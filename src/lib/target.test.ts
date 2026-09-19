import { describe, expect, it } from "vitest";
import { dailyTargetHours, parseTargetUnit, targetForWorkingDays } from "./target";

const tz = "Europe/Paris";
// Septembre 2026 : 22 jours ouvrés (le 1er est un mardi, le 30 un mercredi).
const inSeptember = "2026-09-16";

describe("dailyTargetHours", () => {
  it("prend un objectif journalier tel quel", () => {
    expect(dailyTargetHours({ hours: 5, unit: "day" }, inSeptember, tz)).toBe(5);
  });

  it("répartit un objectif hebdomadaire sur cinq jours ouvrés", () => {
    expect(dailyTargetHours({ hours: 25, unit: "week" }, inSeptember, tz)).toBe(5);
  });

  it("répartit un objectif mensuel sur les jours ouvrés du mois affiché", () => {
    expect(dailyTargetHours({ hours: 110, unit: "month" }, inSeptember, tz)).toBeCloseTo(5, 10);
    // Février 2026 compte 20 jours ouvrés : le même objectif mensuel pèse plus par jour.
    expect(dailyTargetHours({ hours: 110, unit: "month" }, "2026-02-10", tz)).toBeCloseTo(5.5, 10);
  });

  it("vaut zéro sans objectif", () => {
    expect(dailyTargetHours({ hours: 0, unit: "week" }, inSeptember, tz)).toBe(0);
  });
});

describe("targetForWorkingDays", () => {
  it("cumule l'objectif quotidien sur les jours ouvrés écoulés", () => {
    expect(targetForWorkingDays({ hours: 25, unit: "week" }, 3, inSeptember, tz)).toBe(15);
    expect(targetForWorkingDays({ hours: 110, unit: "month" }, 22, inSeptember, tz)).toBeCloseTo(110, 10);
  });
});

describe("parseTargetUnit", () => {
  it("retombe sur la semaine pour une valeur inconnue", () => {
    expect(parseTargetUnit("day")).toBe("day");
    expect(parseTargetUnit("month")).toBe("month");
    expect(parseTargetUnit("week")).toBe("week");
    expect(parseTargetUnit("annee")).toBe("week");
    expect(parseTargetUnit(null)).toBe("week");
  });
});
