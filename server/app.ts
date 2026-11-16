import crypto from 'node:crypto';
import express, { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { computeSurveyAnalytics } from '../src/lib/analyticsEngine.ts';
import {
  AdminUserAccount,
  Campaign,
  CatalogForm,
  CatalogReport,
  Department,
  ProposalStatus,
  SurveyQuestion,
  SurveyResponse,
  SystemConfig,
} from '../src/types/survey.ts';
import {
  AuthenticatedAdminSession,
  authenticateAdminUser,
  changeAdminPassword,
  createAdminUser,
  DbContext,
  deleteQuestionAdmin,
  deleteResponseAdmin,
  getAuthenticatedAdminSession,
  getCampaignBySlug,
  getPrivateResponseByCredentialSession,
  getResponseByIdAdmin,
  getRolePermissionMatrix,
  getSystemSettings,
  initDatabase,
  isCampaignOpenForSubmission,
  listAllCampaignsAdmin,
  listAllCatalogFormsAdmin,
  listAllCatalogReportsAdmin,
  listAllDepartmentsAdmin,
  listAllResponsesAdmin,
  listAdminUsers,
  listAuditLogsAdmin,
  listPublicActiveCampaigns,
  listPublicCatalogForms,
  listPublicDepartments,
  listPublicQuestionsByCampaign,
  listQuestionsAdmin,
  revokeAdminSession,
  revokeCredentialForResponse,
  saveCustomFormPublic,
  submitPublicSurveyResponse,
  updateAdminUser,
  updatePrivateSurveyResponse,
  updateResponseProposalStatus,
  updateSystemSettingsAdmin,
  upsertCampaignAdmin,
  upsertCatalogFormAdmin,
  upsertCatalogReportAdmin,
  upsertDepartmentAdmin,
  upsertQuestionAdmin,
  verifyPrivateAccessCredential,
  writeAuditLog,
} from './db/index.ts';
import {
  appendSetCookie,
  clearCookie,
  corsMiddleware,
  createRateLimiter,
  getClientIp,
  parseCookies,
  securityHeadersMiddleware,
  signCookiePayload,
  verifySignedCookiePayload,
} from './security.ts';

const ADMIN_SESSION_COOKIE = 'mes_admin_session';
const MY_SURVEY_COOKIE = 'mes_my_survey_session';

interface MySurveyCookiePayload extends Record<string, unknown> {
  responseCode: string;
  credentialId: string;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      adminSession?: AuthenticatedAdminSession;
    }
  }
}

const publicSubmitSchema = z.object({
  isAnonymous: z.boolean().default(true),
  departmentId: z.string().min(1).max(80),
  section: z.string().max(120).optional().default(''),
  participantInfo: z.object({
    employeeId: z.string().max(40).optional().default(''),
    fullName: z.string().max(120).optional().default(''),
    departmentId: z.string().min(1).max(80),
    section: z.string().max(120).optional().default(''),
    jobTitle: z.string().min(1).max(80),
    workGroup: z.string().max(80).optional().default(''),
    shift: z.enum(['day', 'night', 'rotating', 'office']).default('day'),
    mesExperience: z.enum(['<6m', '6m-1y', '1-3y', '3-5y', '>5y']).default('1-3y'),
    frequentSystems: z.array(z.string().max(40)).min(1),
    otherSystem: z.string().max(120).optional().default(''),
    surveyDate: z.string().max(32).optional().default(''),
  }),
  selectedForms: z.array(z.any()).default([]),
  selectedReports: z.array(z.any()).default([]),
  workflowEvaluations: z.array(z.any()).default([]),
  dxNeeds: z.array(z.any()).default([]),
  uxRatings: z.record(z.string(), z.number().min(1).max(5)).default({}),
  proposals: z
    .object({
      topImprovement: z.string().max(2000).optional().default(''),
      requestedForms: z.string().max(1000).optional().default(''),
      requestedReports: z.string().max(1000).optional().default(''),
      automationTarget: z.string().max(1000).optional().default(''),
      biggestChallenge: z.string().max(2000).optional().default(''),
      dxProposal: z.string().max(2000).optional().default(''),
      priority: z.enum(['P1', 'P2', 'P3', 'P4']).default('P2'),
      attachmentNames: z.array(z.string().max(200)).optional().default([]),
      customAnswers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    })
    .default({
      topImprovement: '',
      requestedForms: '',
      requestedReports: '',
      automationTarget: '',
      biggestChallenge: '',
      dxProposal: '',
      priority: 'P2',
      attachmentNames: [],
    }),
});

const verifyLookupSchema = z.object({
  responseCode: z.string().min(4).max(64),
  accessToken: z.string().min(12).max(256),
});

const loginSchema = z.object({
  username: z.string().min(2).max(128),
  password: z.string().min(4).max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(4).max(128),
  newPassword: z.string().min(8).max(128),
});

export function createApiApp(opts: { dbPath?: string } = {}): { app: express.Express; dbCtx: DbContext } {
  const dbCtx = initDatabase(opts.dbPath);
  const { db } = dbCtx;

  const app = express();
  app.use(securityHeadersMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '5mb' }));

  const publicApiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 60,
    message: 'Too many requests to the survey portal. Please try again in a minute.',
  });

  const lookupVerifyLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 15,
    message: 'Too many verification attempts. Please wait 60 seconds.',
  });

  const adminLoginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
    message: 'Too many login attempts. Please wait before retrying.',
  });

  // ---------- Middleware Helpers ----------

  function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
    const cookies = parseCookies(req);
    const session = getAuthenticatedAdminSession(db, cookies[ADMIN_SESSION_COOKIE]);
    if (!session) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    req.adminSession = session;
    next();
  }

  function requireCsrf(req: Request, res: Response, next: NextFunction) {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      next();
      return;
    }
    const headerToken = String(req.headers['x-csrf-token'] || '');
    const session = req.adminSession;
    if (!session || !headerToken) {
      res.status(403).json({ error: 'Invalid or missing CSRF token' });
      return;
    }
    const a = Buffer.from(headerToken);
    const b = Buffer.from(session.csrfToken);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(403).json({ error: 'Invalid or missing CSRF token' });
      return;
    }
    next();
  }

  function requirePermission(perm: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const session = req.adminSession;
      if (!session) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      if (!session.permissions.includes(perm)) {
        res.status(403).json({ error: `Forbidden: missing permission "${perm}"` });
        return;
      }
      next();
    };
  }

  function filterByDeptScope(user: AdminUserAccount, responses: SurveyResponse[]): SurveyResponse[] {
    if (!user.departmentScope) return responses;
    return responses.filter((r) => r.departmentId === user.departmentScope);
  }

  // ---------- Health & Metadata ----------

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'smart-mes-survey-portal',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/spec', requireAdminAuth, requirePermission('dashboard:read'), (_req, res) => {
    res.json({
      openapi: '3.0.3',
      service: 'Smart MES & Report Survey Portal API',
      entitiesCount: 15,
    });
  });

  // ---------- Public Survey APIs ----------

  app.get('/api/public/campaigns', publicApiLimiter, (_req, res) => {
    const campaigns = listPublicActiveCampaigns(db);
    const settings = getSystemSettings(db);
    res.json({
      campaigns: campaigns.map((c) => ({
        ...c,
        availability: isCampaignOpenForSubmission(c),
      })),
      defaultLanguage: settings.defaultLanguage,
    });
  });

  app.get('/api/public/campaigns/:slug', publicApiLimiter, (req, res) => {
    const campaign = getCampaignBySlug(db, String(req.params.slug));
    if (!campaign || campaign.status === 'draft' || campaign.status === 'archived') {
      res.status(404).json({ error: 'Survey campaign not found' });
      return;
    }
    const availability = isCampaignOpenForSubmission(campaign);
    const departments = listPublicDepartments(db);
    const catalogForms = listPublicCatalogForms(db);
    const questions = listPublicQuestionsByCampaign(db, campaign.id);
    const settings = getSystemSettings(db);
    res.json({
      campaign,
      availability,
      departments,
      catalogForms,
      questions,
      defaultLanguage: settings.defaultLanguage,
    });
  });

  app.get('/api/public/campaigns/:slug/questions', publicApiLimiter, (req, res) => {
    const campaign = getCampaignBySlug(db, String(req.params.slug));
    if (!campaign || campaign.status === 'draft' || campaign.status === 'archived') {
      res.status(404).json({ error: 'Survey campaign not found' });
      return;
    }
    res.json({
      campaignId: campaign.id,
      questions: listPublicQuestionsByCampaign(db, campaign.id),
    });
  });

  app.post('/api/public/campaigns/:slug/forms', publicApiLimiter, (req, res) => {
    const campaign = getCampaignBySlug(db, String(req.params.slug));
    if (!campaign || !isCampaignOpenForSubmission(campaign).open) {
      res.status(403).json({ error: 'Campaign is not accepting submissions' });
      return;
    }
    const schema = z.object({
      id: z.string().min(2).max(64).optional(),
      groupId: z.enum(['production', 'material', 'equipment', 'quality', 'traceability', 'system']),
      code: z.string().min(2).max(48),
      nameEn: z.string().min(1).max(160),
      nameVi: z.string().min(1).max(160),
      nameKo: z.string().max(160).optional(),
      nameZh: z.string().max(160).optional(),
      description: z.string().max(240).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid form definition' });
      return;
    }
    const form: CatalogForm = {
      id: parsed.data.id || `frm_custom_${crypto.randomUUID().slice(0, 8)}`,
      groupId: parsed.data.groupId,
      code: parsed.data.code.trim().toUpperCase(),
      nameEn: parsed.data.nameEn.trim(),
      nameVi: parsed.data.nameVi.trim(),
      nameKo: parsed.data.nameKo,
      nameZh: parsed.data.nameZh,
      description: parsed.data.description,
      isCustom: true,
      active: true,
    };
    const saved = saveCustomFormPublic(db, form);
    res.status(201).json({ form: saved });
  });

  app.post('/api/public/campaigns/:slug/responses', publicApiLimiter, (req, res) => {
    const campaign = getCampaignBySlug(db, String(req.params.slug));
    if (!campaign) {
      res.status(404).json({ error: 'Survey campaign not found' });
      return;
    }

    const parsed = publicSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return;
    }

    const d = parsed.data;
    const result = submitPublicSurveyResponse(db, campaign, {
      campaignId: campaign.id,
      isAnonymous: d.isAnonymous,
      status: 'submitted',
      departmentId: d.departmentId,
      section: d.section || d.participantInfo.section || '',
      participantInfo: {
        ...d.participantInfo,
        employeeId: d.participantInfo.employeeId || '',
        fullName: d.participantInfo.fullName || '',
        section: d.participantInfo.section || d.section || '',
        workGroup: d.participantInfo.workGroup || '',
        otherSystem: d.participantInfo.otherSystem || '',
        surveyDate: d.participantInfo.surveyDate || new Date().toISOString().slice(0, 10),
      },
      selectedForms: d.selectedForms as SurveyResponse['selectedForms'],
      selectedReports: d.selectedReports as SurveyResponse['selectedReports'],
      workflowEvaluations: d.workflowEvaluations as SurveyResponse['workflowEvaluations'],
      dxNeeds: d.dxNeeds as SurveyResponse['dxNeeds'],
      uxRatings: {
        uiEase: d.uxRatings.uiEase ?? 3,
        searchSpeed: d.uxRatings.searchSpeed ?? 3,
        stepEfficiency: d.uxRatings.stepEfficiency ?? 3,
        pageLoadSpeed: d.uxRatings.pageLoadSpeed ?? 3,
        errorStability: d.uxRatings.errorStability ?? 3,
        dataAccuracy: d.uxRatings.dataAccuracy ?? 4,
        permissionFit: d.uxRatings.permissionFit ?? 4,
        needMobileUi: d.uxRatings.needMobileUi ?? 4,
        needMultilang: d.uxRatings.needMultilang ?? 4,
      },
      proposals: {
        topImprovement: d.proposals.topImprovement || '',
        requestedForms: d.proposals.requestedForms || '',
        requestedReports: d.proposals.requestedReports || '',
        automationTarget: d.proposals.automationTarget || '',
        biggestChallenge: d.proposals.biggestChallenge || '',
        dxProposal: d.proposals.dxProposal || '',
        priority: d.proposals.priority || 'P2',
        attachmentNames: d.proposals.attachmentNames || [],
        customAnswers: d.proposals.customAnswers,
      },
    });

    if (result.ok === false) {
      res.status(result.statusCode).json({ error: result.message, code: result.errorCode });
      return;
    }

    res.status(201).json({
      responseId: result.responseId,
      responseCode: result.responseCode,
      accessToken: result.accessToken,
      submittedAt: result.submittedAt,
      expiresAt: result.expiresAt,
      status: result.status,
      campaignSlug: campaign.slug || campaign.id,
      campaignTitle: campaign.title,
      allowEditAfterSubmit: Boolean(campaign.allowEditAfterSubmit),
    });
  });

  // ---------- Private Result Access (/my-survey) ----------

  app.post('/api/public/my-survey/verify', lookupVerifyLimiter, (req, res) => {
    const parsed = verifyLookupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Response code and access token are required.' });
      return;
    }

    const result = verifyPrivateAccessCredential(db, parsed.data.responseCode, parsed.data.accessToken);
    if (result.ok === false) {
      res.status(result.statusCode).json({ error: result.message, code: result.errorCode });
      return;
    }

    const cookiePayload: MySurveyCookiePayload = {
      responseCode: result.response.responseCode || parsed.data.responseCode.trim().toUpperCase(),
      credentialId: result.credentialId,
      exp: Date.now() + 2 * 60 * 60 * 1000,
    };
    appendSetCookie(res, MY_SURVEY_COOKIE, signCookiePayload(cookiePayload), {
      maxAgeSeconds: 2 * 60 * 60,
      httpOnly: true,
      sameSite: 'Lax',
    });

    res.json({
      response: result.response,
      campaign: result.campaign,
      departments: listPublicDepartments(db),
      catalogForms: listPublicCatalogForms(db),
      credential: {
        status: 'active',
        expiresAt: result.expiresAt,
      },
    });
  });

  app.post('/api/public/my-survey/logout', (_req, res) => {
    clearCookie(res, MY_SURVEY_COOKIE);
    res.json({ ok: true });
  });

  function resolveMySurveyAccess(req: Request, res: Response) {
    // Strictly forbid passing secret token in URL query string
    if (req.query.token || req.query.accessToken) {
      res.status(400).json({
        error: 'Passing access tokens in URL query parameters is forbidden for security.',
        code: 'TOKEN_IN_QUERY_FORBIDDEN',
      });
      return null;
    }

    const targetCode = String(req.params.responseCode || '').trim().toUpperCase();
    const headerToken = String(req.headers['x-survey-access-token'] || '').trim();

    if (headerToken) {
      const check = verifyPrivateAccessCredential(db, targetCode, headerToken);
      if (check.ok === false) {
        res.status(check.statusCode).json({ error: check.message, code: check.errorCode });
        return null;
      }
      return check;
    }

    const cookies = parseCookies(req);
    const cookieData = verifySignedCookiePayload<MySurveyCookiePayload>(cookies[MY_SURVEY_COOKIE]);
    if (!cookieData || Date.now() > cookieData.exp) {
      res.status(401).json({ error: 'Private access verification required.', code: 'AUTH_REQUIRED' });
      return null;
    }

    // IDOR protection: verified cookie must match requested responseCode
    if (cookieData.responseCode.toUpperCase() !== targetCode) {
      res.status(403).json({
        error: 'Access denied: token scope does not match requested response code.',
        code: 'IDOR_FORBIDDEN',
      });
      return null;
    }

    const check = getPrivateResponseByCredentialSession(db, targetCode, cookieData.credentialId);
    if (check.ok === false) {
      res.status(check.statusCode).json({ error: check.message, code: check.errorCode });
      return null;
    }
    return check;
  }

  app.get('/api/public/my-survey/:responseCode', publicApiLimiter, (req, res) => {
    const resolved = resolveMySurveyAccess(req, res);
    if (!resolved) return;
    res.json({
      response: resolved.response,
      campaign: resolved.campaign,
      departments: listPublicDepartments(db),
      catalogForms: listPublicCatalogForms(db),
      credential: {
        status: 'active',
        expiresAt: resolved.expiresAt,
      },
    });
  });

  app.put('/api/public/my-survey/:responseCode', publicApiLimiter, (req, res) => {
    const resolved = resolveMySurveyAccess(req, res);
    if (!resolved) return;

    const updated = updatePrivateSurveyResponse(db, resolved.response, resolved.campaign, req.body || {});
    if (updated.ok === false) {
      res.status(updated.statusCode).json({ error: updated.message, code: updated.errorCode });
      return;
    }
    res.json({
      response: updated.response,
      campaign: resolved.campaign,
    });
  });

  // ---------- Admin Auth Routes ----------

  app.post('/api/admin/auth/login', adminLoginLimiter, (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }
    const result = authenticateAdminUser(
      db,
      parsed.data.username,
      parsed.data.password,
      getClientIp(req),
      String(req.headers['user-agent'] || '')
    );
    if (result.ok === false) {
      res.status(result.statusCode).json({ error: result.message });
      return;
    }

    appendSetCookie(res, ADMIN_SESSION_COOKIE, result.sessionToken, {
      maxAgeSeconds: 12 * 60 * 60,
      httpOnly: true,
      sameSite: 'Lax',
    });

    res.json({
      user: result.user,
      permissions: result.permissions,
      csrfToken: result.csrfToken,
      expiresAt: result.expiresAt,
    });
  });

  app.post('/api/admin/auth/logout', requireAdminAuth, requireCsrf, (req, res) => {
    const s = req.adminSession!;
    revokeAdminSession(db, s.sessionId);
    writeAuditLog(db, {
      actorId: s.user.id,
      actorUsername: s.user.username,
      action: 'ADMIN_LOGOUT',
      resourceType: 'admin_session',
      resourceId: s.sessionId,
      details: 'Signed out',
      ipAddress: getClientIp(req),
    });
    clearCookie(res, ADMIN_SESSION_COOKIE);
    res.json({ ok: true });
  });

  app.get('/api/admin/auth/me', requireAdminAuth, (req, res) => {
    const s = req.adminSession!;
    res.json({
      user: s.user,
      permissions: s.permissions,
      csrfToken: s.csrfToken,
    });
  });

  app.post('/api/admin/auth/change-password', requireAdminAuth, requireCsrf, (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }
    const s = req.adminSession!;
    const out = changeAdminPassword(db, s.user.id, parsed.data.currentPassword, parsed.data.newPassword);
    if (!out.ok) {
      res.status(400).json({ error: out.message });
      return;
    }
    writeAuditLog(db, {
      actorId: s.user.id,
      actorUsername: s.user.username,
      action: 'ADMIN_PASSWORD_CHANGED',
      resourceType: 'admin_user',
      resourceId: s.user.id,
      details: 'Password updated by user',
      ipAddress: getClientIp(req),
    });
    res.json({ ok: true, message: out.message });
  });

  // ---------- Protected Admin Portal Routes ----------

  app.get('/api/admin/dashboard', requireAdminAuth, requirePermission('dashboard:read'), (req, res) => {
    const s = req.adminSession!;
    const responses = filterByDeptScope(s.user, listAllResponsesAdmin(db));
    const campaigns = listAllCampaignsAdmin(db);
    const departments = listAllDepartmentsAdmin(db);
    const catalogForms = listAllCatalogFormsAdmin(db);
    const catalogReports = listAllCatalogReportsAdmin(db);
    const questions = listQuestionsAdmin(db);
    const systemConfig = getSystemSettings(db);
    const auditLogs = s.permissions.includes('audit:read') ? listAuditLogsAdmin(db, 100) : [];
    const users = s.permissions.includes('users:read') ? listAdminUsers(db) : [];

    res.json({
      campaigns,
      departments,
      catalogForms,
      catalogReports,
      questions,
      responses,
      systemConfig,
      auditLogs,
      users,
    });
  });

  app.get('/api/admin/analytics', requireAdminAuth, requirePermission('analytics:read'), (req, res) => {
    const s = req.adminSession!;
    const responses = filterByDeptScope(s.user, listAllResponsesAdmin(db));
    const departments = listAllDepartmentsAdmin(db);
    const catalogForms = listAllCatalogFormsAdmin(db);
    const catalogReports = listAllCatalogReportsAdmin(db);
    const settings = getSystemSettings(db);
    const campaigns = listAllCampaignsAdmin(db);
    const activeCamp = campaigns.find((c) => c.status === 'active') || campaigns[0];

    const analytics = computeSurveyAnalytics(
      responses,
      departments,
      catalogForms,
      catalogReports,
      activeCamp?.targetParticipants || 120,
      settings.minSampleThreshold
    );
    res.json(analytics);
  });

  app.get('/api/admin/reports', requireAdminAuth, requirePermission('reports:read'), (req, res) => {
    const s = req.adminSession!;
    const responses = filterByDeptScope(s.user, listAllResponsesAdmin(db));
    const departments = listAllDepartmentsAdmin(db);
    const catalogForms = listAllCatalogFormsAdmin(db);
    const catalogReports = listAllCatalogReportsAdmin(db);
    const settings = getSystemSettings(db);
    const analytics = computeSurveyAnalytics(
      responses,
      departments,
      catalogForms,
      catalogReports,
      120,
      settings.minSampleThreshold
    );
    res.json({
      generatedAt: new Date().toISOString(),
      sampleCount: analytics.sampleCount,
      responseRatePct: analytics.responseRatePct,
      priorityMatrix: analytics.priorityMatrix,
      departmentCoverage: analytics.formsByDepartment,
    });
  });

  app.post('/api/analytics/priority-matrix', requireAdminAuth, requirePermission('analytics:read'), (req, res) => {
    try {
      const s = req.adminSession!;
      const body = req.body as {
        responses?: SurveyResponse[];
        targetParticipants?: number;
        minSampleThreshold?: number;
      };
      const responses =
        Array.isArray(body.responses) && body.responses.length > 0
          ? body.responses
          : filterByDeptScope(s.user, listAllResponsesAdmin(db));
      const result = computeSurveyAnalytics(
        responses,
        listAllDepartmentsAdmin(db),
        listAllCatalogFormsAdmin(db),
        listAllCatalogReportsAdmin(db),
        body.targetParticipants ?? 120,
        body.minSampleThreshold ?? 5
      );
      res.json({
        sampleCount: result.sampleCount,
        responseRatePct: result.responseRatePct,
        meetsSampleThreshold: result.meetsSampleThreshold,
        priorityMatrix: result.priorityMatrix,
        automatableHoursPerWeek: result.automatableHoursPerWeek,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid analytics payload' });
    }
  });

  app.post('/api/export/requirements-json', requireAdminAuth, requirePermission('reports:export'), (req, res) => {
    try {
      const s = req.adminSession!;
      const body = req.body as { responses?: SurveyResponse[]; targetParticipants?: number };
      const responses =
        Array.isArray(body.responses) && body.responses.length > 0
          ? body.responses
          : filterByDeptScope(s.user, listAllResponsesAdmin(db));
      const result = computeSurveyAnalytics(
        responses,
        listAllDepartmentsAdmin(db),
        listAllCatalogFormsAdmin(db),
        listAllCatalogReportsAdmin(db),
        body.targetParticipants ?? 120,
        5
      );
      res.setHeader('Content-Disposition', 'attachment; filename="mes_brd_spec.json"');
      res.json({
        generatedAt: new Date().toISOString(),
        sampleCount: result.sampleCount,
        responseRatePct: result.responseRatePct,
        requirements: result.priorityMatrix,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to generate BRD JSON' });
    }
  });

  // Responses & Token Revocation
  app.get('/api/admin/responses', requireAdminAuth, requirePermission('responses:read'), (req, res) => {
    const s = req.adminSession!;
    res.json({ responses: filterByDeptScope(s.user, listAllResponsesAdmin(db)) });
  });

  app.get('/api/admin/responses/:id', requireAdminAuth, requirePermission('responses:read'), (req, res) => {
    const s = req.adminSession!;
    const resp = getResponseByIdAdmin(db, String(req.params.id));
    if (!resp) {
      res.status(404).json({ error: 'Response not found' });
      return;
    }
    if (s.user.departmentScope && resp.departmentId !== s.user.departmentScope) {
      res.status(403).json({ error: 'Forbidden for this department scope' });
      return;
    }
    res.json({ response: resp });
  });

  app.patch(
    '/api/admin/responses/:id/proposal-status',
    requireAdminAuth,
    requireCsrf,
    requirePermission('responses:write'),
    (req, res) => {
      const schema = z.object({
        proposalStatus: z.enum(['pending', 'reviewing', 'approved', 'in_progress', 'completed']),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid proposal status' });
        return;
      }
      const id = String(req.params.id);
      const ok = updateResponseProposalStatus(db, id, parsed.data.proposalStatus as ProposalStatus);
      if (!ok) {
        res.status(404).json({ error: 'Response not found' });
        return;
      }
      const s = req.adminSession!;
      writeAuditLog(db, {
        actorId: s.user.id,
        actorUsername: s.user.username,
        action: 'PROPOSAL_STATUS_UPDATED',
        resourceType: 'survey_response',
        resourceId: id,
        details: `Proposal status set to ${parsed.data.proposalStatus}`,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true, proposalStatus: parsed.data.proposalStatus });
    }
  );

  app.delete(
    '/api/admin/responses/:id',
    requireAdminAuth,
    requireCsrf,
    requirePermission('responses:delete'),
    (req, res) => {
      const id = String(req.params.id);
      const ok = deleteResponseAdmin(db, id);
      if (!ok) {
        res.status(404).json({ error: 'Response not found' });
        return;
      }
      const s = req.adminSession!;
      writeAuditLog(db, {
        actorId: s.user.id,
        actorUsername: s.user.username,
        action: 'RESPONSE_DELETED',
        resourceType: 'survey_response',
        resourceId: id,
        details: `Deleted response ${id}`,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true });
    }
  );

  app.post(
    '/api/admin/credentials/:responseId/revoke',
    requireAdminAuth,
    requireCsrf,
    requirePermission('credentials:revoke'),
    (req, res) => {
      const responseId = String(req.params.responseId);
      const count = revokeCredentialForResponse(db, responseId);
      const s = req.adminSession!;
      writeAuditLog(db, {
        actorId: s.user.id,
        actorUsername: s.user.username,
        action: 'ACCESS_TOKEN_REVOKED',
        resourceType: 'survey_access_credential',
        resourceId: responseId,
        details: `Revoked ${count} active access credential(s) for response ${responseId}`,
        ipAddress: getClientIp(req),
      });
      res.json({ ok: true, revokedCount: count });
    }
  );

  // Campaigns
  app.get('/api/admin/campaigns', requireAdminAuth, requirePermission('campaigns:read'), (_req, res) => {
    res.json({ campaigns: listAllCampaignsAdmin(db) });
  });

  app.post('/api/admin/campaigns', requireAdminAuth, requireCsrf, requirePermission('campaigns:write'), (req, res) => {
    const s = req.adminSession!;
    const body = req.body as Campaign;
    if (!body?.title?.trim()) {
      res.status(400).json({ error: 'Campaign title is required' });
      return;
    }
    const saved = upsertCampaignAdmin(db, {
      ...body,
      id: body.id || `camp_${crypto.randomUUID().slice(0, 8)}`,
      createdBy: body.createdBy || s.user.username,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    writeAuditLog(db, {
      actorId: s.user.id,
      actorUsername: s.user.username,
      action: 'CAMPAIGN_SAVED',
      resourceType: 'survey_campaign',
      resourceId: saved.id,
      details: `Saved campaign "${saved.title}" (${saved.status})`,
      ipAddress: getClientIp(req),
    });
    res.status(201).json({ campaign: saved });
  });

  app.put('/api/admin/campaigns/:id', requireAdminAuth, requireCsrf, requirePermission('campaigns:write'), (req, res) => {
    const s = req.adminSession!;
    const body = req.body as Campaign;
    const saved = upsertCampaignAdmin(db, {
      ...body,
      id: String(req.params.id),
      updatedAt: new Date().toISOString(),
    });
    writeAuditLog(db, {
      actorId: s.user.id,
      actorUsername: s.user.username,
      action: 'CAMPAIGN_UPDATED',
      resourceType: 'survey_campaign',
      resourceId: saved.id,
      details: `Updated campaign "${saved.title}" (${saved.status})`,
      ipAddress: getClientIp(req),
    });
    res.json({ campaign: saved });
  });

  // Questions
  app.get('/api/admin/questions', requireAdminAuth, requirePermission('questions:read'), (req, res) => {
    const campaignId = req.query.campaignId ? String(req.query.campaignId) : undefined;
    res.json({ questions: listQuestionsAdmin(db, campaignId) });
  });

  app.post('/api/admin/questions', requireAdminAuth, requireCsrf, requirePermission('questions:write'), (req, res) => {
    const s = req.adminSession!;
    const { campaignId = 'camp_mes_dx_2026', question } = req.body as {
      campaignId?: string;
      question: SurveyQuestion;
    };
    if (!question?.labelEn?.trim()) {
      res.status(400).json({ error: 'Question label is required' });
      return;
    }
    const saved = upsertQuestionAdmin(db, campaignId, question);
    writeAuditLog(db, {
      actorId: s.user.id,
      actorUsername: s.user.username,
      action: 'QUESTION_SAVED',
      resourceType: 'survey_question',
      resourceId: saved.id,
      details: `Saved question in section ${saved.section}`,
      ipAddress: getClientIp(req),
    });
    res.status(201).json({ question: saved });
  });

  app.delete('/api/admin/questions/:id', requireAdminAuth, requireCsrf, requirePermission('questions:write'), (req, res) => {
    const s = req.adminSession!;
    const ok = deleteQuestionAdmin(db, String(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    writeAuditLog(db, {
      actorId: s.user.id,
      actorUsername: s.user.username,
      action: 'QUESTION_DELETED',
      resourceType: 'survey_question',
      resourceId: String(req.params.id),
      details: 'Deleted dynamic survey question',
      ipAddress: getClientIp(req),
    });
    res.json({ ok: true });
  });

  // Catalogs & Departments
  app.post('/api/admin/catalogs/forms', requireAdminAuth, requireCsrf, requirePermission('catalogs:write'), (req, res) => {
    const form = req.body as CatalogForm;
    if (!form?.code || !form?.nameEn) {
      res.status(400).json({ error: 'Form code and nameEn are required' });
      return;
    }
    const saved = upsertCatalogFormAdmin(db, form);
    res.status(201).json({ form: saved });
  });

  app.post('/api/admin/catalogs/reports', requireAdminAuth, requireCsrf, requirePermission('catalogs:write'), (req, res) => {
    const report = req.body as CatalogReport;
    if (!report?.code || !report?.nameEn) {
      res.status(400).json({ error: 'Report code and nameEn are required' });
      return;
    }
    const saved = upsertCatalogReportAdmin(db, report);
    res.status(201).json({ report: saved });
  });

  app.post('/api/admin/departments', requireAdminAuth, requireCsrf, requirePermission('catalogs:write'), (req, res) => {
    const s = req.adminSession!;
    const dept = req.body as Department;
    if (!dept?.code || !dept?.nameEn) {
      res.status(400).json({ error: 'Department code and nameEn are required' });
      return;
    }
    const saved = upsertDepartmentAdmin(db, dept);
    writeAuditLog(db, {
      actorId: s.user.id,
      actorUsername: s.user.username,
      action: 'DEPARTMENT_SAVED',
      resourceType: 'department',
      resourceId: saved.id,
      details: `Saved department ${saved.code}`,
      ipAddress: getClientIp(req),
    });
    res.status(201).json({ department: saved });
  });

  // System Settings
  app.get('/api/admin/settings', requireAdminAuth, requirePermission('settings:read'), (_req, res) => {
    res.json({ settings: getSystemSettings(db) });
  });

  app.put('/api/admin/settings', requireAdminAuth, requireCsrf, requirePermission('settings:write'), (req, res) => {
    const s = req.adminSession!;
    const cfg = req.body as SystemConfig;
    const saved = updateSystemSettingsAdmin(db, {
      ...cfg,
      updatedBy: s.user.username,
      updatedAt: new Date().toISOString(),
    });
    writeAuditLog(db, {
      actorId: s.user.id,
      actorUsername: s.user.username,
      action: 'SYSTEM_CONFIG_UPDATED',
      resourceType: 'system_settings',
      resourceId: 'default',
      details: `Updated defaultLang=${saved.defaultLanguage}, minSample=${saved.minSampleThreshold}, tokenTtlDays=${saved.tokenTtlDays}`,
      ipAddress: getClientIp(req),
    });
    res.json({ settings: saved });
  });

  // Admin Users & RBAC (Strictly SUPER_ADMIN)
  app.get('/api/admin/users', requireAdminAuth, requirePermission('users:read'), (_req, res) => {
    res.json({
      users: listAdminUsers(db),
      roles: getRolePermissionMatrix(db),
    });
  });

  app.post('/api/admin/users', requireAdminAuth, requireCsrf, requirePermission('users:write'), (req, res) => {
    const schema = z.object({
      username: z.string().min(3).max(40),
      email: z.string().email(),
      fullName: z.string().min(1).max(120),
      password: z.string().min(8).max(128),
      roleCode: z.enum(['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'RESPONDENT']),
      departmentScope: z.string().max(64).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid admin user payload' });
      return;
    }
    try {
      const created = createAdminUser(db, parsed.data);
      const s = req.adminSession!;
      writeAuditLog(db, {
        actorId: s.user.id,
        actorUsername: s.user.username,
        action: 'ADMIN_USER_CREATED',
        resourceType: 'admin_user',
        resourceId: created.id,
        details: `Created user ${created.username} (${created.roleCode})`,
        ipAddress: getClientIp(req),
      });
      res.status(201).json({ user: created });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : 'Failed to create user' });
    }
  });

  app.patch('/api/admin/users/:id', requireAdminAuth, requireCsrf, requirePermission('users:write'), (req, res) => {
    const schema = z.object({
      fullName: z.string().min(1).max(120).optional(),
      roleCode: z.enum(['SUPER_ADMIN', 'ADMIN', 'ANALYST', 'RESPONDENT']).optional(),
      status: z.enum(['active', 'suspended']).optional(),
      departmentScope: z.string().max(64).optional(),
      password: z.string().min(8).max(128).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid user update payload' });
      return;
    }
    const targetId = String(req.params.id);
    const updated = updateAdminUser(db, targetId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const s = req.adminSession!;
    writeAuditLog(db, {
      actorId: s.user.id,
      actorUsername: s.user.username,
      action: 'ADMIN_USER_UPDATED',
      resourceType: 'admin_user',
      resourceId: targetId,
      details: `Updated user ${updated.username} (role=${updated.roleCode}, status=${updated.status})`,
      ipAddress: getClientIp(req),
    });
    res.json({ user: updated });
  });

  app.get('/api/admin/audit-logs', requireAdminAuth, requirePermission('audit:read'), (_req, res) => {
    res.json({ auditLogs: listAuditLogsAdmin(db, 200) });
  });

  // Never fall through /api/* to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  return { app, dbCtx };
}
