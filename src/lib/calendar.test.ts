import { describe, expect, it } from "vitest";
import {
  fmtClock,
  heatLevel,
  listDays,
  monthWeeks,
  parseDay,
  parseView,
  periodFor,
  repoBreakdown,
  rhythmCells,
  shiftDay,
  splitByDay,
  weekdayIndex,
  withLanes,
  workingDays,
} from "./calendar";
import { computeSessions, type ActivityEvent } from "./sessions";
import { weekId } from "./weeks";

const tz = "Europe/Paris";
const at = (s: string) => new Date(s).toISOString();
const ev = (iso: string, repo = "MHermand/Dashboard"): ActivityEvent => ({
  at: new Date(iso),
  sha: iso + repo,
  repo,
  message: "",
  isMerge: false,
  url: null,
});

describe("périodes", () => {
  it("parse la vue et le jour", () => {
    expect(parseView("jour")).toBe("jour");
    expect(parseView("x")).toBe("semaine");
    expect(parseDay("2026-09-14")).toBe("2026-09-14");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("14/09/2026")).toBeNull();
  });

  it("semaine : lundi → lundi suivant, libellé et navigation", () => {
    const p = periodFor("semaine", "2026-09-16", tz, "fr");
    expect(p.start.toISOString()).toBe(at("2026-09-14T00:00:00+02:00"));
    expect(p.end.toISOString()).toBe(at("2026-09-21T00:00:00+02:00"));
    expect(p.label).toBe("Semaine 38 · 14 sept. → 20 sept. 2026");
    expect(p.prevDay).toBe("2026-09-07");
    expect(p.nextDay).toBe("2026-09-21");
    expect(p.days).toHaveLength(7);
    expect(p.days[6]).toBe("2026-09-20");
  });

  it("jour et mois", () => {
    const d = periodFor("jour", "2026-09-07", tz, "fr");
    expect(d.label).toBe("Lundi 7 septembre 2026");
    expect(d.end.toISOString()).toBe(at("2026-09-08T00:00:00+02:00"));
    const m = periodFor("mois", "2026-09-18", tz, "fr");
    expect(m.label).toBe("Septembre 2026");
    expect(m.start.toISOString()).toBe(at("2026-09-01T00:00:00+02:00"));
    expect(m.end.toISOString()).toBe(at("2026-10-01T00:00:00+02:00"));
    expect(m.prevDay).toBe("2026-08-01");
    expect(m.nextDay).toBe("2026-10-01");
    expect(m.days).toHaveLength(30);
    expect(weekId(m.week)).toBe("2026-W40");
  });

  it("grille du mois : de la semaine du 1er à celle du 30", () => {
    const weeks = monthWeeks("2026-09-18", tz);
    expect(weeks.map((w) => weekId(w.week))).toEqual(["2026-W36", "2026-W37", "2026-W38", "2026-W39", "2026-W40"]);
    expect(weeks[0].days[0]).toBe("2026-08-31");
    expect(weeks[4].days[6]).toBe("2026-10-04");
  });

  it("shiftDay traverse le changement d'heure et listDays énumère", () => {
    expect(shiftDay("2026-10-25", 1, tz)).toBe("2026-10-26");
    expect(shiftDay("2026-03-29", -1, tz)).toBe("2026-03-28");
    expect(listDays("2026-09-28", "2026-10-02", tz)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(weekdayIndex("2026-09-14", tz)).toBe(0);
    expect(weekdayIndex("2026-09-13", tz)).toBe(6);
  });
});

describe("segments et grille", () => {
  it("découpe une session à cheval sur minuit", () => {
    const [session] = computeSessions([ev("2026-09-14T23:00:00+02:00"), ev("2026-09-15T00:39:00+02:00")]);
    const segments = splitByDay(session, tz);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ day: "2026-09-14", startMin: 22 * 60 + 30, endMin: 24 * 60, first: true, last: false });
    expect(segments[1]).toMatchObject({ day: "2026-09-15", startMin: 0, endMin: 69, first: false, last: true });
  });

  it("withLanes décale les segments qui se chevauchent", () => {
    const lanes = withLanes([
      { id: "a", startMin: 540, endMin: 942 },
      { id: "b", startMin: 810, endMin: 990 },
      { id: "c", startMin: 1000, endMin: 1100 },
    ]);
    expect(lanes.map((l) => [l.id, l.lane])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 0],
    ]);
  });

  it("fmtClock", () => {
    expect(fmtClock(8 * 60 + 35)).toBe("08:35");
    expect(fmtClock(24 * 60)).toBe("00:00");
  });
});

describe("jours ouvrés", () => {
  it("compte les jours ouvrés d'une période", () => {
    expect(workingDays(periodFor("semaine", "2026-09-16", tz).days, tz)).toBe(5);
    expect(workingDays(periodFor("mois", "2026-09-16", tz).days, tz)).toBe(22);
    expect(workingDays(["2026-09-19", "2026-09-20"], tz)).toBe(0);
  });
});

describe("statistiques", () => {
  it("répartit le temps d'une session au prorata des commits par dépôt", () => {
    const [session] = computeSessions([
      ev("2026-09-14T10:00:00+02:00", "a/x"),
      ev("2026-09-14T10:30:00+02:00", "a/x"),
      ev("2026-09-14T11:00:00+02:00", "a/y"),
    ]);
    // 60 min brut + 60 min de tampons = 120 min ; 2/3 pour x, 1/3 pour y
    const shares = repoBreakdown([session]);
    expect(shares).toEqual([
      { repo: "a/x", minutes: 80, commits: 2 },
      { repo: "a/y", minutes: 40, commits: 1 },
    ]);
  });

  it("rythme : minutes, sessions et commits par jour de semaine et par heure", () => {
    const sessions = computeSessions([ev("2026-09-14T09:30:00+02:00"), ev("2026-09-14T10:30:00+02:00")]); // 09:00 → 11:00 lundi
    const sunday = computeSessions([ev("2026-09-13T21:30:00+02:00")]); // 21:00 → 22:00 dimanche
    const r = rhythmCells([...sessions, ...sunday], tz);
    expect(r.cells[0][9]).toEqual({ minutes: 60, sessions: 1, commits: 1 });
    expect(r.cells[0][10]).toEqual({ minutes: 60, sessions: 1, commits: 1 });
    expect(r.cells[0][11].minutes).toBe(0);
    expect(r.cells[6][21].minutes).toBe(60);
    expect(r.max).toBe(60);
    // limité aux jours demandés : le dimanche sort du décompte
    const monday = rhythmCells([...sessions, ...sunday], tz, new Set(["2026-09-14"]));
    expect(monday.cells[6][21].minutes).toBe(0);
    expect(monday.cells[0][9].minutes).toBe(60);
    expect(heatLevel(0, 60)).toBe(0);
    expect(heatLevel(60, 60)).toBe(5);
    expect(heatLevel(15, 60)).toBe(2);
  });

});
