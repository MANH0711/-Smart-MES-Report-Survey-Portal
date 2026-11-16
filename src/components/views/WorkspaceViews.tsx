import { useMemo, useState } from 'react';
import { Eye, KeyRound, ShieldOff, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { computeSurveyAnalytics } from '../../lib/analyticsEngine';
import { exportResponsesToExcelCsv, triggerPrintPdfReport } from '../../lib/exportUtils';
import { PriorityTier, ProposalStatus, SurveyResponse } from '../../types/survey';
import {
  FormCatalogPanel,
  QuestionManagerPanel,
  ReportCatalogPanel,
} from '../admin/AdminCatalogManagers';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DataTable, DataTableColumn } from '../ui/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Sheet, SheetContent } from '../ui/sheet';

export function FormsCatalogView() {
  const { hasPermission } = useApp();
  return <FormCatalogPanel canEdit={hasPermission('catalogs:write')} />;
}

export function ReportsCatalogView() {
  const { hasPermission } = useApp();
  return <ReportCatalogPanel canEdit={hasPermission('catalogs:write')} />;
}

export function QuestionsView() {
  const { hasPermission } = useApp();
  return <QuestionManagerPanel canEdit={hasPermission('questions:write')} />;
}

function tierVariant(tier: PriorityTier): 'danger' | 'warning' | 'primary' | 'default' {
  if (tier === 'P1') return 'danger';
  if (tier === 'P2') return 'warning';
  if (tier === 'P3') return 'primary';
  return 'default';
}

function credBadgeVariant(status?: SurveyResponse['credentialStatus']): 'success' | 'danger' | 'warning' | 'default' {
  if (status === 'active') return 'success';
  if (status === 'revoked') return 'danger';
  if (status === 'expired') return 'warning';
  return 'default';
}

export function ResultsView() {
  const {
    lang,
    t,
    hasPermission,
    departments,
    catalogForms,
    catalogReports,
    responses,
    systemConfig,
    removeResponse,
    updateProposalStatus,
    revokeResponseToken,
  } = useApp();

  const [deptFilter, setDeptFilter] = useState('all');
  const [inspectResp, setInspectResp] = useState<SurveyResponse | null>(null);
  const canDelete = hasPermission('responses:delete');
  const canEditProposal = hasPermission('responses:write');
  const canRevoke = hasPermission('credentials:revoke');

  const analytics = useMemo(
    () =>
      computeSurveyAnalytics(
        responses,
        departments,
        catalogForms,
        catalogReports,
        120,
        systemConfig.minSampleThreshold
      ),
    [responses, departments, catalogForms, catalogReports, systemConfig.minSampleThreshold]
  );

  const filteredResponses = useMemo(() => {
    if (deptFilter === 'all') return responses;
    return responses.filter((r) => r.departmentId === deptFilter);
  }, [responses, deptFilter]);

  const deptLabel = (deptId: string) => {
    const d = departments.find((x) => x.id === deptId);
    if (!d) return deptId;
    return lang === 'vi' ? d.nameVi : d.nameEn;
  };

  const credLabel = (status?: SurveyResponse['credentialStatus']) => {
    if (status === 'active') return t('credActive');
    if (status === 'revoked') return t('credRevoked');
    if (status === 'expired') return t('credExpired');
    return t('credNone');
  };

  const columns: DataTableColumn<SurveyResponse>[] = [
    {
      id: 'responseCode',
      header: t('colCode'),
      accessor: (r) => r.responseCode || r.id,
      cell: (r) => (
        <span className="font-mono-num text-[11.5px] font-semibold text-[#0B2B5B] dark:text-cyan-400 whitespace-nowrap">
          {r.responseCode || r.id.slice(0, 12)}
        </span>
      ),
    },
    {
      id: 'respondent',
      header: t('colRespondent'),
      accessor: (r) => (r.isAnonymous ? t('anonymousMode') : r.participantInfo.fullName),
      cell: (r) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">
            {r.isAnonymous ? t('anonymousMode') : r.participantInfo.fullName}
          </div>
          <div className="text-[11px] text-slate-400">{r.participantInfo.jobTitle}</div>
        </div>
      ),
    },
    {
      id: 'dept',
      header: t('department'),
      accessor: (r) => deptLabel(r.departmentId),
      cell: (r) => (
        <Badge variant="default">
          {departments.find((d) => d.id === r.departmentId)?.code || r.departmentId}
        </Badge>
      ),
    },
    {
      id: 'forms',
      header: t('formsUnit'),
      accessor: (r) => r.selectedForms.length,
      align: 'right',
    },
    {
      id: 'priority',
      header: t('colTier'),
      accessor: (r) => r.proposals.priority,
      cell: (r) => <Badge variant={tierVariant(r.proposals.priority)}>{r.proposals.priority}</Badge>,
    },
    {
      id: 'proposalStatus',
      header: t('proposalStatusLabel'),
      accessor: (r) => r.proposalStatus || 'pending',
      cell: (r) => (
        <Select
          value={r.proposalStatus || 'pending'}
          disabled={!canEditProposal}
          onValueChange={(v) => updateProposalStatus(r.id, v as ProposalStatus)}
        >
          <SelectTrigger className="h-7 w-[130px] text-[11.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">{t('proposalPending')}</SelectItem>
            <SelectItem value="reviewing">{t('proposalReviewing')}</SelectItem>
            <SelectItem value="approved">{t('proposalApproved')}</SelectItem>
            <SelectItem value="in_progress">{t('proposalInProgress')}</SelectItem>
            <SelectItem value="completed">{t('proposalCompleted')}</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      id: 'credential',
      header: 'Token',
      accessor: (r) => r.credentialStatus || 'none',
      cell: (r) => (
        <Badge variant={credBadgeVariant(r.credentialStatus)}>{credLabel(r.credentialStatus)}</Badge>
      ),
    },
    {
      id: 'submittedAt',
      header: t('colSubmittedAt'),
      accessor: (r) => (r.submittedAt || r.updatedAt).slice(0, 10),
      cell: (r) => (
        <span className="font-mono-num text-slate-500">
          {(r.submittedAt || r.updatedAt).slice(0, 10)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('colActions'),
      sortable: false,
      align: 'right',
      accessor: (r) => r.id,
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setInspectResp(r)}
            aria-label={t('inspectDetail')}
            title={t('inspectDetail')}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {canRevoke && r.credentialStatus === 'active' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => revokeResponseToken(r.id)}
              aria-label={t('revokeTokenBtn')}
              title={t('revokeTokenBtn')}
            >
              <ShieldOff className="h-3.5 w-3.5 text-amber-600" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={!canDelete}
            onClick={() => removeResponse(r.id)}
            aria-label={t('tableBulkDelete')}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-600" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <DataTable
          data={filteredResponses}
          columns={columns}
          getRowId={(r) => r.id}
          selectable={true}
          onExportExcel={(rows) => exportResponsesToExcelCsv(rows, departments, analytics.priorityMatrix)}
          onExportPdf={triggerPrintPdfReport}
          searchPlaceholder={t('tableSearch')}
          emptyText={t('tableNoResults')}
          labels={{
            columns: t('tableColumns'),
            selected: t('tableSelected'),
            rowsPerPage: t('tableRowsPerPage'),
            page: t('tablePage'),
            of: t('tableOf'),
            exportExcel: t('exportExcelCsv'),
            exportPdf: t('exportPdfPrint'),
          }}
          bulkActions={[
            {
              id: 'export',
              label: t('tableBulkExport'),
              variant: 'outline',
              onClick: (rows) => exportResponsesToExcelCsv(rows, departments, analytics.priorityMatrix),
            },
            ...(canDelete
              ? [
                  {
                    id: 'delete',
                    label: t('tableBulkDelete'),
                    variant: 'destructive' as const,
                    onClick: (rows: SurveyResponse[]) => {
                      rows.forEach((row) => removeResponse(row.id));
                    },
                  },
                ]
              : []),
          ]}
          toolbarExtra={
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('allDepartments')} ({responses.length})
                </SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {lang === 'vi' ? d.nameVi : d.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      </div>

      {/* Right-Side Inspection Sheet Drawer */}
      <Sheet open={Boolean(inspectResp)} onOpenChange={(o) => !o && setInspectResp(null)}>
        <SheetContent side="right" className="overflow-y-auto p-4">
          {inspectResp && (
            <div className="space-y-3 pt-2 text-[12px]">
              <div className="border-b border-slate-100 pb-2.5 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    {t('inspectDetail')}
                  </h3>
                  <Badge variant={credBadgeVariant(inspectResp.credentialStatus)}>
                    <KeyRound className="mr-1 h-3 w-3" />
                    {credLabel(inspectResp.credentialStatus)}
                  </Badge>
                </div>
                <div className="mt-1 font-mono-num text-[11px] text-slate-500">
                  {inspectResp.responseCode || inspectResp.id}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-2.5 dark:bg-slate-950">
                <div>
                  <span className="text-slate-500">{t('colRespondent')}: </span>
                  <span className="font-semibold">
                    {inspectResp.isAnonymous ? t('anonymousMode') : inspectResp.participantInfo.fullName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">{t('department')}: </span>
                  <span className="font-semibold">{deptLabel(inspectResp.departmentId)}</span>
                </div>
                <div>
                  <span className="text-slate-500">{t('formsUnit')}: </span>
                  <span className="font-mono-num font-semibold">{inspectResp.selectedForms.length}</span>
                </div>
                <div>
                  <span className="text-slate-500">{t('proposalStatusLabel')}: </span>
                  <span className="font-semibold">{inspectResp.proposalStatus || 'pending'}</span>
                </div>
              </div>

              {canRevoke && inspectResp.credentialStatus === 'active' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-amber-700 border-amber-300"
                  onClick={async () => {
                    await revokeResponseToken(inspectResp.id);
                    setInspectResp((prev) => (prev ? { ...prev, credentialStatus: 'revoked' } : null));
                  }}
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                  <span>{t('revokeTokenBtn')}</span>
                </Button>
              )}

              <div>
                <div className="mb-1 font-semibold">{t('proposalTopImprovement')}</div>
                <p className="rounded border border-slate-100 p-2 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  {inspectResp.proposals.topImprovement || '—'}
                </p>
              </div>

              <div>
                <div className="mb-1 font-semibold">{t('proposalBiggestChallenge')}</div>
                <p className="rounded border border-slate-100 p-2 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  {inspectResp.proposals.biggestChallenge || '—'}
                </p>
              </div>

              <div>
                <div className="mb-1 font-semibold">
                  {t('reviewSummaryForms')} ({inspectResp.selectedForms.length})
                </div>
                <ul className="space-y-1.5">
                  {inspectResp.selectedForms.map((f) => {
                    const impLabel =
                      f.importanceLevel === 'high_urgent' || f.importance >= 4
                        ? t('impHighUrgent')
                        : f.importanceLevel === 'medium' || f.importance === 3
                        ? t('impMedium')
                        : t('impLow');
                    const authUsers = f.authorizedUsers || f.usedFeatures;
                    return (
                      <li
                        key={f.formId}
                        className="rounded border border-slate-100 p-2 dark:border-slate-800"
                      >
                        <div className="font-medium text-slate-900 dark:text-slate-100">{f.formName}</div>
                        <div className="mt-0.5 font-mono-num text-[11px] text-slate-500">
                          {f.frequency} · {t('importance')}: {impLabel} ({f.importance}/5)
                        </div>
                        {authUsers && (
                          <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="font-medium">{t('colAuthorizedUsers')}:</span> {authUsers}
                          </div>
                        )}
                        {(f.improvements || f.painPoints) && (
                          <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="font-medium">{t('improvements')}:</span>{' '}
                            {f.improvements || f.painPoints}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
