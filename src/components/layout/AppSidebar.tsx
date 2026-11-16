import {
  ChartNoAxesCombined,
  ChartPie,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Factory,
  FileBarChart2,
  FileCheck2,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  PanelsTopLeft,
  Settings2,
  UserCog,
} from 'lucide-react';
import { ActiveRoute, useApp } from '../../context/AppContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Sheet, SheetContent } from '../ui/sheet';
import { cn } from '../../lib/utils';

interface NavGroup {
  groupKey: string;
  items: {
    id: ActiveRoute;
    labelKey: string;
    icon: typeof LayoutDashboard;
    requiredPerm?: string;
  }[];
}

export const SIDEBAR_NAV_GROUPS: NavGroup[] = [
  {
    groupKey: 'menuGroupOverview',
    items: [
      { id: 'dashboard', labelKey: 'navDashboard', icon: LayoutDashboard, requiredPerm: 'dashboard:read' },
      { id: 'analytics', labelKey: 'navAnalytics', icon: ChartPie, requiredPerm: 'analytics:read' },
      { id: 'summary', labelKey: 'navSummary', icon: ChartNoAxesCombined, requiredPerm: 'reports:read' },
    ],
  },
  {
    groupKey: 'menuGroupSurvey',
    items: [
      { id: 'campaigns', labelKey: 'adminCampaigns', icon: FolderKanban, requiredPerm: 'campaigns:read' },
      { id: 'results', labelKey: 'navResults', icon: FileCheck2, requiredPerm: 'responses:read' },
      { id: 'questions', labelKey: 'navQuestions', icon: HelpCircle, requiredPerm: 'questions:read' },
    ],
  },
  {
    groupKey: 'menuGroupSystem',
    items: [
      { id: 'forms_catalog', labelKey: 'navFormsCatalog', icon: PanelsTopLeft, requiredPerm: 'catalogs:read' },
      { id: 'reports_catalog', labelKey: 'navReportsCatalog', icon: FileBarChart2, requiredPerm: 'catalogs:read' },
      { id: 'users', labelKey: 'navUsersRbac', icon: UserCog, requiredPerm: 'users:read' },
      { id: 'admin', labelKey: 'navAdmin', icon: Settings2, requiredPerm: 'settings:read' },
    ],
  },
];

function SidebarContent({
  collapsed,
  onSelectRoute,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onSelectRoute?: (r: ActiveRoute) => void;
  onToggleCollapse?: () => void;
}) {
  const { activeRoute, setActiveRoute, navigate, t, isLiveSynced, hasPermission } = useApp();

  const handleSelect = (id: ActiveRoute) => {
    setActiveRoute(id);
    onSelectRoute?.(id);
  };

  return (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-slate-900">
      <div className="flex flex-col">
        {/* Brand Row matching 48px Header */}
        <div
          className={cn(
            'flex h-12 items-center border-b border-slate-200 px-3 dark:border-slate-800',
            collapsed ? 'justify-center' : 'justify-between'
          )}
        >
          <button
            type="button"
            onClick={() => handleSelect('dashboard')}
            className="flex items-center gap-2 text-left cursor-pointer min-w-0"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0B2B5B] text-white dark:bg-cyan-500 dark:text-slate-950">
              <Factory className="h-4 w-4" />
            </div>
            {!collapsed && (
              <span className="truncate text-[14px] font-bold tracking-tight text-[#0B2B5B] dark:text-cyan-400">
                {t('appTitle')}
              </span>
            )}
          </button>

          {onToggleCollapse && !collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={t('collapseSidebar')}
              aria-label={t('collapseSidebar')}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-3 p-2 overflow-y-auto">
          {SIDEBAR_NAV_GROUPS.map((grp) => {
            const visibleItems = grp.items.filter(
              (item) => !item.requiredPerm || hasPermission(item.requiredPerm)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={grp.groupKey} className="space-y-0.5">
                {!collapsed && (
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                    {t(grp.groupKey)}
                  </div>
                )}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeRoute === item.id;
                  const label = t(item.labelKey);
                  const btn = (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={cn(
                        'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[12.5px] font-medium transition-colors cursor-pointer',
                        collapsed && 'justify-center px-0',
                        active
                          ? 'bg-[#0B2B5B] text-white dark:bg-cyan-500 dark:text-slate-950'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </button>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.id}>
                        <TooltipTrigger asChild>{btn}</TooltipTrigger>
                        <TooltipContent side="right">{label}</TooltipContent>
                      </Tooltip>
                    );
                  }
                  return btn;
                })}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer Collapse Trigger & Public Portal Link */}
      <div className="border-t border-slate-200 p-2 dark:border-slate-800 space-y-1.5">
        <button
          type="button"
          onClick={() => navigate('/survey')}
          className={cn(
            'flex h-8 w-full items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11.5px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer',
            collapsed && 'justify-center px-0'
          )}
          title={t('publicPortalTag')}
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-cyan-600" />
          {!collapsed && <span className="truncate">{t('publicPortalTag')}</span>}
        </button>

        {!collapsed && (
          <div className="rounded-md bg-slate-50 px-2.5 py-1 text-[10.5px] text-slate-500 dark:bg-slate-950 dark:text-slate-400 truncate">
            {isLiveSynced ? t('liveFirestoreMode') : t('baselinePreviewMode')}
          </div>
        )}
        {onToggleCollapse && collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={t('expandSidebar')}
                className="flex h-8 w-full items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t('expandSidebar')}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function AppSidebar({
  mobileOpen,
  onMobileOpenChange,
}: {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const { sidebarCollapsed, toggleSidebar } = useApp();

  return (
    <>
      <aside
        className={cn(
          'no-print hidden lg:block shrink-0 border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-800 dark:bg-slate-900',
          sidebarCollapsed ? 'w-[60px]' : 'w-[220px]'
        )}
      >
        <div className="sticky top-0 h-screen">
          <SidebarContent collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[240px] p-0">
          <SidebarContent collapsed={false} onSelectRoute={() => onMobileOpenChange(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
