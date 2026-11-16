import { ClipboardCheck, Factory, Moon, SearchCheck, Shield, Sun } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LANGUAGES } from '../../i18n/translations';
import { LanguageCode } from '../../types/survey';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/utils';

export function PublicHeader() {
  const { pathname, navigate, lang, setLang, t, theme, toggleTheme, adminUser } = useApp();

  const onMySurvey = pathname.startsWith('/my-survey');
  const onSurvey = pathname === '/' || pathname.startsWith('/survey');

  return (
    <header className="sticky top-0 z-30 flex h-12 w-full items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:px-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => navigate('/survey')}
          className="flex items-center gap-2 text-left cursor-pointer min-w-0"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0B2B5B] text-white dark:bg-cyan-500 dark:text-slate-950">
            <Factory className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold tracking-tight text-[#0B2B5B] dark:text-cyan-400">
              {t('appTitle')}
            </div>
            <div className="hidden sm:block truncate text-[10px] text-slate-500 dark:text-slate-400">
              {t('publicPortalTag')}
            </div>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-1 border-l border-slate-200 pl-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => navigate('/survey')}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap',
              onSurvey
                ? 'bg-[#0B2B5B] text-white dark:bg-cyan-500 dark:text-slate-950'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            )}
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            <span>{t('navSurvey')}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/my-survey')}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap',
              onMySurvey
                ? 'bg-[#0B2B5B] text-white dark:bg-cyan-500 dark:text-slate-950'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            )}
          >
            <SearchCheck className="h-3.5 w-3.5" />
            <span>{t('mySurveyLink')}</span>
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <Button
          type="button"
          variant={onMySurvey ? 'default' : 'outline'}
          size="sm"
          className="md:hidden px-2"
          onClick={() => navigate('/my-survey')}
        >
          <SearchCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('mySurveyLink')}</span>
        </Button>

        <Select value={lang} onValueChange={(v) => setLang(v as LanguageCode)}>
          <SelectTrigger className="h-8 w-[82px] px-2 text-[12px]">
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
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate(adminUser ? '/admin/dashboard' : '/admin/login')}
          className="gap-1.5"
        >
          <Shield className="h-3.5 w-3.5 text-[#0B2B5B] dark:text-cyan-400" />
          <span className="hidden sm:inline">{t('adminPortalLink')}</span>
        </Button>
      </div>
    </header>
  );
}
