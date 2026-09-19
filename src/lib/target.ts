/**
 * Objectif d'un contributeur : une valeur en heures et l'unité qui la porte.
 * Tout le reste de l'application raisonne en heures par jour ouvré, ce qui permet
 * de comparer un objectif journalier, hebdomadaire ou mensuel sur n'importe quelle période.
 */
import { periodFor, workingDays } from "./calendar";

export type TargetUnit = "day" | "week" | "month";

export interface Target {
  hours: number;
  unit: TargetUnit;
}

/** Jours ouvrés d'une semaine : base de conversion d'un objectif hebdomadaire. */
export const WORKING_DAYS_PER_WEEK = 5;

export const TARGET_UNITS: { value: TargetUnit; label: string }[] = [
  { value: "day", label: "jour" },
  { value: "week", label: "semaine" },
  { value: "month", label: "mois" },
];

export function parseTargetUnit(value: unknown): TargetUnit {
  return value === "day" || value === "month" ? value : "week";
}

export function targetUnitLabel(unit: TargetUnit): string {
  return TARGET_UNITS.find((u) => u.value === unit)!.label;
}

export const NO_TARGET: Target = { hours: 0, unit: "week" };

/**
 * Objectif ramené à des heures par jour ouvré : l'hebdomadaire se répartit sur cinq jours,
 * le mensuel sur les jours ouvrés du mois auquel appartient `anchorDay`.
 */
export function dailyTargetHours(target: Target, anchorDay: string, tz: string): number {
  if (!(target.hours > 0)) return 0;
  if (target.unit === "day") return target.hours;
  if (target.unit === "week") return target.hours / WORKING_DAYS_PER_WEEK;
  const days = workingDays(periodFor("mois", anchorDay, tz).days, tz);
  return days > 0 ? target.hours / days : 0;
}

/** Objectif cumulé sur un nombre de jours ouvrés donné. */
export function targetForWorkingDays(target: Target, days: number, anchorDay: string, tz: string): number {
  return dailyTargetHours(target, anchorDay, tz) * days;
}
