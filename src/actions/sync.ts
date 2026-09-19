"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fill, type Messages } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { describeError } from "@/lib/github";
import { connectedClient } from "@/lib/github-client";
import { getStore } from "@/lib/runtime";
import { syncRepo, type SyncRepoResult } from "@/lib/sync";
import { runSyncAll } from "@/lib/sync-runner";

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

async function client(m: Messages) {
  const gh = await connectedClient();
  if (!gh) throw new Error(m.sync.notConnected);
  return gh;
}

async function finish(results: SyncRepoResult[], failure: string | null, m: Messages): Promise<never> {
  refresh();
  const message = failure ?? (await summarizeSync(results, m));
  const kind = failure || results.some((r) => !r.ok) ? "error" : "success";
  redirect(`/settings?kind=${kind}&msg=${encodeURIComponent(message)}`);
}

/** Chemin local sûr pour un retour : une URL absolue ou protocolaire renverrait ailleurs. */
function localPath(value: FormDataEntryValue | null): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/settings";
}

/** Synchronisation depuis la barre d'outils : on revient sur la page de départ, l'échec en bandeau. */
export async function runSync(formData: FormData) {
  const { m } = await getI18n();
  const back = localPath(formData.get("back"));
  let failure: string | null = null;
  let results: SyncRepoResult[] = [];
  try {
    // Une synchronisation déjà en cours (planificateur, assistant) est rejointe, pas doublée.
    results = await runSyncAll({ describe: (err) => describeError(err, m) });
  } catch (err) {
    failure = describeError(err, m);
  }
  refresh();
  const failed = results.filter((r) => !r.ok);
  const message = failure ?? (failed.length > 0 ? await summarizeSync(failed, m) : null);
  if (!message) redirect(back);
  redirect(`${back}${back.includes("?") ? "&" : "?"}kind=error&msg=${encodeURIComponent(message)}`);
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
    results = [await syncRepo(store, await client(m), repo, { describe: (err) => describeError(err, m) })];
  } catch (err) {
    failure = describeError(err, m);
  }
  await finish(results, failure, m);
}
