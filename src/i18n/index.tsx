'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { messages as enMessages } from "./messages/en";
import { messages as frMessages } from "./messages/fr";

export type Locale = "en" | "fr";
export type Messages = typeof enMessages;

const DEFAULT_LOCALE: Locale = "en";
const LOCALE_STORAGE_KEY = "nexus-locale";

type I18nContextValue = {
  locale: Locale;
  messages: Messages;
  t: (key: keyof Messages, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const getStoredLocale = (): Locale | null => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === "en" || stored === "fr") return stored;
  return null;
};

const getQueryLocale = (): Locale | null => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const fromLang = params.get("lang");
  const fromLocale = params.get("locale");
  const candidate = (fromLang || fromLocale || "").toLowerCase();
  if (candidate === "en" || candidate === "fr") return candidate as Locale;
  return null;
};

const getNavigatorLocale = (): Locale => {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  return navigator.language.toLowerCase().startsWith("en") ? "en" : "fr";
};

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || DEFAULT_LOCALE);

  useEffect(() => {
    const fromQuery = getQueryLocale();
    const stored = getStoredLocale();
    const resolved = fromQuery || stored || getNavigatorLocale() || DEFAULT_LOCALE;
    setLocaleState(resolved);
    if (fromQuery && typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, fromQuery);
    }
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    }
  }, []);

  const messages = locale === "en" ? enMessages : frMessages;

  const t = useCallback(
    (key: keyof Messages, params?: Record<string, string | number>) => {
      const template = messages[key] ?? enMessages[key] ?? String(key);
      if (!params) return template;
      return Object.keys(params).reduce(
        (result, paramKey) =>
          result.split(`{${paramKey}}`).join(String(params[paramKey])),
        template
      );
    },
    [messages]
  );

  const value = useMemo(
    () => ({ locale, messages, t, setLocale }),
    [locale, messages, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export const I18N_DEFAULT_LOCALE = DEFAULT_LOCALE;
export const I18N_STORAGE_KEY = LOCALE_STORAGE_KEY;
