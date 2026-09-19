/**
 * Synchronisation GitHub → table `commits`, dépôt par dépôt.
 */
import { needsPullRequestLookup } from "./attribution";
import type { GhCommit, GhPull } from "./github";
import { GitHubError } from "./github";
import type { CommitInsert, RepoRow, Store } from "./store";

/** Ce que la synchronisation demande à GitHub — une interface pour pouvoir la simuler en test. */
export interface GitHubApi {
  listBranches(owner: string, repo: string): Promise<string[]>;
  iterCommits(owner: string, repo: string, options: { sha: string; since?: string }): AsyncIterable<GhCommit[]>;
  pullsForCommit(owner: string, repo: string, sha: string): Promise<GhPull[]>;
}

export interface SyncRepoResult {
  repoId: string;
  repo: string;
  ok: boolean;
  branches: number;
  commits: number;
  pullRequestLookups: number;
  error: string | null;
}

const DAY = 86_400_000;
/** Marge de re-lecture à chaque synchronisation (rebases, pushes tardifs). */
const OVERLAP_DAYS = 3;
/** Plafond de requêtes « PR d'origine » par synchronisation et par dépôt. */
const MAX_PR_LOOKUPS = 60;

function firstLine(message: string): string {
  return message.split("\n")[0].trim().slice(0, 200);
}

/**
 * Début de la fenêtre à lire, `null` pour tout l'historique : la synchro incrémentale repart de la
 * dernière réussie, la première de la date de début de suivi du dépôt (sans date : tout le dépôt).
 * On ne descend jamais sous cette date.
 */
export function syncSince(repo: Pick<RepoRow, "tracked_since" | "last_synced_at">): Date | null {
  const floor = repo.tracked_since ? Date.parse(`${repo.tracked_since}T00:00:00Z`) : null;
  if (!repo.last_synced_at) return floor === null ? null : new Date(floor);
  const base = Date.parse(repo.last_synced_at) - OVERLAP_DAYS * DAY;
  return new Date(floor === null ? base : Math.max(base, floor));
}

export interface SyncOptions {
  now?: Date;
  /** Appelé avant chaque dépôt : de quoi afficher une progression. */
  onRepo?: (repo: RepoRow, index: number, total: number) => void;
}

export async function syncAllRepos(store: Store, gh: GitHubApi, options: SyncOptions = {}): Promise<SyncRepoResult[]> {
  const repos = (await store.repos()).filter((r) => r.enabled);
  const results: SyncRepoResult[] = [];
  for (const [index, repo] of repos.entries()) {
    options.onRepo?.(repo, index, repos.length);
    results.push(await syncRepo(store, gh, repo, options.now));
  }
  return results;
}

export async function syncRepo(store: Store, gh: GitHubApi, repo: RepoRow, now: Date = new Date()): Promise<SyncRepoResult> {
  const label = `${repo.owner}/${repo.name}`;
  try {
    const since = syncSince(repo);

    const branches = await gh.listBranches(repo.owner, repo.name);
    const seen = new Map<string, { commit: GhCommit; branches: Set<string> }>();
    for (const branch of branches) {
      for await (const page of gh.iterCommits(repo.owner, repo.name, { sha: branch, since: since?.toISOString() })) {
        for (const commit of page) {
          const entry = seen.get(commit.sha) ?? { commit, branches: new Set<string>() };
          entry.branches.add(branch);
          seen.set(commit.sha, entry);
        }
      }
    }

    const existing = await store.commitBranches(repo.id, [...seen.keys()]);
    const rows: CommitInsert[] = [...seen.values()].map(({ commit, branches: onBranches }) => ({
      repo_id: repo.id,
      sha: commit.sha,
      author_name: commit.authorName,
      author_email: commit.authorEmail,
      author_login: commit.authorLogin,
      committer_name: commit.committerName,
      committer_email: commit.committerEmail,
      authored_at: commit.authoredAt,
      committed_at: commit.committedAt,
      message: firstLine(commit.message),
      is_merge: commit.parentsCount > 1,
      parents_count: commit.parentsCount,
      branches: [...new Set([...(existing.get(commit.sha) ?? []), ...onBranches])].sort(),
      html_url: commit.htmlUrl,
      synced_at: now.toISOString(),
    }));
    await store.upsertCommits(rows);

    const pullRequestLookups = await resolvePullRequests(store, gh, repo);

    await store.updateRepo(repo.id, { last_synced_at: now.toISOString(), last_sync_error: null, last_sync_commits: rows.length });
    return { repoId: repo.id, repo: label, ok: true, branches: branches.length, commits: rows.length, pullRequestLookups, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await store.updateRepo(repo.id, { last_sync_error: message });
    return { repoId: repo.id, repo: label, ok: false, branches: 0, commits: 0, pullRequestLookups: 0, error: message };
  }
}

/**
 * Pour les commits sans auteur GitHub identifiable (ex. « Claude <noreply@anthropic.com> »),
 * retrouve la PR d'origine et son auteur. Les autres commits sont simplement marqués vérifiés.
 */
async function resolvePullRequests(store: Store, gh: GitHubApi, repo: RepoRow): Promise<number> {
  const pending = await store.pendingPullRequestChecks(repo.id, 500);
  const lookupNeeded = (c: { author_login: string | null; author_email: string | null }) =>
    needsPullRequestLookup({ authorLogin: c.author_login, authorEmail: c.author_email });

  const trivial = pending.filter((c) => !lookupNeeded(c)).map((c) => c.sha);
  await store.markPullRequestChecked(repo.id, trivial);

  const toLookup = pending.filter((c) => lookupNeeded(c)).slice(0, MAX_PR_LOOKUPS);
  let lookups = 0;
  for (const commit of toLookup) {
    let pulls: GhPull[] = [];
    try {
      pulls = await gh.pullsForCommit(repo.owner, repo.name, commit.sha);
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) pulls = [];
      else throw err;
    }
    lookups += 1;
    const chosen = pulls.find((p) => p.mergedAt) ?? [...pulls].sort((a, b) => a.number - b.number)[0] ?? null;
    await store.markPullRequestChecked(repo.id, [commit.sha], { number: chosen?.number ?? null, authorLogin: chosen?.authorLogin ?? null });
  }
  return lookups;
}
