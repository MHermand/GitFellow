import { describe, expect, it } from "vitest";
import {
  addWeeksToKey,
  dayKey,
  parseWeekId,
  weekEnd,
  weekId,
  weekLabel,
  weekOf,
  weekShortLabel,
  weekStart,
  weeksRange,
} from "./weeks";

const tz = "Europe/Paris";
const at = (s: string) => new Date(s).toISOString();

describe("semaines ISO en Europe/Paris", () => {
  it("le lundi 14/09/2026 est en 2026-W38", () => {
    expect(weekId(weekOf(new Date("2026-09-14T10:00:00+02:00"), tz))).toBe("2026-W38");
  });

  it("découpe au lundi 00:00 heure de Paris, pas UTC", () => {
    expect(weekOf(new Date("2026-09-13T23:30:00+02:00"), tz).week).toBe(37);
    expect(weekOf(new Date("2026-09-14T00:30:00+02:00"), tz).week).toBe(38);
    // 22:30 UTC le dimanche = 00:30 lundi à Paris
    expect(weekOf(new Date("2026-09-13T22:30:00Z"), tz).week).toBe(38);
  });

  it("weekStart / weekEnd", () => {
    const key = { year: 2026, week: 38 };
    expect(weekStart(key, tz).toISOString()).toBe(at("2026-09-14T00:00:00+02:00"));
    expect(weekEnd(key, tz).toISOString()).toBe(at("2026-09-21T00:00:00+02:00"));
  });

  it("gère le passage d'année (le 1er janvier 2026 est un jeudi)", () => {
    expect(weekId(weekOf(new Date("2025-12-29T12:00:00+01:00"), tz))).toBe("2026-W01");
    expect(weekId(weekOf(new Date("2025-12-28T12:00:00+01:00"), tz))).toBe("2025-W52");
    expect(weeksRange({ year: 2026, week: 2 }, 4, tz).map(weekId)).toEqual([
      "2025-W51",
      "2025-W52",
      "2026-W01",
      "2026-W02",
    ]);
  });

  it("addWeeksToKey traverse le changement d'heure d'octobre", () => {
    expect(weekId(addWeeksToKey({ year: 2026, week: 43 }, 1, tz))).toBe("2026-W44");
    expect(weekId(addWeeksToKey({ year: 2026, week: 44 }, -1, tz))).toBe("2026-W43");
  });

  it("parseWeekId", () => {
    expect(parseWeekId("2026-W38")).toEqual({ year: 2026, week: 38 });
    expect(parseWeekId("2026-38")).toBeNull();
    expect(parseWeekId("2026-W60")).toBeNull();
    expect(parseWeekId(null)).toBeNull();
  });

  it("dayKey et libellés en français", () => {
    expect(dayKey(new Date("2026-09-14T23:30:00+02:00"), tz)).toBe("2026-09-14");
    expect(dayKey(new Date("2026-09-14T22:30:00Z"), tz)).toBe("2026-09-15");
    expect(weekLabel({ year: 2026, week: 38 }, tz)).toBe("14 sept. → 20 sept. 2026");
    expect(weekShortLabel({ year: 2026, week: 35 }, tz)).toBe("24–30 août");
    expect(weekShortLabel({ year: 2026, week: 31 }, tz)).toBe("27 juil.–2 août");
  });
});
