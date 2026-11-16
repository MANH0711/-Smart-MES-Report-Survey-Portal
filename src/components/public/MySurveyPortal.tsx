import React, { useState } from 'react';
import {
  AlertTriangle,
  Edit3,
  KeyRound,
  Lock,
  LogOut,
  SearchCheck,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import {
  ApiError,
  logoutMySurveySession,
  MySurveyPayload,
  updateMySurveyResponse,
  verifyMySurveyCredential,
} from '../../services/apiClient';
import { ProposalStatus } from '../../types/survey';
import { SurveyWizard } from '../survey/SurveyWizard';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { PublicHeader } from './PublicHeader';

function proposalBadgeVariant(status?: ProposalStatus): 'default' | 'primary' | 'warning' | 'success' {
  if (status === 'completed') return 'success';
  if (status === 'approved' || status === 'in_progress') return 'primary';
  if (status === 'reviewing') return 'warning';
  return 'default';
}

export function MySurveyPortal() {
  const { lang, t } = useApp();
  const [responseCode, setResponseCode] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [verifiedData, setVerifiedData] = useState<MySurveyPayload | null>(null);
  const [editing, setEditing] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!responseCode.trim() || !accessToken.trim()) {
      setErrorMsg(t('errInvalidCredential'));
      return;
    }
    setVerifying(true);
    try {
      const payload = await verifyMySurveyCredential(responseCode.trim().toUpperCase(), accessToken.trim());
      setVerifiedData(payload);
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'TOKEN_REVOKED') setErrorMsg(t('errTokenRevoked'));
        else if (err.code === 'TOKEN_EXPIRED') setErrorMsg(t('errTokenExpired'));
        else if (err.status === 429) setErrorMsg(err.message);
        else setErrorMsg(t('errInvalidCredential'));
      } else {
        setErrorMsg(t('errInvalidCredential'));
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleCloseSession = async () => {
    try {
      await logoutMySurveySession();
    } catch {
      // ignore
    }
    setVerifiedData(null);
    setEditing(false);
    setAccessToken('');
  };

  const proposalLabel = (status?: ProposalStatus) => {
    switch (status) {
      case 'reviewing':
        return t('proposalReviewing');
      case 'approved':
        return t('proposalApproved');
      case 'in_progress':
        return t('proposalInProgress');
      case 'completed':
        return t('proposalCompleted');
      default:
        return t('proposalPending');
    }
  };

  const deptLabel = (deptId: string) => {
    const d = verifiedData?.departments.find((x) => x.id === deptId);
    if (!d) return deptId;
    return lang === 'vi' ? d.nameVi : d.nameEn;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
      <PublicHeader />

      <main className="w-full min-w-0 flex-1 px-3 py-3 sm:px-5 sm:py-4 space-y-4">
        {!verifiedData ? (
          <div className="mx-auto max-w-lg py-6">
            <div className="rounded-md border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#0B2B5B] text-white dark:bg-cyan-500 dark:text-slate-950">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-[17px] font-bold text-slate-900 dark:text-slate-100">
                    {t('mySurveyTitle')}
                  </h1>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">{t('mySurveyDesc')}</p>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-3">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                    {t('responseCodeLabel')}
                  </label>
                  <Input
                    value={responseCode}
                    onChange={(e) => setResponseCode(e.target.value)}
                    placeholder="MES-2611-A1B2C3D4"
                    className="font-mono-num"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                    {t('accessTokenLabel')}
                  </label>
                  <Input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="mes_tk_..."
                    className="font-mono-num"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={verifying}>
                  <SearchCheck className="h-4 w-4" />
                  <span>{verifying ? t('mySurveyVerifying') : t('mySurveyVerifyBtn')}</span>
                </Button>
              </form>
            </div>
          </div>
        ) : editing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <Edit3 className="h-4 w-4 text-[#0B2B5B] dark:text-cyan-400" />
                <span>
                  {t('mySurveyEditBtn')} · {verifiedData.response.responseCode}
                </span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
                {t('mySurveyCancelEdit')}
              </Button>
            </div>

            <SurveyWizard
              publicCampaign={verifiedData.campaign}
              publicDepartments={verifiedData.departments}
              publicForms={verifiedData.catalogForms}
              initialResponse={verifiedData.response}
              submitButtonLabel={t('mySurveySaveChanges')}
              onCancelEdit={() => setEditing(false)}
              onSubmitPayload={async (patch) => {
                const updated = await updateMySurveyResponse(
                  verifiedData.response.responseCode || responseCode,
                  patch
                );
                setVerifiedData((prev) =>
                  prev ? { ...prev, response: updated.response, campaign: updated.campaign } : prev
                );
                setEditing(false);
                toast.success(t('mySurveyUpdatedToast'));
              }}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Private Record Header */}
            <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="primary" className="font-mono-num">
                      {verifiedData.response.responseCode}
                    </Badge>
                    <Badge variant="success">{t('statusSubmitted')}</Badge>
                    <Badge variant={proposalBadgeVariant(verifiedData.response.proposalStatus)}>
                      {t('proposalStatusLabel')}: {proposalLabel(verifiedData.response.proposalStatus)}
                    </Badge>
                  </div>
                  <h1 className="text-[17px] font-bold text-slate-900 dark:text-slate-100">
                    {verifiedData.campaign.title}
                  </h1>
                  <div className="font-mono-num text-[11px] text-slate-500">
                    {t('colSubmittedAt')}: {(verifiedData.response.submittedAt || verifiedData.response.updatedAt).slice(0, 19).replace('T', ' ')} ·{' '}
                    {t('tokenExpiresAt')}: {verifiedData.credential.expiresAt.slice(0, 10)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {verifiedData.campaign.allowEditAfterSubmit && (
                    <Button type="button" size="sm" onClick={() => setEditing(true)}>
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{t('mySurveyEditBtn')}</span>
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={handleCloseSession}>
                    <LogOut className="h-3.5 w-3.5" />
                    <span>{t('mySurveyCloseSession')}</span>
                  </Button>
                </div>
              </div>

              {!verifiedData.campaign.allowEditAfterSubmit && (
                <div className="mt-3 flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span>{t('mySurveyLockedNotice')}</span>
                </div>
              )}
            </div>

            {/* Participant Profile */}
            <div className="rounded-md border border-slate-200 bg-white p-4 space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <h2 className="text-[14px] font-semibold">{t('stepA')}</h2>
                <Badge variant="default">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {verifiedData.response.isAnonymous ? t('anonymousMode') : t('authenticatedMode')}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-[12px] sm:grid-cols-4">
                {!verifiedData.response.isAnonymous && (
                  <>
                    <div>
                      <div className="text-[11px] text-slate-500">{t('employeeId')}</div>
                      <div className="font-mono-num font-semibold">
                        {verifiedData.response.participantInfo.employeeId || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">{t('fullName')}</div>
                      <div className="font-semibold">
                        {verifiedData.response.participantInfo.fullName || '—'}
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <div className="text-[11px] text-slate-500">{t('department')}</div>
                  <div className="font-semibold">{deptLabel(verifiedData.response.departmentId)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">{t('section')}</div>
                  <div className="font-semibold">{verifiedData.response.section || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">{t('jobTitle')}</div>
                  <div className="font-semibold">{verifiedData.response.participantInfo.jobTitle}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">{t('frequentSystems')}</div>
                  <div className="font-semibold">
                    {(verifiedData.response.participantInfo.frequentSystems || []).join(', ')}
                  </div>
                </div>
              </div>
            </div>

            {/* Evaluated MES Forms */}
            <div className="rounded-md border border-slate-200 bg-white p-4 space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-[14px] font-semibold">
                {t('stepB')} ({verifiedData.response.selectedForms.length})
              </h2>
              {verifiedData.response.selectedForms.length === 0 ? (
                <div className="py-4 text-center text-[12px] text-slate-400">{t('noDataYet')}</div>
              ) : (
                <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">{t('colFormId')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('colActionEng')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('colUsageFreq')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('colImportanceTier')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('colAuthorizedUsers')}</TableHead>
                        <TableHead className="whitespace-nowrap">{t('colDesiredImprovements')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verifiedData.response.selectedForms.map((f) => (
                        <TableRow key={f.formId}>
                          <TableCell className="font-mono-num text-[11px]">{f.formId}</TableCell>
                          <TableCell className="font-medium">{f.formName}</TableCell>
                          <TableCell>{f.frequency}</TableCell>
                          <TableCell>
                            <Badge variant={f.importance >= 4 ? 'danger' : 'default'}>
                              {f.importanceLevel === 'high_urgent' || f.importance >= 4
                                ? t('impHighUrgent')
                                : f.importanceLevel === 'medium' || f.importance === 3
                                ? t('impMedium')
                                : t('impLow')}
                            </Badge>
                          </TableCell>
                          <TableCell>{f.authorizedUsers || f.usedFeatures || '—'}</TableCell>
                          <TableCell>{f.improvements || f.painPoints || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Proposals */}
            <div className="rounded-md border border-slate-200 bg-white p-4 space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold">{t('stepG')}</h2>
                <Badge variant={verifiedData.response.proposals.priority === 'P1' ? 'danger' : 'primary'}>
                  {verifiedData.response.proposals.priority}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-[12px]">
                <div className="rounded border border-slate-100 p-2.5 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">{t('proposalTopImprovement')}</div>
                  <div className="mt-0.5">{verifiedData.response.proposals.topImprovement || '—'}</div>
                </div>
                <div className="rounded border border-slate-100 p-2.5 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">{t('proposalBiggestChallenge')}</div>
                  <div className="mt-0.5">{verifiedData.response.proposals.biggestChallenge || '—'}</div>
                </div>
                <div className="rounded border border-slate-100 p-2.5 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">{t('proposalRequestedForms')}</div>
                  <div className="mt-0.5">{verifiedData.response.proposals.requestedForms || '—'}</div>
                </div>
                <div className="rounded border border-slate-100 p-2.5 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500">{t('proposalDxVision')}</div>
                  <div className="mt-0.5">{verifiedData.response.proposals.dxProposal || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
