import { z } from 'zod';

export type LanguageCode = 'vi' | 'en' | 'ko' | 'zh';
export type UserRole = 'super_admin' | 'admin' | 'analyst' | 'respondent';
export type RbacRoleCode = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'RESPONDENT' | 'PUBLIC';
export type FormGroupId = 'production' | 'material' | 'equipment' | 'quality' | 'traceability' | 'system';
export type ReportCategoryId = 'production_reports' | 'quality_reports' | 'equipment_reports' | 'material_reports' | 'management_reports';
export type UsageFrequency = 'multi_daily' | 'daily' | 'weekly' | 'monthly' | 'rarely';
export type DxDemandLevel = 'essential' | 'needed' | 'neutral' | 'not_yet' | 'no_need';
export type PriorityTier = 'P1' | 'P2' | 'P3' | 'P4';
export type ProposalStatus = 'pending' | 'reviewing' | 'approved' | 'in_progress' | 'completed';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  employeeId?: string;
  departmentId?: string;
  section?: string;
  jobTitle?: string;
  role: UserRole;
  preferredLang: LanguageCode;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserAccount {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleCode: RbacRoleCode;
  departmentScope?: string;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface PublicSubmissionReceipt {
  responseId: string;
  responseCode: string;
  accessToken: string;
  submittedAt: string;
  status: 'submitted' | 'draft';
  expiresAt: string;
  campaignSlug: string;
  campaignTitle: string;
  allowEditAfterSubmit: boolean;
}

export interface Department {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  nameKo?: string;
  nameZh?: string;
  sections?: string[];
  targetHeadcount: number;
  active: boolean;
  updatedAt: string;
}

export interface CatalogForm {
  id: string;
  groupId: FormGroupId;
  code: string;
  nameEn: string;
  nameVi: string;
  nameKo?: string;
  nameZh?: string;
  description?: string;
  isCustom: boolean;
  active: boolean;
}

export interface CatalogReport {
  id: string;
  categoryId: ReportCategoryId;
  code: string;
  nameEn: string;
  nameVi: string;
  nameKo?: string;
  nameZh?: string;
  description?: string;
  isCustom: boolean;
  active: boolean;
}

export interface Campaign {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  status: 'draft' | 'active' | 'closed' | 'archived';
  allowAnonymous: boolean;
  requireAuth: boolean;
  requireEmployeeCode?: boolean;
  requireParticipantName?: boolean;
  allowMultipleSubmissions?: boolean;
  allowEditAfterSubmit?: boolean;
  startDate?: string;
  endDate?: string;
  targetParticipants: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyQuestion {
  id: string;
  section: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  labelVi: string;
  labelEn: string;
  labelKo?: string;
  labelZh?: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'rating' | 'boolean' | 'number';
  required: boolean;
  orderIndex: number;
  conditionField?: string;
  conditionValue?: string;
  active: boolean;
}

export interface ParticipantInfo {
  employeeId: string;
  fullName: string;
  departmentId: string;
  section: string;
  jobTitle: string;
  workGroup: string;
  shift: 'day' | 'night' | 'rotating' | 'office';
  mesExperience: '<6m' | '6m-1y' | '1-3y' | '3-5y' | '>5y';
  frequentSystems: string[];
  otherSystem: string;
  surveyDate?: string;
}

export interface SelectedFormEvaluation {
  formId: string;
  formName: string;
  groupId: FormGroupId;
  isCustom: boolean;
  purpose: string;
  frequency: UsageFrequency;
  avgMinutes: number;
  userCount: number;
  importance: number; // 1-5
  usability: number; // 1-5
  businessFit: number; // 1-5
  usedFeatures: string;
  unusedFeatures: string;
  painPoints: string;
  improvements: string;
  authorizedUsers?: string;
  importanceLevel?: 'high_urgent' | 'medium' | 'low';
  frequencyChosen?: boolean;
}

export interface SelectedReportEvaluation {
  reportId: string;
  reportName: string;
  categoryId: ReportCategoryId;
  isCustom: boolean;
  frequency: UsageFrequency;
  users: string;
  purpose: string;
  needExcel: boolean;
  needPdf: boolean;
  needAutoEmail: boolean;
  needMobile: boolean;
  needRealtime: boolean;
  loadTimeSec: number;
  dataAccuracy: number; // 1-5
  satisfaction: number; // 1-5
  extraMetrics: string;
  duplicateReports: string;
}

export interface WorkflowEvaluation {
  processId: string;
  processName: string;
  department: string;
  frequency: UsageFrequency;
  processingMinutes: number;
  participantCount: number;
  difficulties: string;
  impactScore: number; // 1-5
  automationIdea: string;
}

export interface DxNeedEvaluation {
  featureId: string;
  featureName: string;
  demandLevel: DxDemandLevel;
}

export interface UxRatings {
  uiEase: number;
  searchSpeed: number;
  stepEfficiency: number;
  pageLoadSpeed: number;
  errorStability: number;
  dataAccuracy: number;
  permissionFit: number;
  needMobileUi: number;
  needMultilang: number;
}

export interface ProposalsData {
  topImprovement: string;
  requestedForms: string;
  requestedReports: string;
  automationTarget: string;
  biggestChallenge: string;
  dxProposal: string;
  priority: PriorityTier;
  attachmentNames: string[];
  customAnswers?: Record<string, string | number | boolean>;
}

export interface SurveyResponse {
  id: string;
  campaignId: string;
  responseCode?: string;
  respondentUid: string;
  isAnonymous: boolean;
  status: 'draft' | 'submitted';
  proposalStatus?: ProposalStatus;
  credentialStatus?: 'active' | 'revoked' | 'expired' | 'none';
  credentialExpiresAt?: string;
  departmentId: string;
  section?: string;
  participantInfo: ParticipantInfo;
  selectedForms: SelectedFormEvaluation[];
  selectedReports: SelectedReportEvaluation[];
  workflowEvaluations: WorkflowEvaluation[];
  dxNeeds: DxNeedEvaluation[];
  uxRatings: UxRatings;
  proposals: ProposalsData;
  submittedAt?: string;
  updatedAt: string;
}

export interface SystemConfig {
  id: string;
  anonymousSurveyDefault: boolean;
  requireGoogleLogin: boolean;
  defaultLanguage: LanguageCode;
  minSampleThreshold: number;
  tokenTtlDays?: number;
  retentionDays?: number;
  updatedBy: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}

export interface PriorityMatrixItem {
  id: string;
  itemName: string;
  category: 'form_upgrade' | 'report_realtime' | 'report_consolidate' | 'workflow_automation' | 'dx_capability';
  recommendationType: string;
  businessImpact: number; // 1-5
  usageFrequency: number; // 1-5
  userDemand: number; // 1-5
  rawScore: number;
  normalizedScore: number; // 0-100
  tier: PriorityTier;
  departmentCount: number;
  departments: string[];
  sampleCount: number;
  rationale: string;
}

export const participantSchema = z.object({
  employeeId: z.string().max(40),
  fullName: z.string().max(120),
  departmentId: z.string().min(1, 'Department is required'),
  section: z.string().max(80),
  jobTitle: z.string().min(1, 'Job title is required').max(80),
  workGroup: z.string().max(80),
  shift: z.enum(['day', 'night', 'rotating', 'office']),
  mesExperience: z.enum(['<6m', '6m-1y', '1-3y', '3-5y', '>5y']),
  frequentSystems: z.array(z.string()).min(1, 'Select at least one system'),
  otherSystem: z.string().max(100),
});
