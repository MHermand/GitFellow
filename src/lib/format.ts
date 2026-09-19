export function fmtMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function fmtHoursDecimal(minutes: number, digits = 2): string {
  return (minutes / 60).toFixed(digits).replace(".", ",");
}

/** Heures d'objectif : « 70 h », ou « 67,2 h » quand la répartition ne tombe pas juste. */
export function fmtHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1).replace(".", ",")} h`;
}

export function fmtPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}\u202f%`;
}

export function fmtDateTime(iso: string | null, tz: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}
