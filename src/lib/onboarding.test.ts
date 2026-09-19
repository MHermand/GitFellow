import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeGitHub } from "./github-fake";
import { autoTrackAuthors } from "./onboarding";
import { SqliteStore } from "./store/sqlite";
import { syncAllRepos } from "./sync";

let store: SqliteStore;
beforeEach(() => {
  store = new SqliteStore(":memory:", { timezone: "Europe/Paris" });
});
afterEach(() => store.close());

describe("première synchronisation avec le GitHub simulé", () => {
  it("lit les commits, rattache les commits d'agent à l'auteur de la PR et suit les personnes", async () => {
    const gh = new FakeGitHub(new Date("2026-09-19T12:00:00Z"));
    await store.addRepo({ owner: "acme", name: "web-app", tracked_since: "2026-08-01" });
    await store.addRepo({ owner: "acme", name: "api", tracked_since: null });

    const results = await syncAllRepos(store, gh, { now: new Date("2026-09-19T12:00:00Z") });
    expect(results.map((r) => r.ok)).toEqual([true, true]);
    expect(results[0].commits).toBeGreaterThan(50);
    expect(await store.countCommits()).toBe(results[0].commits + results[1].commits);

    // Les commits « Claude » (adresse générique) ont leur PR d'origine renseignée, portée par alice.
    const rows = await store.commitsBetween(new Date("2026-08-01T00:00:00Z"), new Date("2026-09-20T00:00:00Z"));
    const agent = rows.filter((r) => r.author_email === "noreply@anthropic.com");
    expect(agent.length).toBeGreaterThan(0);
    expect(agent.every((r) => r.pr_author_login === "alice-dev")).toBe(true);
    // Les commits antérieurs à la date de suivi de web-app ne sont pas lus.
    expect(rows.filter((r) => r.repo_id === results[0].repoId).every((r) => r.authored_at >= "2026-08-01")).toBe(true);

    const created = await autoTrackAuthors(store);
    const contributors = await store.contributors();
    expect(created).toBe(contributors.length);
    expect(contributors.map((c) => c.display_name).sort()).toEqual(["Alice Martin", "Bob Keller", "Chloé Durand"]);
    expect(contributors.find((c) => c.display_name === "Alice Martin")?.github_logins).toEqual(["alice-dev"]);
    // Une seconde passe ne double rien.
    expect(await autoTrackAuthors(store)).toBe(0);
  });

  it("une seconde synchronisation ne relit que la fenêtre de recouvrement et garde les PR", async () => {
    const gh = new FakeGitHub(new Date("2026-09-19T12:00:00Z"));
    const repo = await store.addRepo({ owner: "acme", name: "web-app", tracked_since: null });
    const first = await syncAllRepos(store, gh, { now: new Date("2026-09-19T12:00:00Z") });
    const second = await syncAllRepos(store, gh, { now: new Date("2026-09-19T13:00:00Z") });
    expect(second[0].commits).toBeLessThan(first[0].commits);
    expect(await store.countCommits(repo.id)).toBe(first[0].commits);
    expect(await store.pendingPullRequestChecks(repo.id, 10)).toEqual([]);
  });
});
