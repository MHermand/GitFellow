import { describe, expect, it } from "vitest";
import { activityHref, isSelected, parseActivityParams, toggleId } from "./activity";

const tz = "Europe/Paris";
const now = new Date("2026-09-18T10:00:00+02:00");

describe("paramètres de la page Activité", () => {
  it("valeurs par défaut", () => {
    const p = parseActivityParams({}, tz, now);
    expect(p).toEqual({ view: "semaine", day: "2026-09-18", people: null, repos: null });
  });

  it("lit et sérialise sans bruit", () => {
    const p = parseActivityParams({ view: "mois", date: "2026-09-01", people: "a,b", repos: "none" }, tz, now);
    expect(p.people).toEqual(["a", "b"]);
    expect(p.repos).toEqual([]);
    expect(activityHref(p, {}, "2026-09-18")).toBe("/?view=mois&date=2026-09-01&people=a%2Cb&repos=none");
    expect(activityHref(parseActivityParams({}, tz, now), {}, "2026-09-18")).toBe("/");
    expect(activityHref(parseActivityParams({}, tz, now), { view: "jour" }, "2026-09-18")).toBe("/?view=jour");
  });

  it("bascule une sélection et revient à « tous »", () => {
    const all = ["a", "b", "c"];
    expect(toggleId(null, all, "b")).toEqual(["a", "c"]);
    expect(toggleId(["a", "c"], all, "b")).toBeNull();
    expect(toggleId(["a"], all, "a")).toEqual([]);
    expect(isSelected(null, "a")).toBe(true);
    expect(isSelected(["b"], "a")).toBe(false);
  });
});
