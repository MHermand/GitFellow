/**
 * Modèles de vue de la page Activité : à partir des rapports (sessions par contributeur),
 * construit ce que les grilles et les cartes affichent. Pur, sans accès aux données.
 *
 * Toutes les cartes (période, dépôts, rythme, tendance) portent sur les personnes sélectionnées
 * dans la barre de filtres ; le rythme porte en plus sur la période affichée.
 */
import { count, fill, messages, type Locale } from "@/i18n";
import { activityHref, type ActivityParams } from "./activity";
import {
  fmtClock,
  elapsedWorkingDays,
  monthWeeks,
  periodFor,
  repoBreakdown,
  rhythmCells,
  splitByDay,
  weekdayIndex,
  withLanes,
  type Period,
} from "./calendar";
import { fmtHours, fmtMinutes, fmtPercent } from "./format";
import { DATA_HUE, shadesFor, swatch, type Swatch } from "./palette";
import { sessionsByDay, sessionsInWeek, type ContributorReport, type ContributorRow } from "./report";
import { rawMinutes, sessionMinutes, type Session } from "./sessions";
import { dailyTargetHours, WORKING_DAYS_PER_WEEK } from "./target";
import { dayKey, dayLabel, fmtInTz, sameWeek, weekShortLabel, weekStart, type WeekKey } from "./weeks";

export interface BlockView {
  key: string;
  day: string;
  startMin: number;
  endMin: number;
  lane: number;
  swatch: Swatch;
  time: string;
  primary: string;
  secondary: string;
  commits: number;
  href: string;
  title: string;
  lines?: { time: string; repo: string; message: string }[];
}

export interface DayColumn {
  id: string;
  name: string;
  swatch: Swatch;
  minutes: number;
  sessions: number;
  commits: number;
  blocks: BlockView[];
}

export interface MonthChip {
  id: string;
  name: string;
  swatch: Swatch;
  minutes: number;
  href: string;
}

export interface MonthWeekRow {
  week: WeekKey;
  inProgress: boolean;
  days: { day: string; inMonth: boolean; isToday: boolean; chips: MonthChip[] }[];
}

/** Ligne d'un panneau de survol : libellé à gauche, valeur puis part, chacune dans sa colonne. */
export interface TipRow {
  label: string;
  value: string;
  share?: string;
}

export interface PersonDetail {
  id: string;
  name: string;
  dot: string;
  minutes: number;
  shown: string;
  /** Largeur du segment dans la jauge groupée, de 0 à 1. */
  share: number;
  rows: TipRow[];
}

/** Carte « Ce jour / Cette semaine / <Mois> » : une seule jauge pour toutes les personnes. */
export interface PeriodSummary {
  minutes: number;
  shown: string;
  suffix: string;
  people: PersonDetail[];
}

export interface RepoStat {
  repo: string;
  dot: string;
  minutes: number;
  shown: string;
  commits: number;
  /** Part du temps total de la période, de 0 à 1. */
  share: number;
  rows: TipRow[];
}

export interface RhythmCellView {
  /** Niveau 0-5 dans la rampe de couleur. */
  level: number;
  shown: string;
  sessions: number;
  commits: number;
}

export interface RhythmRow {
  letter: string;
  title: string;
  cells: RhythmCellView[];
}

export interface RhythmView {
  rows: RhythmRow[];
}

/** Une barre de la carte Tendance : une semaine (vue Mois) ou un jour (vues Jour et Semaine). */
export interface TrendPoint {
  label: string;
  title: string;
  minutes: number;
  shown: string;
  /** Barre de la période affichée : c'est elle qui porte la valeur en clair. */
  current: boolean;
  rows: TipRow[];
}

export interface ChipItem {
  id: string;
  label: string;
  swatch: Swatch | null;
}

export interface ActivityView {
  people: ChipItem[];
  repos: ChipItem[];
  blocksByDay: Record<string, BlockView[]>;
  dayColumns: DayColumn[];
  monthRows: MonthWeekRow[];
  periodTitle: string;
  summary: PeriodSummary;
  repoStats: RepoStat[];
  rhythm: RhythmView | null;
  trend: TrendPoint[];
  trendThreshold: number;
  /** Teinte commune aux jauges, répartitions, rythme et tendance de la page. */
  hue: string;
}

export interface ActivityViewInput {
  params: ActivityParams;
  period: Period;
  reports: ContributorReport[];
  /** Contributeurs actifs, dans l'ordre d'affichage (fixe les couleurs). */
  contributors: ContributorRow[];
  /** Dépôts actifs, "owner/name", dans l'ordre d'affichage (fixe les couleurs). */
  repoLabels: string[];
  tz: string;
  today: string;
  thisWeek: WeekKey;
  trendWeeks: WeekKey[];
  locale: Locale;
}

const shortRepo = (label: string) => label.split("/")[1] ?? label;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function inRange(sessions: Session[], start: Date, end: Date): Session[] {
  return sessions.filter((s) => s.start.getTime() >= start.getTime() && s.start.getTime() < end.getTime());
}

/** Part d'une valeur dans son total, quand ce total a un sens. */
function shareOf(part: number, whole: number | null | undefined, locale: Locale): string | undefined {
  return whole && whole > 0 ? fmtPercent(part / whole, locale) : undefined;
}

/** Fiche d'un contributeur, ouverte sur la période affichée, filtres conservés. */
function detailHref(contributorId: string, params: ActivityParams, day: string, today: string): string {
  return activityHref(params, { day }, today, `/contributors/${contributorId}`);
}

function totals(sessions: Session[], tz: string) {
  return {
    minutes: sessions.reduce((sum, s) => sum + sessionMinutes(s), 0),
    sessions: sessions.length,
    commits: sessions.reduce((sum, s) => sum + s.events.length, 0),
    days: new Set(sessions.map((s) => dayKey(s.start, tz))),
  };
}

/** Puces des menus de filtres : une teinte par personne, les dépôts en clair. */
export function filterChips(contributors: ContributorRow[], repoLabels: string[]): { people: ChipItem[]; repos: ChipItem[] } {
  return {
    people: contributors.map((c, i) => ({ id: c.id, label: c.displayName, swatch: swatch(i) })),
    repos: repoLabels.map((label) => ({ id: label, label: shortRepo(label), swatch: null })),
  };
}

export function buildActivityView(input: ActivityViewInput): ActivityView {
  const { params, period, reports, contributors, repoLabels, tz, today, thisWeek, trendWeeks, locale } = input;
  const m = messages(locale);
  const partOf = (part: number, whole: number | null | undefined) => shareOf(part, whole, locale);
  const personIndex = new Map(contributors.map((c, i) => [c.id, i]));
  const personSwatch = (id: string) => swatch(personIndex.get(id) ?? 0);

  // Une seule lecture des couleurs dans le calendrier : une teinte par personne.
  const { people, repos } = filterChips(contributors, repoLabels);

  const selected = reports.filter((r) => params.people === null || params.people.includes(r.contributor.id));
  const periodSessions = new Map(selected.map((r) => [r.contributor.id, inRange(r.sessions, period.start, period.end)]));
  // Teinte de la page : celle de la personne quand elle est seule à l'écran — sélectionnée et
  // présente sur la période —, la teinte de données sinon. Jauges, répartitions, rythme,
  // tendance et repères du calendrier en découlent ; le bleu de marque reste à l'interface.
  const onScreen = selected.filter((r) => (periodSessions.get(r.contributor.id) ?? []).length > 0);
  const hue = onScreen.length === 1 ? personSwatch(onScreen[0].contributor.id).dot : DATA_HUE;
  const periodDays = new Set(period.days);

  // ---- Blocs (vues Jour et Semaine)
  const rawBlocks: (Omit<BlockView, "lane"> & { contributorId: string })[] = [];
  for (const r of selected) {
    const c = r.contributor;
    for (const session of r.sessions) {
      const segments = splitByDay(session, tz).filter((seg) => periodDays.has(seg.day));
      if (segments.length === 0) continue;
      const repoNames = [...new Set(session.events.map((e) => shortRepo(e.repo)))].join(", ");
      const sw = personSwatch(c.id);
      for (const seg of segments) {
        rawBlocks.push({
          key: `${c.id}-${session.start.toISOString()}-${seg.day}`,
          contributorId: c.id,
          day: seg.day,
          startMin: seg.startMin,
          endMin: seg.endMin,
          swatch: sw,
          time: `${seg.first ? fmtClock(seg.startMin) : "…"}–${seg.last ? fmtClock(seg.endMin) : "…"}`,
          primary: c.displayName,
          secondary: repoNames,
          commits: session.events.length,
          href: detailHref(c.id, params, dayKey(session.start, tz), today),
          title: fill(m.activity.blockTitle, {
            name: c.displayName,
            day: dayLabel(seg.day, tz, locale),
            start: fmtInTz(session.start, tz, "HH:mm"),
            end: fmtInTz(session.end, tz, "HH:mm"),
            conventional: fmtMinutes(sessionMinutes(session)),
            raw: fmtMinutes(rawMinutes(session)),
            commits: count(locale, m.common.commits, session.events.length),
            repos: repoNames,
          }),
          lines: session.events.map((e) => ({ time: fmtInTz(e.at, tz, "HH:mm"), repo: shortRepo(e.repo), message: e.message || e.sha.slice(0, 7) })),
        });
      }
    }
  }

  const blocksByDay: Record<string, BlockView[]> = {};
  for (const day of period.days) {
    const segs = rawBlocks.filter((b) => b.day === day);
    blocksByDay[day] = withLanes(segs).map(({ contributorId: _ignored, ...rest }) => rest);
  }

  // ---- Vue Jour : une colonne par personne
  const dayColumns: DayColumn[] = selected.map((r) => {
    const sessions = periodSessions.get(r.contributor.id) ?? [];
    const blocks = withLanes(rawBlocks.filter((b) => b.contributorId === r.contributor.id)).map(({ contributorId: _ignored, ...rest }) => rest);
    return {
      id: r.contributor.id,
      name: r.contributor.displayName,
      swatch: personSwatch(r.contributor.id),
      minutes: sessions.reduce((sum, s) => sum + sessionMinutes(s), 0),
      sessions: sessions.length,
      commits: sessions.reduce((sum, s) => sum + s.events.length, 0),
      blocks,
    };
  });

  // ---- Vue Mois
  const monthRows: MonthWeekRow[] = params.view === "mois" ? monthWeeks(params.day, tz).map((row) => ({
    week: row.week,
    inProgress: sameWeek(row.week, thisWeek),
    days: row.days.map((day) => ({
      day,
      inMonth: periodDays.has(day),
      isToday: day === today,
      chips: selected.flatMap((r) => {
        const minutes = sessionsByDay(r.sessions, tz).find((d) => d.day === day)?.minutes ?? 0;
        if (minutes <= 0) return [];
        return [{ id: r.contributor.id, name: r.contributor.displayName, swatch: personSwatch(r.contributor.id), minutes, href: detailHref(r.contributor.id, params, day, today) }];
      }),
    })),
  })) : [];

  // ---- Carte de période : une jauge pour l'ensemble des personnes sélectionnées
  const allPeriodSessions = [...periodSessions.values()].flat();
  const group = totals(allPeriodSessions, tz);
  // Objectifs ramenés en heures par jour ouvré : chacun peut être fixé par jour, par semaine ou par mois.
  const dailyTarget = selected.reduce((sum, r) => sum + dailyTargetHours(r.contributor.target, period.anchorDay, tz), 0);
  const weekTarget = dailyTarget * WORKING_DAYS_PER_WEEK;

  let suffix = "";
  /** Minutes valant 100 % de la jauge ; 0 = barre de composition (pas de seuil). */
  let fillBase = 0;
  // Objectif du mois : l'objectif quotidien cumulé sur les jours ouvrés, arrêté au jour en
  // cours tant que le mois n'est pas terminé.
  const periodWorkingDays = elapsedWorkingDays(period.days, today, tz);
  if (params.view === "mois") {
    const periodTarget = dailyTarget * periodWorkingDays;
    suffix = periodTarget > 0 ? fill(m.activity.target, { hours: fmtHours(periodTarget, locale) }) : m.activity.noTarget;
    fillBase = periodTarget * 60;
  } else if (params.view === "semaine") {
    suffix = weekTarget > 0 ? fill(m.activity.target, { hours: fmtHours(weekTarget, locale) }) : m.activity.noTarget;
    fillBase = weekTarget * 60;
  }
  const fillRatio = fillBase > 0 ? Math.min(1, group.minutes / fillBase) : group.minutes > 0 ? 1 : 0;

  const ownTotals = new Map(selected.map((r) => [r.contributor.id, totals(periodSessions.get(r.contributor.id) ?? [], tz)]));
  // Les parts n'ont de sens qu'à plusieurs : seules, elles vaudraient toujours 100 %.
  const several = [...ownTotals.values()].filter((t) => t.minutes > 0).length > 1;
  const personDetails: PersonDetail[] = selected.map((r) => {
    const c = r.contributor;
    const own = ownTotals.get(c.id)!;
    const part = (whole: number) => (several ? whole : null);
    // Mêmes indicateurs, dans le même ordre, d'une vue à l'autre.
    const rows: TipRow[] = [
      { label: m.activity.tip.time, value: fmtMinutes(own.minutes), share: partOf(own.minutes, part(group.minutes)) },
      { label: m.activity.tip.commits, value: String(own.commits), share: partOf(own.commits, part(group.commits)) },
      { label: m.activity.tip.sessions, value: String(own.sessions), share: partOf(own.sessions, part(group.sessions)) },
    ];
    if (params.view !== "jour") {
      rows.push({ label: m.activity.tip.activeDays, value: String(own.days.size), share: partOf(own.days.size, part(periodWorkingDays)) });
    }
    return {
      id: c.id,
      name: c.displayName,
      dot: personSwatch(c.id).dot,
      minutes: own.minutes,
      shown: fmtMinutes(own.minutes),
      share: group.minutes > 0 ? (fillRatio * own.minutes) / group.minutes : 0,
      rows,
    };
  });

  const summary: PeriodSummary = {
    minutes: group.minutes,
    shown: fmtMinutes(group.minutes),
    suffix,
    people: personDetails,
  };

  const periodTitle = params.view === "jour" ? m.activity.thisDay : params.view === "mois" ? period.label : m.activity.thisWeek;

  // ---- Par dépôt (au prorata des commits de chaque session)
  const totalShares = repoBreakdown(allPeriodSessions);
  const grand = totalShares.reduce((sum, s) => sum + s.minutes, 0);
  const grandCommits = totalShares.reduce((sum, s) => sum + s.commits, 0);
  const severalRepos = totalShares.length > 1;
  // Une répartition d'une même mesure : des paliers d'une seule teinte, du plus gros au plus petit.
  const repoShades = shadesFor(hue, totalShares.length);
  const repoStats: RepoStat[] = totalShares.map((s, index) => {
    const share = grand > 0 ? s.minutes / grand : 0;
    return {
      repo: shortRepo(s.repo),
      dot: repoShades[index],
      minutes: s.minutes,
      shown: fmtMinutes(s.minutes),
      commits: s.commits,
      share,
      rows: [
        { label: m.activity.tip.time, value: fmtMinutes(s.minutes), share: partOf(s.minutes, severalRepos ? grand : null) },
        { label: m.activity.tip.commits, value: String(s.commits), share: partOf(s.commits, severalRepos ? grandCommits : null) },
      ],
    };
  });

  // ---- Rythme : jour de la semaine × heure, sur la période affichée
  let rhythmView: RhythmView | null = null;
  if (selected.length > 0) {
    const { cells, max } = rhythmCells(selected.flatMap((r) => r.sessions), tz, periodDays);
    const anchorRow = params.view === "jour" ? weekdayIndex(params.day, tz) : -1;
    // La matrice garde les sept lignes quelle que soit la période : seule la donnée change.
    const rowTitle = (index: number) => {
      if (params.view === "mois") return fill(m.activity.weekdaysOfMonth, { weekday: m.dates.weekdays[index] });
      if (params.view === "semaine") return capitalize(dayLabel(period.days[index], tz, locale));
      return index === anchorRow ? capitalize(dayLabel(params.day, tz, locale)) : m.dates.weekdays[index];
    };
    rhythmView = {
      rows: [0, 1, 2, 3, 4, 5, 6].map((index) => ({
        letter: m.dates.weekdayLetters[index],
        title: rowTitle(index),
        cells: cells[index].map((cell) => ({
          level: max > 0 && cell.minutes > 0 ? Math.min(5, 1 + Math.floor((cell.minutes / max) * 4.999)) : 0,
          shown: cell.minutes > 0 ? fmtMinutes(cell.minutes) : "",
          sessions: cell.sessions,
          commits: cell.commits,
        })),
      })),
    };
  }

  // ---- Tendance : semaines en vue Mois, jours de la semaine concernée sinon
  interface TrendSource {
    label: string;
    title: string;
    current: boolean;
    sessions: Session[];
    /** Jours couverts par la barre, pour rapporter les jours actifs aux jours ouvrés. */
    days: string[];
  }

  let sources: TrendSource[] = [];
  if (selected.length > 0 && params.view === "mois") {
    sources = trendWeeks.map((w, i) => ({
      label: fill(m.dates.weekShort, { n: String(w.week).padStart(2, "0") }),
      title: `${fill(m.dates.week, { n: w.week })} · ${weekShortLabel(w, tz, locale)}`,
      current: i === trendWeeks.length - 1,
      sessions: selected.flatMap((r) => sessionsInWeek(r.sessions, w, tz)),
      days: periodFor("semaine", dayKey(weekStart(w, tz), tz), tz, locale).days,
    }));
  } else if (selected.length > 0) {
    // Les sept jours de la semaine affichée (ou de celle du jour affiché).
    const weekDays = params.view === "semaine" ? period.days : periodFor("semaine", params.day, tz, locale).days;
    const byDay = new Map<string, Session[]>();
    for (const r of selected) {
      for (const session of sessionsInWeek(r.sessions, period.week, tz)) {
        const day = dayKey(session.start, tz);
        byDay.set(day, [...(byDay.get(day) ?? []), session]);
      }
    }
    sources = weekDays.map((day) => ({
      label: `${m.dates.weekdayLetters[weekdayIndex(day, tz)]} ${Number(day.split("-")[2])}`,
      title: capitalize(dayLabel(day, tz, locale)),
      current: params.view === "jour" ? day === params.day : day === today,
      sessions: byDay.get(day) ?? [],
      days: [day],
    }));
  }

  const bars = sources.map((source) => ({ source, stat: totals(source.sessions, tz) }));
  const barTotals = bars.reduce(
    (acc, b) => ({ minutes: acc.minutes + b.stat.minutes, commits: acc.commits + b.stat.commits, sessions: acc.sessions + b.stat.sessions }),
    { minutes: 0, commits: 0, sessions: 0 },
  );
  const trend: TrendPoint[] = bars.map(({ source, stat }) => ({
    label: source.label,
    title: source.title,
    minutes: stat.minutes,
    shown: fmtMinutes(stat.minutes),
    current: source.current,
    rows: [
      { label: m.activity.tip.time, value: fmtMinutes(stat.minutes), share: partOf(stat.minutes, barTotals.minutes) },
      { label: m.activity.tip.commits, value: String(stat.commits), share: partOf(stat.commits, barTotals.commits) },
      { label: m.activity.tip.sessions, value: String(stat.sessions), share: partOf(stat.sessions, barTotals.sessions) },
      { label: m.activity.tip.activeDays, value: String(stat.days.size), share: partOf(stat.days.size, elapsedWorkingDays(source.days, today, tz)) },
    ],
  }));

  return {
    people,
    repos,
    blocksByDay,
    dayColumns,
    monthRows,
    periodTitle,
    summary,
    repoStats,
    rhythm: rhythmView,
    trend,
    trendThreshold: params.view === "mois" ? weekTarget : 0,
    hue,
  };
}
