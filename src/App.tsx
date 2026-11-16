/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { AppProvider, useApp } from './context/AppContext';
import { AppSidebar } from './components/layout/AppSidebar';
import { AppHeader } from './components/layout/AppHeader';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { AdminPortal } from './components/admin/AdminPortal';
import { AdminLoginPage } from './components/admin/AdminLoginPage';
import { PublicPortal } from './components/public/PublicPortal';
import { MySurveyPortal } from './components/public/MySurveyPortal';
import {
  FormsCatalogView,
  QuestionsView,
  ReportsCatalogView,
  ResultsView,
} from './components/views/WorkspaceViews';
import { TooltipProvider } from './components/ui/tooltip';

function AdminShell() {
  const { activeRoute, hasPermission } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AppSidebar mobileOpen={mobileMenuOpen} onMobileOpenChange={setMobileMenuOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 min-w-0 p-3">
          {activeRoute === 'dashboard' && <AnalyticsDashboard mode="dashboard" />}
          {activeRoute === 'analytics' && <AnalyticsDashboard mode="analytics" />}
          {activeRoute === 'summary' && <AnalyticsDashboard mode="summary" />}
          {activeRoute === 'campaigns' && <AdminPortal defaultTab="campaigns" />}
          {activeRoute === 'forms_catalog' && <FormsCatalogView />}
          {activeRoute === 'reports_catalog' && <ReportsCatalogView />}
          {activeRoute === 'questions' && <QuestionsView />}
          {activeRoute === 'results' && <ResultsView />}
          {activeRoute === 'users' &&
            (hasPermission('users:read') ? (
              <AdminPortal defaultTab="users" />
            ) : (
              <AnalyticsDashboard mode="dashboard" />
            ))}
          {activeRoute === 'admin' && <AdminPortal defaultTab="config" />}
        </main>
      </div>
    </div>
  );
}

function RootRouter() {
  const { pathname, navigate, adminUser, adminAuthChecked } = useApp();
  const clean = pathname.replace(/\/+$/, '') || '/';

  const isPublicSurveyPath = clean.startsWith('/survey');
  const isMySurveyPath = clean.startsWith('/my-survey');
  const isAdminLoginPath = clean === '/admin/login';
  const isAdminPath = clean === '/admin' || clean.startsWith('/admin/');

  // Redirect guards once session check completes
  useEffect(() => {
    if (!adminAuthChecked) return;
    if (isAdminPath && !isAdminLoginPath && !adminUser) {
      navigate('/admin/login', true);
    } else if (isAdminLoginPath && adminUser) {
      navigate('/admin/dashboard', true);
    } else if (clean === '/' && adminUser) {
      navigate('/admin/dashboard', true);
    }
  }, [adminAuthChecked, adminUser, clean, isAdminPath, isAdminLoginPath, navigate]);

  if (isMySurveyPath) {
    return <MySurveyPortal />;
  }

  if (isPublicSurveyPath) {
    return <PublicPortal />;
  }

  if (isAdminLoginPath) {
    return <AdminLoginPage />;
  }

  if (isAdminPath) {
    if (!adminAuthChecked) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-[13px] text-slate-500 dark:bg-slate-950">
          Loading...
        </div>
      );
    }
    if (!adminUser) {
      return <AdminLoginPage />;
    }
    return <AdminShell />;
  }

  // Root `/` for unauthenticated visitors renders Public Survey Portal (never leaks admin UI!)
  if (clean === '/') {
    if (adminAuthChecked && adminUser) {
      return <AdminShell />;
    }
    return <PublicPortal />;
  }

  return <PublicPortal />;
}

export default function App() {
  return (
    <TooltipProvider delayDuration={150}>
      <AppProvider>
        <RootRouter />
        <Toaster position="bottom-right" richColors />
      </AppProvider>
    </TooltipProvider>
  );
}
