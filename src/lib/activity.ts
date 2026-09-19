/**
 * Paramètres d'URL de la page Activité et construction des liens qui les conservent.
 */
import { parseDay, parseView, type View } from "./calendar";
import { dayKey } from "./weeks";

export interface ActivityParams {
  view: View;
  /** Jour d'ancrage, "YYYY-MM-DD". */
  day: string;
  /** null = toutes les personnes ; [] = aucune. */
  people: string[] | null;
  /** null = tous les dépôts ; [] = aucun. */
  repos: string[] | null;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseIdList(value: string | string[] | undefined): string[] | null {
  if (value === undefined) return null;
  const joined = Array.isArray(value) ? value.join(",") : value;
  if (joined === "" || joined === "none") return [];
  return joined.split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseActivityParams(raw: RawSearchParams, tz: string, now: Date = new Date()): ActivityParams {
  return {
    view: parseView(first(raw.view)),
    day: parseDay(first(raw.date)) ?? dayKey(now, tz),
    people: parseIdList(raw.people),
    repos: parseIdList(raw.repos),
  };
}

/**
 * Lien conservant les paramètres courants, modifiés par `patch`. `base` permet de viser une
 * autre page (la fiche d'un contributeur) en gardant la période et les filtres.
 */
export function activityHref(params: ActivityParams, patch: Partial<ActivityParams> = {}, today?: string, base = "/"): string {
  const next = { ...params, ...patch };
  const query = new URLSearchParams();
  if (next.view !== "semaine") query.set("view", next.view);
  if (next.day && next.day !== today) query.set("date", next.day);
  if (next.people !== null) query.set("people", next.people.length ? next.people.join(",") : "none");
  if (next.repos !== null) query.set("repos", next.repos.length ? next.repos.join(",") : "none");
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Bascule un identifiant dans une sélection (null = tout sélectionné). */
export function toggleId(selection: string[] | null, all: string[], id: string): string[] | null {
  const current = selection ?? all;
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  const ordered = all.filter((x) => next.includes(x));
  return ordered.length === all.length ? null : ordered;
}

export function isSelected(selection: string[] | null, id: string): boolean {
  return selection === null || selection.includes(id);
}
