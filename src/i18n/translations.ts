import vi from './vi.json';
import en from './en.json';
import ko from './ko.json';
import zh from './zh.json';
import { LanguageCode } from '../types/survey';

export const LANGUAGES: { code: LanguageCode; label: string; nativeName: string }[] = [
  { code: 'vi', label: 'VI', nativeName: 'Tiếng Việt' },
  { code: 'en', label: 'EN', nativeName: 'English' },
  { code: 'ko', label: 'KO', nativeName: '한국어' },
  { code: 'zh', label: 'ZH', nativeName: '中文' },
];

type TranslationDict = Record<string, string>;

export const TRANSLATIONS: Record<LanguageCode, TranslationDict> = {
  vi,
  en,
  ko,
  zh,
};

export function getT(lang: LanguageCode) {
  const dict = TRANSLATIONS[lang] || vi;
  return (key: string): string => dict[key] ?? vi[key as keyof typeof vi] ?? key;
}
