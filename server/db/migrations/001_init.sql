-- Migration 001: Public Survey, Private Access Credentials, RBAC & Audit Schema

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ko TEXT,
  name_zh TEXT,
  sections_json TEXT NOT NULL DEFAULT '[]',
  target_headcount INTEGER NOT NULL DEFAULT 10,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_forms (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  name_ko TEXT,
  name_zh TEXT,
  description TEXT,
  is_custom INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS catalog_reports (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  name_ko TEXT,
  name_zh TEXT,
  description TEXT,
  is_custom INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS survey_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  start_at TEXT,
  end_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  is_anonymous INTEGER NOT NULL DEFAULT 1,
  require_employee_code INTEGER NOT NULL DEFAULT 0,
  require_participant_name INTEGER NOT NULL DEFAULT 0,
  allow_multiple_submissions INTEGER NOT NULL DEFAULT 1,
  allow_edit_after_submit INTEGER NOT NULL DEFAULT 0,
  target_participants INTEGER NOT NULL DEFAULT 100,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON survey_campaigns(slug);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON survey_campaigns(status);

CREATE TABLE IF NOT EXISTS survey_questions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES survey_campaigns(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  label_vi TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_ko TEXT,
  label_zh TEXT,
  type TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  condition_field TEXT,
  condition_value TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_questions_campaign ON survey_questions(campaign_id, order_index);

CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES survey_campaigns(id) ON DELETE CASCADE,
  response_code TEXT NOT NULL UNIQUE,
  department_id TEXT NOT NULL REFERENCES departments(id),
  section TEXT NOT NULL DEFAULT '',
  employee_code TEXT,
  participant_name TEXT,
  job_title TEXT NOT NULL DEFAULT '',
  work_group TEXT NOT NULL DEFAULT '',
  shift TEXT NOT NULL DEFAULT 'day',
  mes_experience TEXT NOT NULL DEFAULT '1-3y',
  frequent_systems_json TEXT NOT NULL DEFAULT '[]',
  other_system TEXT NOT NULL DEFAULT '',
  survey_date TEXT NOT NULL DEFAULT '',
  selected_forms_json TEXT NOT NULL DEFAULT '[]',
  selected_reports_json TEXT NOT NULL DEFAULT '[]',
  workflow_evaluations_json TEXT NOT NULL DEFAULT '[]',
  dx_needs_json TEXT NOT NULL DEFAULT '[]',
  ux_ratings_json TEXT NOT NULL DEFAULT '{}',
  proposals_json TEXT NOT NULL DEFAULT '{}',
  proposal_status TEXT NOT NULL DEFAULT 'pending' CHECK (proposal_status IN ('pending', 'reviewing', 'approved', 'in_progress', 'completed')),
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted')),
  is_anonymous INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_responses_campaign ON survey_responses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_responses_code ON survey_responses(response_code);
CREATE INDEX IF NOT EXISTS idx_responses_dept ON survey_responses(department_id);
CREATE INDEX IF NOT EXISTS idx_responses_emp ON survey_responses(campaign_id, employee_code);

CREATE TABLE IF NOT EXISTS survey_response_answers (
  id TEXT PRIMARY KEY,
  response_id TEXT NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  answer_value TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_answers_response ON survey_response_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON survey_response_answers(question_id);

CREATE TABLE IF NOT EXISTS survey_access_credentials (
  id TEXT PRIMARY KEY,
  response_id TEXT NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_credentials_response ON survey_access_credentials(response_id);
CREATE INDEX IF NOT EXISTS idx_credentials_hash ON survey_access_credentials(token_hash);

CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  role_code TEXT NOT NULL UNIQUE,
  role_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  id TEXT PRIMARY KEY,
  permission_code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_id TEXT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES admin_roles(id),
  department_scope TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_hash ON admin_sessions(token_hash);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_username TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY,
  anonymous_survey_default INTEGER NOT NULL DEFAULT 1,
  require_google_login INTEGER NOT NULL DEFAULT 0,
  default_language TEXT NOT NULL DEFAULT 'vi',
  min_sample_threshold INTEGER NOT NULL DEFAULT 5,
  token_ttl_days INTEGER NOT NULL DEFAULT 90,
  retention_days INTEGER NOT NULL DEFAULT 365,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
