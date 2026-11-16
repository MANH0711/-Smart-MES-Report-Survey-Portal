import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Paperclip,
  Save,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import {
  Campaign,
  CatalogForm,
  Department,
  DxDemandLevel,
  DxNeedEvaluation,
  ParticipantInfo,
  participantSchema,
  PriorityTier,
  ProposalsData,
  SelectedFormEvaluation,
  SurveyQuestion,
  SurveyResponse,
  UxRatings,
} from '../../types/survey';
import {
  DX_FEATURES,
  SYSTEM_OPTIONS,
  UX_CRITERIA,
} from '../../data/catalogs';
import { SurveyPartB } from './SurveyPartBC';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Combobox } from '../ui/combobox';
import { DatePicker } from '../ui/date-picker';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { StarRating } from '../ui/star-rating';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { cn } from '../../lib/utils';

export interface SurveyWizardProps {
  publicCampaign?: Campaign;
  publicDepartments?: Department[];
  publicForms?: CatalogForm[];
  publicQuestions?: SurveyQuestion[];
  initialResponse?: SurveyResponse;
  onSubmitPayload?: (
    payload: Omit<SurveyResponse, 'id' | 'responseCode' | 'respondentUid' | 'updatedAt' | 'submittedAt'>
  ) => Promise<void>;
  onAddPublicForm?: (form: CatalogForm) => Promise<void>;
  submitButtonLabel?: string;
  onCancelEdit?: () => void;
}

const DEFAULT_PARTICIPANT: ParticipantInfo = {
  employeeId: '',
  fullName: '',
  departmentId: 'dept_prod',
  section: '',
  jobTitle: '',
  workGroup: '',
  shift: 'day',
  mesExperience: '1-3y',
  frequentSystems: ['MES'],
  otherSystem: '',
  surveyDate: new Date().toISOString().slice(0, 10),
};

const DEFAULT_UX: UxRatings = {
  uiEase: 3,
  searchSpeed: 3,
  stepEfficiency: 3,
  pageLoadSpeed: 3,
  errorStability: 3,
  dataAccuracy: 4,
  permissionFit: 4,
  needMobileUi: 4,
  needMultilang: 4,
};

const DEFAULT_PROPOSALS: ProposalsData = {
  topImprovement: '',
  requestedForms: '',
  requestedReports: '',
  automationTarget: '',
  biggestChallenge: '',
  dxProposal: '',
  priority: 'P1',
  attachmentNames: [],
  customAnswers: {},
};

export function SurveyWizard({
  publicCampaign,
  publicDepartments,
  publicForms,
  publicQuestions,
  initialResponse,
  onSubmitPayload,
  onAddPublicForm,
  submitButtonLabel,
  onCancelEdit,
}: SurveyWizardProps = {}) {
  const {
    lang,
    t,
    adminUser,
    departments: ctxDepartments,
    catalogForms: ctxForms,
    campaigns,
    activeCampaignId,
    questions: ctxQuestions,
    systemConfig,
    addCustomCatalogForm,
    setActiveRoute,
  } = useApp();

  const activeCampaign =
    publicCampaign || campaigns.find((c) => c.id === activeCampaignId) || campaigns[0];
  const departments = publicDepartments || ctxDepartments;
  const catalogForms = publicForms || ctxForms;
  const questions = publicQuestions || ctxQuestions;
  const draftStorageKey = `smart_mes_survey_draft_${activeCampaign?.slug || activeCampaign?.id || 'default'}`;
  const isEditingExisting = Boolean(initialResponse);

  const [step, setStep] = useState(0);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(() => {
    if (initialResponse) return initialResponse.isAnonymous;
    if (activeCampaign && !activeCampaign.allowAnonymous) return false;
    return activeCampaign?.allowAnonymous ? systemConfig.anonymousSurveyDefault : false;
  });
  const [selectedForms, setSelectedForms] = useState<SelectedFormEvaluation[]>(
    () => initialResponse?.selectedForms || []
  );
  const [dxNeeds, setDxNeeds] = useState<DxNeedEvaluation[]>(() => {
    if (initialResponse?.dxNeeds && initialResponse.dxNeeds.length > 0) return initialResponse.dxNeeds;
    return DX_FEATURES.map((f) => ({
      featureId: f.id,
      featureName: f.labels.en,
      demandLevel: 'needed',
    }));
  });
  const [uxRatings, setUxRatings] = useState<UxRatings>(() => initialResponse?.uxRatings || DEFAULT_UX);
  const [proposals, setProposals] = useState<ProposalsData>(() => initialResponse?.proposals || DEFAULT_PROPOSALS);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState<SurveyResponse | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  const formMethods = useForm<ParticipantInfo>({
    resolver: zodResolver(participantSchema),
    defaultValues: initialResponse
      ? {
          ...DEFAULT_PARTICIPANT,
          ...initialResponse.participantInfo,
          employeeId:
            initialResponse.isAnonymous || initialResponse.participantInfo.employeeId === 'ANONYMOUS'
              ? ''
              : initialResponse.participantInfo.employeeId,
          fullName:
            initialResponse.isAnonymous || initialResponse.participantInfo.fullName === 'ANONYMOUS'
              ? ''
              : initialResponse.participantInfo.fullName,
        }
      : DEFAULT_PARTICIPANT,
    mode: 'onBlur',
  });

  const watchedParticipant = formMethods.watch();

  // Keep anonymous mode synced when campaign forbids anonymous
  useEffect(() => {
    if (activeCampaign && !activeCampaign.allowAnonymous) {
      setIsAnonymous(false);
    }
  }, [activeCampaign]);

  // Restore draft on mount (only for fresh survey responses, not when editing existing record)
  useEffect(() => {
    if (isEditingExisting) return;
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.participantInfo) formMethods.reset({ ...DEFAULT_PARTICIPANT, ...parsed.participantInfo });
        if (typeof parsed.isAnonymous === 'boolean' && activeCampaign?.allowAnonymous !== false) {
          setIsAnonymous(parsed.isAnonymous);
        }
        if (Array.isArray(parsed.selectedForms)) setSelectedForms(parsed.selectedForms);
        if (Array.isArray(parsed.dxNeeds) && parsed.dxNeeds.length > 0) setDxNeeds(parsed.dxNeeds);
        if (parsed.uxRatings) setUxRatings(parsed.uxRatings);
        if (parsed.proposals) setProposals(parsed.proposals);
      }
    } catch {
      // ignore invalid draft
    }
  }, [formMethods, draftStorageKey, isEditingExisting, activeCampaign?.allowAnonymous]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (submittedRecord || isEditingExisting) return;
    const timer = setTimeout(() => {
      const payload = {
        isAnonymous,
        participantInfo: watchedParticipant,
        selectedForms,
        dxNeeds,
        uxRatings,
        proposals,
      };
      localStorage.setItem(draftStorageKey, JSON.stringify(payload));
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 500);
    return () => clearTimeout(timer);
  }, [
    isAnonymous,
    watchedParticipant,
    selectedForms,
    dxNeeds,
    uxRatings,
    proposals,
    submittedRecord,
    isEditingExisting,
    draftStorageKey,
  ]);

  const stepMeta = [
    { title: t('stepA'), desc: t('stepADesc') },
    { title: t('stepB'), desc: t('stepBDesc') },
    { title: t('stepE'), desc: t('stepEDesc') },
    { title: t('stepF'), desc: t('stepFDesc') },
    { title: t('stepG'), desc: t('stepGDesc') },
    { title: t('stepReview'), desc: t('stepReviewDesc') },
  ];

  const progressPct = Math.round(((step + 1) / stepMeta.length) * 100);
  const selectedDeptObj = departments.find((d) => d.id === watchedParticipant.departmentId);

  const deptOptions = useMemo(
    () =>
      departments
        .filter((d) => d.active)
        .map((d) => ({
          value: d.id,
          label:
            lang === 'vi'
              ? d.nameVi
              : lang === 'ko'
              ? d.nameKo || d.nameEn
              : lang === 'zh'
              ? d.nameZh || d.nameEn
              : d.nameEn,
          hint: d.code,
        })),
    [departments, lang]
  );

  const visibleDynamicQuestions = useMemo(() => {
    return questions
      .filter((q) => q.active)
      .filter((q) => {
        if (!q.conditionField || !q.conditionValue) return true;
        if (q.conditionField === 'frequentSystems') {
          return watchedParticipant.frequentSystems?.includes(q.conditionValue);
        }
        if (q.conditionField === 'departmentId') {
          return watchedParticipant.departmentId === q.conditionValue;
        }
        return true;
      })
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [questions, watchedParticipant.frequentSystems, watchedParticipant.departmentId]);

  const handleSaveDraftExplicit = async () => {
    if (isEditingExisting) return;
    const pInfo = formMethods.getValues();
    const payload = {
      isAnonymous,
      participantInfo: pInfo,
      selectedForms,
      dxNeeds,
      uxRatings,
      proposals,
    };
    localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    toast.success(t('draftSavedToast'));
  };

  const validateParticipantPolicy = (): boolean => {
    const p = formMethods.getValues();
    if (!isAnonymous) {
      if ((activeCampaign?.requireEmployeeCode || !activeCampaign?.allowAnonymous) && !p.employeeId.trim()) {
        return false;
      }
      if ((activeCampaign?.requireParticipantName || !activeCampaign?.allowAnonymous) && !p.fullName.trim()) {
        return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (step === 0) {
      const valid = await formMethods.trigger();
      if (!valid || !validateParticipantPolicy()) {
        toast.error(t('requiredFieldsToast'));
        return;
      }
    }
    setStep((s) => Math.min(stepMeta.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleSystem = (sys: string) => {
    const current = formMethods.getValues('frequentSystems') || [];
    const next = current.includes(sys) ? current.filter((s) => s !== sys) : [...current, sys];
    formMethods.setValue('frequentSystems', next, { shouldValidate: true });
  };

  const updateDxDemand = (featureId: string, demandLevel: DxDemandLevel) => {
    setDxNeeds((prev) => prev.map((d) => (d.featureId === featureId ? { ...d, demandLevel } : d)));
  };

  const handleAttachmentChange = (files: FileList | null) => {
    if (!files) return;
    const names = Array.from(files).map((f) => `${f.name} (${Math.round(f.size / 1024)}KB)`);
    setProposals((p) => ({ ...p, attachmentNames: [...p.attachmentNames, ...names] }));
  };

  const handleSubmit = async () => {
    const pValid = await formMethods.trigger();
    if (!pValid || !validateParticipantPolicy()) {
      setStep(0);
      toast.error(t('requiredFieldsToast'));
      return;
    }

    setSubmitting(true);
    try {
      const pInfo = formMethods.getValues();
      const normalizedPayload: Omit<
        SurveyResponse,
        'id' | 'responseCode' | 'respondentUid' | 'updatedAt' | 'submittedAt'
      > = {
        campaignId: activeCampaign?.id || 'camp_mes_dx_2026',
        isAnonymous,
        status: 'submitted',
        departmentId: pInfo.departmentId,
        section: pInfo.section,
        participantInfo: isAnonymous ? { ...pInfo, employeeId: 'ANONYMOUS', fullName: 'ANONYMOUS' } : pInfo,
        selectedForms,
        selectedReports: [],
        workflowEvaluations: [],
        dxNeeds,
        uxRatings,
        proposals,
      };

      if (onSubmitPayload) {
        await onSubmitPayload(normalizedPayload);
        if (!isEditingExisting) localStorage.removeItem(draftStorageKey);
        return;
      }

      // Fallback standalone preview completion
      const now = new Date().toISOString();
      const fallbackResp: SurveyResponse = {
        ...normalizedPayload,
        id: `resp_${Date.now()}`,
        respondentUid: adminUser?.id || 'anonymous',
        submittedAt: now,
        updatedAt: now,
      };
      localStorage.removeItem(draftStorageKey);
      setSubmittedRecord(fallbackResp);
      toast.success(t('surveyCompletedTitle'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const startNewSurvey = () => {
    setSubmittedRecord(null);
    setStep(0);
    formMethods.reset(DEFAULT_PARTICIPANT);
    setSelectedForms([]);
    setProposals(DEFAULT_PROPOSALS);
  };

  if (submittedRecord) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <div className="rounded-md border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-[18px] font-bold text-slate-900 dark:text-slate-100">
            {t('surveyCompletedTitle')}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500 dark:text-slate-400">
            {t('surveyCompletedSubtitle')}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2.5 rounded-md border border-slate-100 bg-slate-50 p-3 text-left sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-950">
            <div>
              <div className="text-[11px] text-slate-500">{t('colCode')}</div>
              <div className="mt-0.5 truncate font-mono-num text-[12px] font-semibold">
                {submittedRecord.id}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">{t('reviewSummaryForms')}</div>
              <div className="mt-0.5 font-mono-num text-[14px] font-bold text-[#0B2B5B] dark:text-cyan-400">
                {submittedRecord.selectedForms.length}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">{t('reviewSummaryPriority')}</div>
              <div className="mt-0.5">
                <Badge variant={submittedRecord.proposals.priority === 'P1' ? 'danger' : 'primary'}>
                  {submittedRecord.proposals.priority}
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" onClick={() => setActiveRoute('analytics')}>
              {t('viewAnalytics')}
            </Button>
            <Button size="sm" variant="outline" onClick={startNewSurvey}>
              {t('newSurveyResponse')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* Compact Wizard Progress Header */}
      <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="primary">
                {t('stepLabel')} {step + 1}/{stepMeta.length}
              </Badge>
              <span className="truncate text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                {stepMeta[step].title}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {stepMeta[step].desc}
            </p>
          </div>

          <div className="flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
            {lastSavedTime && (
              <span className="font-mono-num">
                {t('draftSaved')} · {lastSavedTime}
              </span>
            )}
            <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200">
              {progressPct}%
            </span>
          </div>
        </div>

        <Progress value={progressPct} className="mt-2 h-1.5" />

        {/* Compact Step Pills */}
        <div className="mt-2.5 flex items-center gap-1 overflow-x-auto pb-0.5">
          {stepMeta.map((meta, idx) => {
            const active = idx === step;
            const done = idx < step;
            return (
              <button
                key={meta.title}
                type="button"
                onClick={() => setStep(idx)}
                className={cn(
                  'whitespace-nowrap shrink-0 rounded border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                  active
                    ? 'border-[#0B2B5B] bg-[#0B2B5B] text-white dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950'
                    : done
                    ? 'border-cyan-200 bg-cyan-50/70 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'
                )}
              >
                {idx + 1}. {meta.title.split(':')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Step Card (12px compact padding) */}
      <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        {/* STEP 0: PART A */}
        {step === 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <div>
                <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                  {t('stepA')}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {activeCampaign?.title}
                </p>
              </div>
              {activeCampaign?.allowAnonymous !== false && !isEditingExisting && (
                <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium cursor-pointer dark:border-slate-800 dark:bg-slate-950">
                  <span>{isAnonymous ? t('anonymousMode') : t('authenticatedMode')}</span>
                  <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-4">
              {!isAnonymous && (
                <>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                      {t('employeeId')} {(activeCampaign?.requireEmployeeCode || !activeCampaign?.allowAnonymous) && '*'}
                    </label>
                    <Input {...formMethods.register('employeeId')} placeholder="NV-1042" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                      {t('fullName')} {(activeCampaign?.requireParticipantName || !activeCampaign?.allowAnonymous) && '*'}
                    </label>
                    <Input {...formMethods.register('fullName')} />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {t('department')} *
                </label>
                <Combobox
                  options={deptOptions}
                  value={watchedParticipant.departmentId}
                  onChange={(v) => {
                    formMethods.setValue('departmentId', v, { shouldValidate: true });
                  }}
                  placeholder={t('selectDepartment')}
                  searchPlaceholder={t('tableSearch')}
                  emptyText={t('tableNoResults')}
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {t('section')}
                </label>
                <Input
                  {...formMethods.register('section')}
                  placeholder={t('sectionPlaceholder')}
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {t('jobTitle')} *
                </label>
                <Input {...formMethods.register('jobTitle')} />
                {formMethods.formState.errors.jobTitle && (
                  <p className="mt-0.5 text-[11px] text-red-600">
                    {formMethods.formState.errors.jobTitle.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {t('mesExperience')}
                </label>
                <Select
                  value={watchedParticipant.mesExperience}
                  onValueChange={(v) =>
                    formMethods.setValue('mesExperience', v as ParticipantInfo['mesExperience'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="<6m">{t('expUnder6m')}</SelectItem>
                    <SelectItem value="6m-1y">{t('exp6m1y')}</SelectItem>
                    <SelectItem value="1-3y">{t('exp1to3y')}</SelectItem>
                    <SelectItem value="3-5y">{t('exp3to5y')}</SelectItem>
                    <SelectItem value=">5y">{t('expOver5y')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {t('surveyDate')}
                </label>
                <DatePicker
                  value={watchedParticipant.surveyDate || ''}
                  onChange={(d) => formMethods.setValue('surveyDate', d)}
                />
              </div>

              <div className="md:col-span-2 lg:col-span-4">
                <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {t('shift')}
                </label>
                <RadioGroup
                  value={watchedParticipant.shift}
                  onValueChange={(v) =>
                    formMethods.setValue('shift', v as ParticipantInfo['shift'])
                  }
                  className="flex flex-wrap gap-2"
                >
                  {[
                    { id: 'day', label: t('shiftDay') },
                    { id: 'night', label: t('shiftNight') },
                    { id: 'rotating', label: t('shiftRotating') },
                    { id: 'office', label: t('shiftOffice') },
                  ].map((sh) => (
                    <label
                      key={sh.id}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] cursor-pointer transition-colors',
                        watchedParticipant.shift === sh.id
                          ? 'border-[#0B2B5B] bg-sky-50/70 text-[#0B2B5B] font-medium dark:border-cyan-500 dark:bg-cyan-950/30 dark:text-cyan-300'
                          : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                      )}
                    >
                      <RadioGroupItem value={sh.id} />
                      <span>{sh.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <div className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
                {t('frequentSystems')} *
              </div>
              <div className="flex flex-wrap gap-2">
                {SYSTEM_OPTIONS.map((sys) => {
                  const checked = watchedParticipant.frequentSystems?.includes(sys);
                  return (
                    <label
                      key={sys}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] font-medium cursor-pointer transition-colors',
                        checked
                          ? 'border-[#0B2B5B] bg-sky-50 text-[#0B2B5B] dark:border-cyan-500 dark:bg-cyan-950/30 dark:text-cyan-300'
                          : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleSystem(sys)} />
                      <span>{sys}</span>
                    </label>
                  );
                })}
              </div>
              {watchedParticipant.frequentSystems?.includes('Other') && (
                <div className="max-w-md pt-1">
                  <Input {...formMethods.register('otherSystem')} placeholder={t('otherSystem')} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 1: PART B */}
        {step === 1 && (
          <SurveyPartB
            lang={lang}
            t={t}
            catalogForms={catalogForms}
            selectedForms={selectedForms}
            onChangeForms={setSelectedForms}
            onAddCustomForm={onAddPublicForm || addCustomCatalogForm}
          />
        )}

        {/* STEP 2: DIGITAL TRANSFORMATION NEEDS */}
        {step === 2 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                {t('stepE')}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('stepEDesc')}</p>
            </div>

            <div className="divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {DX_FEATURES.map((feat) => {
                const current = dxNeeds.find((d) => d.featureId === feat.id)?.demandLevel || 'neutral';
                const levels: { id: DxDemandLevel; label: string }[] = [
                  { id: 'essential', label: t('dxEssential') },
                  { id: 'needed', label: t('dxNeeded') },
                  { id: 'neutral', label: t('dxNeutral') },
                  { id: 'not_yet', label: t('dxNotYet') },
                  { id: 'no_need', label: t('dxNoNeed') },
                ];
                return (
                  <div
                    key={feat.id}
                    className="flex flex-col gap-2 px-3 py-2 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="text-[13px] font-medium text-slate-900 dark:text-slate-100">
                      {feat.labels[lang]}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {levels.map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => updateDxDemand(feat.id, lvl.id)}
                          className={cn(
                            'rounded border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap',
                            current === lvl.id
                              ? 'border-[#0B2B5B] bg-[#0B2B5B] text-white dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                          )}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: UX ASSESSMENT */}
        {step === 3 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                {t('stepF')}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('stepFDesc')}</p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
              {UX_CRITERIA.map((item) => (
                <div
                  key={item.key}
                  className="rounded-md border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950"
                >
                  <StarRating
                    label={item.labels[lang]}
                    value={uxRatings[item.key]}
                    onChange={(val) => setUxRatings((prev) => ({ ...prev, [item.key]: val }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: PROPOSALS & FEEDBACK */}
        {step === 4 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                {t('stepG')}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('stepGDesc')}</p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {t('proposalTopImprovement')}
                </label>
                <Textarea
                  value={proposals.topImprovement}
                  onChange={(e) => setProposals((p) => ({ ...p, topImprovement: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {t('proposalBiggestChallenge')}
                </label>
                <Textarea
                  value={proposals.biggestChallenge}
                  onChange={(e) => setProposals((p) => ({ ...p, biggestChallenge: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {t('proposalRequestedForms')}
                </label>
                <Input
                  value={proposals.requestedForms}
                  onChange={(e) => setProposals((p) => ({ ...p, requestedForms: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {t('proposalRequestedReports')}
                </label>
                <Input
                  value={proposals.requestedReports}
                  onChange={(e) => setProposals((p) => ({ ...p, requestedReports: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {t('proposalAutomationTarget')}
                </label>
                <Input
                  value={proposals.automationTarget}
                  onChange={(e) => setProposals((p) => ({ ...p, automationTarget: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {t('proposalPriority')}
                </label>
                <RadioGroup
                  value={proposals.priority}
                  onValueChange={(v) => setProposals((p) => ({ ...p, priority: v as PriorityTier }))}
                  className="grid grid-cols-4 gap-2"
                >
                  {(['P1', 'P2', 'P3', 'P4'] as PriorityTier[]).map((tier) => (
                    <label
                      key={tier}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-[12px] font-semibold cursor-pointer transition-colors',
                        proposals.priority === tier
                          ? 'border-[#0B2B5B] bg-[#0B2B5B] text-white dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950'
                          : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                      )}
                    >
                      <RadioGroupItem value={tier} className="sr-only" />
                      <span>{tier}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {t('proposalDxVision')}
                </label>
                <Textarea
                  value={proposals.dxProposal}
                  onChange={(e) => setProposals((p) => ({ ...p, dxProposal: e.target.value }))}
                />
              </div>
            </div>

            {visibleDynamicQuestions.length > 0 && (
              <div className="space-y-2.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                <div className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                  {t('additionalQuestions')}
                </div>
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {visibleDynamicQuestions.map((q) => {
                    const label =
                      lang === 'vi'
                        ? q.labelVi
                        : lang === 'ko'
                        ? q.labelKo || q.labelEn
                        : lang === 'zh'
                        ? q.labelZh || q.labelEn
                        : q.labelEn;
                    const val = String(proposals.customAnswers?.[q.id] ?? '');
                    return (
                      <div key={q.id}>
                        <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                          {label} {q.required && '*'}
                        </label>
                        <Input
                          value={val}
                          onChange={(e) =>
                            setProposals((p) => ({
                              ...p,
                              customAnswers: { ...(p.customAnswers || {}), [q.id]: e.target.value },
                            }))
                          }
                          placeholder={t('yourAnswer')}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
              <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-slate-700 dark:text-slate-300">
                <Paperclip className="h-3.5 w-3.5 text-cyan-600" />
                <span>{t('attachFiles')}</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleAttachmentChange(e.target.files)}
                />
              </label>
              {proposals.attachmentNames.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                  {proposals.attachmentNames.map((n, i) => (
                    <Badge key={i} variant="default">
                      {n}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW & SUBMIT */}
        {step === 5 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <ClipboardCheck className="h-4 w-4 text-[#0B2B5B] dark:text-cyan-400" />
              <div>
                <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                  {t('stepReview')}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('stepReviewDesc')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <div className="rounded-md border border-slate-200 p-2.5 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">{t('reviewSummaryMode')}</div>
                <div className="mt-1 text-[13px] font-semibold">
                  {isAnonymous ? t('anonymousMode') : t('authenticatedMode')}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 p-2.5 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">{t('reviewSummaryDept')}</div>
                <div className="mt-1 text-[13px] font-semibold truncate">
                  {lang === 'vi'
                    ? selectedDeptObj?.nameVi
                    : selectedDeptObj?.nameEn || watchedParticipant.departmentId}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 p-2.5 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">{t('reviewSummaryForms')}</div>
                <div className="mt-1 font-mono-num text-[18px] font-bold text-[#0B2B5B] dark:text-cyan-400">
                  {selectedForms.length}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 p-2.5 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">{t('reviewSummaryPriority')}</div>
                <div className="mt-1">
                  <Badge variant={proposals.priority === 'P1' ? 'danger' : 'primary'}>
                    {proposals.priority}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Action Bar: Quay lại · Lưu nháp · Tiếp tục / Gửi phiếu */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handlePrev} disabled={step === 0}>
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t('prevStep')}</span>
            </Button>
            {onCancelEdit && (
              <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}>
                {t('cancel')}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isEditingExisting && (
              <Button type="button" variant="outline" size="sm" onClick={handleSaveDraftExplicit}>
                <Save className="h-3.5 w-3.5" />
                <span>{t('saveDraft')}</span>
              </Button>
            )}

            {step < stepMeta.length - 1 ? (
              <Button type="button" size="sm" onClick={handleNext}>
                <span>{t('nextStep')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button type="button" variant="accent" size="sm" onClick={handleSubmit} disabled={submitting}>
                <Send className="h-3.5 w-3.5" />
                <span>{submitting ? t('submitting') : submitButtonLabel || t('submitSurvey')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
