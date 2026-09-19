import { describe, expect, it } from "vitest";
import { computeSessions, rawMinutes, sessionMinutes, totalMinutes, type ActivityEvent } from "./sessions";

const ev = (iso: string): ActivityEvent => ({
  at: new Date(iso),
  sha: iso,
  repo: "MHermand/Dashboard",
  message: "",
  isMerge: false,
  url: null,
});

const iso = (d: Date) => d.toISOString();
const at = (s: string) => new Date(s).toISOString();

describe("computeSessions", () => {
  it("reproduit l'exemple de référence (3 sessions, 9h24)", () => {
    const events = [
      "2026-09-14T09:54:00+02:00",
      "2026-09-14T10:12:00+02:00",
      "2026-09-14T12:00:00+02:00",
      "2026-09-14T13:39:00+02:00",
      "2026-09-14T16:00:00+02:00",
      "2026-09-14T17:00:00+02:00",
      "2026-09-14T23:00:00+02:00",
      "2026-09-15T00:39:00+02:00",
    ].map(ev);

    const sessions = computeSessions(events);
    expect(sessions).toHaveLength(3);

    expect(iso(sessions[0].start)).toBe(at("2026-09-14T09:24:00+02:00"));
    expect(iso(sessions[0].end)).toBe(at("2026-09-14T14:09:00+02:00"));
    expect(sessionMinutes(sessions[0])).toBe(4 * 60 + 45);
    expect(sessions[0].events).toHaveLength(4);

    expect(iso(sessions[1].start)).toBe(at("2026-09-14T15:30:00+02:00"));
    expect(iso(sessions[1].end)).toBe(at("2026-09-14T17:30:00+02:00"));
    expect(sessionMinutes(sessions[1])).toBe(120);

    expect(iso(sessions[2].start)).toBe(at("2026-09-14T22:30:00+02:00"));
    expect(iso(sessions[2].end)).toBe(at("2026-09-15T01:09:00+02:00"));
    expect(sessionMinutes(sessions[2])).toBe(2 * 60 + 39);

    expect(totalMinutes(sessions)).toBe(9 * 60 + 24);
  });

  it("un écart d'exactement 2h reste dans la même session, 2h01 la coupe", () => {
    const same = computeSessions([ev("2026-09-14T10:00:00+02:00"), ev("2026-09-14T12:00:00+02:00")]);
    expect(same).toHaveLength(1);
    const split = computeSessions([ev("2026-09-14T10:00:00+02:00"), ev("2026-09-14T12:01:00+02:00")]);
    expect(split).toHaveLength(2);
  });

  it("un commit isolé vaut pre + post minutes", () => {
    const [session] = computeSessions([ev("2026-09-14T10:00:00+02:00")]);
    expect(sessionMinutes(session)).toBe(60);
    expect(rawMinutes(session)).toBe(0);
  });

  it("respecte des paramètres personnalisés", () => {
    const sessions = computeSessions(
      [ev("2026-09-14T10:00:00+02:00"), ev("2026-09-14T11:30:00+02:00")],
      { preMinutes: 15, gapMinutes: 60, postMinutes: 15 },
    );
    expect(sessions).toHaveLength(2);
    expect(totalMinutes(sessions)).toBe(60);
  });

  it("trie les événements et tolère les doublons d'horodatage", () => {
    const sessions = computeSessions([
      ev("2026-09-14T11:00:00+02:00"),
      ev("2026-09-14T10:00:00+02:00"),
      ev("2026-09-14T10:00:00+02:00"),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessionMinutes(sessions[0])).toBe(120);
    expect(sessions[0].events).toHaveLength(3);
  });

  it("retourne une liste vide sans événement", () => {
    expect(computeSessions([])).toEqual([]);
  });
});
