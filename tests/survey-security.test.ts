import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import { createApiApp } from '../server/app.ts';
import type { DbContext } from '../server/db/index.ts';
import {
  generateAccessToken,
  hashAccessToken,
  hashPassword,
  verifyPassword,
  verifyTokenHash,
} from '../server/security.ts';

function extractCookie(setCookieHeaders: string[] | string | undefined, name: string): string | null {
  if (!setCookieHeaders) return null;
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const raw of list) {
    const firstPart = raw.split(';')[0] || '';
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = firstPart.slice(0, eqIdx).trim();
    const val = firstPart.slice(eqIdx + 1).trim();
    if (key === name) {
      return val;
    }
  }
  return null;
}

function getRawSetCookies(res: Response): string[] {
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[]; get: (k: string) => string | null };
  if (typeof anyHeaders.getSetCookie === 'function') {
    return anyHeaders.getSetCookie();
  }
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function makeSampleSubmission(overrides: Record<string, unknown> = {}) {
  return {
    isAnonymous: false,
    departmentId: 'dept_prod',
    section: 'Line SMT-01',
    participantInfo: {
      employeeId: 'EMP9001',
      fullName: 'Nguyen Van A',
      departmentId: 'dept_prod',
      section: 'Line SMT-01',
      jobTitle: 'engineer',
      workGroup: '',
      shift: 'day',
      mesExperience: '1-3y',
      frequentSystems: ['MES', 'Web Report'],
      otherSystem: '',
      surveyDate: '2026-05-01',
    },
    selectedForms: [
      {
        formId: 'frm_prod_order',
        formName: 'Production Order',
        groupId: 'production',
        isCustom: false,
        purpose: 'Production work order tracking',
        frequency: 'daily',
        avgMinutes: 45,
        userCount: 12,
        importance: 5,
        usability: 3,
        businessFit: 3,
        usedFeatures: 'Create/View',
        unusedFeatures: '',
        authorizedUsers: 'Line Leader, Operator',
        importanceLevel: 'high_urgent',
        improvements: 'Auto barcode scan & zero duplicate entry',
        painPoints: 'Slow load and manual reentry',
      },
    ],
    selectedReports: [],
    workflowEvaluations: [],
    dxNeeds: [],
    uxRatings: {
      uiEase: 3,
      searchSpeed: 3,
      stepEfficiency: 3,
      pageLoadSpeed: 3,
      errorStability: 3,
      dataAccuracy: 4,
      permissionFit: 4,
      needMobileUi: 5,
      needMultilang: 4,
    },
    proposals: {
      topImprovement: 'Faster mobile input',
      requestedForms: 'MES Mobile Defect Entry',
      requestedReports: 'Real-time Line Yield',
      automationTarget: 'Auto-sync ERP work orders',
      biggestChallenge: 'Manual Excel reconciliation',
      dxProposal: 'Unified dashboard & QR traceability',
      priority: 'P1',
      attachmentNames: [],
    },
    ...overrides,
  };
}

describe('Unit Tests: Cryptography, Tokens & Password Hashing', () => {
  it('generates 256-bit CSPRNG access tokens that are unique and prefixed', () => {
    const t1 = generateAccessToken();
    const t2 = generateAccessToken();
    expect(t1.startsWith('mes_tk_')).toBe(true);
    expect(t2.startsWith('mes_tk_')).toBe(true);
    expect(t1).not.toBe(t2);
    // 32 random bytes base64url = 43 chars + 7 chars prefix = 50 chars
    expect(t1.length).toBeGreaterThanOrEqual(50);
  });

  it('hashes access tokens with keyed HMAC-SHA256 and verifies in constant time without storing plaintext', () => {
    const raw = generateAccessToken();
    const digest = hashAccessToken(raw);
    expect(digest).not.toBe(raw);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyTokenHash(raw, digest)).toBe(true);
    expect(verifyTokenHash(`${raw}x`, digest)).toBe(false);
    expect(verifyTokenHash('', digest)).toBe(false);
  });

  it('hashes passwords with scrypt per-user salt and verifies correctly', () => {
    const h1 = hashPassword('MesAdmin#2026');
    const h2 = hashPassword('MesAdmin#2026');
    expect(h1).not.toBe(h2); // Unique random salts
    expect(h1.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('MesAdmin#2026', h1)).toBe(true);
    expect(verifyPassword('WrongPassword', h1)).toBe(false);
  });
});

describe('Integration & E2E Acceptance Tests: Public Survey, Private Lookup & Admin RBAC', () => {
  let server: http.Server;
  let baseUrl = '';
  let dbCtx: DbContext;

  let receiptA: {
    responseId: string;
    responseCode: string;
    accessToken: string;
  };
  let receiptB: {
    responseId: string;
    responseCode: string;
    accessToken: string;
  };
  let cookieJarA = '';

  let adminCookie = '';
  let adminCsrf = '';
  let analystCookie = '';
  let analystCsrf = '';
  let superAdminCookie = '';
  let superAdminCsrf = '';

  beforeAll(async () => {
    const created = createApiApp({ dbPath: ':memory:' });
    dbCtx = created.dbCtx;
    server = http.createServer(created.app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    dbCtx.close();
  });

  it('AT1: Public user can inspect active campaigns without login and zero aggregate leakage', async () => {
    const res = await fetch(`${baseUrl}/api/public/campaigns`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { campaigns: { id: string; slug: string }[] };
    expect(Array.isArray(data.campaigns)).toBe(true);
    expect(data.campaigns.some((c) => c.slug === 'mes-dx-2026')).toBe(true);

    const detailRes = await fetch(`${baseUrl}/api/public/campaigns/mes-dx-2026`);
    expect(detailRes.status).toBe(200);
    const detail = (await detailRes.json()) as Record<string, unknown>;
    expect(detail.campaign).toBeDefined();
    expect(detail.departments).toBeDefined();
    expect(detail.catalogForms).toBeDefined();
    expect(detail.responses).toBeUndefined();
    expect(detail.auditLogs).toBeUndefined();
  });

  it('AT2: Public submission creates response, returns CSPRNG token once, and stores only hash in DB', async () => {
    const resA = await fetch(`${baseUrl}/api/public/campaigns/mes-dx-2026/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeSampleSubmission()),
    });
    expect(resA.status).toBe(201);
    const bodyA = (await resA.json()) as {
      responseId: string;
      responseCode: string;
      accessToken: string;
      status: string;
    };
    expect(bodyA.responseId).toBeTruthy();
    expect(bodyA.responseCode).toMatch(/^MES-\d{4}-[0-9A-F]{8}$/);
    expect(bodyA.accessToken.startsWith('mes_tk_')).toBe(true);
    expect(bodyA.status).toBe('submitted');
    receiptA = bodyA;

    // Verify DB does NOT contain plaintext accessToken
    const credRow = dbCtx.db
      .prepare('SELECT token_hash FROM survey_access_credentials WHERE response_id = ?')
      .get(receiptA.responseId) as { token_hash: string } | undefined;
    expect(credRow).toBeDefined();
    expect(credRow!.token_hash).not.toBe(receiptA.accessToken);
    expect(credRow!.token_hash).toBe(hashAccessToken(receiptA.accessToken));

    // Submit second response B for IDOR testing
    const resB = await fetch(`${baseUrl}/api/public/campaigns/mes-dx-2026/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        makeSampleSubmission({
          departmentId: 'dept_qaqc',
          participantInfo: {
            employeeId: 'EMP9002',
            fullName: 'Tran Thi B',
            departmentId: 'dept_qaqc',
            section: 'OQC Lab',
            jobTitle: 'supervisor',
            shift: 'day',
            mesExperience: '3-5y',
            frequentSystems: ['MES', 'SPC'],
          },
        })
      ),
    });
    expect(resB.status).toBe(201);
    receiptB = (await resB.json()) as typeof receiptB;
    expect(receiptB.responseCode).not.toBe(receiptA.responseCode);
  });

  it('AT3: Valid responseCode + accessToken unlocks isolated /my-survey response and rejects query-param tokens', async () => {
    // Passing token via URL query string must be strictly rejected
    const queryReject = await fetch(
      `${baseUrl}/api/public/my-survey/${receiptA.responseCode}?token=${encodeURIComponent(receiptA.accessToken)}`
    );
    expect(queryReject.status).toBe(400);

    const verifyRes = await fetch(`${baseUrl}/api/public/my-survey/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseCode: receiptA.responseCode,
        accessToken: receiptA.accessToken,
      }),
    });
    expect(verifyRes.status).toBe(200);
    const rawCookies = getRawSetCookies(verifyRes);
    const cookieVal = extractCookie(rawCookies, 'mes_my_survey_session');
    expect(cookieVal).toBeTruthy();
    expect(rawCookies.join(';')).toContain('HttpOnly');
    cookieJarA = `mes_my_survey_session=${cookieVal}`;

    const verifyBody = (await verifyRes.json()) as { response: { responseCode: string; participantInfo: { employeeId: string } } };
    expect(verifyBody.response.responseCode).toBe(receiptA.responseCode);
    expect(verifyBody.response.participantInfo.employeeId).toBe('EMP9001');

    // Follow-up GET with scoped cookie returns strictly receiptA
    const getRes = await fetch(`${baseUrl}/api/public/my-survey/${receiptA.responseCode}`, {
      headers: { Cookie: cookieJarA },
    });
    expect(getRes.status).toBe(200);

    // Campaign mes-dx-2026 has allowEditAfterSubmit=true, so participant can update their own submission
    const editOk = await fetch(`${baseUrl}/api/public/my-survey/${receiptA.responseCode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieJarA },
      body: JSON.stringify({
        proposals: {
          topImprovement: 'Updated improvement proposal',
          requestedForms: 'MES Mobile Defect Entry',
          requestedReports: 'Real-time Line Yield',
          automationTarget: 'Auto-sync ERP work orders',
          biggestChallenge: 'Manual Excel reconciliation',
          dxProposal: 'Unified dashboard & QR traceability',
          priority: 'P1',
          attachmentNames: [],
        },
      }),
    });
    expect(editOk.status).toBe(200);
    const editedBody = (await editOk.json()) as { response: { proposals: { topImprovement: string } } };
    expect(editedBody.response.proposals.topImprovement).toBe('Updated improvement proposal');
  });

  it('AT4: Wrong accessToken returns 401 and sets no cookie', async () => {
    const res = await fetch(`${baseUrl}/api/public/my-survey/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseCode: receiptA.responseCode,
        accessToken: 'mes_tk_invalid_wrong_token_value_123456',
      }),
    });
    expect(res.status).toBe(401);
    expect(extractCookie(getRawSetCookies(res), 'mes_my_survey_session')).toBeNull();
  });

  it('AT5 (IDOR Prevention): Cookie scoped to Response A cannot access Response B', async () => {
    const idorRes = await fetch(`${baseUrl}/api/public/my-survey/${receiptB.responseCode}`, {
      headers: { Cookie: cookieJarA },
    });
    expect(idorRes.status).toBe(403);
    const errBody = (await idorRes.json()) as { code?: string };
    expect(errBody.code).toBe('IDOR_FORBIDDEN');
  });

  it('AT6: Unauthenticated Admin API endpoints return 401 Unauthorized', async () => {
    const endpoints = [
      '/api/admin/dashboard',
      '/api/admin/responses',
      '/api/admin/analytics',
      '/api/admin/reports',
      '/api/admin/users',
      '/api/admin/settings',
      '/api/admin/audit-logs',
    ];
    for (const ep of endpoints) {
      const r = await fetch(`${baseUrl}${ep}`);
      expect(r.status).toBe(401);
    }
    const exportUnauth = await fetch(`${baseUrl}/api/export/requirements-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(exportUnauth.status).toBe(401);
  });

  it('AT7 & AT8: Admin logs in with scrypt verification, gets HttpOnly session + CSRF, and reads dashboard/responses/analytics', async () => {
    const loginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'MesAdmin#2026' }),
    });
    expect(loginRes.status).toBe(200);
    const rawCookies = getRawSetCookies(loginRes);
    const sessVal = extractCookie(rawCookies, 'mes_admin_session');
    expect(sessVal).toBeTruthy();
    expect(rawCookies.join(';')).toContain('HttpOnly');
    adminCookie = `mes_admin_session=${sessVal}`;

    const loginData = (await loginRes.json()) as { user: { roleCode: string }; csrfToken: string };
    expect(loginData.user.roleCode).toBe('ADMIN');
    expect(loginData.csrfToken).toBeTruthy();
    adminCsrf = loginData.csrfToken;

    const dashRes = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { Cookie: adminCookie },
    });
    expect(dashRes.status).toBe(200);
    const dashData = (await dashRes.json()) as { responses: { responseCode: string }[]; campaigns: unknown[] };
    expect(dashData.responses.some((r) => r.responseCode === receiptA.responseCode)).toBe(true);

    const analyticsRes = await fetch(`${baseUrl}/api/admin/analytics`, {
      headers: { Cookie: adminCookie },
    });
    expect(analyticsRes.status).toBe(200);
  });

  it('AT9 (RBAC & CSRF): Analyst has read-only analytics access and gets 403 on mutations/users/settings; CSRF is enforced', async () => {
    // 1. CSRF check on admin mutation without header
    const noCsrf = await fetch(`${baseUrl}/api/admin/responses/${receiptA.responseId}/proposal-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({ proposalStatus: 'approved' }),
    });
    expect(noCsrf.status).toBe(403);

    // Admin WITH CSRF succeeds
    const withCsrf = await fetch(`${baseUrl}/api/admin/responses/${receiptA.responseId}/proposal-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
        'X-CSRF-Token': adminCsrf,
      },
      body: JSON.stringify({ proposalStatus: 'approved' }),
    });
    expect(withCsrf.status).toBe(200);

    // 2. ADMIN role cannot read /api/admin/users (SUPER_ADMIN only)
    const adminUsersRes = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Cookie: adminCookie },
    });
    expect(adminUsersRes.status).toBe(403);

    // 3. ANALYST login
    const analystLogin = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'analyst', password: 'MesAnalyst#2026' }),
    });
    expect(analystLogin.status).toBe(200);
    analystCookie = `mes_admin_session=${extractCookie(getRawSetCookies(analystLogin), 'mes_admin_session')}`;
    analystCsrf = ((await analystLogin.json()) as { csrfToken: string }).csrfToken;

    // Analyst can read dashboard, analytics, reports, responses
    expect((await fetch(`${baseUrl}/api/admin/dashboard`, { headers: { Cookie: analystCookie } })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/admin/analytics`, { headers: { Cookie: analystCookie } })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/admin/reports`, { headers: { Cookie: analystCookie } })).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/admin/responses`, { headers: { Cookie: analystCookie } })).status).toBe(200);

    // Analyst gets 403 on settings, users, audit-logs, campaign creation, and proposal updates
    expect((await fetch(`${baseUrl}/api/admin/users`, { headers: { Cookie: analystCookie } })).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/admin/settings`, { headers: { Cookie: analystCookie } })).status).toBe(403);
    expect((await fetch(`${baseUrl}/api/admin/audit-logs`, { headers: { Cookie: analystCookie } })).status).toBe(403);
    expect(
      (
        await fetch(`${baseUrl}/api/admin/campaigns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: analystCookie, 'X-CSRF-Token': analystCsrf },
          body: JSON.stringify({ title: 'Unauthorized Campaign' }),
        })
      ).status
    ).toBe(403);

    // 4. SUPER_ADMIN can manage users
    const superLogin = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadmin', password: 'MesAdmin#2026' }),
    });
    expect(superLogin.status).toBe(200);
    superAdminCookie = `mes_admin_session=${extractCookie(getRawSetCookies(superLogin), 'mes_admin_session')}`;
    superAdminCsrf = ((await superLogin.json()) as { csrfToken: string }).csrfToken;

    const usersRes = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Cookie: superAdminCookie },
    });
    expect(usersRes.status).toBe(200);
  });

  it('AT10: Authenticated admin exports BRD requirements JSON cleanly', async () => {
    const expRes = await fetch(`${baseUrl}/api/export/requirements-json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
        'X-CSRF-Token': adminCsrf,
      },
      body: '{}',
    });
    expect(expRes.status).toBe(200);
    expect(expRes.headers.get('content-disposition')).toContain('mes_brd_spec.json');
    const json = (await expRes.json()) as { sampleCount: number; requirements: unknown[] };
    expect(json.sampleCount).toBeGreaterThan(0);
    expect(Array.isArray(json.requirements)).toBe(true);
  });

  it('AT11: Revoking private access token immediately invalidates both lookup and active cookie', async () => {
    const revokeRes = await fetch(`${baseUrl}/api/admin/credentials/${receiptA.responseId}/revoke`, {
      method: 'POST',
      headers: {
        Cookie: adminCookie,
        'X-CSRF-Token': adminCsrf,
      },
    });
    expect(revokeRes.status).toBe(200);

    // Re-verifying with raw token must fail with 403 TOKEN_REVOKED
    const verifyRevoked = await fetch(`${baseUrl}/api/public/my-survey/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseCode: receiptA.responseCode,
        accessToken: receiptA.accessToken,
      }),
    });
    expect(verifyRevoked.status).toBe(403);
    expect(((await verifyRevoked.json()) as { code: string }).code).toBe('TOKEN_REVOKED');

    // Previously issued cookie must also be rejected immediately
    const cookieRevoked = await fetch(`${baseUrl}/api/public/my-survey/${receiptA.responseCode}`, {
      headers: { Cookie: cookieJarA },
    });
    expect(cookieRevoked.status).toBe(403);
    expect(((await cookieRevoked.json()) as { code: string }).code).toBe('TOKEN_REVOKED');
  });

  it('AT12: Expired tokens are rejected with 403 TOKEN_EXPIRED and campaign policies (edit/duplicate) are enforced', async () => {
    // 1. Backdate receiptB credential expiry in DB
    dbCtx.db
      .prepare('UPDATE survey_access_credentials SET expires_at = ? WHERE response_id = ?')
      .run('2020-01-01T00:00:00.000Z', receiptB.responseId);

    const expiredRes = await fetch(`${baseUrl}/api/public/my-survey/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseCode: receiptB.responseCode,
        accessToken: receiptB.accessToken,
      }),
    });
    expect(expiredRes.status).toBe(403);
    expect(((await expiredRes.json()) as { code: string }).code).toBe('TOKEN_EXPIRED');

    // 2. Submitting to draft campaign ('smt-pilot-2026') must be rejected with 403
    const draftSubmit = await fetch(`${baseUrl}/api/public/campaigns/smt-pilot-2026/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeSampleSubmission({ departmentId: 'dept_smt' })),
    });
    expect(draftSubmit.status).toBe(403);

    // 3. Create an active strict campaign via Admin API (single submission + edit locked)
    const strictCampRes = await fetch(`${baseUrl}/api/admin/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
        'X-CSRF-Token': adminCsrf,
      },
      body: JSON.stringify({
        title: 'Strict SMT Pilot 2026',
        slug: 'strict-smt-2026',
        description: 'Single submission, non-editable campaign',
        status: 'active',
        allowAnonymous: false,
        requireAuth: false,
        requireEmployeeCode: true,
        requireParticipantName: true,
        allowMultipleSubmissions: false,
        allowEditAfterSubmit: false,
        startDate: '2026-01-01',
        endDate: '2027-12-31',
        targetParticipants: 40,
      }),
    });
    expect(strictCampRes.status).toBe(201);

    const pilotSubmit1 = await fetch(`${baseUrl}/api/public/campaigns/strict-smt-2026/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        makeSampleSubmission({
          isAnonymous: false,
          participantInfo: {
            employeeId: 'SMT7777',
            fullName: 'SMT Engineer',
            departmentId: 'dept_smt',
            section: 'SMT Line 3',
            jobTitle: 'engineer',
            shift: 'day',
            mesExperience: '1-3y',
            frequentSystems: ['MES'],
          },
          departmentId: 'dept_smt',
        })
      ),
    });
    expect(pilotSubmit1.status).toBe(201);
    const pilotReceipt = (await pilotSubmit1.json()) as { responseCode: string; accessToken: string };

    // Duplicate employee code on single-submission campaign returns 409 DUPLICATE_SUBMISSION
    const pilotSubmitDup = await fetch(`${baseUrl}/api/public/campaigns/strict-smt-2026/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        makeSampleSubmission({
          isAnonymous: false,
          participantInfo: {
            employeeId: 'SMT7777',
            fullName: 'SMT Engineer',
            departmentId: 'dept_smt',
            section: 'SMT Line 3',
            jobTitle: 'engineer',
            shift: 'day',
            mesExperience: '1-3y',
            frequentSystems: ['MES'],
          },
          departmentId: 'dept_smt',
        })
      ),
    });
    expect(pilotSubmitDup.status).toBe(409);

    // Editing on campaign with allowEditAfterSubmit=false returns 403 EDIT_LOCKED
    const pilotVerify = await fetch(`${baseUrl}/api/public/my-survey/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responseCode: pilotReceipt.responseCode,
        accessToken: pilotReceipt.accessToken,
      }),
    });
    expect(pilotVerify.status).toBe(200);
    const pilotCookie = `mes_my_survey_session=${extractCookie(getRawSetCookies(pilotVerify), 'mes_my_survey_session')}`;

    const editLocked = await fetch(`${baseUrl}/api/public/my-survey/${pilotReceipt.responseCode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: pilotCookie },
      body: JSON.stringify({
        proposals: {
          topImprovement: 'Attempt edit',
          requestedForms: '',
          requestedReports: '',
          automationTarget: '',
          biggestChallenge: '',
          dxProposal: '',
          priority: 'P1',
          attachmentNames: [],
        },
      }),
    });
    expect(editLocked.status).toBe(403);
    expect(((await editLocked.json()) as { code: string }).code).toBe('EDIT_LOCKED');

    const auditRes = await fetch(`${baseUrl}/api/admin/audit-logs`, {
      headers: { Cookie: superAdminCookie },
    });
    expect(auditRes.status).toBe(200);
    expect(superAdminCsrf).toBeTruthy();
  });
});
