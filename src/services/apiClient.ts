import {
  AdminUserAccount,
  AuditLog,
  Campaign,
  CatalogForm,
  CatalogReport,
  Department,
  ProposalStatus,
  PublicSubmissionReceipt,
  RbacRoleCode,
  SurveyQuestion,
  SurveyResponse,
  SystemConfig,
} from '../types/survey';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.code);
  }
  return data as T;
}

// ---------- Public Survey APIs ----------

export interface PublicCampaignItem extends Campaign {
  availability: {
    open: boolean;
    reason?: 'CAMPAIGN_NOT_ACTIVE' | 'CAMPAIGN_NOT_STARTED' | 'CAMPAIGN_EXPIRED';
  };
}

export async function fetchPublicCampaigns() {
  return requestJson<{ campaigns: PublicCampaignItem[]; defaultLanguage: string }>('/api/public/campaigns');
}

export async function fetchPublicCampaignDetail(slug: string) {
  return requestJson<{
    campaign: Campaign;
    availability: { open: boolean; reason?: string };
    departments: Department[];
    catalogForms: CatalogForm[];
    questions: SurveyQuestion[];
    defaultLanguage: string;
  }>(`/api/public/campaigns/${encodeURIComponent(slug)}`);
}

export async function submitPublicCustomForm(slug: string, form: CatalogForm) {
  return requestJson<{ form: CatalogForm }>(`/api/public/campaigns/${encodeURIComponent(slug)}/forms`, {
    method: 'POST',
    body: JSON.stringify(form),
  });
}

export async function submitPublicResponse(
  slug: string,
  payload: Omit<SurveyResponse, 'id' | 'responseCode' | 'respondentUid' | 'updatedAt' | 'submittedAt'>
) {
  return requestJson<PublicSubmissionReceipt>(`/api/public/campaigns/${encodeURIComponent(slug)}/responses`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ---------- Private Result Lookup (/my-survey) ----------

export interface MySurveyPayload {
  response: SurveyResponse;
  campaign: Campaign;
  departments: Department[];
  catalogForms: CatalogForm[];
  credential: { status: 'active'; expiresAt: string };
}

export async function verifyMySurveyCredential(responseCode: string, accessToken: string) {
  return requestJson<MySurveyPayload>('/api/public/my-survey/verify', {
    method: 'POST',
    body: JSON.stringify({ responseCode, accessToken }),
  });
}

export async function fetchMySurveyResponse(responseCode: string) {
  return requestJson<MySurveyPayload>(`/api/public/my-survey/${encodeURIComponent(responseCode)}`);
}

export async function updateMySurveyResponse(responseCode: string, patch: Partial<SurveyResponse>) {
  return requestJson<{ response: SurveyResponse; campaign: Campaign }>(
    `/api/public/my-survey/${encodeURIComponent(responseCode)}`,
    {
      method: 'PUT',
      body: JSON.stringify(patch),
    }
  );
}

export async function logoutMySurveySession() {
  return requestJson<{ ok: boolean }>('/api/public/my-survey/logout', { method: 'POST' });
}

// ---------- Admin Auth & Dashboard APIs ----------

export interface AdminAuthSessionResponse {
  user: AdminUserAccount;
  permissions: string[];
  csrfToken: string;
  expiresAt?: string;
}

export async function loginAdminApi(username: string, password: string) {
  return requestJson<AdminAuthSessionResponse>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function fetchAdminMeApi() {
  return requestJson<AdminAuthSessionResponse>('/api/admin/auth/me');
}

export async function logoutAdminApi(csrfToken: string) {
  return requestJson<{ ok: boolean }>('/api/admin/auth/logout', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
  });
}

export async function changeAdminPasswordApi(csrfToken: string, currentPassword: string, newPassword: string) {
  return requestJson<{ ok: boolean; message: string }>('/api/admin/auth/change-password', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export interface AdminDashboardPayload {
  campaigns: Campaign[];
  departments: Department[];
  catalogForms: CatalogForm[];
  catalogReports: CatalogReport[];
  questions: SurveyQuestion[];
  responses: SurveyResponse[];
  systemConfig: SystemConfig;
  auditLogs: AuditLog[];
  users: AdminUserAccount[];
}

export async function fetchAdminDashboardApi() {
  return requestJson<AdminDashboardPayload>('/api/admin/dashboard');
}

export async function saveAdminCampaignApi(csrfToken: string, campaign: Campaign) {
  return requestJson<{ campaign: Campaign }>('/api/admin/campaigns', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(campaign),
  });
}

export async function saveAdminDepartmentApi(csrfToken: string, dept: Department) {
  return requestJson<{ department: Department }>('/api/admin/departments', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(dept),
  });
}

export async function saveAdminFormApi(csrfToken: string, form: CatalogForm) {
  return requestJson<{ form: CatalogForm }>('/api/admin/catalogs/forms', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(form),
  });
}

export async function saveAdminReportApi(csrfToken: string, report: CatalogReport) {
  return requestJson<{ report: CatalogReport }>('/api/admin/catalogs/reports', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(report),
  });
}

export async function saveAdminQuestionApi(csrfToken: string, campaignId: string, question: SurveyQuestion) {
  return requestJson<{ question: SurveyQuestion }>('/api/admin/questions', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ campaignId, question }),
  });
}

export async function deleteAdminQuestionApi(csrfToken: string, questionId: string) {
  return requestJson<{ ok: boolean }>(`/api/admin/questions/${encodeURIComponent(questionId)}`, {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': csrfToken },
  });
}

export async function deleteAdminResponseApi(csrfToken: string, responseId: string) {
  return requestJson<{ ok: boolean }>(`/api/admin/responses/${encodeURIComponent(responseId)}`, {
    method: 'DELETE',
    headers: { 'X-CSRF-Token': csrfToken },
  });
}

export async function updateProposalStatusApi(
  csrfToken: string,
  responseId: string,
  proposalStatus: ProposalStatus
) {
  return requestJson<{ ok: boolean; proposalStatus: ProposalStatus }>(
    `/api/admin/responses/${encodeURIComponent(responseId)}/proposal-status`,
    {
      method: 'PATCH',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ proposalStatus }),
    }
  );
}

export async function revokeResponseTokenApi(csrfToken: string, responseId: string) {
  return requestJson<{ ok: boolean; revokedCount: number }>(
    `/api/admin/credentials/${encodeURIComponent(responseId)}/revoke`,
    {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
    }
  );
}

export async function saveAdminSettingsApi(csrfToken: string, settings: SystemConfig) {
  return requestJson<{ settings: SystemConfig }>('/api/admin/settings', {
    method: 'PUT',
    headers: { 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(settings),
  });
}

export async function fetchAdminUsersApi() {
  return requestJson<{
    users: AdminUserAccount[];
    roles: { roleCode: string; roleName: string; permissions: string[] }[];
  }>('/api/admin/users');
}

export async function createAdminUserApi(
  csrfToken: string,
  input: {
    username: string;
    email: string;
    fullName: string;
    password: string;
    roleCode: Exclude<RbacRoleCode, 'PUBLIC'>;
    departmentScope?: string;
  }
) {
  return requestJson<{ user: AdminUserAccount }>('/api/admin/users', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(input),
  });
}

export async function updateAdminUserApi(
  csrfToken: string,
  userId: string,
  patch: {
    fullName?: string;
    roleCode?: Exclude<RbacRoleCode, 'PUBLIC'>;
    status?: 'active' | 'suspended';
    departmentScope?: string;
    password?: string;
  }
) {
  return requestJson<{ user: AdminUserAccount }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(patch),
  });
}
