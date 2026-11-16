import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_CATALOG_FORMS,
  DEFAULT_CATALOG_REPORTS,
  DEFAULT_DEPARTMENTS,
} from '../../src/data/catalogs.ts';
import {
  DEFAULT_CAMPAIGNS,
  DEFAULT_QUESTIONS,
  DEFAULT_SYSTEM_CONFIG,
  DEMO_AUDIT_LOGS,
  DEMO_RESPONSES,
} from '../../src/data/demoData.ts';
import {
  AdminUserAccount,
  AuditLog,
  Campaign,
  CatalogForm,
  CatalogReport,
  Department,
  ProposalStatus,
  RbacRoleCode,
  SurveyQuestion,
  SurveyResponse,
  SystemConfig,
} from '../../src/types/survey.ts';
import {
  generateAccessToken,
  generateCsrfToken,
  generateResponseCode,
  generateSessionToken,
  hashAccessToken,
  hashPassword,
  verifyPassword,
  verifyTokenHash,
} from '../security.ts';

export const ALL_PERMISSIONS: { code: string; description: string }[] = [
  { code: 'dashboard:read', description: 'View executive KPI dashboard' },
  { code: 'analytics:read', description: 'View analytics charts and priority matrix' },
  { code: 'reports:read', description: 'View summary reports' },
  { code: 'reports:export', description: 'Export Excel/PDF/JSON reports' },
  { code: 'campaigns:read', description: 'View survey campaigns' },
  { code: 'campaigns:write', description: 'Create, update, clone campaigns' },
  { code: 'questions:read', description: 'View dynamic survey questions' },
  { code: 'questions:write', description: 'Create, edit, delete questions' },
  { code: 'catalogs:read', description: 'View MES forms, reports, departments catalogs' },
  { code: 'catalogs:write', description: 'Create or edit MES forms, reports, departments' },
  { code: 'responses:read', description: 'Inspect submitted survey responses' },
  { code: 'responses:write', description: 'Update proposal status on responses' },
  { code: 'responses:delete', description: 'Delete survey responses' },
  { code: 'credentials:revoke', description: 'Revoke respondent private lookup tokens' },
  { code: 'settings:read', description: 'View system configuration' },
  { code: 'settings:write', description: 'Modify system configuration' },
  { code: 'users:read', description: 'View admin user accounts and RBAC roles' },
  { code: 'users:write', description: 'Create, update, suspend admin users & assign roles' },
  { code: 'audit:read', description: 'View security and system audit logs' },
];

const ROLE_PERMISSION_MAP: Record<Exclude<RbacRoleCode, 'PUBLIC'>, string[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS.map((p) => p.code),
  ADMIN: ALL_PERMISSIONS.filter((p) => p.code !== 'users:read' && p.code !== 'users:write').map((p) => p.code),
  ANALYST: [
    'dashboard:read',
    'analytics:read',
    'reports:read',
    'reports:export',
    'campaigns:read',
    'questions:read',
    'catalogs:read',
    'responses:read',
  ],
  RESPONDENT: [],
};

export interface DbContext {
  db: DatabaseSync;
  close: () => void;
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function slugifyCampaign(title: string, fallbackId: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallbackId.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
}

export function initDatabase(dbPath?: string): DbContext {
  const resolvedPath =
    dbPath ||
    process.env.SQLITE_DB_PATH ||
    path.resolve(process.cwd(), 'data', 'mes_survey.db');

  if (resolvedPath !== ':memory:') {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new DatabaseSync(resolvedPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (resolvedPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  runMigrations(db);
  seedDatabaseIfEmpty(db);

  return {
    db,
    close: () => {
      db.close();
    },
  };
}

function runMigrations(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationDir = path.resolve(process.cwd(), 'server', 'db', 'migrations');
  const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith('.sql')).sort();
  const checkStmt = db.prepare('SELECT version FROM schema_migrations WHERE version = ?');
  const markStmt = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');

  for (const file of files) {
    const already = checkStmt.get(file) as { version: string } | undefined;
    if (already) continue;
    const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      markStmt.run(file, new Date().toISOString());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

function seedDatabaseIfEmpty(db: DatabaseSync) {
  const now = new Date().toISOString();

  // 1. Seed RBAC roles & permissions
  const roleCountRow = db.prepare('SELECT COUNT(*) as cnt FROM admin_roles').get() as { cnt: number };
  if (roleCountRow.cnt === 0) {
    db.exec('BEGIN');
    try {
      const insertRole = db.prepare('INSERT OR IGNORE INTO admin_roles (id, role_code, role_name) VALUES (?, ?, ?)');
      insertRole.run('role_super_admin', 'SUPER_ADMIN', 'Super Administrator');
      insertRole.run('role_admin', 'ADMIN', 'Administrator');
      insertRole.run('role_analyst', 'ANALYST', 'Data Analyst');
      insertRole.run('role_respondent', 'RESPONDENT', 'Respondent');

      const insertPerm = db.prepare(
        'INSERT OR IGNORE INTO admin_permissions (id, permission_code, description) VALUES (?, ?, ?)'
      );
      for (const perm of ALL_PERMISSIONS) {
        insertPerm.run(`perm_${perm.code.replace(/[^a-z0-9]/gi, '_')}`, perm.code, perm.description);
      }

      const insertRolePerm = db.prepare(
        'INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_id) VALUES (?, ?)'
      );
      const roleIds: Record<Exclude<RbacRoleCode, 'PUBLIC'>, string> = {
        SUPER_ADMIN: 'role_super_admin',
        ADMIN: 'role_admin',
        ANALYST: 'role_analyst',
        RESPONDENT: 'role_respondent',
      };
      for (const [roleCode, perms] of Object.entries(ROLE_PERMISSION_MAP) as [
        Exclude<RbacRoleCode, 'PUBLIC'>,
        string[],
      ][]) {
        for (const permCode of perms) {
          insertRolePerm.run(roleIds[roleCode], `perm_${permCode.replace(/[^a-z0-9]/gi, '_')}`);
        }
      }

      // Seed admin accounts
      const adminPass = process.env.ADMIN_SEED_PASSWORD || 'MesAdmin#2026';
      const analystPass = process.env.ANALYST_SEED_PASSWORD || 'MesAnalyst#2026';
      const insertUser = db.prepare(`
        INSERT OR IGNORE INTO admin_users
        (id, username, email, password_hash, full_name, role_id, department_scope, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `);
      insertUser.run(
        'usr_superadmin',
        'superadmin',
        'superadmin@smartmes.local',
        hashPassword(adminPass),
        'System Super Admin',
        'role_super_admin',
        null,
        now,
        now
      );
      insertUser.run(
        'usr_admin',
        'admin',
        'admin@smartmes.local',
        hashPassword(adminPass),
        'MES Portal Admin',
        'role_admin',
        null,
        now,
        now
      );
      insertUser.run(
        'usr_analyst',
        'analyst',
        'analyst@smartmes.local',
        hashPassword(analystPass),
        'MES Data Analyst',
        'role_analyst',
        null,
        now,
        now
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  // 2. Seed Departments
  const deptCount = (db.prepare('SELECT COUNT(*) as cnt FROM departments').get() as { cnt: number }).cnt;
  if (deptCount === 0) {
    const stmt = db.prepare(`
      INSERT INTO departments (id, code, name_vi, name_en, name_ko, name_zh, sections_json, target_headcount, active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const d of DEFAULT_DEPARTMENTS) {
      stmt.run(
        d.id,
        d.code,
        d.nameVi,
        d.nameEn,
        d.nameKo || null,
        d.nameZh || null,
        JSON.stringify(d.sections || []),
        d.targetHeadcount,
        d.active ? 1 : 0,
        d.updatedAt || now
      );
    }
  }

  // 3. Seed Catalog Forms
  const formCount = (db.prepare('SELECT COUNT(*) as cnt FROM catalog_forms').get() as { cnt: number }).cnt;
  if (formCount === 0) {
    const stmt = db.prepare(`
      INSERT INTO catalog_forms (id, group_id, code, name_en, name_vi, name_ko, name_zh, description, is_custom, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const f of DEFAULT_CATALOG_FORMS) {
      stmt.run(
        f.id,
        f.groupId,
        f.code,
        f.nameEn,
        f.nameVi,
        f.nameKo || null,
        f.nameZh || null,
        f.description || null,
        f.isCustom ? 1 : 0,
        f.active ? 1 : 0
      );
    }
  }

  // 4. Seed Catalog Reports
  const reportCount = (db.prepare('SELECT COUNT(*) as cnt FROM catalog_reports').get() as { cnt: number }).cnt;
  if (reportCount === 0) {
    const stmt = db.prepare(`
      INSERT INTO catalog_reports (id, category_id, code, name_en, name_vi, name_ko, name_zh, description, is_custom, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of DEFAULT_CATALOG_REPORTS) {
      stmt.run(
        r.id,
        r.categoryId,
        r.code,
        r.nameEn,
        r.nameVi,
        r.nameKo || null,
        r.nameZh || null,
        r.description || null,
        r.isCustom ? 1 : 0,
        r.active ? 1 : 0
      );
    }
  }

  // 5. Seed Campaigns
  const campCount = (db.prepare('SELECT COUNT(*) as cnt FROM survey_campaigns').get() as { cnt: number }).cnt;
  if (campCount === 0) {
    const stmt = db.prepare(`
      INSERT INTO survey_campaigns
      (id, name, slug, description, start_at, end_at, status, is_anonymous, require_employee_code, require_participant_name, allow_multiple_submissions, allow_edit_after_submit, target_participants, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const slugMap: Record<string, string> = {
      camp_mes_dx_2026: 'mes-dx-2026',
      camp_smt_pilot_2026: 'smt-pilot-2026',
    };
    for (const c of DEFAULT_CAMPAIGNS) {
      const endDateFuture = c.id === 'camp_mes_dx_2026' ? '2027-12-31' : c.endDate || '2027-12-31';
      stmt.run(
        c.id,
        c.title,
        slugMap[c.id] || slugifyCampaign(c.title, c.id),
        c.description || '',
        c.startDate || '2026-01-01',
        endDateFuture,
        c.status,
        c.allowAnonymous ? 1 : 0,
        c.id === 'camp_smt_pilot_2026' ? 1 : 0,
        c.id === 'camp_smt_pilot_2026' ? 1 : 0,
        1,
        1,
        c.targetParticipants,
        c.createdBy || 'superadmin',
        c.createdAt || now,
        c.updatedAt || now
      );
    }
  }

  // 6. Seed Questions
  const qCount = (db.prepare('SELECT COUNT(*) as cnt FROM survey_questions').get() as { cnt: number }).cnt;
  if (qCount === 0) {
    const stmt = db.prepare(`
      INSERT INTO survey_questions
      (id, campaign_id, section, label_vi, label_en, label_ko, label_zh, type, required, order_index, condition_field, condition_value, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const q of DEFAULT_QUESTIONS) {
      stmt.run(
        q.id,
        'camp_mes_dx_2026',
        q.section,
        q.labelVi,
        q.labelEn,
        q.labelKo || null,
        q.labelZh || null,
        q.type,
        q.required ? 1 : 0,
        q.orderIndex,
        q.conditionField || null,
        q.conditionValue || null,
        q.active ? 1 : 0
      );
    }
  }

  // 7. Seed System Settings
  const cfgCount = (db.prepare('SELECT COUNT(*) as cnt FROM system_settings').get() as { cnt: number }).cnt;
  if (cfgCount === 0) {
    db.prepare(`
      INSERT INTO system_settings
      (id, anonymous_survey_default, require_google_login, default_language, min_sample_threshold, token_ttl_days, retention_days, updated_by, updated_at)
      VALUES ('default', ?, ?, ?, ?, 90, 365, ?, ?)
    `).run(
      DEFAULT_SYSTEM_CONFIG.anonymousSurveyDefault ? 1 : 0,
      DEFAULT_SYSTEM_CONFIG.requireGoogleLogin ? 1 : 0,
      DEFAULT_SYSTEM_CONFIG.defaultLanguage,
      DEFAULT_SYSTEM_CONFIG.minSampleThreshold,
      DEFAULT_SYSTEM_CONFIG.updatedBy,
      DEFAULT_SYSTEM_CONFIG.updatedAt
    );
  }

  // 8. Seed Demo Survey Responses (baseline dataset)
  const respCount = (db.prepare('SELECT COUNT(*) as cnt FROM survey_responses').get() as { cnt: number }).cnt;
  if (respCount === 0) {
    db.exec('BEGIN');
    try {
      const insertResp = db.prepare(`
        INSERT INTO survey_responses
        (id, campaign_id, response_code, department_id, section, employee_code, participant_name, job_title, work_group, shift, mes_experience, frequent_systems_json, other_system, survey_date, selected_forms_json, selected_reports_json, workflow_evaluations_json, dx_needs_json, ux_ratings_json, proposals_json, proposal_status, submitted_at, updated_at, status, is_anonymous)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertAns = db.prepare(`
        INSERT INTO survey_response_answers (id, response_id, question_id, answer_value, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      DEMO_RESPONSES.forEach((r, idx) => {
        const code = `MES-DEMO-${String(idx + 1).padStart(4, '0')}`;
        insertResp.run(
          r.id,
          r.campaignId,
          code,
          r.departmentId,
          r.section || r.participantInfo.section || '',
          r.isAnonymous ? null : r.participantInfo.employeeId || null,
          r.isAnonymous ? null : r.participantInfo.fullName || null,
          r.participantInfo.jobTitle || '',
          r.participantInfo.workGroup || '',
          r.participantInfo.shift || 'day',
          r.participantInfo.mesExperience || '1-3y',
          JSON.stringify(r.participantInfo.frequentSystems || []),
          r.participantInfo.otherSystem || '',
          r.participantInfo.surveyDate || (r.submittedAt || r.updatedAt).slice(0, 10),
          JSON.stringify(r.selectedForms || []),
          JSON.stringify(r.selectedReports || []),
          JSON.stringify(r.workflowEvaluations || []),
          JSON.stringify(r.dxNeeds || []),
          JSON.stringify(r.uxRatings || {}),
          JSON.stringify(r.proposals || {}),
          'pending',
          r.submittedAt || r.updatedAt,
          r.updatedAt,
          r.status,
          r.isAnonymous ? 1 : 0
        );
        for (const f of r.selectedForms) {
          insertAns.run(
            `ans_${r.id}_${f.formId}`,
            r.id,
            `form:${f.formId}`,
            JSON.stringify({ frequency: f.frequency, importance: f.importance, improvements: f.improvements }),
            r.submittedAt || r.updatedAt
          );
        }
      });

      const insertAudit = db.prepare(`
        INSERT INTO audit_logs (id, actor_id, actor_username, action, resource_type, resource_id, details, created_at, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `);
      for (const l of DEMO_AUDIT_LOGS) {
        insertAudit.run(l.id, l.actorUid, l.actorEmail, l.action, l.targetType, l.targetId, l.details, l.createdAt);
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

// ---------- Row Mappers ----------

function mapCampaignRow(row: Record<string, unknown>): Campaign {
  const isAnon = Boolean(row.is_anonymous);
  return {
    id: String(row.id),
    title: String(row.name),
    slug: String(row.slug),
    description: String(row.description || ''),
    status: row.status as Campaign['status'],
    allowAnonymous: isAnon,
    requireAuth: false,
    requireEmployeeCode: Boolean(row.require_employee_code),
    requireParticipantName: Boolean(row.require_participant_name),
    allowMultipleSubmissions: Boolean(row.allow_multiple_submissions),
    allowEditAfterSubmit: Boolean(row.allow_edit_after_submit),
    startDate: row.start_at ? String(row.start_at) : undefined,
    endDate: row.end_at ? String(row.end_at) : undefined,
    targetParticipants: Number(row.target_participants || 100),
    createdBy: String(row.created_by || 'admin'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapDepartmentRow(row: Record<string, unknown>): Department {
  return {
    id: String(row.id),
    code: String(row.code),
    nameVi: String(row.name_vi),
    nameEn: String(row.name_en),
    nameKo: row.name_ko ? String(row.name_ko) : undefined,
    nameZh: row.name_zh ? String(row.name_zh) : undefined,
    sections: safeJsonParse<string[]>(row.sections_json as string, []),
    targetHeadcount: Number(row.target_headcount || 10),
    active: Boolean(row.active),
    updatedAt: String(row.updated_at),
  };
}

function mapFormRow(row: Record<string, unknown>): CatalogForm {
  return {
    id: String(row.id),
    groupId: row.group_id as CatalogForm['groupId'],
    code: String(row.code),
    nameEn: String(row.name_en),
    nameVi: String(row.name_vi),
    nameKo: row.name_ko ? String(row.name_ko) : undefined,
    nameZh: row.name_zh ? String(row.name_zh) : undefined,
    description: row.description ? String(row.description) : undefined,
    isCustom: Boolean(row.is_custom),
    active: Boolean(row.active),
  };
}

function mapReportRow(row: Record<string, unknown>): CatalogReport {
  return {
    id: String(row.id),
    categoryId: row.category_id as CatalogReport['categoryId'],
    code: String(row.code),
    nameEn: String(row.name_en),
    nameVi: String(row.name_vi),
    nameKo: row.name_ko ? String(row.name_ko) : undefined,
    nameZh: row.name_zh ? String(row.name_zh) : undefined,
    description: row.description ? String(row.description) : undefined,
    isCustom: Boolean(row.is_custom),
    active: Boolean(row.active),
  };
}

function mapQuestionRow(row: Record<string, unknown>): SurveyQuestion {
  return {
    id: String(row.id),
    section: row.section as SurveyQuestion['section'],
    labelVi: String(row.label_vi),
    labelEn: String(row.label_en),
    labelKo: row.label_ko ? String(row.label_ko) : undefined,
    labelZh: row.label_zh ? String(row.label_zh) : undefined,
    type: row.type as SurveyQuestion['type'],
    required: Boolean(row.required),
    orderIndex: Number(row.order_index || 0),
    conditionField: row.condition_field ? String(row.condition_field) : undefined,
    conditionValue: row.condition_value ? String(row.condition_value) : undefined,
    active: Boolean(row.active),
  };
}

function computeCredentialStatus(
  revokedAt?: unknown,
  expiresAt?: unknown
): { credentialStatus: 'active' | 'revoked' | 'expired' | 'none'; credentialExpiresAt?: string } {
  if (!expiresAt && !revokedAt) return { credentialStatus: 'none' };
  if (revokedAt) {
    return {
      credentialStatus: 'revoked',
      credentialExpiresAt: expiresAt ? String(expiresAt) : undefined,
    };
  }
  const expStr = String(expiresAt);
  if (Date.parse(expStr) <= Date.now()) {
    return { credentialStatus: 'expired', credentialExpiresAt: expStr };
  }
  return { credentialStatus: 'active', credentialExpiresAt: expStr };
}

function mapResponseRow(row: Record<string, unknown>): SurveyResponse {
  const isAnon = Boolean(row.is_anonymous);
  const credInfo = computeCredentialStatus(row.cred_revoked_at, row.cred_expires_at);
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    responseCode: String(row.response_code),
    respondentUid: isAnon ? 'anonymous' : String(row.employee_code || 'public_participant'),
    isAnonymous: isAnon,
    status: row.status as SurveyResponse['status'],
    proposalStatus: (row.proposal_status as ProposalStatus) || 'pending',
    credentialStatus: credInfo.credentialStatus,
    credentialExpiresAt: credInfo.credentialExpiresAt,
    departmentId: String(row.department_id),
    section: String(row.section || ''),
    participantInfo: {
      employeeId: isAnon ? 'ANONYMOUS' : String(row.employee_code || ''),
      fullName: isAnon ? 'ANONYMOUS' : String(row.participant_name || ''),
      departmentId: String(row.department_id),
      section: String(row.section || ''),
      jobTitle: String(row.job_title || ''),
      workGroup: String(row.work_group || ''),
      shift: (row.shift as SurveyResponse['participantInfo']['shift']) || 'day',
      mesExperience: (row.mes_experience as SurveyResponse['participantInfo']['mesExperience']) || '1-3y',
      frequentSystems: safeJsonParse<string[]>(row.frequent_systems_json as string, ['MES']),
      otherSystem: String(row.other_system || ''),
      surveyDate: String(row.survey_date || ''),
    },
    selectedForms: safeJsonParse(row.selected_forms_json as string, []),
    selectedReports: safeJsonParse(row.selected_reports_json as string, []),
    workflowEvaluations: safeJsonParse(row.workflow_evaluations_json as string, []),
    dxNeeds: safeJsonParse(row.dx_needs_json as string, []),
    uxRatings: safeJsonParse(row.ux_ratings_json as string, {
      uiEase: 3,
      searchSpeed: 3,
      stepEfficiency: 3,
      pageLoadSpeed: 3,
      errorStability: 3,
      dataAccuracy: 4,
      permissionFit: 4,
      needMobileUi: 4,
      needMultilang: 4,
    }),
    proposals: safeJsonParse(row.proposals_json as string, {
      topImprovement: '',
      requestedForms: '',
      requestedReports: '',
      automationTarget: '',
      biggestChallenge: '',
      dxProposal: '',
      priority: 'P2',
      attachmentNames: [],
    }),
    submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
    updatedAt: String(row.updated_at),
  };
}

// ---------- Campaign Availability Helper ----------

export function isCampaignOpenForSubmission(campaign: Campaign): {
  open: boolean;
  reason?: 'CAMPAIGN_NOT_ACTIVE' | 'CAMPAIGN_NOT_STARTED' | 'CAMPAIGN_EXPIRED';
} {
  if (campaign.status !== 'active') {
    return { open: false, reason: 'CAMPAIGN_NOT_ACTIVE' };
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  if (campaign.startDate && todayStr < campaign.startDate.slice(0, 10)) {
    return { open: false, reason: 'CAMPAIGN_NOT_STARTED' };
  }
  if (campaign.endDate && todayStr > campaign.endDate.slice(0, 10)) {
    return { open: false, reason: 'CAMPAIGN_EXPIRED' };
  }
  return { open: true };
}

// ---------- Public Repository Functions ----------

export function listPublicActiveCampaigns(db: DatabaseSync): Campaign[] {
  const rows = db
    .prepare("SELECT * FROM survey_campaigns WHERE status IN ('active', 'closed') ORDER BY created_at DESC")
    .all() as Record<string, unknown>[];
  return rows.map(mapCampaignRow);
}

export function getCampaignBySlug(db: DatabaseSync, slug: string): Campaign | null {
  const row = db.prepare('SELECT * FROM survey_campaigns WHERE slug = ? OR id = ?').get(slug, slug) as
    | Record<string, unknown>
    | undefined;
  return row ? mapCampaignRow(row) : null;
}

export function listPublicDepartments(db: DatabaseSync): Department[] {
  const rows = db.prepare('SELECT * FROM departments WHERE active = 1 ORDER BY code ASC').all() as Record<
    string,
    unknown
  >[];
  return rows.map(mapDepartmentRow);
}

export function listPublicCatalogForms(db: DatabaseSync): CatalogForm[] {
  const rows = db.prepare('SELECT * FROM catalog_forms WHERE active = 1 ORDER BY code ASC').all() as Record<
    string,
    unknown
  >[];
  return rows.map(mapFormRow);
}

export function listPublicQuestionsByCampaign(db: DatabaseSync, campaignId: string): SurveyQuestion[] {
  const rows = db
    .prepare('SELECT * FROM survey_questions WHERE campaign_id = ? AND active = 1 ORDER BY order_index ASC')
    .all(campaignId) as Record<string, unknown>[];
  return rows.map(mapQuestionRow);
}

export function saveCustomFormPublic(db: DatabaseSync, form: CatalogForm): CatalogForm {
  db.prepare(`
    INSERT OR IGNORE INTO catalog_forms (id, group_id, code, name_en, name_vi, name_ko, name_zh, description, is_custom, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
  `).run(
    form.id,
    form.groupId,
    form.code,
    form.nameEn,
    form.nameVi,
    form.nameKo || null,
    form.nameZh || null,
    form.description || null
  );
  return { ...form, isCustom: true, active: true };
}

export function getSystemSettings(db: DatabaseSync): SystemConfig {
  const row = db.prepare("SELECT * FROM system_settings WHERE id = 'default'").get() as
    | Record<string, unknown>
    | undefined;
  if (!row) return DEFAULT_SYSTEM_CONFIG;
  return {
    id: String(row.id),
    anonymousSurveyDefault: Boolean(row.anonymous_survey_default),
    requireGoogleLogin: Boolean(row.require_google_login),
    defaultLanguage: (row.default_language as SystemConfig['defaultLanguage']) || 'vi',
    minSampleThreshold: Number(row.min_sample_threshold || 5),
    tokenTtlDays: Number(row.token_ttl_days || 90),
    retentionDays: Number(row.retention_days || 365),
    updatedBy: String(row.updated_by || 'system'),
    updatedAt: String(row.updated_at),
  };
}

export function submitPublicSurveyResponse(
  db: DatabaseSync,
  campaign: Campaign,
  input: Omit<SurveyResponse, 'id' | 'responseCode' | 'respondentUid' | 'updatedAt' | 'submittedAt'>
): {
  ok: true;
  responseId: string;
  responseCode: string;
  accessToken: string;
  submittedAt: string;
  expiresAt: string;
  status: 'submitted';
} | {
  ok: false;
  statusCode: number;
  errorCode: string;
  message: string;
} {
  const availability = isCampaignOpenForSubmission(campaign);
  if (!availability.open) {
    return {
      ok: false,
      statusCode: 403,
      errorCode: availability.reason || 'CAMPAIGN_CLOSED',
      message: 'This survey campaign is not currently accepting submissions.',
    };
  }

  // Enforce campaign policy flags
  const effectiveAnonymous = campaign.allowAnonymous ? Boolean(input.isAnonymous) : false;
  const empCode = effectiveAnonymous ? '' : (input.participantInfo.employeeId || '').trim();
  const fullName = effectiveAnonymous ? '' : (input.participantInfo.fullName || '').trim();

  if (campaign.requireEmployeeCode && !effectiveAnonymous && !empCode) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'EMPLOYEE_CODE_REQUIRED',
      message: 'Employee code is required for this campaign.',
    };
  }
  if (campaign.requireParticipantName && !effectiveAnonymous && !fullName) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'PARTICIPANT_NAME_REQUIRED',
      message: 'Participant full name is required for this campaign.',
    };
  }

  // Duplicate submission policy when allow_multiple_submissions = false
  if (!campaign.allowMultipleSubmissions && empCode) {
    const dup = db
      .prepare('SELECT id FROM survey_responses WHERE campaign_id = ? AND LOWER(employee_code) = LOWER(?) LIMIT 1')
      .get(campaign.id, empCode) as { id: string } | undefined;
    if (dup) {
      return {
        ok: false,
        statusCode: 409,
        errorCode: 'DUPLICATE_SUBMISSION',
        message: 'This employee code has already submitted a response for this campaign.',
      };
    }
  }

  // Verify department exists
  const deptExists = db
    .prepare('SELECT id FROM departments WHERE id = ?')
    .get(input.departmentId) as { id: string } | undefined;
  if (!deptExists) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: 'INVALID_DEPARTMENT',
      message: 'Selected department does not exist.',
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const settings = getSystemSettings(db);
  const ttlDays = Math.max(1, settings.tokenTtlDays || 90);
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const responseId = `resp_${crypto.randomUUID()}`;
  let responseCode = generateResponseCode();
  // Ensure responseCode collision check
  while (db.prepare('SELECT id FROM survey_responses WHERE response_code = ?').get(responseCode)) {
    responseCode = generateResponseCode();
  }

  const rawAccessToken = generateAccessToken();
  const tokenHash = hashAccessToken(rawAccessToken);
  const credId = `cred_${crypto.randomUUID()}`;

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO survey_responses
      (id, campaign_id, response_code, department_id, section, employee_code, participant_name, job_title, work_group, shift, mes_experience, frequent_systems_json, other_system, survey_date, selected_forms_json, selected_reports_json, workflow_evaluations_json, dx_needs_json, ux_ratings_json, proposals_json, proposal_status, submitted_at, updated_at, status, is_anonymous)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'submitted', ?)
    `).run(
      responseId,
      campaign.id,
      responseCode,
      input.departmentId,
      input.section || input.participantInfo.section || '',
      effectiveAnonymous ? null : empCode || null,
      effectiveAnonymous ? null : fullName || null,
      input.participantInfo.jobTitle || '',
      input.participantInfo.workGroup || '',
      input.participantInfo.shift || 'day',
      input.participantInfo.mesExperience || '1-3y',
      JSON.stringify(input.participantInfo.frequentSystems || ['MES']),
      input.participantInfo.otherSystem || '',
      input.participantInfo.surveyDate || nowIso.slice(0, 10),
      JSON.stringify(input.selectedForms || []),
      JSON.stringify(input.selectedReports || []),
      JSON.stringify(input.workflowEvaluations || []),
      JSON.stringify(input.dxNeeds || []),
      JSON.stringify(input.uxRatings || {}),
      JSON.stringify(input.proposals || {}),
      nowIso,
      nowIso,
      effectiveAnonymous ? 1 : 0
    );

    const insertAns = db.prepare(`
      INSERT INTO survey_response_answers (id, response_id, question_id, answer_value, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const f of input.selectedForms || []) {
      insertAns.run(
        `ans_${crypto.randomUUID()}`,
        responseId,
        `form:${f.formId}`,
        JSON.stringify({
          frequency: f.frequency,
          importance: f.importance,
          importanceLevel: f.importanceLevel,
          authorizedUsers: f.authorizedUsers,
          improvements: f.improvements,
        }),
        nowIso
      );
    }
    if (input.proposals?.customAnswers) {
      for (const [qId, ansVal] of Object.entries(input.proposals.customAnswers)) {
        insertAns.run(`ans_${crypto.randomUUID()}`, responseId, qId, String(ansVal), nowIso);
      }
    }

    db.prepare(`
      INSERT INTO survey_access_credentials (id, response_id, token_hash, created_at, expires_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, NULL)
    `).run(credId, responseId, tokenHash, nowIso, expiresAt);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return {
    ok: true,
    responseId,
    responseCode,
    accessToken: rawAccessToken,
    submittedAt: nowIso,
    expiresAt,
    status: 'submitted',
  };
}

export type VerifyCredentialResult =
  | {
      ok: true;
      credentialId: string;
      expiresAt: string;
      response: SurveyResponse;
      campaign: Campaign;
    }
  | {
      ok: false;
      statusCode: 401 | 403;
      errorCode: 'INVALID_CREDENTIALS' | 'TOKEN_REVOKED' | 'TOKEN_EXPIRED';
      message: string;
    };

export function verifyPrivateAccessCredential(
  db: DatabaseSync,
  responseCode: string,
  rawAccessToken: string
): VerifyCredentialResult {
  const normalizedCode = responseCode.trim().toUpperCase();
  const respRow = db
    .prepare('SELECT * FROM survey_responses WHERE UPPER(response_code) = ?')
    .get(normalizedCode) as Record<string, unknown> | undefined;

  if (!respRow) {
    return {
      ok: false,
      statusCode: 401,
      errorCode: 'INVALID_CREDENTIALS',
      message: 'Invalid response code or access token.',
    };
  }

  const creds = db
    .prepare('SELECT * FROM survey_access_credentials WHERE response_id = ?')
    .all(String(respRow.id)) as Record<string, unknown>[];

  const matched = creds.find((c) => verifyTokenHash(rawAccessToken.trim(), String(c.token_hash)));
  if (!matched) {
    return {
      ok: false,
      statusCode: 401,
      errorCode: 'INVALID_CREDENTIALS',
      message: 'Invalid response code or access token.',
    };
  }

  if (matched.revoked_at) {
    return {
      ok: false,
      statusCode: 403,
      errorCode: 'TOKEN_REVOKED',
      message: 'This access token has been revoked by an administrator.',
    };
  }

  const expiresAt = String(matched.expires_at);
  if (Date.parse(expiresAt) <= Date.now()) {
    return {
      ok: false,
      statusCode: 403,
      errorCode: 'TOKEN_EXPIRED',
      message: 'This access token has expired.',
    };
  }

  const campRow = db
    .prepare('SELECT * FROM survey_campaigns WHERE id = ?')
    .get(String(respRow.campaign_id)) as Record<string, unknown>;

  return {
    ok: true,
    credentialId: String(matched.id),
    expiresAt,
    response: mapResponseRow({
      ...respRow,
      cred_revoked_at: matched.revoked_at,
      cred_expires_at: matched.expires_at,
    }),
    campaign: mapCampaignRow(campRow),
  };
}

export function getPrivateResponseByCredentialSession(
  db: DatabaseSync,
  responseCode: string,
  credentialId: string
): VerifyCredentialResult {
  const normalizedCode = responseCode.trim().toUpperCase();
  const respRow = db
    .prepare('SELECT * FROM survey_responses WHERE UPPER(response_code) = ?')
    .get(normalizedCode) as Record<string, unknown> | undefined;

  if (!respRow) {
    return {
      ok: false,
      statusCode: 401,
      errorCode: 'INVALID_CREDENTIALS',
      message: 'Session invalid or expired.',
    };
  }

  const cred = db
    .prepare('SELECT * FROM survey_access_credentials WHERE id = ? AND response_id = ?')
    .get(credentialId, String(respRow.id)) as Record<string, unknown> | undefined;

  if (!cred) {
    return {
      ok: false,
      statusCode: 403,
      errorCode: 'INVALID_CREDENTIALS',
      message: 'Access denied for this response.',
    };
  }

  if (cred.revoked_at) {
    return {
      ok: false,
      statusCode: 403,
      errorCode: 'TOKEN_REVOKED',
      message: 'This access token has been revoked by an administrator.',
    };
  }

  const expiresAt = String(cred.expires_at);
  if (Date.parse(expiresAt) <= Date.now()) {
    return {
      ok: false,
      statusCode: 403,
      errorCode: 'TOKEN_EXPIRED',
      message: 'This access token has expired.',
    };
  }

  const campRow = db
    .prepare('SELECT * FROM survey_campaigns WHERE id = ?')
    .get(String(respRow.campaign_id)) as Record<string, unknown>;

  return {
    ok: true,
    credentialId: String(cred.id),
    expiresAt,
    response: mapResponseRow({
      ...respRow,
      cred_revoked_at: cred.revoked_at,
      cred_expires_at: cred.expires_at,
    }),
    campaign: mapCampaignRow(campRow),
  };
}

export function updatePrivateSurveyResponse(
  db: DatabaseSync,
  existing: SurveyResponse,
  campaign: Campaign,
  patch: Partial<SurveyResponse>
): { ok: true; response: SurveyResponse } | { ok: false; statusCode: number; errorCode: string; message: string } {
  if (!campaign.allowEditAfterSubmit) {
    return {
      ok: false,
      statusCode: 403,
      errorCode: 'EDIT_LOCKED',
      message: 'Editing responses after submission is disabled for this campaign.',
    };
  }

  const availability = isCampaignOpenForSubmission(campaign);
  if (!availability.open) {
    return {
      ok: false,
      statusCode: 403,
      errorCode: availability.reason || 'CAMPAIGN_CLOSED',
      message: 'This survey campaign is closed and can no longer be edited.',
    };
  }

  const nowIso = new Date().toISOString();
  const nextParticipant = patch.participantInfo || existing.participantInfo;
  const nextForms = patch.selectedForms || existing.selectedForms;
  const nextDx = patch.dxNeeds || existing.dxNeeds;
  const nextUx = patch.uxRatings || existing.uxRatings;
  const nextProposals = patch.proposals || existing.proposals;
  const nextDeptId = patch.departmentId || existing.departmentId;
  const nextSection = patch.section ?? nextParticipant.section ?? existing.section ?? '';

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE survey_responses
      SET department_id = ?, section = ?,
          employee_code = CASE WHEN is_anonymous = 1 THEN NULL ELSE ? END,
          participant_name = CASE WHEN is_anonymous = 1 THEN NULL ELSE ? END,
          job_title = ?, shift = ?, mes_experience = ?, frequent_systems_json = ?, other_system = ?,
          selected_forms_json = ?, dx_needs_json = ?, ux_ratings_json = ?, proposals_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      nextDeptId,
      nextSection,
      nextParticipant.employeeId || null,
      nextParticipant.fullName || null,
      nextParticipant.jobTitle || '',
      nextParticipant.shift || 'day',
      nextParticipant.mesExperience || '1-3y',
      JSON.stringify(nextParticipant.frequentSystems || ['MES']),
      nextParticipant.otherSystem || '',
      JSON.stringify(nextForms),
      JSON.stringify(nextDx),
      JSON.stringify(nextUx),
      JSON.stringify(nextProposals),
      nowIso,
      existing.id
    );

    db.prepare('DELETE FROM survey_response_answers WHERE response_id = ?').run(existing.id);
    const insertAns = db.prepare(`
      INSERT INTO survey_response_answers (id, response_id, question_id, answer_value, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const f of nextForms) {
      insertAns.run(
        `ans_${crypto.randomUUID()}`,
        existing.id,
        `form:${f.formId}`,
        JSON.stringify({
          frequency: f.frequency,
          importance: f.importance,
          importanceLevel: f.importanceLevel,
          authorizedUsers: f.authorizedUsers,
          improvements: f.improvements,
        }),
        nowIso
      );
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const updatedRow = db
    .prepare(`
      SELECT r.*, c.revoked_at AS cred_revoked_at, c.expires_at AS cred_expires_at
      FROM survey_responses r
      LEFT JOIN survey_access_credentials c ON c.response_id = r.id
      WHERE r.id = ?
      LIMIT 1
    `)
    .get(existing.id) as Record<string, unknown>;

  return { ok: true, response: mapResponseRow(updatedRow) };
}

// ---------- Admin Auth & RBAC Repository Functions ----------

export interface AuthenticatedAdminSession {
  sessionId: string;
  csrfToken: string;
  user: AdminUserAccount;
  permissions: string[];
}

export function getUserPermissions(db: DatabaseSync, roleId: string): string[] {
  const rows = db
    .prepare(`
      SELECT p.permission_code
      FROM admin_role_permissions rp
      JOIN admin_permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `)
    .all(roleId) as { permission_code: string }[];
  return rows.map((r) => r.permission_code);
}

export function authenticateAdminUser(
  db: DatabaseSync,
  usernameOrEmail: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
):
  | {
      ok: true;
      sessionToken: string;
      csrfToken: string;
      expiresAt: string;
      user: AdminUserAccount;
      permissions: string[];
    }
  | {
      ok: false;
      statusCode: 401 | 403 | 423;
      message: string;
    } {
  const identifier = usernameOrEmail.trim().toLowerCase();
  const userRow = db
    .prepare(`
      SELECT u.*, r.role_code
      FROM admin_users u
      JOIN admin_roles r ON r.id = u.role_id
      WHERE LOWER(u.username) = ? OR LOWER(u.email) = ?
      LIMIT 1
    `)
    .get(identifier, identifier) as Record<string, unknown> | undefined;

  if (!userRow) {
    return { ok: false, statusCode: 401, message: 'Invalid username or password.' };
  }

  if (userRow.status !== 'active') {
    return { ok: false, statusCode: 403, message: 'This administrator account is suspended.' };
  }

  if (userRow.locked_until && Date.parse(String(userRow.locked_until)) > Date.now()) {
    return {
      ok: false,
      statusCode: 423,
      message: 'Account temporarily locked due to repeated failed login attempts. Try again later.',
    };
  }

  const valid = verifyPassword(password, String(userRow.password_hash));
  const now = new Date();
  const nowIso = now.toISOString();

  if (!valid) {
    const nextFailed = Number(userRow.failed_attempts || 0) + 1;
    const lockUntil = nextFailed >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null;
    db.prepare('UPDATE admin_users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?').run(
      nextFailed,
      lockUntil,
      nowIso,
      String(userRow.id)
    );
    writeAuditLog(db, {
      actorId: String(userRow.id),
      actorUsername: String(userRow.username),
      action: 'ADMIN_LOGIN_FAILED',
      resourceType: 'admin_user',
      resourceId: String(userRow.id),
      details: `Failed login attempt #${nextFailed}`,
      ipAddress,
    });
    if (lockUntil) {
      return {
        ok: false,
        statusCode: 423,
        message: 'Too many failed login attempts. Account locked for 15 minutes.',
      };
    }
    return { ok: false, statusCode: 401, message: 'Invalid username or password.' };
  }

  // Successful login -> reset lockout, issue CSPRNG session token + CSRF token
  const rawSessionToken = generateSessionToken();
  const tokenHash = hashAccessToken(rawSessionToken);
  const csrfToken = generateCsrfToken();
  const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
  const sessionId = `sess_${crypto.randomUUID()}`;

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?').run(
      nowIso,
      String(userRow.id)
    );
    db.prepare(`
      INSERT INTO admin_sessions (id, user_id, token_hash, csrf_token, expires_at, revoked_at, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `).run(sessionId, String(userRow.id), tokenHash, csrfToken, expiresAt, ipAddress || null, userAgent || null, nowIso);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const permissions = getUserPermissions(db, String(userRow.role_id));
  const user: AdminUserAccount = {
    id: String(userRow.id),
    username: String(userRow.username),
    email: String(userRow.email),
    fullName: String(userRow.full_name),
    roleCode: userRow.role_code as RbacRoleCode,
    departmentScope: userRow.department_scope ? String(userRow.department_scope) : undefined,
    status: userRow.status as AdminUserAccount['status'],
    createdAt: String(userRow.created_at),
    updatedAt: nowIso,
  };

  writeAuditLog(db, {
    actorId: user.id,
    actorUsername: user.username,
    action: 'ADMIN_LOGIN_SUCCESS',
    resourceType: 'admin_session',
    resourceId: sessionId,
    details: `Logged in as ${user.roleCode}`,
    ipAddress,
  });

  return {
    ok: true,
    sessionToken: rawSessionToken,
    csrfToken,
    expiresAt,
    user,
    permissions,
  };
}

export function getAuthenticatedAdminSession(
  db: DatabaseSync,
  rawSessionToken?: string
): AuthenticatedAdminSession | null {
  if (!rawSessionToken) return null;
  const tokenHash = hashAccessToken(rawSessionToken);
  const row = db
    .prepare(`
      SELECT s.id AS session_id, s.csrf_token, s.expires_at, s.revoked_at,
             u.id AS user_id, u.username, u.email, u.full_name, u.department_scope, u.status, u.created_at, u.updated_at,
             u.role_id, r.role_code
      FROM admin_sessions s
      JOIN admin_users u ON u.id = s.user_id
      JOIN admin_roles r ON r.id = u.role_id
      WHERE s.token_hash = ?
      LIMIT 1
    `)
    .get(tokenHash) as Record<string, unknown> | undefined;

  if (!row) return null;
  if (row.revoked_at) return null;
  if (Date.parse(String(row.expires_at)) <= Date.now()) return null;
  if (row.status !== 'active') return null;

  const permissions = getUserPermissions(db, String(row.role_id));
  return {
    sessionId: String(row.session_id),
    csrfToken: String(row.csrf_token),
    user: {
      id: String(row.user_id),
      username: String(row.username),
      email: String(row.email),
      fullName: String(row.full_name),
      roleCode: row.role_code as RbacRoleCode,
      departmentScope: row.department_scope ? String(row.department_scope) : undefined,
      status: row.status as AdminUserAccount['status'],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    },
    permissions,
  };
}

export function revokeAdminSession(db: DatabaseSync, sessionId: string) {
  db.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), sessionId);
}

export function changeAdminPassword(
  db: DatabaseSync,
  userId: string,
  currentPassword: string,
  newPassword: string
): { ok: boolean; message: string } {
  const row = db.prepare('SELECT password_hash FROM admin_users WHERE id = ?').get(userId) as
    | { password_hash: string }
    | undefined;
  if (!row || !verifyPassword(currentPassword, row.password_hash)) {
    return { ok: false, message: 'Current password is incorrect.' };
  }
  const nowIso = new Date().toISOString();
  db.prepare('UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    hashPassword(newPassword),
    nowIso,
    userId
  );
  return { ok: true, message: 'Password updated successfully.' };
}

// ---------- Admin Data Operations ----------

export function listAllResponsesAdmin(db: DatabaseSync): SurveyResponse[] {
  const rows = db
    .prepare(`
      SELECT r.*,
        (SELECT c.revoked_at FROM survey_access_credentials c WHERE c.response_id = r.id ORDER BY c.created_at DESC LIMIT 1) AS cred_revoked_at,
        (SELECT c.expires_at FROM survey_access_credentials c WHERE c.response_id = r.id ORDER BY c.created_at DESC LIMIT 1) AS cred_expires_at
      FROM survey_responses r
      ORDER BY r.submitted_at DESC
    `)
    .all() as Record<string, unknown>[];
  return rows.map(mapResponseRow);
}

export function getResponseByIdAdmin(db: DatabaseSync, id: string): SurveyResponse | null {
  const row = db
    .prepare(`
      SELECT r.*,
        (SELECT c.revoked_at FROM survey_access_credentials c WHERE c.response_id = r.id ORDER BY c.created_at DESC LIMIT 1) AS cred_revoked_at,
        (SELECT c.expires_at FROM survey_access_credentials c WHERE c.response_id = r.id ORDER BY c.created_at DESC LIMIT 1) AS cred_expires_at
      FROM survey_responses r
      WHERE r.id = ?
      LIMIT 1
    `)
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapResponseRow(row) : null;
}

export function updateResponseProposalStatus(
  db: DatabaseSync,
  responseId: string,
  proposalStatus: ProposalStatus
): boolean {
  const res = db
    .prepare('UPDATE survey_responses SET proposal_status = ?, updated_at = ? WHERE id = ?')
    .run(proposalStatus, new Date().toISOString(), responseId);
  return Number(res.changes) > 0;
}

export function deleteResponseAdmin(db: DatabaseSync, responseId: string): boolean {
  const res = db.prepare('DELETE FROM survey_responses WHERE id = ?').run(responseId);
  return Number(res.changes) > 0;
}

export function revokeCredentialForResponse(db: DatabaseSync, responseId: string): number {
  const nowIso = new Date().toISOString();
  const res = db
    .prepare('UPDATE survey_access_credentials SET revoked_at = ? WHERE response_id = ? AND revoked_at IS NULL')
    .run(nowIso, responseId);
  return Number(res.changes);
}

export function listAllCampaignsAdmin(db: DatabaseSync): Campaign[] {
  const rows = db.prepare('SELECT * FROM survey_campaigns ORDER BY created_at DESC').all() as Record<string, unknown>[];
  return rows.map(mapCampaignRow);
}

export function upsertCampaignAdmin(db: DatabaseSync, campaign: Campaign): Campaign {
  const nowIso = new Date().toISOString();
  const slug = campaign.slug?.trim() || slugifyCampaign(campaign.title, campaign.id);
  db.prepare(`
    INSERT INTO survey_campaigns
    (id, name, slug, description, start_at, end_at, status, is_anonymous, require_employee_code, require_participant_name, allow_multiple_submissions, allow_edit_after_submit, target_participants, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      slug = excluded.slug,
      description = excluded.description,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      status = excluded.status,
      is_anonymous = excluded.is_anonymous,
      require_employee_code = excluded.require_employee_code,
      require_participant_name = excluded.require_participant_name,
      allow_multiple_submissions = excluded.allow_multiple_submissions,
      allow_edit_after_submit = excluded.allow_edit_after_submit,
      target_participants = excluded.target_participants,
      updated_at = excluded.updated_at
  `).run(
    campaign.id,
    campaign.title,
    slug,
    campaign.description || '',
    campaign.startDate || null,
    campaign.endDate || null,
    campaign.status,
    campaign.allowAnonymous ? 1 : 0,
    campaign.requireEmployeeCode ? 1 : 0,
    campaign.requireParticipantName ? 1 : 0,
    campaign.allowMultipleSubmissions === false ? 0 : 1,
    campaign.allowEditAfterSubmit ? 1 : 0,
    campaign.targetParticipants || 100,
    campaign.createdBy || 'admin',
    campaign.createdAt || nowIso,
    nowIso
  );
  return { ...campaign, slug, updatedAt: nowIso };
}

export function listAllDepartmentsAdmin(db: DatabaseSync): Department[] {
  const rows = db.prepare('SELECT * FROM departments ORDER BY code ASC').all() as Record<string, unknown>[];
  return rows.map(mapDepartmentRow);
}

export function upsertDepartmentAdmin(db: DatabaseSync, dept: Department): Department {
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO departments (id, code, name_vi, name_en, name_ko, name_zh, sections_json, target_headcount, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      name_vi = excluded.name_vi,
      name_en = excluded.name_en,
      name_ko = excluded.name_ko,
      name_zh = excluded.name_zh,
      sections_json = excluded.sections_json,
      target_headcount = excluded.target_headcount,
      active = excluded.active,
      updated_at = excluded.updated_at
  `).run(
    dept.id,
    dept.code,
    dept.nameVi,
    dept.nameEn,
    dept.nameKo || null,
    dept.nameZh || null,
    JSON.stringify(dept.sections || []),
    dept.targetHeadcount,
    dept.active ? 1 : 0,
    nowIso
  );
  return { ...dept, updatedAt: nowIso };
}

export function listAllCatalogFormsAdmin(db: DatabaseSync): CatalogForm[] {
  const rows = db.prepare('SELECT * FROM catalog_forms ORDER BY code ASC').all() as Record<string, unknown>[];
  return rows.map(mapFormRow);
}

export function upsertCatalogFormAdmin(db: DatabaseSync, form: CatalogForm): CatalogForm {
  db.prepare(`
    INSERT INTO catalog_forms (id, group_id, code, name_en, name_vi, name_ko, name_zh, description, is_custom, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      group_id = excluded.group_id,
      code = excluded.code,
      name_en = excluded.name_en,
      name_vi = excluded.name_vi,
      name_ko = excluded.name_ko,
      name_zh = excluded.name_zh,
      description = excluded.description,
      is_custom = excluded.is_custom,
      active = excluded.active
  `).run(
    form.id,
    form.groupId,
    form.code,
    form.nameEn,
    form.nameVi,
    form.nameKo || null,
    form.nameZh || null,
    form.description || null,
    form.isCustom ? 1 : 0,
    form.active ? 1 : 0
  );
  return form;
}

export function listAllCatalogReportsAdmin(db: DatabaseSync): CatalogReport[] {
  const rows = db.prepare('SELECT * FROM catalog_reports ORDER BY code ASC').all() as Record<string, unknown>[];
  return rows.map(mapReportRow);
}

export function upsertCatalogReportAdmin(db: DatabaseSync, report: CatalogReport): CatalogReport {
  db.prepare(`
    INSERT INTO catalog_reports (id, category_id, code, name_en, name_vi, name_ko, name_zh, description, is_custom, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_id = excluded.category_id,
      code = excluded.code,
      name_en = excluded.name_en,
      name_vi = excluded.name_vi,
      name_ko = excluded.name_ko,
      name_zh = excluded.name_zh,
      description = excluded.description,
      is_custom = excluded.is_custom,
      active = excluded.active
  `).run(
    report.id,
    report.categoryId,
    report.code,
    report.nameEn,
    report.nameVi,
    report.nameKo || null,
    report.nameZh || null,
    report.description || null,
    report.isCustom ? 1 : 0,
    report.active ? 1 : 0
  );
  return report;
}

export function listQuestionsAdmin(db: DatabaseSync, campaignId?: string): SurveyQuestion[] {
  const rows = campaignId
    ? (db
        .prepare('SELECT * FROM survey_questions WHERE campaign_id = ? ORDER BY order_index ASC')
        .all(campaignId) as Record<string, unknown>[])
    : (db.prepare('SELECT * FROM survey_questions ORDER BY order_index ASC').all() as Record<string, unknown>[]);
  return rows.map(mapQuestionRow);
}

export function upsertQuestionAdmin(db: DatabaseSync, campaignId: string, q: SurveyQuestion): SurveyQuestion {
  db.prepare(`
    INSERT INTO survey_questions (id, campaign_id, section, label_vi, label_en, label_ko, label_zh, type, required, order_index, condition_field, condition_value, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      section = excluded.section,
      label_vi = excluded.label_vi,
      label_en = excluded.label_en,
      label_ko = excluded.label_ko,
      label_zh = excluded.label_zh,
      type = excluded.type,
      required = excluded.required,
      order_index = excluded.order_index,
      condition_field = excluded.condition_field,
      condition_value = excluded.condition_value,
      active = excluded.active
  `).run(
    q.id,
    campaignId,
    q.section,
    q.labelVi,
    q.labelEn,
    q.labelKo || null,
    q.labelZh || null,
    q.type,
    q.required ? 1 : 0,
    q.orderIndex,
    q.conditionField || null,
    q.conditionValue || null,
    q.active ? 1 : 0
  );
  return q;
}

export function deleteQuestionAdmin(db: DatabaseSync, questionId: string): boolean {
  const res = db.prepare('DELETE FROM survey_questions WHERE id = ?').run(questionId);
  return Number(res.changes) > 0;
}

export function listAdminUsers(db: DatabaseSync): AdminUserAccount[] {
  const rows = db
    .prepare(`
      SELECT u.id, u.username, u.email, u.full_name, u.department_scope, u.status, u.created_at, u.updated_at, r.role_code
      FROM admin_users u
      JOIN admin_roles r ON r.id = u.role_id
      ORDER BY u.created_at ASC
    `)
    .all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    fullName: String(row.full_name),
    roleCode: row.role_code as RbacRoleCode,
    departmentScope: row.department_scope ? String(row.department_scope) : undefined,
    status: row.status as AdminUserAccount['status'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export function createAdminUser(
  db: DatabaseSync,
  input: {
    username: string;
    email: string;
    fullName: string;
    password: string;
    roleCode: Exclude<RbacRoleCode, 'PUBLIC'>;
    departmentScope?: string;
  }
): AdminUserAccount {
  const roleRow = db.prepare('SELECT id FROM admin_roles WHERE role_code = ?').get(input.roleCode) as
    | { id: string }
    | undefined;
  if (!roleRow) {
    throw new Error('Invalid role code');
  }
  const nowIso = new Date().toISOString();
  const id = `usr_${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO admin_users (id, username, email, password_hash, full_name, role_id, department_scope, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(
    id,
    input.username.trim().toLowerCase(),
    input.email.trim().toLowerCase(),
    hashPassword(input.password),
    input.fullName.trim(),
    roleRow.id,
    input.departmentScope || null,
    nowIso,
    nowIso
  );
  return {
    id,
    username: input.username.trim().toLowerCase(),
    email: input.email.trim().toLowerCase(),
    fullName: input.fullName.trim(),
    roleCode: input.roleCode,
    departmentScope: input.departmentScope,
    status: 'active',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function updateAdminUser(
  db: DatabaseSync,
  userId: string,
  patch: {
    fullName?: string;
    roleCode?: Exclude<RbacRoleCode, 'PUBLIC'>;
    status?: 'active' | 'suspended';
    departmentScope?: string;
    password?: string;
  }
): AdminUserAccount | null {
  const existing = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(userId) as
    | Record<string, unknown>
    | undefined;
  if (!existing) return null;

  let roleId = String(existing.role_id);
  if (patch.roleCode) {
    const roleRow = db.prepare('SELECT id FROM admin_roles WHERE role_code = ?').get(patch.roleCode) as
      | { id: string }
      | undefined;
    if (!roleRow) throw new Error('Invalid role code');
    roleId = roleRow.id;
  }

  const nowIso = new Date().toISOString();
  db.prepare(`
    UPDATE admin_users
    SET full_name = ?, role_id = ?, status = ?, department_scope = ?, password_hash = ?, updated_at = ?
    WHERE id = ?
  `).run(
    patch.fullName !== undefined ? patch.fullName : String(existing.full_name),
    roleId,
    patch.status || String(existing.status),
    patch.departmentScope !== undefined
      ? patch.departmentScope || null
      : existing.department_scope
        ? String(existing.department_scope)
        : null,
    patch.password ? hashPassword(patch.password) : String(existing.password_hash),
    nowIso,
    userId
  );

  // If user is suspended, revoke active sessions immediately
  if (patch.status === 'suspended') {
    db.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(
      nowIso,
      userId
    );
  }

  const updated = listAdminUsers(db).find((u) => u.id === userId);
  return updated || null;
}

export function updateSystemSettingsAdmin(db: DatabaseSync, cfg: SystemConfig): SystemConfig {
  const nowIso = new Date().toISOString();
  db.prepare(`
    UPDATE system_settings
    SET anonymous_survey_default = ?, require_google_login = ?, default_language = ?, min_sample_threshold = ?, token_ttl_days = ?, retention_days = ?, updated_by = ?, updated_at = ?
    WHERE id = 'default'
  `).run(
    cfg.anonymousSurveyDefault ? 1 : 0,
    cfg.requireGoogleLogin ? 1 : 0,
    cfg.defaultLanguage,
    cfg.minSampleThreshold,
    cfg.tokenTtlDays ?? 90,
    cfg.retentionDays ?? 365,
    cfg.updatedBy,
    nowIso
  );
  return getSystemSettings(db);
}

export function writeAuditLog(
  db: DatabaseSync,
  entry: {
    actorId: string;
    actorUsername: string;
    action: string;
    resourceType: string;
    resourceId: string;
    details: string;
    ipAddress?: string;
  }
) {
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, actor_username, action, resource_type, resource_id, details, created_at, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `log_${crypto.randomUUID()}`,
    entry.actorId,
    entry.actorUsername,
    entry.action,
    entry.resourceType,
    entry.resourceId,
    entry.details,
    new Date().toISOString(),
    entry.ipAddress || null
  );
}

export function listAuditLogsAdmin(db: DatabaseSync, limit = 200): AuditLog[] {
  const rows = db
    .prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    actorUid: String(row.actor_id),
    actorEmail: String(row.actor_username),
    action: String(row.action),
    targetType: String(row.resource_type),
    targetId: String(row.resource_id),
    details: String(row.details),
    createdAt: String(row.created_at),
  }));
}

export function getRolePermissionMatrix(db: DatabaseSync): { roleCode: string; roleName: string; permissions: string[] }[] {
  const roles = db.prepare('SELECT * FROM admin_roles').all() as { id: string; role_code: string; role_name: string }[];
  return roles.map((r) => ({
    roleCode: r.role_code,
    roleName: r.role_name,
    permissions: getUserPermissions(db, r.id),
  }));
}
