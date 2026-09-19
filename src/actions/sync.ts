"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fill, type Messages } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { githubConnection } from "@/lib/config";
import { describeError, GitHubClient } from "@/lib/github";
import { getStore } from "@/lib/runtime";
import { syncAllRepos, syncRepo, type SyncRepoResult } from "@/lib/sync";

function refresh() {
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/contributors/[id]", "page");
}

/** Résumé lisible d'une synchronisation, affiché dans les paramètres. */
export async function summarizeSync(results: SyncRepoResult[], m: Messages): Promise<string> {
  if (results.length === 0) return m.sync.none;
  return results
    .map((r) =>
      r.ok
        ? fill(m.sync.ok, { repo: r.repo, commits: r.commits, branches: r.branches })
        : fill(m.sync.failed, { repo: r.repo, error: r.error ?? "" }),
    )
    .join(" · ");
}

function client(m: Messages): GitHubClient {
  const connection = githubConnection();
  if (!connection) throw new Error(m.sync.notConnected);
  return new GitHubClient(connection.token);
}

async function finish(results: SyncRepoResult[], failure: string | null, m: Messages): Promise<never> {
  refresh();
  const message = failure ?? (await summarizeSync(results, m));
  const kind = failure || results.some((r) => !r.ok) ? "error" : "success";
  redirect(`/settings?kind=${kind}&msg=${encodeURIComponent(message)}`);
}

export async function runSync() {
  const { m } = await getI18n();
  let results: SyncRepoResult[] = [];
  let failure: string | null = null;
  try {
    results = await syncAllRepos(getStore(), client(m), { describe: (err) => describeError(err, m) });
  } catch (err) {
    failure = describeError(err, m);
  }
  await finish(results, failure, m);
}

/** Synchronise un seul dépôt, depuis sa ligne dans les paramètres. */
export async function runSyncOne(id: string) {
  const { m } = await getI18n();
  const store = getStore();
  const repo = await store.repo(id);
  if (!repo) redirect(`/settings?kind=error&msg=${encodeURIComponent(m.sync.repoNotFound)}`);

  let results: SyncRepoResult[] = [];
  let failure: string | null = null;
  try {
    results = [await syncRepo(store, client(m), repo, { describe: (err) => describeError(err, m) })];
  } catch (err) {
    failure = describeError(err, m);
  }
  await finish(results, failure, m);
}
