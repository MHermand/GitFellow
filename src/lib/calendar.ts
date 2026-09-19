/**
 * Vues agenda de la page Activité : périodes (jour / semaine / mois), découpage des sessions
 * par jour et par heure, superpositions, répartition par dépôt, rythme (jour × heure).
 * Fonctions pures, testées dans calendar.test.ts.
 */
import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, format, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { sessionMinutes, type Session } from "./sessions";
import { dayKey, weekEnd, weekLabel, weekOf, weekStart, type WeekKey } from "./weeks";

export type View = "jour" | "semaine" | "mois";

export function parseView(value: string | null | undefined): View {
  return value === "jour" || value === "mois" ? value : "semaine";
}

/** "2026-09-14" valide, sinon null. */
export function parseDay(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d ? value : null;
}

/** Minuit (dans le fuseau) du jour donné, comme instant. */
export function dayStart(day: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, tz).getTime());
}

export function shiftDay(day: string, days: number, tz: string): string {
  const z = new TZDate(dayStart(day, tz), tz);
  const shifted = addDays(z, days);
  shifted.setHours(12, 0, 0, 0);
  return dayKey(new Date(shifted.getTime()), tz);
}

/** Index du jour de la semaine, lundi = 0 … dimanche = 6. */
export function weekdayIndex(day: string, tz: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new TZDate(y, m - 1, d, tz).getDay() + 6) % 7;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export interface Period {
  view: View;
  anchorDay: string;
  /** Borne de début (incluse) et de fin (exclue), comme instants. */
  start: Date;
  end: Date;
  /** Semaine ISO de référence : celle affichée, ou celle qui contient le jour / la fin du mois. */
  week: WeekKey;
  label: string;
  prevDay: string;
  nextDay: string;
  /** Jours couverts, dans l'ordre. */
  days: string[];
}

export function periodFor(view: View, anchorDay: string, tz: string): Period {
  const anchor = dayStart(anchorDay, tz);
  const zoned = new TZDate(anchor, tz);

  if (view === "jour") {
    const end = new Date(addDays(zoned, 1).getTime());
    return {
      view,
      anchorDay,
      start: anchor,
      end,
      week: weekOf(anchor, tz),
      label: capitalize(format(zoned, "EEEE d MMMM yyyy", { locale: fr })),
      prevDay: shiftDay(anchorDay, -1, tz),
      nextDay: shiftDay(anchorDay, 1, tz),
      days: [anchorDay],
    };
  }

  if (view === "mois") {
    const first = startOfMonth(zoned);
    const next = startOfMonth(addMonths(zoned, 1));
    const start = new Date(first.getTime());
    const end = new Date(next.getTime());
    const lastDay = shiftDay(dayKey(end, tz), -1, tz);
    return {
      view,
      anchorDay,
      start,
      end,
      week: weekOf(dayStart(lastDay, tz), tz),
      label: capitalize(format(zoned, "LLLL yyyy", { locale: fr })),
      prevDay: dayKey(new Date(startOfMonth(addMonths(zoned, -1)).getTime()), tz),
      nextDay: dayKey(end, tz),
      days: listDays(dayKey(start, tz), lastDay, tz),
    };
  }

  const week = weekOf(anchor, tz);
  const start = weekStart(week, tz);
  const end = weekEnd(week, tz);
  const firstDay = dayKey(start, tz);
  return {
    view: "semaine",
    anchorDay,
    start,
    end,
    week,
    label: `Semaine ${week.week} · ${weekLabel(week, tz)}`,
    prevDay: shiftDay(firstDay, -7, tz),
    nextDay: shiftDay(firstDay, 7, tz),
    days: listDays(firstDay, shiftDay(firstDay, 6, tz), tz),
  };
}

export function listDays(from: string, to: string, tz: string): string[] {
  const out: string[] = [];
  let cursor = from;
  for (let guard = 0; guard < 62 && cursor <= to; guard += 1) {
    out.push(cursor);
    cursor = shiftDay(cursor, 1, tz);
  }
  return out;
}

/** Semaines à afficher sur la grille du mois : de la semaine du 1er à celle du dernier jour. */
export function monthWeeks(anchorDay: string, tz: string): { week: WeekKey; days: string[] }[] {
  const period = periodFor("mois", anchorDay, tz);
  const firstWeekStart = dayKey(weekStart(weekOf(period.start, tz), tz), tz);
  const lastDay = period.days[period.days.length - 1];
  const out: { week: WeekKey; days: string[] }[] = [];
  let monday = firstWeekStart;
  for (let guard = 0; guard < 6 && monday <= lastDay; guard += 1) {
    const days = listDays(monday, shiftDay(monday, 6, tz), tz);
    out.push({ week: weekOf(dayStart(monday, tz), tz), days });
    monday = shiftDay(monday, 7, tz);
  }
  return out;
}

export interface DaySegment {
  day: string;
  /** Minutes depuis minuit (heure locale du fuseau). */
  startMin: number;
  endMin: number;
  first: boolean;
  last: boolean;
  session: Session;
}

function wallMinutes(date: Date, tz: string): number {
  const z = new TZDate(date, tz);
  return z.getHours() * 60 + z.getMinutes();
}

/** Découpe une session en segments par jour (une session 22:30 → 01:09 donne deux segments). */
export function splitByDay(session: Session, tz: string): DaySegment[] {
  const out: DaySegment[] = [];
  let cursor = session.start;
  for (let guard = 0; guard < 8 && cursor.getTime() < session.end.getTime(); guard += 1) {
    const day = dayKey(cursor, tz);
    const nextMidnight = dayStart(shiftDay(day, 1, tz), tz);
    const segmentEnd = session.end.getTime() < nextMidnight.getTime() ? session.end : nextMidnight;
    const endMin = segmentEnd.getTime() === nextMidnight.getTime() ? 24 * 60 : wallMinutes(segmentEnd, tz);
    out.push({
      day,
      startMin: wallMinutes(cursor, tz),
      endMin,
      first: cursor.getTime() === session.start.getTime(),
      last: segmentEnd.getTime() === session.end.getTime(),
      session,
    });
    cursor = segmentEnd;
  }
  return out;
}

/** Attribue une « voie » aux segments qui se chevauchent (0 = premier, 1 = décalé, …). */
export function withLanes<T extends { startMin: number; endMin: number }>(segments: T[]): (T & { lane: number })[] {
  const sorted = [...segments].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  let active: { endMin: number }[] = [];
  return sorted.map((seg) => {
    active = active.filter((a) => a.endMin > seg.startMin);
    const lane = Math.min(active.length, 3);
    active.push(seg);
    return { ...seg, lane };
  });
}

export interface RepoShare {
  repo: string;
  minutes: number;
  commits: number;
}

/** Temps par dépôt : chaque session est répartie au prorata de ses commits par dépôt. */
export function repoBreakdown(sessions: Session[]): RepoShare[] {
  const map = new Map<string, RepoShare>();
  for (const session of sessions) {
    const total = sessionMinutes(session);
    const counts = new Map<string, number>();
    for (const event of session.events) counts.set(event.repo, (counts.get(event.repo) ?? 0) + 1);
    for (const [repo, count] of counts) {
      const entry = map.get(repo) ?? { repo, minutes: 0, commits: 0 };
      entry.minutes += (total * count) / session.events.length;
      entry.commits += count;
      map.set(repo, entry);
    }
  }
  return [...map.values()]
    .map((r) => ({ ...r, minutes: Math.round(r.minutes) }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Jours ouvrés (lundi → vendredi) parmi `days`. */
export function workingDays(days: string[], tz: string): number {
  return days.filter((day) => weekdayIndex(day, tz) < 5).length;
}

/**
 * Jours ouvrés (lundi → vendredi) parmi `days`, arrêtés au jour en cours : une période à venir
 * n'en compte aucun, une période passée les compte tous.
 */
export function elapsedWorkingDays(days: string[], today: string, tz: string): number {
  if (days.length === 0) return 0;
  const last = days[days.length - 1];
  const until = today < days[0] ? "" : today <= last ? today : last;
  return days.filter((day) => day <= until && weekdayIndex(day, tz) < 5).length;
}

export interface RhythmCell {
  minutes: number;
  sessions: number;
  commits: number;
}

/**
 * Occupation par jour de la semaine (lundi = 0) × heure, limitée aux jours donnés.
 * Une session compte dans chaque case qu'elle touche, un commit dans la case de son horodatage.
 */
export function rhythmCells(
  sessions: Session[],
  tz: string,
  days?: ReadonlySet<string>,
): { cells: RhythmCell[][]; max: number } {
  const cells: RhythmCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ minutes: 0, sessions: 0, commits: 0 })),
  );
  for (const session of sessions) {
    for (const seg of splitByDay(session, tz)) {
      if (days && !days.has(seg.day)) continue;
      const row = weekdayIndex(seg.day, tz);
      for (let h = Math.floor(seg.startMin / 60); h < Math.min(24, Math.ceil(seg.endMin / 60)); h += 1) {
        const overlap = Math.min(seg.endMin, (h + 1) * 60) - Math.max(seg.startMin, h * 60);
        if (overlap <= 0) continue;
        cells[row][h].minutes += overlap;
        cells[row][h].sessions += 1;
      }
    }
    for (const event of session.events) {
      const day = dayKey(event.at, tz);
      if (days && !days.has(day)) continue;
      cells[weekdayIndex(day, tz)][Math.floor(wallMinutes(event.at, tz) / 60)].commits += 1;
    }
  }
  const max = Math.max(0, ...cells.flat().map((c) => c.minutes));
  return { cells, max };
}

/** Niveau 0-5 pour la rampe de couleur. */
export function heatLevel(minutes: number, max: number): number {
  if (max <= 0 || minutes <= 0) return 0;
  return Math.min(5, 1 + Math.floor((minutes / max) * 4.999));
}

export function fmtClock(minutes: number): string {
  const m = Math.round(minutes) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
