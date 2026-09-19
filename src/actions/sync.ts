"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { githubConnection } from "@/lib/config";
import { GitHubClient } from "@/lib/github";
import { getStore } from "@/lib/runtime";
import { syncAllRepos, syncRepo, type SyncRepoResult } from "@/lib/sync";

function refresh() {
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/contributors/[id]", "page");
}

/** Résumé lisible d'une synchronisation, affiché dans les paramètres. */
export async function summarizeSync(results: SyncRepoResult[]): Promise<string> {
  if (results.length === 0) return "Aucun dépôt actif à synchroniser.";
  return results
    .map((r) => (r.ok ? `${r.repo} : ${r.commits} commits sur ${r.branches} branches` : `${r.repo} : échec — ${r.error}`))
    .join(" · ");
}

function client(): GitHubClient {
  const connection = githubConnection();
  if (!connection) throw new Error("GitHub n'est pas connecté.");
  return new GitHubClient(connection.token);
}

export async function runSync() {
  let results: SyncRepoResult[];
  let failure: string | null = null;
  try {
    results = await syncAllRepos(getStore(), client());
  } catch (err) {
    results = [];
    failure = err instanceof Error ? err.message : String(err);
  }

  refresh();

  const message = failure ?? (await summarizeSync(results));
  const kind = failure || results.some((r) => !r.ok) ? "error" : "success";
  redirect(`/settings?kind=${kind}&msg=${encodeURIComponent(message)}`);
}

/** Synchronise un seul dépôt, depuis sa ligne dans les paramètres. */
export async function runSyncOne(id: string) {
  const store = getStore();
  const repo = await store.repo(id);
  if (!repo) redirect(`/settings?kind=error&msg=${encodeURIComponent("Dépôt introuvable.")}`);

  let results: SyncRepoResult[];
  let failure: string | null = null;
  try {
    results = [await syncRepo(store, client(), repo)];
  } catch (err) {
    results = [];
    failure = err instanceof Error ? err.message : String(err);
  }

  refresh();

  const message = failure ?? (await summarizeSync(results));
  const kind = failure || results.some((r) => !r.ok) ? "error" : "success";
  redirect(`/settings?kind=${kind}&msg=${encodeURIComponent(message)}`);
}
