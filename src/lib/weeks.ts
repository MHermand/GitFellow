/**
 * Semaines ISO et jours calendaires dans un fuseau donné (Europe/Paris par défaut).
 * Tous les instants manipulés sont des `Date` UTC ; le fuseau ne sert qu'au découpage.
 */
import { TZDate } from "@date-fns/tz";
import { addWeeks, format, getISOWeek, getISOWeekYear, startOfISOWeek } from "date-fns";
import { DEFAULT_LOCALE, messages, type Locale } from "@/i18n";
import { dateFnsLocale } from "./locale-dates";

export interface WeekKey {
  year: number;
  week: number;
}

export const DEFAULT_TIMEZONE = "Europe/Paris";

export function weekOf(date: Date, tz: string): WeekKey {
  const zoned = new TZDate(date, tz);
  return { year: getISOWeekYear(zoned), week: getISOWeek(zoned) };
}

export function weekId(key: WeekKey): string {
  return `${key.year}-W${String(key.week).padStart(2, "0")}`;
}

export function parseWeekId(value: string | null | undefined): WeekKey | null {
  if (!value) return null;
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return null;
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  return { year: Number(match[1]), week };
}

export function compareWeeks(a: WeekKey, b: WeekKey): number {
  return a.year - b.year || a.week - b.week;
}

export function sameWeek(a: WeekKey, b: WeekKey): boolean {
  return compareWeeks(a, b) === 0;
}

/** Lundi 00:00 (dans le fuseau) de la semaine ISO demandée. */
export function weekStart(key: WeekKey, tz: string): Date {
  // Le 4 janvier est toujours dans la semaine ISO n°1.
  const jan4 = new TZDate(key.year, 0, 4, tz);
  const monday = addWeeks(startOfISOWeek(jan4), key.week - 1);
  return new Date(monday.getTime());
}

/** Lundi 00:00 de la semaine suivante (borne exclusive). */
export function weekEnd(key: WeekKey, tz: string): Date {
  return new Date(addWeeks(new TZDate(weekStart(key, tz), tz), 1).getTime());
}

export function addWeeksToKey(key: WeekKey, n: number, tz: string): WeekKey {
  const start = new TZDate(weekStart(key, tz), tz);
  // Milieu de journée pour rester insensible aux changements d'heure.
  const shifted = addWeeks(start, n);
  shifted.setHours(12, 0, 0, 0);
  return weekOf(new Date(shifted.getTime()), tz);
}

export function currentWeek(tz: string, now: Date = new Date()): WeekKey {
  return weekOf(now, tz);
}

/** `count` semaines consécutives se terminant par `until`, de la plus ancienne à la plus récente. */
export function weeksRange(until: WeekKey, count: number, tz: string): WeekKey[] {
  const keys: WeekKey[] = [];
  for (let i = count - 1; i >= 0; i -= 1) keys.push(addWeeksToKey(until, -i, tz));
  return keys;
}

/** "2026-09-14" dans le fuseau. */
export function dayKey(date: Date, tz: string): string {
  return format(new TZDate(date, tz), "yyyy-MM-dd");
}

export function fmtInTz(date: Date, tz: string, pattern: string, locale: Locale = DEFAULT_LOCALE): string {
  return format(new TZDate(date, tz), pattern, { locale: dateFnsLocale(locale) });
}

/** "14 → 20 sept. 2026" · "Sep 14 → 20, 2026" */
export function weekLabel(key: WeekKey, tz: string, locale: Locale = DEFAULT_LOCALE): string {
  const { dates } = messages(locale);
  const start = new TZDate(weekStart(key, tz), tz);
  const end = new TZDate(weekEnd(key, tz).getTime() - 1, tz);
  return `${fmtInTz(start, tz, dates.rangeStart, locale)} → ${fmtInTz(end, tz, dates.rangeEnd, locale)}`;
}

/** "24–30 août" ou "27 juil.–2 août" */
export function weekShortLabel(key: WeekKey, tz: string, locale: Locale = DEFAULT_LOCALE): string {
  const { dates } = messages(locale);
  const start = new TZDate(weekStart(key, tz), tz);
  const end = new TZDate(weekEnd(key, tz).getTime() - 1, tz);
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${fmtInTz(start, tz, dates.rangeStartShort, locale)}–${fmtInTz(end, tz, dates.rangeEndShort, locale)}`
    : `${fmtInTz(start, tz, dates.rangeStart, locale)}–${fmtInTz(end, tz, dates.rangeStart, locale)}`;
}

/** "lundi 14 septembre" · "Monday, September 14" */
export function dayLabel(day: string, tz: string, locale: Locale = DEFAULT_LOCALE): string {
  const [y, m, d] = day.split("-").map(Number);
  return format(new TZDate(y, m - 1, d, tz), messages(locale).dates.dayShort, { locale: dateFnsLocale(locale) });
}
