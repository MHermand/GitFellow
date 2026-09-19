/**
 * Langues de l'application : français et anglais, un dictionnaire chacun.
 * La langue vient du réglage enregistré, à défaut du navigateur (Accept-Language).
 */
import { en, type Messages } from "./en";
import { fr } from "./fr";

export type { Messages };
export type Locale = "fr" | "en";

export const LOCALES: readonly Locale[] = ["fr", "en"];
export const DEFAULT_LOCALE: Locale = "en";

const DICTIONARIES: Record<Locale, Messages> = { fr, en };

export function messages(locale: Locale): Messages {
  return DICTIONARIES[locale];
}

export function parseLocale(value: unknown): Locale | null {
  return value === "fr" || value === "en" ? value : null;
}

/** Langue du navigateur : le premier « fr » de la liste l'emporte, sinon l'anglais. */
export function detectLocale(acceptLanguage: string | null | undefined): Locale {
  const tags = (acceptLanguage ?? "")
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase())
    .filter(Boolean);
  for (const tag of tags) {
    if (tag === "fr" || tag.startsWith("fr-")) return "fr";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return DEFAULT_LOCALE;
}

/** Remplace les `{name}` d'un gabarit. */
export function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

export interface PluralForms {
  one: string;
  other: string;
}

/** « 1 commit », « 2 commits » — selon les règles de pluriel de la langue (en français, 0 est singulier). */
export function count(locale: Locale, forms: PluralForms, n: number, extra: Record<string, string | number> = {}): string {
  const rule = new Intl.PluralRules(locale).select(n);
  return fill(rule === "one" ? forms.one : forms.other, { n, ...extra });
}

export interface I18n {
  locale: Locale;
  m: Messages;
  /** `t(m.x.y, { n: 3 })` remplit un gabarit ; `n(m.common.commits, 3)` accorde un pluriel. */
  t: (template: string, params?: Record<string, string | number>) => string;
  n: (forms: PluralForms, value: number, extra?: Record<string, string | number>) => string;
}

/** Dictionnaire et aides d'une langue — partagé par le serveur (getI18n) et le client (useI18n). */
export function makeI18n(locale: Locale): I18n {
  return {
    locale,
    m: messages(locale),
    t: (template, params = {}) => fill(template, params),
    n: (forms, value, extra = {}) => count(locale, forms, value, extra),
  };
}
