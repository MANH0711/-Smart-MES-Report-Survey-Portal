import { useMemo, useState } from 'react';
import { Layers, Plus, RotateCcw, Search, X } from 'lucide-react';
import {
  CatalogForm,
  FormGroupId,
  LanguageCode,
  SelectedFormEvaluation,
  UsageFrequency,
} from '../../types/survey';
import { FORM_GROUPS } from '../../data/catalogs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '../../lib/utils';

type CustomModuleId = 'ASFC' | 'ADMIN' | 'REPORT' | 'SPC' | 'MOM' | 'WEB REPORT';

const CUSTOM_MODULE_OPTIONS: {
  id: CustomModuleId;
  label: string;
  groupId: FormGroupId;
}[] = [
  { id: 'ASFC', label: 'MES SHOPFLOW', groupId: 'production' },
  { id: 'ADMIN', label: 'MES ADMIN', groupId: 'system' },
  { id: 'REPORT', label: 'MES REPORT', groupId: 'production' },
  { id: 'SPC', label: 'MES SPC', groupId: 'quality' },
  { id: 'MOM', label: 'MES MONITORING', groupId: 'equipment' },
  { id: 'WEB REPORT', label: 'WEB REPORT', groupId: 'system' },
];

function getDisplayModuleId(form: CatalogForm): string {
  if (form.isCustom && form.description) return form.description;
  return form.groupId.toUpperCase();
}

type ImportanceTier = 'high_urgent' | 'medium' | 'low';

function importanceTierToScore(tier: ImportanceTier): number {
  if (tier === 'high_urgent') return 5;
  if (tier === 'medium') return 3;
  return 1;
}

function resolveImportanceTier(evalItem?: SelectedFormEvaluation): ImportanceTier | '__none__' {
  if (!evalItem) return '__none__';
  if (evalItem.importanceLevel) return evalItem.importanceLevel;
  // Backward compatibility if an existing record only has numeric importance
  if (evalItem.importance >= 4) return 'high_urgent';
  if (evalItem.importance === 3) return 'medium';
  if (evalItem.importance <= 2) return 'low';
  return '__none__';
}

function resolveFrequencyValue(evalItem?: SelectedFormEvaluation): 'daily' | 'weekly' | 'monthly' | '__none__' {
  if (!evalItem) return '__none__';
  if (evalItem.frequencyChosen === false) return '__none__';
  if (evalItem.frequency === 'daily' || evalItem.frequency === 'multi_daily') return 'daily';
  if (evalItem.frequency === 'weekly') return 'weekly';
  if (evalItem.frequency === 'monthly') return 'monthly';
  return '__none__';
}

interface PartBProps {
  lang: LanguageCode;
  t: (k: string) => string;
  catalogForms: CatalogForm[];
  selectedForms: SelectedFormEvaluation[];
  onChangeForms: (next: SelectedFormEvaluation[]) => void;
  onAddCustomForm: (form: CatalogForm) => Promise<void>;
}

export function SurveyPartB({
  lang,
  t,
  catalogForms,
  selectedForms,
  onChangeForms,
  onAddCustomForm,
}: PartBProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [onlyFilled, setOnlyFilled] = useState(false);

  // Add custom form inline bar
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [customModuleId, setCustomModuleId] = useState<CustomModuleId>('ASFC');
  const [customNameKo, setCustomNameKo] = useState('');
  const [customNameEn, setCustomNameEn] = useState('');

  const evalMap = useMemo(() => {
    const map = new Map<string, SelectedFormEvaluation>();
    for (const item of selectedForms) {
      map.set(item.formId, item);
    }
    return map;
  }, [selectedForms]);

  const activeCatalogForms = useMemo(
    () => catalogForms.filter((f) => f.active),
    [catalogForms]
  );

  const activeCustomModulesInTable = useMemo(() => {
    const present = new Set(
      activeCatalogForms
        .filter((f) => f.isCustom && f.description)
        .map((f) => f.description as string)
    );
    return CUSTOM_MODULE_OPTIONS.filter((opt) => present.has(opt.id));
  }, [activeCatalogForms]);

  const filteredForms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeCatalogForms.filter((form) => {
      const displayModuleId = getDisplayModuleId(form);
      if (moduleFilter !== 'all') {
        const matchesGroup = form.groupId === moduleFilter;
        const matchesCustomModule = displayModuleId === moduleFilter;
        if (!matchesGroup && !matchesCustomModule) return false;
      }
      const evalItem = evalMap.get(form.id);
      if (onlyFilled && !evalItem) return false;
      if (!q) return true;
      const customLabel =
        CUSTOM_MODULE_OPTIONS.find((m) => m.id === displayModuleId)?.label || '';
      const haystack = [
        form.code,
        displayModuleId,
        customLabel,
        form.groupId.toUpperCase(),
        form.nameKo || '',
        form.nameEn,
        form.nameVi,
        evalItem?.authorizedUsers || '',
        evalItem?.improvements || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [activeCatalogForms, moduleFilter, onlyFilled, searchQuery, evalMap]);

  const hasActiveFilters = Boolean(searchQuery.trim() || moduleFilter !== 'all' || onlyFilled);

  const resetFilters = () => {
    setSearchQuery('');
    setModuleFilter('all');
    setOnlyFilled(false);
  };

  const upsertRow = (form: CatalogForm, patch: Partial<SelectedFormEvaluation>) => {
    const existing = evalMap.get(form.id);
    const base: SelectedFormEvaluation = existing || {
      formId: form.id,
      formName: form.nameEn,
      groupId: form.groupId,
      isCustom: form.isCustom,
      purpose: '',
      frequency: 'daily',
      frequencyChosen: false,
      avgMinutes: 15,
      userCount: 5,
      importance: 3,
      usability: 3,
      businessFit: 3,
      usedFeatures: '',
      unusedFeatures: '',
      painPoints: '',
      improvements: '',
      authorizedUsers: '',
    };

    const nextItem: SelectedFormEvaluation = {
      ...base,
      ...patch,
    };

    // If all 4 table inputs are empty/unset, remove the row cleanly
    const hasFreq = nextItem.frequencyChosen !== false;
    const hasImp = Boolean(nextItem.importanceLevel);
    const hasAuth = Boolean((nextItem.authorizedUsers || '').trim());
    const hasImpText = Boolean((nextItem.improvements || '').trim());

    if (!hasFreq && !hasImp && !hasAuth && !hasImpText) {
      onChangeForms(selectedForms.filter((item) => item.formId !== form.id));
      return;
    }

    if (existing) {
      onChangeForms(selectedForms.map((item) => (item.formId === form.id ? nextItem : item)));
    } else {
      onChangeForms([...selectedForms, nextItem]);
    }
  };

  const handleFrequencyChange = (form: CatalogForm, value: string) => {
    if (value === '__none__') {
      upsertRow(form, { frequencyChosen: false, frequency: 'daily' });
    } else {
      upsertRow(form, {
        frequencyChosen: true,
        frequency: value as UsageFrequency,
      });
    }
  };

  const handleImportanceChange = (form: CatalogForm, value: string) => {
    if (value === '__none__') {
      upsertRow(form, { importanceLevel: undefined, importance: 3 });
    } else {
      const tier = value as ImportanceTier;
      upsertRow(form, {
        importanceLevel: tier,
        importance: importanceTierToScore(tier),
      });
    }
  };

  const handleClearRow = (formId: string) => {
    onChangeForms(selectedForms.filter((item) => item.formId !== formId));
  };

  const handleCreateCustom = async () => {
    const trimmedEn = customNameEn.trim();
    const trimmedKo = customNameKo.trim() || trimmedEn;
    if (!trimmedEn) return;
    const id = `frm_custom_${Date.now()}`;
    const code = customCode.trim().toUpperCase() || `MES-C${String(Date.now()).slice(-3)}`;
    const moduleMeta =
      CUSTOM_MODULE_OPTIONS.find((m) => m.id === customModuleId) || CUSTOM_MODULE_OPTIONS[0];
    const newForm: CatalogForm = {
      id,
      groupId: moduleMeta.groupId,
      code,
      nameEn: trimmedEn,
      nameVi: trimmedEn,
      nameKo: trimmedKo,
      nameZh: trimmedEn,
      description: moduleMeta.id,
      isCustom: true,
      active: true,
    };
    await onAddCustomForm(newForm);
    onChangeForms([
      ...selectedForms,
      {
        formId: id,
        formName: trimmedEn,
        groupId: moduleMeta.groupId,
        isCustom: true,
        purpose: '',
        frequency: 'daily',
        frequencyChosen: true,
        avgMinutes: 15,
        userCount: 5,
        importance: 5,
        importanceLevel: 'high_urgent',
        usability: 3,
        businessFit: 3,
        usedFeatures: '',
        unusedFeatures: '',
        painPoints: '',
        improvements: '',
        authorizedUsers: '',
      },
    ]);
    setCustomCode('');
    setCustomNameKo('');
    setCustomNameEn('');
    setShowCustomForm(false);
  };

  return (
    <div className="space-y-2.5">
      {/* Compact Header & Filled Progress Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
            {t('stepB')}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t('stepBDesc')}
          </p>
        </div>

        <Badge variant="primary" className="shrink-0 font-mono-num">
          {t('partBFilledCount')}: {selectedForms.length} / {activeCatalogForms.length} {t('formsUnit')}
        </Badge>
      </div>

      {/* Unified Compact Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Search Box */}
          <div className="relative w-full sm:w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('partBTableSearch')}
              className="h-[34px] pl-8 pr-7 bg-white dark:bg-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* MODULE_ID Selector */}
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="h-[34px] w-full sm:w-[225px] bg-white dark:bg-slate-900">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('partBFilterModule')}</SelectItem>
              {FORM_GROUPS.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.id.toUpperCase()} · {g.labels[lang]}
                </SelectItem>
              ))}
              {activeCustomModulesInTable.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.id} · {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filled Rows Toggle */}
          <label
            className={cn(
              'flex h-[34px] items-center gap-2 rounded-md border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer select-none',
              onlyFilled
                ? 'border-[#0B2B5B]/40 bg-sky-50/70 text-[#0B2B5B] dark:border-cyan-500/50 dark:bg-cyan-950/30 dark:text-cyan-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            )}
          >
            <Switch checked={onlyFilled} onCheckedChange={setOnlyFilled} />
            <span>{t('partBOnlyFilled')}</span>
          </label>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-[34px] px-2 text-slate-500 hover:text-slate-800 dark:text-slate-400"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t('partBResetFilter')}</span>
            </Button>
          )}
        </div>

        <Button
          type="button"
          variant={showCustomForm ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowCustomForm((v) => !v)}
          className="h-[34px] shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t('addCustomForm')}</span>
        </Button>
      </div>

      {/* Add Custom Form Inline Panel */}
      {showCustomForm && (
        <div className="grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-2.5 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-800 dark:bg-slate-950">
          <Input
            placeholder={t('customFormCodePlaceholder')}
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value)}
            className="h-[34px] bg-white dark:bg-slate-900"
          />
          <Select value={customModuleId} onValueChange={(v) => setCustomModuleId(v as CustomModuleId)}>
            <SelectTrigger className="h-[34px] bg-white dark:bg-slate-900">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {CUSTOM_MODULE_OPTIONS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.id} — {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="ACTION_NAME_KOR"
            value={customNameKo}
            onChange={(e) => setCustomNameKo(e.target.value)}
            className="h-[34px] bg-white dark:bg-slate-900"
          />
          <Input
            placeholder="ACTION_NAME_ENG *"
            value={customNameEn}
            onChange={(e) => setCustomNameEn(e.target.value)}
            className="h-[34px] bg-white dark:bg-slate-900"
          />
          <div className="flex items-center justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              onClick={handleCreateCustom}
              disabled={!customNameEn.trim()}
              className="h-[34px]"
            >
              {t('saveAndSelect')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowCustomForm(false)}
              className="h-[34px]"
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* 8-Column Survey Data Table (Single-line non-wrapping headers, fits desktop screen width) */}
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="max-h-[540px] w-full overflow-auto">
          <Table className="w-full min-w-[900px] lg:min-w-0">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[96px] px-2 whitespace-nowrap">{t('colFormId')}</TableHead>
                <TableHead className="w-[96px] px-2 whitespace-nowrap">{t('colModuleId')}</TableHead>
                <TableHead className="w-[14%] px-2 whitespace-nowrap">{t('colActionKor')}</TableHead>
                <TableHead className="w-[17%] px-2 whitespace-nowrap">{t('colActionEng')}</TableHead>
                <TableHead className="w-[116px] px-2 whitespace-nowrap" title={t('colUsageFreqHint')}>
                  {t('colUsageFreq')}
                </TableHead>
                <TableHead className="w-[136px] px-2 whitespace-nowrap" title={t('colImportanceTierHint')}>
                  {t('colImportanceTier')}
                </TableHead>
                <TableHead className="w-[17%] px-2 whitespace-nowrap" title={t('colAuthorizedUsersHint')}>
                  {t('colAuthorizedUsers')}
                </TableHead>
                <TableHead className="w-[21%] px-2 whitespace-nowrap" title={t('colDesiredImprovementsHint')}>
                  {t('colDesiredImprovements')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredForms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                    {t('tableNoResults')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredForms.map((form) => {
                  const evalItem = evalMap.get(form.id);
                  const isFilled = Boolean(evalItem);
                  const freqVal = resolveFrequencyValue(evalItem);
                  const impVal = resolveImportanceTier(evalItem);
                  const authUsersVal = evalItem?.authorizedUsers ?? evalItem?.usedFeatures ?? '';
                  const improvementsVal = evalItem?.improvements ?? '';

                  return (
                    <TableRow
                      key={form.id}
                      data-state={isFilled ? 'selected' : undefined}
                      className={cn(
                        'transition-colors duration-150',
                        isFilled && 'bg-sky-50/40 dark:bg-cyan-950/20'
                      )}
                    >
                      {/* 1. ID */}
                      <TableCell className="px-2 whitespace-nowrap font-mono-num font-semibold text-[#0B2B5B] dark:text-cyan-400">
                        <div className="flex items-center justify-between gap-1">
                          <span>{form.code}</span>
                          <button
                            type="button"
                            onClick={() => handleClearRow(form.id)}
                            title={t('partBClearRow')}
                            disabled={!isFilled}
                            className={cn(
                              'rounded p-0.5 transition-opacity cursor-pointer',
                              isFilled
                                ? 'opacity-70 hover:opacity-100 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                                : 'opacity-0 pointer-events-none'
                            )}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        </div>
                      </TableCell>

                      {/* 2. MODULE_ID */}
                      <TableCell className="px-2 whitespace-nowrap">
                        <Badge
                          variant="default"
                          className="font-mono-num uppercase"
                          title={
                            CUSTOM_MODULE_OPTIONS.find((m) => m.id === getDisplayModuleId(form))
                              ?.label
                          }
                        >
                          {getDisplayModuleId(form)}
                        </Badge>
                      </TableCell>

                      {/* 3. ACTION_NAME_KOR */}
                      <TableCell
                        className="max-w-[175px] truncate px-2 font-medium text-slate-800 dark:text-slate-200"
                        title={form.nameKo || form.nameEn}
                      >
                        {form.nameKo || form.nameEn}
                      </TableCell>

                      {/* 4. ACTION_NAME_ENG */}
                      <TableCell
                        className="max-w-[205px] truncate px-2 text-slate-700 dark:text-slate-300"
                        title={form.nameEn}
                      >
                        {form.nameEn}
                      </TableCell>

                      {/* 5. Tần suất dùng */}
                      <TableCell className="px-2 whitespace-nowrap">
                        <Select
                          value={freqVal}
                          onValueChange={(v) => handleFrequencyChange(form, v)}
                        >
                          <SelectTrigger
                            className={cn(
                              'h-8 text-[12px] transition-colors',
                              freqVal === '__none__'
                                ? 'text-slate-400'
                                : 'border-[#0B2B5B]/40 font-medium text-slate-900 dark:border-cyan-500/50 dark:text-slate-100'
                            )}
                          >
                            <SelectValue placeholder={t('selectOption')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{t('selectOption')}</SelectItem>
                            <SelectItem value="daily">{t('freqDaily')}</SelectItem>
                            <SelectItem value="weekly">{t('freqWeekly')}</SelectItem>
                            <SelectItem value="monthly">{t('freqMonthly')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* 6. Mức độ quan trọng */}
                      <TableCell className="px-2 whitespace-nowrap">
                        <Select
                          value={impVal}
                          onValueChange={(v) => handleImportanceChange(form, v)}
                        >
                          <SelectTrigger
                            className={cn(
                              'h-8 text-[12px] transition-colors',
                              impVal === '__none__'
                                ? 'text-slate-400'
                                : impVal === 'high_urgent'
                                ? 'border-red-300 bg-red-50/50 font-medium text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
                                : impVal === 'medium'
                                ? 'border-amber-300 bg-amber-50/40 font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                                : 'border-slate-300 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200'
                            )}
                          >
                            <SelectValue placeholder={t('selectOption')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{t('selectOption')}</SelectItem>
                            <SelectItem value="high_urgent">{t('impHighUrgent')}</SelectItem>
                            <SelectItem value="medium">{t('impMedium')}</SelectItem>
                            <SelectItem value="low">{t('impLow')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* 7. NV được phân quyền */}
                      <TableCell className="px-2">
                        <Input
                          value={authUsersVal}
                          onChange={(e) =>
                            upsertRow(form, {
                              authorizedUsers: e.target.value,
                              usedFeatures: e.target.value,
                            })
                          }
                          placeholder={t('authorizedUsersPlaceholder')}
                          className="h-8 text-[12px]"
                        />
                      </TableCell>

                      {/* 8. Cải tiến mong muốn */}
                      <TableCell className="px-2">
                        <Input
                          value={improvementsVal}
                          onChange={(e) =>
                            upsertRow(form, {
                              improvements: e.target.value,
                            })
                          }
                          placeholder={t('desiredImprovementsPlaceholder')}
                          className="h-8 text-[12px]"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

