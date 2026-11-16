import { useMemo, useState } from 'react';
import {
  Bell,
  ChevronRight,
  KeyRound,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  UserCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ActiveRoute, useApp } from '../../context/AppContext';
import { LANGUAGES } from '../../i18n/translations';
import { SIDEBAR_NAV_GROUPS } from './AppSidebar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { LanguageCode } from '../../types/survey';

const ROUTE_LABEL_MAP: Record<ActiveRoute, string> = {
  dashboard: 'navDashboard',
  survey: 'navSurvey',
  campaigns: 'adminCampaigns',
  forms_catalog: 'navFormsCatalog',
  reports_catalog: 'navReportsCatalog',
  questions: 'navQuestions',
  results: 'navResults',
  analytics: 'navAnalytics',
  summary: 'navSummary',
  users: 'navUsersRbac',
  admin: 'navAdmin',
};

export function AppHeader({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const {
    activeRoute,
    setActiveRoute,
    lang,
    setLang,
    t,
    theme,
    toggleTheme,
    adminUser,
    hasPermission,
    campaigns,
    activeCampaignId,
    catalogForms,
    catalogReports,
    responses,
    systemConfig,
    auditLogs,
    logoutAdmin,
    changeAdminPassword,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const [currPwd, setCurrPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const currentPageTitle = t(ROUTE_LABEL_MAP[activeRoute]);
  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId);
  const submittedCount = responses.filter((r) => r.status === 'submitted').length;

  const notifications = useMemo(() => {
    const items: { id: string; title: string; detail: string; tone: 'warning' | 'primary' | 'default' }[] = [];
    if (submittedCount < systemConfig.minSampleThreshold) {
      items.push({
        id: 'sample_gate',
        title: t('sampleGateTitle'),
        detail: `${submittedCount} / ${systemConfig.minSampleThreshold}`,
        tone: 'warning',
      });
    }
    if (activeCampaign) {
      items.push({
        id: 'active_camp',
        title: activeCampaign.title,
        detail: `${submittedCount} / ${activeCampaign.targetParticipants} (${t('kpiSubmitted')})`,
        tone: 'primary',
      });
    }
    auditLogs.slice(0, 3).forEach((log) => {
      items.push({
        id: log.id,
        title: log.action,
        detail: log.details,
        tone: 'default',
      });
    });
    return items;
  }, [submittedCount, systemConfig.minSampleThreshold, activeCampaign, auditLogs, t]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: { id: string; label: string; type: string; route: ActiveRoute }[] = [];

    for (const grp of SIDEBAR_NAV_GROUPS) {
      for (const item of grp.items) {
        if (item.requiredPerm && !hasPermission(item.requiredPerm)) continue;
        const label = t(item.labelKey);
        if (label.toLowerCase().includes(q)) {
          results.push({ id: `nav_${item.id}`, label, type: t('searchTypePage'), route: item.id });
        }
      }
    }

    for (const f of catalogForms) {
      const name = lang === 'vi' ? f.nameVi : f.nameEn;
      if (name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q)) {
        results.push({
          id: f.id,
          label: `${f.code} · ${name}`,
          type: t('searchTypeForm'),
          route: 'forms_catalog',
        });
      }
      if (results.length >= 10) break;
    }

    for (const r of catalogReports) {
      const name = lang === 'vi' ? r.nameVi : r.nameEn;
      if (name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)) {
        results.push({
          id: r.id,
          label: `${r.code} · ${name}`,
          type: t('searchTypeReport'),
          route: 'reports_catalog',
        });
      }
      if (results.length >= 12) break;
    }

    return results.slice(0, 10);
  }, [searchQuery, catalogForms, catalogReports, lang, t, hasPermission]);

  const roleLabel =
    adminUser?.roleCode === 'SUPER_ADMIN'
      ? t('roleSuperAdmin')
      : adminUser?.roleCode === 'ADMIN'
      ? t('roleAdmin')
      : adminUser?.roleCode === 'ANALYST'
      ? t('roleAnalyst')
      : t('roleRespondent');

  const handleChangePassword = async () => {
    if (!currPwd || newPwd.length < 8) {
      toast.error(t('newPassword'));
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error(t('passwordMismatch'));
      return;
    }
    setSavingPwd(true);
    try {
      await changeAdminPassword(currPwd, newPwd);
      setCurrPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setPwdDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <header className="no-print sticky top-0 z-30 flex h-12 w-full items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label={t('openMenu')}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="hidden sm:inline text-[12px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
            {t('appTitle')}
          </span>
          <ChevronRight className="hidden sm:inline h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
          <h1 className="truncate text-[18px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {currentPageTitle}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="relative hidden md:block w-[240px] lg:w-[280px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-[34px] w-full rounded-md border border-slate-200 bg-slate-50/70 pl-8 pr-2.5 text-[12px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {searchFocused && searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-[38px] z-50 rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
              {searchResults.length === 0 ? (
                <div className="px-2.5 py-3 text-center text-[12px] text-slate-400">
                  {t('searchNoResults')}
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-0.5">
                  {searchResults.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onMouseDown={() => {
                        setActiveRoute(res.route);
                        setSearchQuery('');
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {res.label}
                      </span>
                      <Badge variant="default">{res.type}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <Select value={lang} onValueChange={(v) => setLang(v as LanguageCode)}>
          <SelectTrigger className="h-8 w-[84px] px-2 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label} · {l.nativeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle Light/Dark theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label={t('notifications')}>
              <Bell className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="end">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-900 dark:text-slate-100">
                {t('notifications')}
              </span>
              <Badge variant="primary">{notifications.length}</Badge>
            </div>
            {notifications.length === 0 ? (
              <div className="py-4 text-center text-[12px] text-slate-400">{t('noNotifications')}</div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-md border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-medium text-slate-800 dark:text-slate-200">
                        {n.title}
                      </span>
                      <Badge variant={n.tone}>{n.tone === 'warning' ? '!' : 'i'}</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {n.detail}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 px-2">
              <UserCircle2 className="h-4 w-4 text-[#0B2B5B] dark:text-cyan-400" />
              <span className="hidden sm:inline max-w-[140px] truncate text-[12px]">
                {adminUser?.fullName || adminUser?.username || t('account')}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="end">
            <div className="space-y-2.5">
              <div className="space-y-0.5">
                <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                  {adminUser?.fullName}
                </div>
                <div className="truncate font-mono-num text-[11px] text-slate-500">
                  @{adminUser?.username} · {adminUser?.email}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-[12px] dark:bg-slate-950">
                <span className="text-slate-500">{t('role')}</span>
                <Badge variant="primary">{roleLabel}</Badge>
              </div>

              <Dialog open={pwdDialogOpen} onOpenChange={setPwdDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="w-full">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>{t('changePasswordTitle')}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{t('changePasswordTitle')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2.5">
                    <Input
                      type="password"
                      placeholder={t('currentPassword')}
                      value={currPwd}
                      onChange={(e) => setCurrPwd(e.target.value)}
                    />
                    <Input
                      type="password"
                      placeholder={t('newPassword')}
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                    />
                    <Input
                      type="password"
                      placeholder={t('confirmPassword')}
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => setPwdDialogOpen(false)}>
                        {t('cancel')}
                      </Button>
                      <Button size="sm" onClick={handleChangePassword} disabled={savingPwd}>
                        {t('changePasswordTitle')}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button type="button" variant="outline" size="sm" className="w-full" onClick={logoutAdmin}>
                <LogOut className="h-3.5 w-3.5" />
                <span>{t('signOut')}</span>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
