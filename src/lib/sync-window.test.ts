import { describe, expect, it } from "vitest";
import type { RepoRow } from "./store";
import { syncSince } from "./sync";

const repo = (extra: Partial<RepoRow>): RepoRow => ({
  id: "r1",
  owner: "MHermand",
  name: "CRA",
  enabled: true,
  last_synced_at: null,
  last_sync_error: null,
  last_sync_commits: null,
  tracked_since: null,
  created_at: "2026-09-01T00:00:00Z",
  ...extra,
});

describe("syncSince", () => {
  it("part de la date de début de suivi à la première synchro", () => {
    expect(syncSince(repo({ tracked_since: "2026-06-01" }))?.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("lit tout l'historique quand aucune date n'est fixée", () => {
    expect(syncSince(repo({}))).toBeNull();
  });

  it("reprend à la dernière synchro moins trois jours de marge", () => {
    const since = syncSince(repo({ last_synced_at: "2026-09-18T06:00:00Z", tracked_since: "2026-06-01" }));
    expect(since?.toISOString()).toBe("2026-09-15T06:00:00.000Z");
  });

  it("ne redescend jamais sous la date de début de suivi", () => {
    const since = syncSince(repo({ last_synced_at: "2026-09-18T06:00:00Z", tracked_since: "2026-09-17" }));
    expect(since?.toISOString()).toBe("2026-09-17T00:00:00.000Z");
  });
});
