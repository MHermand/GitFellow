import { describe, expect, it } from "vitest";
import {
  buildReport,
  sessionsByDay,
  statsForWeek,
  summarizeIdentities,
  targetStatus,
  type CommitRow,
  type ContributorRow,
} from "./report";

const tz = "Europe/Paris";
const params = { preMinutes: 30, gapMinutes: 120, postMinutes: 30, timezone: tz };

const felix: ContributorRow = {
  id: "felix",
  displayName: "Félix",
  githubLogins: ["Felixooos"],
  authorEmails: [],
  authorNames: [],
  target: { hours: 25, unit: "week" as const },
  active: true,
};

const commit = (iso: string, extra: Partial<CommitRow> = {}): CommitRow => ({
  repoId: "r1",
  repo: "MHermand/Dashboard",
  sha: iso + (extra.sha ?? ""),
  authorName: "Felixooos",
  authorEmail: "felix@example.com",
  authorLogin: "Felixooos",
  prAuthorLogin: null,
  authoredAt: new Date(iso).toISOString(),
  message: "feat",
  isMerge: false,
  htmlUrl: null,
  ...extra,
});

describe("buildReport + statsForWeek", () => {
  it("calcule les heures de la semaine à partir de l'exemple de référence", () => {
    const commits = [
      "2026-09-14T09:54:00+02:00",
      "2026-09-14T10:12:00+02:00",
      "2026-09-14T12:00:00+02:00",
      "2026-09-14T13:39:00+02:00",
      "2026-09-14T16:00:00+02:00",
      "2026-09-14T17:00:00+02:00",
      "2026-09-14T23:00:00+02:00",
      "2026-09-15T00:39:00+02:00",
    ].map((iso) => commit(iso));

    const { reports, unattributed } = buildReport(commits, [felix], params);
    expect(unattributed).toHaveLength(0);
    const stat = statsForWeek(reports[0].sessions, { year: 2026, week: 38 }, tz);
    expect(stat.minutes).toBe(9 * 60 + 24);
    expect(stat.sessions).toBe(3);
    expect(stat.commits).toBe(8);
    expect(stat.activeDays).toBe(1); // la 3e session commence lundi soir → comptée lundi
    expect(stat.rawMinutes).toBe(3 * 60 + 45 + 60 + 99);

    const days = sessionsByDay(reports[0].sessions, tz);
    expect(days.map((d) => d.day)).toEqual(["2026-09-14"]);
    expect(days[0].sessions).toHaveLength(3);
  });

  it("compte les commits de merge comme de l'activité", () => {
    const commits = [commit("2026-09-14T10:00:00+02:00"), commit("2026-09-14T10:05:00+02:00", { isMerge: true, sha: "m" })];
    const { reports } = buildReport(commits, [felix], params);
    expect(reports[0].commitCount).toBe(2);
  });

  it("isole les commits non attribués", () => {
    const commits = [commit("2026-09-14T10:00:00+02:00", { authorLogin: "inconnu", authorEmail: "i@x.y", authorName: "Inconnu" })];
    const { reports, unattributed } = buildReport(commits, [felix], params);
    expect(reports[0].commitCount).toBe(0);
    expect(unattributed).toHaveLength(1);
    const summary = summarizeIdentities(unattributed);
    expect(summary).toHaveLength(1);
    expect(summary[0].count).toBe(1);
    expect(summary[0].authorLogin).toBe("inconnu");
  });
});

describe("targetStatus", () => {
  it("échelonne les niveaux", () => {
    expect(targetStatus(25 * 60, 25).level).toBe("good");
    expect(targetStatus(21 * 60, 25).level).toBe("warning");
    expect(targetStatus(13 * 60, 25).level).toBe("serious");
    expect(targetStatus(5 * 60, 25).level).toBe("critical");
    expect(targetStatus(5 * 60, 0).level).toBe("neutral");
    expect(targetStatus(5 * 60, 25, { inProgress: true }).level).toBe("neutral");
  });
});
