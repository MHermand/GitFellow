/**
 * Construit le rapport : commits → contributeurs → sessions → statistiques hebdomadaires.
 */
import { resolveContributor, type ContributorIdentity } from "./attribution";
import {
  computeSessions,
  rawMinutes,
  sessionMinutes,
  type ActivityEvent,
  type Session,
  type SessionParams,
} from "./sessions";
import type { Target } from "./target";
import { dayKey, sameWeek, weekOf, type WeekKey } from "./weeks";

export interface CommitRow {
  repoId: string;
  /** "owner/name" */
  repo: string;
  sha: string;
  authorName: string | null;
  authorEmail: string | null;
  authorLogin: string | null;
  prAuthorLogin: string | null;
  /** ISO 8601 */
  authoredAt: string;
  message: string | null;
  isMerge: boolean;
  htmlUrl: string | null;
}

export interface ContributorRow extends ContributorIdentity {
  /** Objectif facultatif : 0 h = pas de seuil, donc pas de jauge. */
  target: Target;
  active: boolean;
}

export interface ReportParams extends SessionParams {
  timezone: string;
}

export interface ContributorReport<C extends ContributorRow = ContributorRow> {
  contributor: C;
  sessions: Session[];
  commitCount: number;
}

export interface WeekStat {
  week: WeekKey;
  minutes: number;
  rawMinutes: number;
  sessions: number;
  commits: number;
  activeDays: number;
}

export interface Report<C extends ContributorRow = ContributorRow> {
  reports: ContributorReport<C>[];
  unattributed: CommitRow[];
}

export function toEvent(commit: CommitRow): ActivityEvent {
  return {
    at: new Date(commit.authoredAt),
    sha: commit.sha,
    repo: commit.repo,
    message: commit.message ?? "",
    isMerge: commit.isMerge,
    url: commit.htmlUrl,
  };
}

export function buildReport<C extends ContributorRow>(
  commits: CommitRow[],
  contributors: C[],
  params: ReportParams,
): Report<C> {
  const byContributor = new Map<string, CommitRow[]>();
  const unattributed: CommitRow[] = [];

  for (const commit of commits) {
    const contributor = resolveContributor(commit, contributors);
    if (!contributor) {
      unattributed.push(commit);
      continue;
    }
    const list = byContributor.get(contributor.id) ?? [];
    list.push(commit);
    byContributor.set(contributor.id, list);
  }

  const reports = contributors.map((contributor) => {
    const own = byContributor.get(contributor.id) ?? [];
    return {
      contributor,
      sessions: computeSessions(own.map(toEvent), params),
      commitCount: own.length,
    };
  });

  return { reports, unattributed };
}

/** Sessions dont le début tombe dans la semaine (une session à cheval sur deux semaines compte dans celle où elle commence). */
export function sessionsInWeek(sessions: Session[], week: WeekKey, tz: string): Session[] {
  return sessions.filter((s) => sameWeek(weekOf(s.start, tz), week));
}

export function statsForWeek(sessions: Session[], week: WeekKey, tz: string): WeekStat {
  const inWeek = sessionsInWeek(sessions, week, tz);
  const days = new Set(inWeek.map((s) => dayKey(s.start, tz)));
  return {
    week,
    minutes: inWeek.reduce((sum, s) => sum + sessionMinutes(s), 0),
    rawMinutes: inWeek.reduce((sum, s) => sum + rawMinutes(s), 0),
    sessions: inWeek.length,
    commits: inWeek.reduce((sum, s) => sum + s.events.length, 0),
    activeDays: days.size,
  };
}

export interface DaySessions {
  day: string;
  sessions: Session[];
  minutes: number;
}

export function sessionsByDay(sessions: Session[], tz: string): DaySessions[] {
  const map = new Map<string, Session[]>();
  for (const session of sessions) {
    const key = dayKey(session.start, tz);
    map.set(key, [...(map.get(key) ?? []), session]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => ({
      day,
      sessions: list.sort((a, b) => a.start.getTime() - b.start.getTime()),
      minutes: list.reduce((sum, s) => sum + sessionMinutes(s), 0),
    }));
}

export type StatusLevel = "good" | "warning" | "serious" | "critical" | "neutral";

export interface TargetStatus {
  level: StatusLevel;
  /** Clé du libellé dans le dictionnaire (`contributor.status`). */
  key: "neutral" | "inProgress" | StatusLevel;
  ratio: number | null;
}

/**
 * Position par rapport à l'objectif de la période.
 *  ≥ 100 % → objectif atteint · ≥ 80 % → proche · ≥ 50 % → en dessous · < 50 % → très en dessous.
 * Une période en cours ou sans seuil reste neutre.
 */
export function targetStatus(
  minutes: number,
  targetHours: number,
  options: { inProgress?: boolean } = {},
): TargetStatus {
  if (!targetHours || targetHours <= 0) return { level: "neutral", key: "neutral", ratio: null };
  const ratio = minutes / (targetHours * 60);
  if (options.inProgress) return { level: "neutral", key: "inProgress", ratio };
  if (ratio >= 1) return { level: "good", key: "good", ratio };
  if (ratio >= 0.8) return { level: "warning", key: "warning", ratio };
  if (ratio >= 0.5) return { level: "serious", key: "serious", ratio };
  return { level: "critical", key: "critical", ratio };
}

export interface IdentitySummary {
  authorName: string | null;
  authorEmail: string | null;
  authorLogin: string | null;
  prAuthorLogin: string | null;
  count: number;
  lastAt: string;
}

/** Regroupe les commits non attribués par identité (nom, e-mail, login, auteur de PR). */
export function summarizeIdentities(commits: CommitRow[]): IdentitySummary[] {
  const map = new Map<string, IdentitySummary>();
  for (const c of commits) {
    const key = [c.authorName, c.authorEmail, c.authorLogin, c.prAuthorLogin].map((v) => v ?? "").join("|");
    const entry = map.get(key) ?? {
      authorName: c.authorName,
      authorEmail: c.authorEmail,
      authorLogin: c.authorLogin,
      prAuthorLogin: c.prAuthorLogin,
      count: 0,
      lastAt: c.authoredAt,
    };
    entry.count += 1;
    if (c.authoredAt > entry.lastAt) entry.lastAt = c.authoredAt;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
