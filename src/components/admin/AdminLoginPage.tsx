import React, { useState } from 'react';
import { ArrowLeft, Factory, Lock, LogIn, Moon, ShieldCheck, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { LANGUAGES } from '../../i18n/translations';
import { LanguageCode } from '../../types/survey';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function AdminLoginPage() {
  const { lang, setLang, t, theme, toggleTheme, loginAdmin, navigate } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!username.trim() || !password) {
      setErrorMsg(t('requiredFieldsToast'));
      return;
    }
    setSubmitting(true);
    try {
      await loginAdmin(username.trim(), password);
      toast.success(t('authenticatedMode'));
      navigate('/admin/dashboard', true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
      {/* Minimal Top Bar */}
      <header className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => navigate('/survey')}
          className="flex items-center gap-2 text-[12px] font-medium text-slate-600 hover:text-[#0B2B5B] dark:text-slate-300 dark:hover:text-cyan-400 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t('backToPublicSurvey')}</span>
        </button>

        <div className="flex items-center gap-2">
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

          <Button type="button" variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Center Auth Card */}
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#0B2B5B] text-white dark:bg-cyan-500 dark:text-slate-950">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                {t('appTitle')} · RBAC
              </div>
              <h1 className="text-[18px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {t('adminLoginTitle')}
              </h1>
            </div>
          </div>

          <p className="mb-4 text-[12px] text-slate-500 dark:text-slate-400">{t('adminLoginSubtitle')}</p>

          {errorMsg && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                {t('usernameOrEmail')}
              </label>
              <Input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
              />
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300">
                {t('passwordLabel')}
              </label>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              <LogIn className="h-3.5 w-3.5" />
              <span>{submitting ? t('signingIn') : t('signInAdminBtn')}</span>
            </Button>
          </form>

          <div className="mt-4 flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 p-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#0B2B5B] dark:text-cyan-400" />
            <span>HttpOnly Session · CSRF Protected · Scrypt + RBAC</span>
          </div>
        </div>
      </main>
    </div>
  );
}
