import React, { createContext, useContext, useEffect, useState } from 'react';
import { ar, type TranslationDictionary } from './ar';
import { fr } from './fr';
import { MOROCCAN_CITIES } from '../lib/supabase';

export type Language = 'ar' | 'fr';

interface LanguageContextValue {
  lang: Language;
  dir: 'rtl' | 'ltr';
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
  formatPrice: (amount: number, decimals?: number) => string;
  getCityLabel: (cityValue: string) => string;
}

const LANG_STORAGE_KEY = 'karya_lang_v1';

const DICTIONARIES: Record<Language, TranslationDictionary> = {
  ar,
  fr,
};

function resolvePath(obj: unknown, path: string): string | null {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return typeof current === 'string' ? current : null;
}

function getInitialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'fr' || saved === 'ar') return saved;
  } catch {
    // Ignore storage errors
  }
  return 'ar';
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(getInitialLanguage);
  const dir: 'rtl' | 'ltr' = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.body.dir = dir;
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors
    }
  }, [lang, dir]);

  const setLang = (next: Language) => {
    setLangState(next);
  };

  const toggleLang = () => {
    setLangState((prev) => (prev === 'ar' ? 'fr' : 'ar'));
  };

  const t = (path: string, vars?: Record<string, string | number>): string => {
    const template =
      resolvePath(DICTIONARIES[lang], path) ?? resolvePath(DICTIONARIES.ar, path) ?? path;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, key) =>
      vars[key] !== undefined ? String(vars[key]) : `{${key}}`,
    );
  };

  const formatPrice = (amount: number, decimals = 2): string => {
    const numStr = decimals === 0 ? String(Math.round(amount)) : amount.toFixed(decimals);
    return lang === 'ar' ? `${numStr} درهم` : `${numStr} MAD`;
  };

  const getCityLabel = (cityValue: string): string => {
    const found = MOROCCAN_CITIES.find(
      (c) =>
        c.nameFr.toLowerCase() === cityValue.toLowerCase() ||
        c.slug.toLowerCase() === cityValue.toLowerCase() ||
        c.nameAr === cityValue,
    );
    if (!found) return cityValue;
    return lang === 'ar' ? found.nameAr : found.nameFr;
  };

  return (
    <LanguageContext.Provider
      value={{
        lang,
        dir,
        setLang,
        toggleLang,
        t,
        formatPrice,
        getCityLabel,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
