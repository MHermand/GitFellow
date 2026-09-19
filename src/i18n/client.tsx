"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeI18n, type I18n, type Locale } from "./index";

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => makeI18n(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n() hors de <I18nProvider>");
  return value;
}
