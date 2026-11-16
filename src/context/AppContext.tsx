import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AdminUserAccount,
  AuditLog,
  Campaign,
  CatalogForm,
  CatalogReport,
  Department,
  LanguageCode,
  ProposalStatus,
  RbacRoleCode,
  SurveyQuestion,
  SurveyResponse,
  SystemConfig,
  UserProfile,
  UserRole,
} from '../types/survey';
import {
  DEFAULT_CATALOG_FORMS,
  DEFAULT_CATALOG_REPORTS,
  DEFAULT_DEPARTMENTS,
} from '../data/catalogs';
import { DEFAULT_SYSTEM_CONFIG } from '../data/demoData';
import {
  changeAdminPasswordApi,
  createAdminUserApi,
  deleteAdminQuestionApi,
  deleteAdminResponseApi,
  fetchAdminDashboardApi,
  fetchAdminMeApi,
  fetchAdminUsersApi,
  loginAdminApi,
  logoutAdminApi,
  revokeResponseTokenApi,
  saveAdminCampaignApi,
  saveAdminDepartmentApi,
  saveAdminFormApi,
  saveAdminQuestionApi,
  saveAdminReportApi,
  saveAdminSettingsApi,
  updateAdminUserApi,
  updateProposalStatusApi,
} from '../services/apiClient';
import { getT } from '../i18n/translations';

export type ActiveRoute =
  | 'dashboard'
  | 'survey'
  | 'campaigns'
  | 'forms_catalog'
  | 'reports_catalog'
  | 'questions'
  | 'results'
  | 'analytics'
  | 'summary'
  | 'users'
  | 'admin';

const ROUTE_TO_PATH: Record<ActiveRoute, string> = {
  dashboard: '/admin/dashboard',
  campaigns: '/admin/campaigns',
  results: '/admin/responses',
  analytics: '/admin/analytics',
  summary: '/admin/reports',
  forms_catalog: '/admin/forms',
  reports_catalog: '/admin/reports-catalog',
  questions: '/admin/questions',
  users: '/admin/users',
  admin: '/admin/settings',
  survey: '/survey',
};

export function pathToActiveRoute(pathname: string): ActiveRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/admin/dashboard' || clean === '/admin') return 'dashboard';
  if (clean === '/admin/campaigns') return 'campaigns';
  if (clean === '/admin/responses') return 'results';
  if (clean === '/admin/analytics') return 'analytics';
  if (clean === '/admin/reports') return 'summary';
  if (clean === '/admin/forms') return 'forms_catalog';
  if (clean === '/admin/reports-catalog') return 'reports_catalog';
  if (clean === '/admin/questions') return 'questions';
  if (clean === '/admin/users') return 'users';
  if (clean === '/admin/settings') return 'admin';
  if (clean.startsWith('/survey')) return 'survey';
  return 'dashboard';
}

interface RoleMatrixItem {
  roleCode: string;
  roleName: string;
  permissions: string[];
}

interface AppContextValue {
  pathname: string;
  navigate: (to: string, replace?: boolean) => void;
  activeRoute: ActiveRoute;
  setActiveRoute: (route: ActiveRoute) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: string) => string;
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  adminUser: AdminUserAccount | null;
  adminPermissions: string[];
  csrfToken: string;
  adminAuthChecked: boolean;
  hasPermission: (perm: string) => boolean;
  loginAdmin: (username: string, password: string) => Promise<void>;
  logoutAdmin: () => Promise<void>;
  changeAdminPassword: (currentPassword: string, newPassword: string) => Promise<void>;

  userProfile: UserProfile | null;
  isLiveSynced: boolean;

  departments: Department[];
  catalogForms: CatalogForm[];
  catalogReports: CatalogReport[];
  campaigns: Campaign[];
  activeCampaignId: string;
  setActiveCampaignId: (id: string) => void;
  questions: SurveyQuestion[];
  responses: SurveyResponse[];
  usersList: UserProfile[];
  adminUsers: AdminUserAccount[];
  roleMatrix: RoleMatrixItem[];
  systemConfig: SystemConfig;
  auditLogs: AuditLog[];

  addCustomCatalogForm: (form: CatalogForm) => Promise<void>;
  addCustomCatalogReport: (report: CatalogReport) => Promise<void>;
  upsertDepartment: (dept: Department) => Promise<void>;
  upsertCampaign: (campaign: Campaign) => Promise<void>;
  upsertQuestion: (question: SurveyQuestion) => Promise<void>;
  removeQuestion: (questionId: string) => Promise<void>;
  removeResponse: (responseId: string) => Promise<void>;
  updateProposalStatus: (responseId: string, status: ProposalStatus) => Promise<void>;
  revokeResponseToken: (responseId: string) => Promise<void>;
  updateSystemConfig: (cfg: SystemConfig) => Promise<void>;
  createAdminUserAccount: (input: {
    username: string;
    email: string;
    fullName: string;
    password: string;
    roleCode: Exclude<RbacRoleCode, 'PUBLIC'>;
    departmentScope?: string;
  }) => Promise<void>;
  updateAdminUserAccount: (
    userId: string,
    patch: {
      fullName?: string;
      roleCode?: Exclude<RbacRoleCode, 'PUBLIC'>;
      status?: 'active' | 'suspended';
      departmentScope?: string;
      password?: string;
    }
  ) => Promise<void>;
  refreshLiveData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname || '/');
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(() => {
    return localStorage.getItem('mes_sidebar_collapsed') === 'true';
  });
  const [lang, setLangState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('mes_survey_lang') as LanguageCode | null;
    return saved && ['vi', 'en', 'ko', 'zh'].includes(saved) ? saved : 'vi';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('mes_survey_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [adminUser, setAdminUser] = useState<AdminUserAccount | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [adminAuthChecked, setAdminAuthChecked] = useState(false);
  const [isLiveSynced, setIsLiveSynced] = useState(false);

  const [departments, setDepartments] = useState<Department[]>(DEFAULT_DEPARTMENTS);
  const [catalogForms, setCatalogForms] = useState<CatalogForm[]>(DEFAULT_CATALOG_FORMS);
  const [catalogReports, setCatalogReports] = useState<CatalogReport[]>(DEFAULT_CATALOG_REPORTS);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string>('camp_mes_dx_2026');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  // Never preload or leak survey responses or audit logs for unauthenticated visitors
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserAccount[]>([]);
  const [roleMatrix, setRoleMatrix] = useState<RoleMatrixItem[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string, replace = false) => {
    const target = to.startsWith('/') ? to : `/${to}`;
    if (replace) {
      window.history.replaceState({}, '', target);
    } else if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
    }
    setPathname(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const activeRoute = pathToActiveRoute(pathname);
  const setActiveRoute = useCallback(
    (route: ActiveRoute) => {
      navigate(ROUTE_TO_PATH[route] || '/admin/dashboard');
    },
    [navigate]
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('mes_survey_theme', theme);
  }, [theme]);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    localStorage.setItem('mes_sidebar_collapsed', String(collapsed));
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const next = !prev;
      localStorage.setItem('mes_sidebar_collapsed', String(next));
      return next;
    });
  }, []);

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next);
    localStorage.setItem('mes_survey_lang', next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const loadAdminDashboard = useCallback(async (perms: string[]) => {
    const data = await fetchAdminDashboardApi();
    setCampaigns(data.campaigns);
    setDepartments(data.departments);
    setCatalogForms(data.catalogForms);
    setCatalogReports(data.catalogReports);
    setQuestions(data.questions);
    setResponses(data.responses);
    setSystemConfig(data.systemConfig);
    setAuditLogs(data.auditLogs);
    setAdminUsers(data.users);
    if (data.campaigns.length > 0) {
      setActiveCampaignId((prev) =>
        data.campaigns.some((c) => c.id === prev) ? prev : data.campaigns[0].id
      );
    }
    if (perms.includes('users:read')) {
      try {
        const usersPayload = await fetchAdminUsersApi();
        setAdminUsers(usersPayload.users);
        setRoleMatrix(usersPayload.roles);
      } catch {
        // ignore if forbidden
      }
    }
    setIsLiveSynced(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const session = await fetchAdminMeApi();
        if (!mounted) return;
        setAdminUser(session.user);
        setAdminPermissions(session.permissions);
        setCsrfToken(session.csrfToken);
        await loadAdminDashboard(session.permissions);
      } catch {
        if (!mounted) return;
        setAdminUser(null);
        setAdminPermissions([]);
        setCsrfToken('');
        setResponses([]);
        setAuditLogs([]);
        setAdminUsers([]);
      } finally {
        if (mounted) setAdminAuthChecked(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadAdminDashboard]);

  const hasPermission = useCallback(
    (perm: string) => adminPermissions.includes(perm),
    [adminPermissions]
  );

  const loginAdmin = useCallback(
    async (username: string, password: string) => {
      const session = await loginAdminApi(username, password);
      setAdminUser(session.user);
      setAdminPermissions(session.permissions);
      setCsrfToken(session.csrfToken);
      await loadAdminDashboard(session.permissions);
    },
    [loadAdminDashboard]
  );

  const logoutAdmin = useCallback(async () => {
    try {
      if (csrfToken) await logoutAdminApi(csrfToken);
    } catch {
      // clear client state regardless
    }
    setAdminUser(null);
    setAdminPermissions([]);
    setCsrfToken('');
    setResponses([]);
    setAuditLogs([]);
    setAdminUsers([]);
    setRoleMatrix([]);
    setIsLiveSynced(false);
    navigate('/admin/login', true);
    toast.success(getT(lang)('signOut'));
  }, [csrfToken, lang, navigate]);

  const changeAdminPassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await changeAdminPasswordApi(csrfToken, currentPassword, newPassword);
      toast.success(getT(lang)('passwordUpdatedToast'));
    },
    [csrfToken, lang]
  );

  const refreshLiveData = useCallback(async () => {
    if (!adminUser) return;
    await loadAdminDashboard(adminPermissions);
    toast.success(getT(lang)('liveFirestoreMode'));
  }, [adminUser, adminPermissions, loadAdminDashboard, lang]);

  const addCustomCatalogForm = useCallback(
    async (form: CatalogForm) => {
      const res = await saveAdminFormApi(csrfToken, form);
      setCatalogForms((prev) => {
        const exists = prev.some((f) => f.id === res.form.id);
        return exists ? prev.map((f) => (f.id === res.form.id ? res.form : f)) : [...prev, res.form];
      });
    },
    [csrfToken]
  );

  const addCustomCatalogReport = useCallback(
    async (report: CatalogReport) => {
      const res = await saveAdminReportApi(csrfToken, report);
      setCatalogReports((prev) => {
        const exists = prev.some((r) => r.id === res.report.id);
        return exists ? prev.map((r) => (r.id === res.report.id ? res.report : r)) : [...prev, res.report];
      });
    },
    [csrfToken]
  );

  const upsertDepartment = useCallback(
    async (dept: Department) => {
      const res = await saveAdminDepartmentApi(csrfToken, dept);
      setDepartments((prev) => {
        const exists = prev.some((d) => d.id === res.department.id);
        return exists
          ? prev.map((d) => (d.id === res.department.id ? res.department : d))
          : [...prev, res.department];
      });
    },
    [csrfToken]
  );

  const upsertCampaign = useCallback(
    async (campaign: Campaign) => {
      const res = await saveAdminCampaignApi(csrfToken, campaign);
      setCampaigns((prev) => {
        const exists = prev.some((c) => c.id === res.campaign.id);
        return exists ? prev.map((c) => (c.id === res.campaign.id ? res.campaign : c)) : [res.campaign, ...prev];
      });
    },
    [csrfToken]
  );

  const upsertQuestion = useCallback(
    async (question: SurveyQuestion) => {
      const res = await saveAdminQuestionApi(csrfToken, activeCampaignId, question);
      setQuestions((prev) => {
        const exists = prev.some((q) => q.id === res.question.id);
        return exists ? prev.map((q) => (q.id === res.question.id ? res.question : q)) : [...prev, res.question];
      });
    },
    [csrfToken, activeCampaignId]
  );

  const removeQuestion = useCallback(
    async (questionId: string) => {
      await deleteAdminQuestionApi(csrfToken, questionId);
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    },
    [csrfToken]
  );

  const removeResponse = useCallback(
    async (responseId: string) => {
      await deleteAdminResponseApi(csrfToken, responseId);
      setResponses((prev) => prev.filter((r) => r.id !== responseId));
    },
    [csrfToken]
  );

  const updateProposalStatus = useCallback(
    async (responseId: string, status: ProposalStatus) => {
      await updateProposalStatusApi(csrfToken, responseId, status);
      setResponses((prev) =>
        prev.map((r) => (r.id === responseId ? { ...r, proposalStatus: status } : r))
      );
    },
    [csrfToken]
  );

  const revokeResponseToken = useCallback(
    async (responseId: string) => {
      await revokeResponseTokenApi(csrfToken, responseId);
      setResponses((prev) =>
        prev.map((r) => (r.id === responseId ? { ...r, credentialStatus: 'revoked' } : r))
      );
      toast.success(getT(lang)('tokenRevokedToast'));
    },
    [csrfToken, lang]
  );

  const updateSystemConfig = useCallback(
    async (cfg: SystemConfig) => {
      const res = await saveAdminSettingsApi(csrfToken, cfg);
      setSystemConfig(res.settings);
    },
    [csrfToken]
  );

  const createAdminUserAccount = useCallback(
    async (input: {
      username: string;
      email: string;
      fullName: string;
      password: string;
      roleCode: Exclude<RbacRoleCode, 'PUBLIC'>;
      departmentScope?: string;
    }) => {
      const res = await createAdminUserApi(csrfToken, input);
      setAdminUsers((prev) => [...prev, res.user]);
    },
    [csrfToken]
  );

  const updateAdminUserAccount = useCallback(
    async (
      userId: string,
      patch: {
        fullName?: string;
        roleCode?: Exclude<RbacRoleCode, 'PUBLIC'>;
        status?: 'active' | 'suspended';
        departmentScope?: string;
        password?: string;
      }
    ) => {
      const res = await updateAdminUserApi(csrfToken, userId, patch);
      setAdminUsers((prev) => prev.map((u) => (u.id === userId ? res.user : u)));
    },
    [csrfToken]
  );

  const userProfile: UserProfile | null = adminUser
    ? {
        uid: adminUser.id,
        email: adminUser.email,
        displayName: adminUser.fullName,
        role:
          adminUser.roleCode === 'SUPER_ADMIN'
            ? 'super_admin'
            : (adminUser.roleCode.toLowerCase() as UserRole),
        preferredLang: lang,
        createdAt: adminUser.createdAt,
        updatedAt: adminUser.updatedAt,
      }
    : null;

  const usersList: UserProfile[] = adminUsers.map((u) => ({
    uid: u.id,
    email: u.email,
    displayName: u.fullName,
    role:
      u.roleCode === 'SUPER_ADMIN'
        ? 'super_admin'
        : (u.roleCode.toLowerCase() as UserRole),
    preferredLang: lang,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));

  const t = useCallback((key: string) => getT(lang)(key), [lang]);

  return (
    <AppContext.Provider
      value={{
        pathname,
        navigate,
        activeRoute,
        setActiveRoute,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        lang,
        setLang,
        t,
        theme,
        toggleTheme,
        adminUser,
        adminPermissions,
        csrfToken,
        adminAuthChecked,
        hasPermission,
        loginAdmin,
        logoutAdmin,
        changeAdminPassword,
        userProfile,
        isLiveSynced,
        departments,
        catalogForms,
        catalogReports,
        campaigns,
        activeCampaignId,
        setActiveCampaignId,
        questions,
        responses,
        usersList,
        adminUsers,
        roleMatrix,
        systemConfig,
        auditLogs,
        addCustomCatalogForm,
        addCustomCatalogReport,
        upsertDepartment,
        upsertCampaign,
        upsertQuestion,
        removeQuestion,
        removeResponse,
        updateProposalStatus,
        revokeResponseToken,
        updateSystemConfig,
        createAdminUserAccount,
        updateAdminUserAccount,
        refreshLiveData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
