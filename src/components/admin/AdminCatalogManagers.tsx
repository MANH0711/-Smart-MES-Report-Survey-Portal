import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import {
  CatalogForm,
  CatalogReport,
  Department,
  FormGroupId,
  ReportCategoryId,
  SurveyQuestion,
} from '../../types/survey';
import { FORM_GROUPS, REPORT_CATEGORIES } from '../../data/catalogs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DataTable, DataTableColumn } from '../ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { triggerPrintPdfReport } from '../../lib/exportUtils';

export function QuestionManagerPanel({ canEdit }: { canEdit: boolean }) {
  const { t, questions, upsertQuestion, removeQuestion } = useApp();
  const [labelVi, setLabelVi] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [section, setSection] = useState<SurveyQuestion['section']>('G');
  const [qType, setQType] = useState<SurveyQuestion['type']>('textarea');
  const [required, setRequired] = useState(false);
  const [condField, setCondField] = useState('');
  const [condValue, setCondValue] = useState('');
  const [openAdd, setOpenAdd] = useState(false);

  const handleAdd = async () => {
    if (!canEdit) return toast.error(t('adminRequiredNotice'));
    if (!labelEn.trim() || !labelVi.trim()) return toast.error(t('requiredFieldsToast'));
    const q: SurveyQuestion = {
      id: `q_${Date.now()}`,
      section,
      labelVi: labelVi.trim(),
      labelEn: labelEn.trim(),
      labelKo: labelEn.trim(),
      labelZh: labelEn.trim(),
      type: qType,
      required,
      orderIndex: questions.length + 1,
      conditionField: condField.trim(),
      conditionValue: condValue.trim(),
      active: true,
    };
    await upsertQuestion(q);
    setLabelVi('');
    setLabelEn('');
    setCondField('');
    setCondValue('');
    setOpenAdd(false);
    toast.success(t('addQuestion'));
  };

  const columns: DataTableColumn<SurveyQuestion>[] = [
    {
      id: 'section',
      header: t('colSection'),
      accessor: (q) => q.section,
      cell: (q) => <Badge variant="primary">{q.section}</Badge>,
    },
    {
      id: 'question',
      header: t('colQuestion'),
      accessor: (q) => `${q.labelVi} ${q.labelEn}`,
      cell: (q) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">{q.labelVi}</div>
          <div className="text-[11px] text-slate-500">{q.labelEn}</div>
        </div>
      ),
    },
    {
      id: 'condition',
      header: t('colCondition'),
      accessor: (q) => (q.conditionField ? `${q.conditionField} = ${q.conditionValue}` : t('alwaysVisible')),
      cell: (q) => (
        <span className="font-mono-num text-[11px] text-slate-500">
          {q.conditionField ? `${q.conditionField} = ${q.conditionValue}` : t('alwaysVisible')}
        </span>
      ),
    },
    {
      id: 'required',
      header: t('colRequired'),
      accessor: (q) => (q.required ? t('yes') : t('no')),
      cell: (q) => <Badge variant={q.required ? 'warning' : 'default'}>{q.required ? t('yes') : t('no')}</Badge>,
    },
    {
      id: 'active',
      header: t('colActive'),
      accessor: (q) => (q.active ? 1 : 0),
      cell: (q) => (
        <Switch
          checked={q.active}
          disabled={!canEdit}
          onCheckedChange={(v) => upsertQuestion({ ...q, active: v })}
        />
      ),
    },
    {
      id: 'actions',
      header: t('colActions'),
      sortable: false,
      align: 'right',
      accessor: (q) => q.id,
      cell: (q) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={!canEdit}
          onClick={() => removeQuestion(q.id)}
        >
          <Trash2 className="h-3.5 w-3.5 text-red-600" />
        </Button>
      ),
    },
  ];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
      <DataTable
        data={questions}
        columns={columns}
        getRowId={(q) => q.id}
        selectable={false}
        searchPlaceholder={t('tableSearch')}
        emptyText={t('tableNoResults')}
        labels={{
          columns: t('tableColumns'),
          rowsPerPage: t('tableRowsPerPage'),
          page: t('tablePage'),
          of: t('tableOf'),
        }}
        toolbarExtra={
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" />
                <span>{t('addQuestion')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('addQuestion')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2.5">
                <Input placeholder="VI" value={labelVi} onChange={(e) => setLabelVi(e.target.value)} />
                <Input placeholder="EN" value={labelEn} onChange={(e) => setLabelEn(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={section} onValueChange={(v) => setSection(v as SurveyQuestion['section'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['A', 'B', 'E', 'F', 'G'].map((s) => (
                        <SelectItem key={s} value={s}>{t('colSection')} {s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={qType} onValueChange={(v) => setQType(v as SurveyQuestion['type'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="textarea">Textarea</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="frequentSystems / departmentId" value={condField} onChange={(e) => setCondField(e.target.value)} />
                  <Input placeholder="ERP / dept_prod" value={condValue} onChange={(e) => setCondValue(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-[12px] font-medium cursor-pointer">
                  <Switch checked={required} onCheckedChange={setRequired} />
                  <span>{t('colRequired')}</span>
                </label>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setOpenAdd(false)}>{t('cancel')}</Button>
                  <Button size="sm" onClick={handleAdd} disabled={!canEdit}>{t('addQuestion')}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
    </div>
  );
}

export function FormCatalogPanel({ canEdit }: { canEdit: boolean }) {
  const { lang, t, catalogForms, responses, addCustomCatalogForm } = useApp();
  const [nameEn, setNameEn] = useState('');
  const [nameVi, setNameVi] = useState('');
  const [code, setCode] = useState('');
  const [groupId, setGroupId] = useState<FormGroupId>('production');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [openAdd, setOpenAdd] = useState(false);

  const usageStats = useMemo(() => {
    const map = new Map<string, { count: number; impSum: number; easeSum: number }>();
    for (const r of responses.filter((x) => x.status === 'submitted')) {
      for (const f of r.selectedForms) {
        const cur = map.get(f.formId) || { count: 0, impSum: 0, easeSum: 0 };
        cur.count += 1;
        cur.impSum += f.importance;
        cur.easeSum += f.usability;
        map.set(f.formId, cur);
      }
    }
    return map;
  }, [responses]);

  const rows = useMemo(() => {
    return catalogForms
      .filter((f) => (filterGroup === 'all' ? true : f.groupId === filterGroup))
      .map((f) => {
        const stat = usageStats.get(f.id);
        return {
          ...f,
          usageCount: stat?.count || 0,
          avgImp: stat ? Math.round((stat.impSum / stat.count) * 10) / 10 : 0,
          avgEase: stat ? Math.round((stat.easeSum / stat.count) * 10) / 10 : 0,
        };
      });
  }, [catalogForms, filterGroup, usageStats]);

  const handleAdd = async () => {
    if (!canEdit) return toast.error(t('adminRequiredNotice'));
    if (!nameEn.trim() || !code.trim()) return toast.error(t('requiredFieldsToast'));
    const form: CatalogForm = {
      id: `frm_${Date.now()}`,
      groupId,
      code: code.trim().toUpperCase(),
      nameEn: nameEn.trim(),
      nameVi: nameVi.trim() || nameEn.trim(),
      isCustom: false,
      active: true,
    };
    await addCustomCatalogForm(form);
    setNameEn('');
    setNameVi('');
    setCode('');
    setOpenAdd(false);
    toast.success(t('addForm'));
  };

  type FormRow = (typeof rows)[number];
  const columns: DataTableColumn<FormRow>[] = [
    {
      id: 'code',
      header: t('colCode'),
      accessor: (r) => r.code,
      cell: (r) => <span className="font-mono-num font-semibold text-[#0B2B5B] dark:text-cyan-400">{r.code}</span>,
    },
    {
      id: 'group',
      header: t('colGroup'),
      accessor: (r) => FORM_GROUPS.find((g) => g.id === r.groupId)?.labels[lang] || r.groupId,
      cell: (r) => (
        <Badge variant="default">
          {FORM_GROUPS.find((g) => g.id === r.groupId)?.labels[lang] || r.groupId}
        </Badge>
      ),
    },
    {
      id: 'name',
      header: t('colName'),
      accessor: (r) => (lang === 'vi' ? r.nameVi : r.nameEn),
      cell: (r) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">
            {lang === 'vi' ? r.nameVi : r.nameEn}
          </div>
          {lang === 'vi' && r.nameEn !== r.nameVi && (
            <div className="text-[11px] text-slate-400">{r.nameEn}</div>
          )}
        </div>
      ),
    },
    { id: 'usage', header: t('colUsageCount'), accessor: (r) => r.usageCount, align: 'right' },
    { id: 'imp', header: t('colAvgImportance'), accessor: (r) => r.avgImp, align: 'right' },
    {
      id: 'ease',
      header: t('colAvgUsability'),
      accessor: (r) => r.avgEase,
      align: 'right',
      cell: (r) =>
        r.usageCount > 0 ? (
          <Badge variant={r.avgEase <= 2.8 ? 'warning' : 'success'}>{r.avgEase}</Badge>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      id: 'origin',
      header: t('colOrigin'),
      accessor: (r) => (r.isCustom ? t('originCustom') : t('originStandard')),
      cell: (r) => <Badge variant={r.isCustom ? 'primary' : 'default'}>{r.isCustom ? t('originCustom') : t('originStandard')}</Badge>,
    },
  ];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        selectable={false}
        onExportPdf={triggerPrintPdfReport}
        searchPlaceholder={t('tableSearch')}
        emptyText={t('tableNoResults')}
        labels={{
          columns: t('tableColumns'),
          rowsPerPage: t('tableRowsPerPage'),
          page: t('tablePage'),
          of: t('tableOf'),
          exportPdf: t('exportPdfPrint'),
        }}
        toolbarExtra={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterGroup} onValueChange={setFilterGroup}>
              <SelectTrigger className="w-[190px]">
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

            <Dialog open={openAdd} onOpenChange={setOpenAdd}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t('addForm')}</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('addForm')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2.5">
                  <Input placeholder="MES-P10" value={code} onChange={(e) => setCode(e.target.value)} />
                  <Input placeholder="EN" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
                  <Input placeholder="VI" value={nameVi} onChange={(e) => setNameVi(e.target.value)} />
                  <Select value={groupId} onValueChange={(v) => setGroupId(v as FormGroupId)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORM_GROUPS.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.labels[lang]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setOpenAdd(false)}>{t('cancel')}</Button>
                    <Button size="sm" onClick={handleAdd} disabled={!canEdit}>{t('addForm')}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
    </div>
  );
}

export function ReportCatalogPanel({ canEdit }: { canEdit: boolean }) {
  const { lang, t, catalogReports, responses, addCustomCatalogReport } = useApp();
  const [nameEn, setNameEn] = useState('');
  const [nameVi, setNameVi] = useState('');
  const [code, setCode] = useState('');
  const [categoryId, setCategoryId] = useState<ReportCategoryId>('production_reports');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [openAdd, setOpenAdd] = useState(false);

  const usageStats = useMemo(() => {
    const map = new Map<string, { count: number; rtCount: number; loadSum: number }>();
    for (const r of responses.filter((x) => x.status === 'submitted')) {
      for (const rep of r.selectedReports) {
        const cur = map.get(rep.reportId) || { count: 0, rtCount: 0, loadSum: 0 };
        cur.count += 1;
        if (rep.needRealtime) cur.rtCount += 1;
        cur.loadSum += rep.loadTimeSec || 0;
        map.set(rep.reportId, cur);
      }
    }
    return map;
  }, [responses]);

  const rows = useMemo(() => {
    return catalogReports
      .filter((r) => (filterCat === 'all' ? true : r.categoryId === filterCat))
      .map((r) => {
        const stat = usageStats.get(r.id);
        return {
          ...r,
          usageCount: stat?.count || 0,
          rtPct: stat ? Math.round((stat.rtCount / stat.count) * 100) : 0,
          avgLoad: stat ? Math.round((stat.loadSum / stat.count) * 10) / 10 : 0,
        };
      });
  }, [catalogReports, filterCat, usageStats]);

  const handleAdd = async () => {
    if (!canEdit) return toast.error(t('adminRequiredNotice'));
    if (!nameEn.trim() || !code.trim()) return toast.error(t('requiredFieldsToast'));
    const report: CatalogReport = {
      id: `rpt_${Date.now()}`,
      categoryId,
      code: code.trim().toUpperCase(),
      nameEn: nameEn.trim(),
      nameVi: nameVi.trim() || nameEn.trim(),
      isCustom: false,
      active: true,
    };
    await addCustomCatalogReport(report);
    setNameEn('');
    setNameVi('');
    setCode('');
    setOpenAdd(false);
    toast.success(t('addReport'));
  };

  type ReportRow = (typeof rows)[number];
  const columns: DataTableColumn<ReportRow>[] = [
    {
      id: 'code',
      header: t('colCode'),
      accessor: (r) => r.code,
      cell: (r) => <span className="font-mono-num font-semibold text-[#0B2B5B] dark:text-cyan-400">{r.code}</span>,
    },
    {
      id: 'category',
      header: t('colCategory'),
      accessor: (r) => REPORT_CATEGORIES.find((c) => c.id === r.categoryId)?.labels[lang] || r.categoryId,
      cell: (r) => (
        <Badge variant="default">
          {REPORT_CATEGORIES.find((c) => c.id === r.categoryId)?.labels[lang] || r.categoryId}
        </Badge>
      ),
    },
    {
      id: 'name',
      header: t('colName'),
      accessor: (r) => (lang === 'vi' ? r.nameVi : r.nameEn),
      cell: (r) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">
            {lang === 'vi' ? r.nameVi : r.nameEn}
          </div>
          {lang === 'vi' && r.nameEn !== r.nameVi && (
            <div className="text-[11px] text-slate-400">{r.nameEn}</div>
          )}
        </div>
      ),
    },
    { id: 'usage', header: t('colUsageCount'), accessor: (r) => r.usageCount, align: 'right' },
    {
      id: 'rtPct',
      header: t('colRealtimePct'),
      accessor: (r) => r.rtPct,
      align: 'right',
      cell: (r) =>
        r.usageCount > 0 ? (
          <Badge variant={r.rtPct >= 50 ? 'primary' : 'default'}>{r.rtPct}%</Badge>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      id: 'avgLoad',
      header: t('colAvgLoadSec'),
      accessor: (r) => r.avgLoad,
      align: 'right',
      cell: (r) => (r.usageCount > 0 ? <span className="font-mono-num">{r.avgLoad}s</span> : <span className="text-slate-400">—</span>),
    },
    {
      id: 'origin',
      header: t('colOrigin'),
      accessor: (r) => (r.isCustom ? t('originCustom') : t('originStandard')),
      cell: (r) => <Badge variant={r.isCustom ? 'primary' : 'default'}>{r.isCustom ? t('originCustom') : t('originStandard')}</Badge>,
    },
  ];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        selectable={false}
        onExportPdf={triggerPrintPdfReport}
        searchPlaceholder={t('tableSearch')}
        emptyText={t('tableNoResults')}
        labels={{
          columns: t('tableColumns'),
          rowsPerPage: t('tableRowsPerPage'),
          page: t('tablePage'),
          of: t('tableOf'),
          exportPdf: t('exportPdfPrint'),
        }}
        toolbarExtra={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allCategories')}</SelectItem>
                {REPORT_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.labels[lang]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={openAdd} onOpenChange={setOpenAdd}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t('addReport')}</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('addReport')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2.5">
                  <Input placeholder="RPT-P09" value={code} onChange={(e) => setCode(e.target.value)} />
                  <Input placeholder="EN" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
                  <Input placeholder="VI" value={nameVi} onChange={(e) => setNameVi(e.target.value)} />
                  <Select value={categoryId} onValueChange={(v) => setCategoryId(v as ReportCategoryId)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REPORT_CATEGORIES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.labels[lang]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setOpenAdd(false)}>{t('cancel')}</Button>
                    <Button size="sm" onClick={handleAdd} disabled={!canEdit}>{t('addReport')}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
    </div>
  );
}

export function DepartmentManagerPanel({ canEdit }: { canEdit: boolean }) {
  const { t, departments, upsertDepartment } = useApp();
  const [code, setCode] = useState('');
  const [nameVi, setNameVi] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [sectionsStr, setSectionsStr] = useState('');
  const [target, setTarget] = useState(15);
  const [openAdd, setOpenAdd] = useState(false);

  const handleAdd = async () => {
    if (!canEdit) return toast.error(t('adminRequiredNotice'));
    if (!code.trim() || !nameEn.trim()) return toast.error(t('requiredFieldsToast'));
    const dept: Department = {
      id: `dept_${code.trim().toLowerCase()}_${Date.now()}`,
      code: code.trim().toUpperCase(),
      nameVi: nameVi.trim() || nameEn.trim(),
      nameEn: nameEn.trim(),
      sections: sectionsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      targetHeadcount: target,
      active: true,
      updatedAt: new Date().toISOString(),
    };
    await upsertDepartment(dept);
    setCode('');
    setNameVi('');
    setNameEn('');
    setSectionsStr('');
    setOpenAdd(false);
    toast.success(t('addDepartment'));
  };

  const columns: DataTableColumn<Department>[] = [
    {
      id: 'code',
      header: t('colCode'),
      accessor: (d) => d.code,
      cell: (d) => <Badge variant="primary">{d.code}</Badge>,
    },
    {
      id: 'name',
      header: t('colName'),
      accessor: (d) => `${d.nameVi} ${d.nameEn}`,
      cell: (d) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">{d.nameVi}</div>
          <div className="text-[11px] text-slate-500">{d.nameEn}</div>
        </div>
      ),
    },
    {
      id: 'sections',
      header: t('section'),
      accessor: (d) => (d.sections || []).join(', ') || '—',
    },
    {
      id: 'target',
      header: t('colTarget'),
      accessor: (d) => d.targetHeadcount,
      align: 'right',
    },
    {
      id: 'active',
      header: t('colActive'),
      accessor: (d) => (d.active ? 1 : 0),
      cell: (d) => (
        <Switch
          checked={d.active}
          disabled={!canEdit}
          onCheckedChange={(v) =>
            upsertDepartment({ ...d, active: v, updatedAt: new Date().toISOString() })
          }
        />
      ),
    },
  ];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
      <DataTable
        data={departments}
        columns={columns}
        getRowId={(d) => d.id}
        selectable={false}
        searchPlaceholder={t('tableSearch')}
        emptyText={t('tableNoResults')}
        labels={{
          columns: t('tableColumns'),
          rowsPerPage: t('tableRowsPerPage'),
          page: t('tablePage'),
          of: t('tableOf'),
        }}
        toolbarExtra={
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" />
                <span>{t('addDepartment')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('addDepartment')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2.5">
                <Input placeholder="NPI" value={code} onChange={(e) => setCode(e.target.value)} />
                <Input placeholder="EN" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
                <Input placeholder="VI" value={nameVi} onChange={(e) => setNameVi(e.target.value)} />
                <Input placeholder="Line 1, Line 2" value={sectionsStr} onChange={(e) => setSectionsStr(e.target.value)} />
                <Input type="number" min={1} value={target} onChange={(e) => setTarget(Number(e.target.value) || 1)} />
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setOpenAdd(false)}>{t('cancel')}</Button>
                  <Button size="sm" onClick={handleAdd} disabled={!canEdit}>{t('addDepartment')}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
    </div>
  );
}
