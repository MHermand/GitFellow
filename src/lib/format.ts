import { DEFAULT_LOCALE, fill, messages, type Locale } from "@/i18n";

export function fmtMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function decimal(value: number, digits: number, locale: Locale): string {
  const text = value.toFixed(digits);
  return locale === "fr" ? text.replace(".", ",") : text;
}

export function fmtHoursDecimal(minutes: number, digits = 2, locale: Locale = DEFAULT_LOCALE): string {
  return decimal(minutes / 60, digits, locale);
}

/** Heures d'objectif : « 70 h », ou « 67,2 h » quand la répartition ne tombe pas juste. */
export function fmtHours(hours: number, locale: Locale = DEFAULT_LOCALE): string {
  const rounded = Math.round(hours * 10) / 10;
  const shown = Number.isInteger(rounded) ? String(rounded) : decimal(rounded, 1, locale);
  return fill(messages(locale).common.hours, { h: shown });
}

export function fmtPercent(ratio: number, locale: Locale = DEFAULT_LOCALE): string {
  return fill(messages(locale).common.percent, { n: Math.round(ratio * 100) });
}

export function fmtDateTime(iso: string | null, tz: string, locale: Locale = DEFAULT_LOCALE): string {
  if (!iso) return messages(locale).common.none;
  const { intl, dateTime } = messages(locale).dates;
  return new Intl.DateTimeFormat(intl, {
    timeZone: tz,
    dateStyle: dateTime.dateStyle as "short" | "medium",
    timeStyle: dateTime.timeStyle as "short",
  }).format(new Date(iso));
}
