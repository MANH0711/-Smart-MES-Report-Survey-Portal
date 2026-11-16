import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  KeyRound,
  Lock,
  QrCode,
  SearchCheck,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import {
  fetchPublicCampaignDetail,
  fetchPublicCampaigns,
  PublicCampaignItem,
  submitPublicCustomForm,
  submitPublicResponse,
} from '../../services/apiClient';
import {
  Campaign,
  CatalogForm,
  Department,
  PublicSubmissionReceipt,
  SurveyQuestion,
} from '../../types/survey';
import { SurveyWizard } from '../survey/SurveyWizard';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { QrCodeSvg } from '../ui/qr-code';
import { PublicHeader } from './PublicHeader';

function parseSurveyRoute(pathname: string): {
  mode: 'directory' | 'landing' | 'start' | 'complete';
  slug?: string;
} {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '/survey') {
    return { mode: 'directory' };
  }
  const parts = clean.split('/').filter(Boolean);
  // parts[0] === 'survey'
  if (parts.length === 2) {
    return { mode: 'landing', slug: decodeURIComponent(parts[1]) };
  }
  if (parts.length >= 3 && parts[2] === 'start') {
    return { mode: 'start', slug: decodeURIComponent(parts[1]) };
  }
  if (parts.length >= 3 && parts[2] === 'complete') {
    return { mode: 'complete', slug: decodeURIComponent(parts[1]) };
  }
  return { mode: 'directory' };
}

export function PublicPortal() {
  const { pathname, navigate, t } = useApp();
  const route = parseSurveyRoute(pathname);

  const [campaigns, setCampaigns] = useState<PublicCampaignItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [campaignDetail, setCampaignDetail] = useState<{
    campaign: Campaign;
    availability: { open: boolean; reason?: string };
    departments: Department[];
    catalogForms: CatalogForm[];
    questions: SurveyQuestion[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Ephemeral one-time receipt kept only in React state after submission (never stored in URL!)
  const [receipt, setReceipt] = useState<PublicSubmissionReceipt | null>(null);

  useEffect(() => {
    if (route.mode !== 'directory') return;
    let active = true;
    setLoadingList(true);
    fetchPublicCampaigns()
      .then((res) => {
        if (active) setCampaigns(res.campaigns);
      })
      .catch(() => {
        if (active) setCampaigns([]);
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });
    return () => {
      active = false;
    };
  }, [route.mode]);

  useEffect(() => {
    if (!route.slug || route.mode === 'complete') return;
    let active = true;
    setLoadingDetail(true);
    setDetailError('');
    fetchPublicCampaignDetail(route.slug)
      .then((res) => {
        if (active) setCampaignDetail(res);
      })
      .catch((err) => {
        if (active) {
          setCampaignDetail(null);
          setDetailError(err instanceof Error ? err.message : 'Campaign not found');
        }
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [route.slug, route.mode]);

  const copyText = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      toast.success(t('copiedToClipboard'));
    } catch {
      toast.error('Copy failed');
    }
  };

  const downloadReceiptTxt = (r: PublicSubmissionReceipt) => {
    const content = [
      'SMART MES & REPORT SURVEY PORTAL - PRIVATE RECEIPT',
      '===================================================',
      `Campaign: ${r.campaignTitle}`,
      `Response ID: ${r.responseId}`,
      `Response Code: ${r.responseCode}`,
      `Access Token: ${r.accessToken}`,
      `Submitted At: ${r.submittedAt}`,
      `Expires At: ${r.expiresAt}`,
      `Lookup URL: ${window.location.origin}/my-survey`,
      '',
      'KEEP THIS FILE SECURE. The Access Token is never stored in plaintext on the server.',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${r.responseCode}_receipt.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildCampaignUrl = (slug: string) => `${window.location.origin}/survey/${slug}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
      <PublicHeader />

      <main className="w-full min-w-0 flex-1 px-3 py-3 sm:px-5 sm:py-4 space-y-4">
        {/* MODE 1: CAMPAIGN DIRECTORY (/survey or /) */}
        {route.mode === 'directory' && (
          <div className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">{t('publicPortalTag')}</Badge>
                    <Badge variant="success">No Login Required</Badge>
                  </div>
                  <h1 className="text-[20px] font-bold tracking-tight text-[#0B2B5B] dark:text-cyan-400">
                    {t('appFullTitle')}
                  </h1>
                  <p className="max-w-3xl text-[12.5px] text-slate-600 dark:text-slate-400">
                    {t('publicPortalHeroDesc')}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/my-survey')}
                  className="shrink-0"
                >
                  <SearchCheck className="h-3.5 w-3.5" />
                  <span>{t('mySurveyLink')}</span>
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
                {t('activeCampaignsHeading')}
              </h2>
            </div>

            {loadingList ? (
              <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-[13px] text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                Loading...
              </div>
            ) : campaigns.length === 0 ? (
              <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-[13px] text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                {t('noActiveCampaigns')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {campaigns.map((camp) => {
                  const slug = camp.slug || camp.id;
                  const shareUrl = buildCampaignUrl(slug);
                  return (
                    <div
                      key={camp.id}
                      className="flex flex-col justify-between rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                            {camp.title}
                          </h3>
                          <Badge variant={camp.availability.open ? 'success' : 'default'}>
                            {camp.availability.open ? t('statusActive') : t('statusClosed')}
                          </Badge>
                        </div>

                        <p className="text-[12px] text-slate-600 dark:text-slate-400">
                          {camp.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          <Badge variant={camp.allowAnonymous ? 'default' : 'warning'}>
                            {camp.allowAnonymous ? t('policyAnonymousAllowed') : t('policyIdentifiedRequired')}
                          </Badge>
                          {camp.requireEmployeeCode && (
                            <Badge variant="primary">{t('policyEmployeeCodeRequired')}</Badge>
                          )}
                          <Badge variant="default">
                            {camp.allowEditAfterSubmit ? t('policyEditableAfterSubmit') : t('policyLockedAfterSubmit')}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1 font-mono-num">
                            <Calendar className="h-3.5 w-3.5" />
                            {t('campaignDeadline')}: {camp.startDate || '—'} → {camp.endDate || '—'}
                          </span>
                          <span className="flex items-center gap-1 font-mono-num">
                            <Users className="h-3.5 w-3.5" />
                            {t('campaignTarget')}: {camp.targetParticipants}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button type="button" variant="outline" size="sm">
                              <QrCode className="h-3.5 w-3.5" />
                              <span>QR</span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-xs text-center">
                            <DialogHeader>
                              <DialogTitle>{t('qrShareTitle')}</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col items-center gap-3 py-2">
                              <QrCodeSvg value={shareUrl} size={180} />
                              <div className="w-full truncate rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono-num text-[11px] dark:border-slate-800 dark:bg-slate-950">
                                {shareUrl}
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() => copyText(shareUrl)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                                <span>{t('copySurveyLink')}</span>
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/survey/${slug}`)}
                          >
                            <span>{t('openSurveyLanding')}</span>
                          </Button>
                          {camp.availability.open && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => navigate(`/survey/${slug}/start`)}
                            >
                              <span>{t('startSurvey')}</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODE 2: CAMPAIGN LANDING (/survey/:slug) */}
        {route.mode === 'landing' && (
          <div className="space-y-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/survey')}>
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t('backToCampaigns')}</span>
            </Button>

            {loadingDetail ? (
              <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-[13px] text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                Loading...
              </div>
            ) : detailError || !campaignDetail ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {detailError || t('noActiveCampaigns')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-md border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={campaignDetail.availability.open ? 'success' : 'danger'}>
                      {campaignDetail.availability.open ? t('statusActive') : t('statusClosed')}
                    </Badge>
                    <span className="font-mono-num text-[11px] text-slate-500">
                      {t('campaignDeadline')}: {campaignDetail.campaign.startDate || '—'} →{' '}
                      {campaignDetail.campaign.endDate || '—'}
                    </span>
                  </div>

                  <div>
                    <h1 className="text-[20px] font-bold text-[#0B2B5B] dark:text-cyan-400">
                      {campaignDetail.campaign.title}
                    </h1>
                    <p className="mt-1.5 text-[13px] text-slate-600 dark:text-slate-300">
                      {campaignDetail.campaign.description}
                    </p>
                  </div>

                  {!campaignDetail.availability.open && (
                    <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{t('campaignClosedBanner')}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-[12px]">
                    <div className="flex items-center gap-2 rounded border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950">
                      <ShieldCheck className="h-4 w-4 text-[#0B2B5B] dark:text-cyan-400" />
                      <span>
                        {campaignDetail.campaign.allowAnonymous
                          ? t('policyAnonymousAllowed')
                          : t('policyIdentifiedRequired')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950">
                      <Lock className="h-4 w-4 text-[#0B2B5B] dark:text-cyan-400" />
                      <span>
                        {campaignDetail.campaign.allowEditAfterSubmit
                          ? t('policyEditableAfterSubmit')
                          : t('policyLockedAfterSubmit')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950">
                      <ClipboardCheck className="h-4 w-4 text-[#0B2B5B] dark:text-cyan-400" />
                      <span>
                        {campaignDetail.campaign.allowMultipleSubmissions === false
                          ? t('policySingleSubmission')
                          : t('policyMultiSubmission')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950">
                      <KeyRound className="h-4 w-4 text-[#0B2B5B] dark:text-cyan-400" />
                      <span>256-bit Private Token Receipt</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Button
                      type="button"
                      disabled={!campaignDetail.availability.open}
                      onClick={() => navigate(`/survey/${route.slug}/start`)}
                    >
                      <span>{t('startSurvey')}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" onClick={() => navigate('/my-survey')}>
                      <SearchCheck className="h-4 w-4" />
                      <span>{t('mySurveyLink')}</span>
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-5 flex flex-col items-center justify-center text-center space-y-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                    {t('qrShareTitle')}
                  </div>
                  <QrCodeSvg value={buildCampaignUrl(route.slug || '')} size={170} />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copyText(buildCampaignUrl(route.slug || ''))}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{t('copySurveyLink')}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODE 3: PUBLIC SURVEY EXECUTION (/survey/:slug/start) */}
        {route.mode === 'start' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/survey/${route.slug}`)}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{campaignDetail?.campaign.title || t('backToCampaigns')}</span>
              </Button>
            </div>

            {loadingDetail ? (
              <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-[13px] text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                Loading...
              </div>
            ) : detailError || !campaignDetail ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {detailError || t('noActiveCampaigns')}
              </div>
            ) : !campaignDetail.availability.open ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-6 text-center text-[13px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {t('campaignClosedBanner')}
              </div>
            ) : (
              <SurveyWizard
                publicCampaign={campaignDetail.campaign}
                publicDepartments={campaignDetail.departments}
                publicForms={campaignDetail.catalogForms}
                publicQuestions={campaignDetail.questions}
                onAddPublicForm={async (frm) => {
                  const saved = await submitPublicCustomForm(route.slug!, frm);
                  setCampaignDetail((prev) =>
                    prev ? { ...prev, catalogForms: [...prev.catalogForms, saved.form] } : prev
                  );
                }}
                onSubmitPayload={async (payload) => {
                  const res = await submitPublicResponse(route.slug!, payload);
                  setReceipt(res);
                  toast.success(t('surveyCompletedTitle'));
                  navigate(`/survey/${route.slug}/complete`, true);
                }}
              />
            )}
          </div>
        )}

        {/* MODE 4: PRIVATE SUBMISSION RECEIPT (/survey/:slug/complete) */}
        {route.mode === 'complete' && (
          <div className="mx-auto max-w-2xl py-4">
            <div className="rounded-md border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-center space-y-1.5">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h1 className="text-[19px] font-bold text-slate-900 dark:text-slate-100">
                  {t('privateReceiptTitle')}
                </h1>
                <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
                  {t('surveyCompletedSubtitle')}
                </p>
              </div>

              {receipt ? (
                <>
                  <div className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{t('privateReceiptWarning')}</span>
                  </div>

                  <div className="space-y-2.5 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] text-slate-500">{t('responseIdLabel')}</div>
                        <div className="font-mono-num text-[12px] font-medium truncate">{receipt.responseId}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">{t('colSubmittedAt')}</div>
                        <div className="font-mono-num text-[12px] font-medium">
                          {receipt.submittedAt.replace('T', ' ').slice(0, 19)} UTC
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-2.5 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {t('responseCodeLabel')}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => copyText(receipt.responseCode)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="font-mono-num text-[17px] font-bold tracking-wide text-[#0B2B5B] dark:text-cyan-400">
                        {receipt.responseCode}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-2.5 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {t('accessTokenLabel')}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => copyText(receipt.accessToken)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="break-all rounded border border-slate-200 bg-white p-2 font-mono-num text-[12.5px] font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                        {receipt.accessToken}
                      </div>
                      <div className="mt-1 font-mono-num text-[11px] text-slate-500">
                        {t('tokenExpiresAt')}: {receipt.expiresAt.slice(0, 10)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copyText(`Code: ${receipt.responseCode}\nToken: ${receipt.accessToken}`)
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{t('copyCodeAndToken')}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => downloadReceiptTxt(receipt)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{t('downloadReceiptTxt')}</span>
                    </Button>
                    <Button type="button" size="sm" onClick={() => navigate('/my-survey')}>
                      <SearchCheck className="h-3.5 w-3.5" />
                      <span>{t('goToMySurvey')}</span>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center space-y-3">
                  <p className="text-[12px] text-slate-500">{t('mySurveyDesc')}</p>
                  <div className="flex justify-center gap-2">
                    <Button type="button" size="sm" onClick={() => navigate('/my-survey')}>
                      <SearchCheck className="h-3.5 w-3.5" />
                      <span>{t('goToMySurvey')}</span>
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => navigate('/survey')}>
                      <span>{t('backToCampaigns')}</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
