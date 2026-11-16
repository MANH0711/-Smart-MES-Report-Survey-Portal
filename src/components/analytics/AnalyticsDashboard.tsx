import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ClipboardList,
  Download,
  FileJson,
  Printer,
  RefreshCw,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { computeSurveyAnalytics } from '../../lib/analyticsEngine';
import {
  exportBusinessRequirementsJson,
  exportResponsesToExcelCsv,
  triggerPrintPdfReport,
} from '../../lib/exportUtils';
import { FORM_GROUPS } from '../../data/catalogs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DataTable, DataTableColumn } from '../ui/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { PriorityMatrixItem, PriorityTier } from '../../types/survey';
import { cn } from '../../lib/utils';

interface AnalyticsDashboardProps {
  mode?: 'dashboard' | 'analytics' | 'summary';
}

function tierBadgeVariant(tier: PriorityTier): 'danger' | 'warning' | 'primary' | 'default' {
  if (tier === 'P1') return 'danger';
  if (tier === 'P2') return 'warning';
  if (tier === 'P3') return 'primary';
  return 'default';
}

export function AnalyticsDashboard({ mode = 'analytics' }: AnalyticsDashboardProps) {
  const {
    lang,
    t,
    departments,
    catalogForms,
    catalogReports,
    campaigns,
    activeCampaignId,
    responses,
    systemConfig,
    setActiveRoute,
  } = useApp();

  const [filterCampaign, setFilterCampaign] = useState<string>(activeCampaignId || 'all');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<'all' | '7d' | '30d'>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [apiSyncing, setApiSyncing] = useState(false);

  const selectedCampaignObj = campaigns.find((c) => c.id === filterCampaign);
  const targetParticipants = selectedCampaignObj?.targetParticipants || 120;

  const availableSections = useMemo(() => {
    if (filterDept === 'all') {
      return Array.from(new Set(responses.map((r) => r.section).filter(Boolean) as string[]));
    }
    const d = departments.find((x) => x.id === filterDept);
    return d?.sections || [];
  }, [filterDept, departments, responses]);

  const filteredResponses = useMemo(() => {
    const now = Date.now();
    return responses
      .filter((r) => (filterCampaign === 'all' ? true : r.campaignId === filterCampaign))
      .filter((r) => (filterDept === 'all' ? true : r.departmentId === filterDept))
      .filter((r) => (filterSection === 'all' ? true : r.section === filterSection))
      .filter((r) => {
        if (filterTime === 'all') return true;
        const ts = new Date(r.submittedAt || r.updatedAt).getTime();
        const days = filterTime === '7d' ? 7 : 30;
        return now - ts <= days * 24 * 60 * 60 * 1000;
      })
      .map((r) => {
        if (filterGroup === 'all') return r;
        return {
          ...r,
          selectedForms: r.selectedForms.filter((f) => f.groupId === filterGroup),
        };
      });
  }, [responses, filterCampaign, filterDept, filterSection, filterTime, filterGroup]);

  const analytics = useMemo(
    () =>
      computeSurveyAnalytics(
        filteredResponses,
        departments,
        catalogForms,
        catalogReports,
        targetParticipants,
        systemConfig.minSampleThreshold
      ),
    [filteredResponses, departments, catalogForms, catalogReports, targetParticipants, systemConfig.minSampleThreshold]
  );

  const improvementCount = useMemo(() => {
    const submitted = filteredResponses.filter((r) => r.status === 'submitted');
    let count = 0;
    for (const r of submitted) {
      if (r.proposals.topImprovement?.trim()) count += 1;
      for (const f of r.selectedForms) {
        if (f.improvements?.trim()) count += 1;
      }
    }
    return count;
  }, [filteredResponses]);

  const automationProposalCount = useMemo(() => {
    const submitted = filteredResponses.filter((r) => r.status === 'submitted');
    let count = 0;
    for (const r of submitted) {
      if (r.proposals.automationTarget?.trim()) count += 1;
      for (const wf of r.workflowEvaluations) {
        if (wf.automationIdea?.trim()) count += 1;
      }
    }
    return count;
  }, [filteredResponses]);

  const displayedMatrix = useMemo(() => {
    if (tierFilter === 'all') return analytics.priorityMatrix;
    return analytics.priorityMatrix.filter((m) => m.tier === tierFilter);
  }, [analytics.priorityMatrix, tierFilter]);

  // Top Forms & Top Reports datasets for Dashboard
  const topFormsRows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; groupId: string; count: number; impSum: number; easeSum: number }>();
    for (const r of filteredResponses.filter((x) => x.status === 'submitted')) {
      for (const f of r.selectedForms) {
        const cur = map.get(f.formId) || { id: f.formId, name: f.formName, groupId: f.groupId, count: 0, impSum: 0, easeSum: 0 };
        cur.count += 1;
        cur.impSum += f.importance;
        cur.easeSum += f.usability;
        map.set(f.formId, cur);
      }
    }
    return Array.from(map.values())
      .map((x) => ({
        ...x,
        avgImp: Math.round((x.impSum / x.count) * 10) / 10,
        avgEase: Math.round((x.easeSum / x.count) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredResponses]);

  const topReportsRows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; categoryId: string; count: number; rtCount: number; loadSum: number }>();
    for (const r of filteredResponses.filter((x) => x.status === 'submitted')) {
      for (const rep of r.selectedReports) {
        const cur = map.get(rep.reportId) || { id: rep.reportId, name: rep.reportName, categoryId: rep.categoryId, count: 0, rtCount: 0, loadSum: 0 };
        cur.count += 1;
        if (rep.needRealtime) cur.rtCount += 1;
        cur.loadSum += rep.loadTimeSec || 0;
        map.set(rep.reportId, cur);
      }
    }
    return Array.from(map.values())
      .map((x) => ({
        ...x,
        rtPct: Math.round((x.rtCount / x.count) * 100),
        avgLoad: Math.round((x.loadSum / x.count) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredResponses]);

  const verifyViaApi = async () => {
    setApiSyncing(true);
    try {
      const res = await fetch('/api/analytics/priority-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses: filteredResponses,
          targetParticipants,
          minSampleThreshold: systemConfig.minSampleThreshold,
        }),
      });
      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      toast.success(`n = ${data.sampleCount} · ${data.priorityMatrix?.length || 0}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'API error');
    } finally {
      setApiSyncing(false);
    }
  };

  // Column definitions
  const matrixColumns: DataTableColumn<PriorityMatrixItem>[] = [
    {
      id: 'tier',
      header: t('colTier'),
      accessor: (r) => r.tier,
      cell: (r) => <Badge variant={tierBadgeVariant(r.tier)}>{r.tier}</Badge>,
    },
    {
      id: 'score',
      header: t('colScore'),
      accessor: (r) => r.normalizedScore,
      align: 'right',
      cell: (r) => <span className="font-mono-num font-semibold">{r.normalizedScore}/100</span>,
    },
    {
      id: 'itemName',
      header: t('colRequirement'),
      accessor: (r) => r.itemName,
      cell: (r) => <span className="font-medium text-slate-900 dark:text-slate-100">{r.itemName}</span>,
    },
    {
      id: 'type',
      header: t('colType'),
      accessor: (r) => r.recommendationType,
      cell: (r) => <Badge variant="default">{r.recommendationType}</Badge>,
    },
    {
      id: 'impact',
      header: t('colImpact'),
      accessor: (r) => r.businessImpact,
      align: 'right',
    },
    {
      id: 'freq',
      header: t('colFreq'),
      accessor: (r) => r.usageFrequency,
      align: 'right',
    },
    {
      id: 'demand',
      header: t('colDemand'),
      accessor: (r) => r.userDemand,
      align: 'right',
    },
    {
      id: 'depts',
      header: t('colDepts'),
      accessor: (r) => r.departments.join(', '),
      cell: (r) => <span className="font-mono-num text-slate-600 dark:text-slate-300">{r.departments.join(', ')}</span>,
    },
    {
      id: 'rationale',
      header: t('colRationale'),
      accessor: (r) => r.rationale,
      defaultHidden: mode === 'dashboard',
      cell: (r) => (
        <span className="block max-w-[260px] truncate text-slate-500 dark:text-slate-400" title={r.rationale}>
          {r.rationale}
        </span>
      ),
    },
  ];

  const topFormColumns: DataTableColumn<(typeof topFormsRows)[number]>[] = [
    { id: 'name', header: t('colName'), accessor: (r) => r.name },
    {
      id: 'group',
      header: t('colGroup'),
      accessor: (r) => r.groupId,
      cell: (r) => (
        <Badge variant="default">
          {FORM_GROUPS.find((g) => g.id === r.groupId)?.labels[lang] || r.groupId}
        </Badge>
      ),
    },
    { id: 'count', header: t('colUsageCount'), accessor: (r) => r.count, align: 'right' },
    { id: 'imp', header: t('colAvgImportance'), accessor: (r) => r.avgImp, align: 'right' },
    {
      id: 'ease',
      header: t('colAvgUsability'),
      accessor: (r) => r.avgEase,
      align: 'right',
      cell: (r) => (
        <Badge variant={r.avgEase <= 2.8 ? 'warning' : 'success'}>{r.avgEase}</Badge>
      ),
    },
  ];

  const topReportColumns: DataTableColumn<(typeof topReportsRows)[number]>[] = [
    { id: 'name', header: t('colName'), accessor: (r) => r.name },
    { id: 'count', header: t('colUsageCount'), accessor: (r) => r.count, align: 'right' },
    {
      id: 'rtPct',
      header: t('colRealtimePct'),
      accessor: (r) => r.rtPct,
      align: 'right',
      cell: (r) => <Badge variant={r.rtPct >= 50 ? 'primary' : 'default'}>{r.rtPct}%</Badge>,
    },
    {
      id: 'avgLoad',
      header: t('colAvgLoadSec'),
      accessor: (r) => r.avgLoad,
      align: 'right',
      cell: (r) => <span className="font-mono-num">{r.avgLoad}s</span>,
    },
  ];

  const tableLabels = {
    columns: t('tableColumns'),
    selected: t('tableSelected'),
    rowsPerPage: t('tableRowsPerPage'),
    page: t('tablePage'),
    of: t('tableOf'),
    exportExcel: t('exportExcelCsv'),
    exportPdf: t('exportPdfPrint'),
  };

  // 6 KPIs in 1 row (as required for Dashboard)
  const dashboardKpis = [
    {
      label: t('kpiParticipants'),
      value: String(analytics.sampleCount),
      sub: `${t('kpiTarget')}: ${analytics.targetParticipants}`,
    },
    {
      label: t('kpiCompletionRate'),
      value: `${analytics.responseRatePct}%`,
      sub: `${t('kpiSubmitted')}: ${analytics.completionRatePct}%`,
    },
    {
      label: t('kpiTotalForms'),
      value: String(analytics.totalUniqueFormsUsed),
      sub: `${t('kpiCatalog')}: ${catalogForms.length}`,
    },
    {
      label: t('kpiTotalReports'),
      value: String(analytics.totalUniqueReportsUsed),
      sub: `${t('kpiCatalog')}: ${catalogReports.length}`,
    },
    {
      label: t('kpiImprovementRequests'),
      value: String(improvementCount),
      sub: `${t('kpiAvgUx')}: ${analytics.avgUxSatisfaction}/5`,
    },
    {
      label: t('kpiAutomationProposals'),
      value: String(automationProposalCount),
      sub: `${analytics.automatableHoursPerWeek}h / ${t('kpiWeeklyHoursSaved')}`,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Compact Top Filter & Action Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Select value={filterCampaign} onValueChange={setFilterCampaign}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allCampaigns')}</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterDept}
            onValueChange={(v) => {
              setFilterDept(v);
              setFilterSection('all');
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allDepartments')}</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {lang === 'vi' ? d.nameVi : d.nameEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterSection} onValueChange={setFilterSection}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allSections')}</SelectItem>
              {availableSections.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allGroups')}</SelectItem>
              {FORM_GROUPS.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.labels[lang]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterTime} onValueChange={(v) => setFilterTime(v as 'all' | '7d' | '30d')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allTime')}</SelectItem>
              <SelectItem value="7d">{t('last7Days')}</SelectItem>
              <SelectItem value="30d">{t('last30Days')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {mode === 'dashboard' && (
            <Button size="sm" onClick={() => setActiveRoute('survey')}>
              <ClipboardList className="h-3.5 w-3.5" />
              <span>{t('startSurvey')}</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={verifyViaApi} disabled={apiSyncing}>
            <RefreshCw className={cn('h-3.5 w-3.5', apiSyncing && 'animate-spin')} />
            <span>{t('apiRecalculate')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportResponsesToExcelCsv(filteredResponses, departments, analytics.priorityMatrix)}
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t('exportExcelCsv')}</span>
          </Button>
          {mode === 'summary' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportBusinessRequirementsJson(
                  analytics.priorityMatrix,
                  analytics.sampleCount,
                  analytics.responseRatePct
                )
              }
            >
              <FileJson className="h-3.5 w-3.5" />
              <span>{t('exportJsonSpec')}</span>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={triggerPrintPdfReport}>
            <Printer className="h-3.5 w-3.5" />
            <span>{t('exportPdfPrint')}</span>
          </Button>
        </div>
      </div>

      {/* Minimum Sample Statistical Gate */}
      {!analytics.meetsSampleThreshold && (
        <div className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">
              {t('sampleGateTitle')} (n = {analytics.sampleCount} / {analytics.minSampleThreshold} · {analytics.responseRatePct}%)
            </div>
            <p className="mt-0.5 text-[11px] opacity-90">{t('sampleGateWarning')}</p>
          </div>
        </div>
      )}

      {/* 6 KPIs in 1 Row */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {dashboardKpis.map((k) => (
          <div
            key={k.label}
            className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="truncate text-[12px] font-medium text-slate-500 dark:text-slate-400">
              {k.label}
            </div>
            <div className="mt-1 truncate font-mono-num text-[20px] font-bold text-slate-900 dark:text-slate-100">
              {k.value}
            </div>
            <div className="mt-0.5 truncate font-mono-num text-[11px] text-slate-400 dark:text-slate-500">
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {analytics.sampleCount === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-[13px] text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          {t('noDataYet')}
        </div>
      ) : (
        <>
          {/* DASHBOARD MODE: 2-Col Charts + Top Forms/Reports + Priority Matrix */}
          {mode === 'dashboard' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    {t('chartFormsByDept')}
                  </h3>
                  <div className="mt-2.5 h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.formsByDepartment}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="formsCount" name={t('formsUnit')} fill="#0B2B5B" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="reportsCount" name={t('reportsUnit')} fill="#0891B2" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    {t('chartDxDemand')}
                  </h3>
                  <div className="mt-2.5 h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.dxPriorityChart}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="feature" tick={{ fontSize: 10 }} interval={0} angle={-16} textAnchor="end" height={54} />
                        <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="avgDemand" name={t('colDemand')} fill="#0891B2" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    {t('topFormsTitle')}
                  </h3>
                  <DataTable
                    data={topFormsRows}
                    columns={topFormColumns}
                    getRowId={(r) => r.id}
                    selectable={false}
                    pageSizeDefault={5}
                    maxHeightClass="max-h-[280px]"
                    searchPlaceholder={t('tableSearch')}
                    emptyText={t('tableNoResults')}
                    labels={tableLabels}
                  />
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    {t('topReportsTitle')}
                  </h3>
                  <DataTable
                    data={topReportsRows}
                    columns={topReportColumns}
                    getRowId={(r) => r.id}
                    selectable={false}
                    pageSizeDefault={5}
                    maxHeightClass="max-h-[280px]"
                    searchPlaceholder={t('tableSearch')}
                    emptyText={t('tableNoResults')}
                    labels={tableLabels}
                  />
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                      {t('priorityMatrixTitle')}
                    </h3>
                    <p className="text-[11px] text-slate-500">{t('priorityMatrixDesc')}</p>
                  </div>
                </div>
                <DataTable
                  data={displayedMatrix}
                  columns={matrixColumns}
                  getRowId={(r) => r.id}
                  selectable={false}
                  pageSizeDefault={10}
                  maxHeightClass="max-h-[340px]"
                  searchPlaceholder={t('tableSearch')}
                  emptyText={t('tableNoResults')}
                  labels={tableLabels}
                />
              </div>
            </div>
          )}

          {/* ANALYTICS MODE: All 8 Charts + 6 Synthesis Tabs */}
          {mode === 'analytics' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    01. {t('chartFormsByDept')}
                  </h3>
                  <div className="mt-2.5 h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.formsByDepartment}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="formsCount" name={t('formsUnit')} fill="#0B2B5B" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="reportsCount" name={t('reportsUnit')} fill="#0891B2" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    02. {t('chartFormFreq')}
                  </h3>
                  <div className="mt-2.5 h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.formFrequencyChart}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-16} textAnchor="end" height={54} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="multiDaily" stackId="a" name={t('freqMultiDaily')} fill="#0B2B5B" />
                        <Bar dataKey="daily" stackId="a" name={t('freqDaily')} fill="#0284C7" />
                        <Bar dataKey="weekly" stackId="a" name={t('freqWeekly')} fill="#06B6D4" />
                        <Bar dataKey="monthly" stackId="a" name={t('freqMonthly')} fill="#94A3B8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    03. {t('chartReportDemand')}
                  </h3>
                  <div className="mt-2.5 h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.reportFrequencyChart}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-16} textAnchor="end" height={54} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="realtimeNeedPct" name={t('needRealtime')} fill="#0891B2" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="excelNeedPct" name={t('needExcel')} fill="#1E40AF" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    04. {t('chartDeptSatisfaction')}
                  </h3>
                  <div className="mt-2.5 h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.satisfactionByDepartment}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="uxScore" name={t('kpiAvgUx')} fill="#0B2B5B" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="formUsability" name={t('usability')} fill="#0284C7" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="reportFit" name={t('satisfaction')} fill="#06B6D4" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    05. {t('chartPainPoints')}
                  </h3>
                  <div className="mt-2.5 h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={analytics.painPointsChart}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="category" type="category" width={155} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" name={t('colUsageCount')} fill="#DC2626" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    06. {t('chartImprovements')}
                  </h3>
                  <div className="mt-2.5 h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={analytics.improvementRequestsChart}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="category" type="category" width={155} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" name={t('colUsageCount')} fill="#0284C7" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    07. {t('chartDxDemand')}
                  </h3>
                  <div className="mt-2.5 h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.dxPriorityChart}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="feature" tick={{ fontSize: 10 }} interval={0} angle={-16} textAnchor="end" height={54} />
                        <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="avgDemand" name={t('colDemand')} fill="#0B2B5B" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    08. {t('chartCrossDept')}
                  </h3>
                  <div className="mt-2.5 h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={analytics.crossDeptComparison.slice(0, 8)}>
                        <PolarGrid strokeOpacity={0.3} />
                        <PolarAngleAxis dataKey="department" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis tick={{ fontSize: 10 }} />
                        <Radar name={t('colDemand')} dataKey="dxUrgency" stroke="#0891B2" fill="#0891B2" fillOpacity={0.35} />
                        <Radar name={t('kpiAvgUx')} dataKey="uxScore" stroke="#0B2B5B" fill="#0B2B5B" fillOpacity={0.25} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Synthesis Tabs powered by DataTable */}
              <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <Tabs defaultValue="matrix">
                  <TabsList className="flex flex-wrap h-auto">
                    <TabsTrigger value="matrix">
                      {t('tabMatrix')} ({analytics.priorityMatrix.length})
                    </TabsTrigger>
                    <TabsTrigger value="upgrade">
                      {t('tabUpgradeForms')} ({analytics.formsNeedingUpgrade.length})
                    </TabsTrigger>
                    <TabsTrigger value="underused">
                      {t('tabUnderusedForms')} ({analytics.underutilizedForms.length})
                    </TabsTrigger>
                    <TabsTrigger value="duplicates">
                      {t('tabOverlappingReports')} ({analytics.duplicateClusters.length})
                    </TabsTrigger>
                    <TabsTrigger value="realtime">
                      {t('tabRealtimeReports')} ({analytics.reportsNeedingRealtime.length})
                    </TabsTrigger>
                    <TabsTrigger value="automation">
                      {t('tabAutomationRoi')} ({analytics.automationCandidates.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="matrix" className="mt-2.5">
                    <DataTable
                      data={displayedMatrix}
                      columns={matrixColumns}
                      getRowId={(r) => r.id}
                      selectable={false}
                      searchPlaceholder={t('tableSearch')}
                      emptyText={t('tableNoResults')}
                      labels={tableLabels}
                      toolbarExtra={
                        <Select value={tierFilter} onValueChange={setTierFilter}>
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t('allTiers')}</SelectItem>
                            {['P1', 'P2', 'P3', 'P4'].map((tier) => (
                              <SelectItem key={tier} value={tier}>
                                {tier}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      }
                    />
                  </TabsContent>

                  <TabsContent value="upgrade" className="mt-2.5">
                    <DataTable
                      data={analytics.formsNeedingUpgrade}
                      getRowId={(r) => r.formName}
                      selectable={false}
                      searchPlaceholder={t('tableSearch')}
                      emptyText={t('tableNoResults')}
                      labels={tableLabels}
                      columns={[
                        { id: 'name', header: t('colName'), accessor: (r) => r.formName },
                        { id: 'imp', header: t('importance'), accessor: (r) => r.importance, align: 'right' },
                        {
                          id: 'ease',
                          header: t('usability'),
                          accessor: (r) => r.usability,
                          align: 'right',
                          cell: (r) => <Badge variant="warning">{r.usability}</Badge>,
                        },
                        { id: 'fit', header: t('businessFit'), accessor: (r) => r.businessFit, align: 'right' },
                        { id: 'mentions', header: t('colUsageCount'), accessor: (r) => r.mentions, align: 'right' },
                        { id: 'pain', header: t('painPoints'), accessor: (r) => r.samplePain || '—' },
                      ]}
                    />
                  </TabsContent>

                  <TabsContent value="underused" className="mt-2.5">
                    <DataTable
                      data={analytics.underutilizedForms}
                      getRowId={(r) => r.formName}
                      selectable={false}
                      searchPlaceholder={t('tableSearch')}
                      emptyText={t('tableNoResults')}
                      labels={tableLabels}
                      columns={[
                        { id: 'name', header: t('colName'), accessor: (r) => r.formName },
                        { id: 'grp', header: t('colGroup'), accessor: (r) => r.groupId },
                        { id: 'mentions', header: t('colUsageCount'), accessor: (r) => r.mentions, align: 'right' },
                        { id: 'reason', header: t('colRationale'), accessor: (r) => r.reason },
                      ]}
                    />
                  </TabsContent>

                  <TabsContent value="duplicates" className="mt-2.5">
                    <DataTable
                      data={analytics.duplicateClusters}
                      getRowId={(r) => r.primaryName}
                      selectable={false}
                      searchPlaceholder={t('tableSearch')}
                      emptyText={t('tableNoResults')}
                      labels={tableLabels}
                      columns={[
                        { id: 'type', header: t('colType'), accessor: (r) => r.itemType },
                        { id: 'name', header: t('colName'), accessor: (r) => r.primaryName },
                        { id: 'overlaps', header: t('duplicateReports'), accessor: (r) => r.overlappingWith.join(', ') },
                        { id: 'mentions', header: t('colUsageCount'), accessor: (r) => r.mentions, align: 'right' },
                      ]}
                    />
                  </TabsContent>

                  <TabsContent value="realtime" className="mt-2.5">
                    <DataTable
                      data={analytics.reportsNeedingRealtime}
                      getRowId={(r) => r.reportName}
                      selectable={false}
                      searchPlaceholder={t('tableSearch')}
                      emptyText={t('tableNoResults')}
                      labels={tableLabels}
                      columns={[
                        { id: 'name', header: t('colName'), accessor: (r) => r.reportName },
                        {
                          id: 'rt',
                          header: t('needRealtime'),
                          accessor: (r) => r.realtimeVotes,
                          align: 'right',
                          cell: (r) => <Badge variant="primary">{r.realtimeVotes}</Badge>,
                        },
                        { id: 'total', header: t('colUsageCount'), accessor: (r) => r.totalVotes, align: 'right' },
                        {
                          id: 'load',
                          header: t('colAvgLoadSec'),
                          accessor: (r) => r.avgLoadSec,
                          align: 'right',
                          cell: (r) => <Badge variant={r.avgLoadSec >= 15 ? 'danger' : 'default'}>{r.avgLoadSec}s</Badge>,
                        },
                      ]}
                    />
                  </TabsContent>

                  <TabsContent value="automation" className="mt-2.5">
                    <DataTable
                      data={analytics.automationCandidates}
                      getRowId={(r) => r.processName}
                      selectable={false}
                      searchPlaceholder={t('tableSearch')}
                      emptyText={t('tableNoResults')}
                      labels={tableLabels}
                      columns={[
                        { id: 'name', header: t('colName'), accessor: (r) => r.processName },
                        {
                          id: 'hrs',
                          header: t('kpiAutomationHours'),
                          accessor: (r) => r.hoursPerWeek,
                          align: 'right',
                          cell: (r) => <Badge variant="primary">{r.hoursPerWeek}h</Badge>,
                        },
                        { id: 'imp', header: t('impactScore'), accessor: (r) => r.avgImpact, align: 'right' },
                        { id: 'mentions', header: t('colUsageCount'), accessor: (r) => r.mentions, align: 'right' },
                        { id: 'idea', header: t('automationIdea'), accessor: (r) => r.topIdea || '—' },
                      ]}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}

          {/* SUMMARY MODE: Executive Priority Matrix & BRD Synthesis */}
          {mode === 'summary' && (
            <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                    {t('priorityMatrixTitle')}
                  </h2>
                  <p className="text-[11px] text-slate-500">{t('priorityMatrixDesc')}</p>
                </div>
              </div>

              <DataTable
                data={displayedMatrix}
                columns={matrixColumns}
                getRowId={(r) => r.id}
                selectable={true}
                pageSizeDefault={20}
                searchPlaceholder={t('tableSearch')}
                emptyText={t('tableNoResults')}
                labels={tableLabels}
                onExportExcel={(rows) => exportResponsesToExcelCsv(filteredResponses, departments, rows)}
                onExportPdf={triggerPrintPdfReport}
                toolbarExtra={
                  <Select value={tierFilter} onValueChange={setTierFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allTiers')}</SelectItem>
                      {['P1', 'P2', 'P3', 'P4'].map((tier) => (
                        <SelectItem key={tier} value={tier}>
                          {tier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
