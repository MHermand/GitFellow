import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DuplicateError } from "./types";
import { SqliteStore } from "./sqlite";

let store: SqliteStore;

beforeEach(() => {
  store = new SqliteStore(":memory:", { timezone: "Europe/Paris" });
});
afterEach(() => store.close());

const commit = (repoId: string, sha: string, at: string, extra: Partial<Parameters<SqliteStore["upsertCommits"]>[0][number]> = {}) => ({
  repo_id: repoId,
  sha,
  author_name: "Félix",
  author_email: "felix@example.com",
  author_login: "Felixooos",
  committer_name: null,
  committer_email: null,
  authored_at: at,
  committed_at: at,
  message: "feat",
  is_merge: false,
  parents_count: 1,
  branches: ["main"],
  html_url: null,
  synced_at: "2026-09-19T00:00:00Z",
  ...extra,
});

describe("SqliteStore", () => {
  it("crée les réglages avec le fuseau donné et les met à jour", async () => {
    const settings = await store.settings();
    expect(settings).toMatchObject({ pre_minutes: 30, gap_minutes: 120, post_minutes: 30, timezone: "Europe/Paris", locale: null });
    const updated = await store.updateSettings({ gap_minutes: 90, locale: "en" });
    expect(updated.gap_minutes).toBe(90);
    expect(updated.locale).toBe("en");
  });

  it("refuse un dépôt en double, sans tenir compte de la casse", async () => {
    await store.addRepo({ owner: "MHermand", name: "CRA", tracked_since: null });
    await expect(store.addRepo({ owner: "mhermand", name: "cra", tracked_since: "2026-01-01" })).rejects.toBeInstanceOf(DuplicateError);
    expect(await store.repos()).toHaveLength(1);
  });

  it("garde les listes d'identités d'un contributeur", async () => {
    const created = await store.insertContributor({
      display_name: "Félix",
      github_logins: ["Felixooos"],
      author_emails: ["felix@example.com"],
      author_names: [],
      target_hours: 25,
      target_unit: "week",
    });
    expect(created.github_logins).toEqual(["Felixooos"]);
    await store.updateContributor(created.id, { ...created, display_name: "Félix H.", author_names: ["Felix H"] });
    const row = await store.contributor(created.id);
    expect(row?.display_name).toBe("Félix H.");
    expect(row?.author_names).toEqual(["Felix H"]);
    expect(row?.active).toBe(true);
  });

  it("réécrit un commit sans perdre sa PR d'origine, et normalise les instants", async () => {
    const repo = await store.addRepo({ owner: "o", name: "r", tracked_since: null });
    await store.upsertCommits([commit(repo.id, "a1", "2026-09-14T10:00:00Z")]);
    await store.markPullRequestChecked(repo.id, ["a1"], { number: 12, authorLogin: "MHermand" });
    await store.upsertCommits([commit(repo.id, "a1", "2026-09-14T10:00:00Z", { branches: ["main", "feat"] })]);
    const rows = await store.commitsBetween(new Date("2026-09-14T00:00:00Z"), new Date("2026-09-15T00:00:00Z"));
    expect(rows).toHaveLength(1);
    expect(rows[0].pr_author_login).toBe("MHermand");
    expect(rows[0].authored_at).toBe("2026-09-14T10:00:00.000Z");
    expect(await store.commitBranches(repo.id, ["a1"])).toEqual(new Map([["a1", ["main", "feat"]]]));
    expect(await store.pendingPullRequestChecks(repo.id, 10)).toEqual([]);
  });

  it("borne et ordonne les commits d'une période", async () => {
    const repo = await store.addRepo({ owner: "o", name: "r", tracked_since: null });
    await store.upsertCommits([
      commit(repo.id, "c", "2026-09-14T12:00:00Z"),
      commit(repo.id, "a", "2026-09-13T23:59:59Z"),
      commit(repo.id, "b", "2026-09-14T00:00:00Z"),
      commit(repo.id, "d", "2026-09-15T00:00:00Z"),
    ]);
    const rows = await store.commitsBetween(new Date("2026-09-14T00:00:00Z"), new Date("2026-09-15T00:00:00Z"));
    expect(rows.map((r) => r.sha)).toEqual(["b", "c"]);
    expect(await store.countCommits(repo.id)).toBe(4);
  });

  it("résume les identités des dépôts suivis, depuis leur date de suivi, dépôts fusionnés", async () => {
    const r1 = await store.addRepo({ owner: "o", name: "r1", tracked_since: null });
    const r2 = await store.addRepo({ owner: "o", name: "r2", tracked_since: "2026-09-10" });
    const r3 = await store.addRepo({ owner: "o", name: "r3", tracked_since: null });
    await store.updateRepo(r3.id, { enabled: false });
    await store.upsertCommits([
      commit(r1.id, "a", "2026-09-01T10:00:00Z"),
      commit(r1.id, "b", "2026-09-02T10:00:00Z"),
      commit(r2.id, "c", "2026-09-05T10:00:00Z"), // avant la date de suivi : ignoré
      commit(r2.id, "d", "2026-09-12T10:00:00Z"),
      commit(r2.id, "e", "2026-09-13T10:00:00Z", { author_login: "MHermand", author_email: "max@example.com", author_name: "Maxence" }),
      commit(r3.id, "f", "2026-09-13T10:00:00Z"), // dépôt désactivé : ignoré
    ]);
    const floors = new Map([[r2.id, new Date("2026-09-10T00:00:00Z")]]);
    const summary = await store.identitySummary(floors);
    expect(summary).toEqual([
      { authorName: "Félix", authorEmail: "felix@example.com", authorLogin: "Felixooos", prAuthorLogin: null, count: 3, lastAt: "2026-09-12T10:00:00.000Z" },
      { authorName: "Maxence", authorEmail: "max@example.com", authorLogin: "MHermand", prAuthorLogin: null, count: 1, lastAt: "2026-09-13T10:00:00.000Z" },
    ]);
  });

  it("retirer un dépôt emporte ses commits", async () => {
    const repo = await store.addRepo({ owner: "o", name: "r", tracked_since: null });
    await store.upsertCommits([commit(repo.id, "a", "2026-09-14T10:00:00Z")]);
    await store.deleteRepo(repo.id);
    expect(await store.repos()).toEqual([]);
    expect(await store.countCommits()).toBe(0);
  });
});
