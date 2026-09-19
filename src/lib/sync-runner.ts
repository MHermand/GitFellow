/**
 * Synchronisation en tâche de fond : une seule à la fois, avec sa progression lisible par l'interface,
 * relancée à intervalle régulier tant que l'application tourne. Les commits ne disparaissent pas de
 * GitHub : ce qui n'a pas été lu pendant que l'application était fermée l'est à l'ouverture suivante.
 */
import { connectedClient } from "./github-client";
import { getStore, isConfigured } from "./runtime";
import { syncAllRepos, type SyncRepoResult } from "./sync";

export interface SyncProgress {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  total: number;
  done: number;
  /** "owner/name" en cours de lecture. */
  current: string | null;
  results: SyncRepoResult[];
  /** Échec global (GitHub non connecté, par exemple), hors erreurs par dépôt. */
  error: string | null;
}

interface Runner {
  progress: SyncProgress;
  pending: Promise<SyncRepoResult[]> | null;
  timer: NodeJS.Timeout | null;
}

const registry = globalThis as typeof globalThis & { __gitfellowSync?: Runner };

function runner(): Runner {
  if (!registry.__gitfellowSync) {
    registry.__gitfellowSync = {
      progress: { running: false, startedAt: null, finishedAt: null, total: 0, done: 0, current: null, results: [], error: null },
      pending: null,
      timer: null,
    };
  }
  return registry.__gitfellowSync;
}

export function syncProgress(): SyncProgress {
  return { ...runner().progress, results: [...runner().progress.results] };
}

export interface RunOptions {
  /** Texte d'une erreur, dans la langue de l'utilisateur. */
  describe?: (err: unknown) => string;
}

/**
 * Lance une synchronisation complète si aucune n'est en cours, et renvoie la promesse de celle qui
 * tourne : plusieurs demandes simultanées (bouton, assistant, planificateur) partagent la même.
 */
export function runSyncAll(options: RunOptions = {}): Promise<SyncRepoResult[]> {
  const r = runner();
  if (r.pending) return r.pending;

  const describe = options.describe ?? ((err: unknown) => (err instanceof Error ? err.message : String(err)));
  r.progress = { running: true, startedAt: new Date().toISOString(), finishedAt: null, total: 0, done: 0, current: null, results: [], error: null };

  r.pending = (async () => {
    try {
      const gh = await connectedClient();
      if (!gh) throw new Error("not_connected");
      const results = await syncAllRepos(getStore(), gh, {
        describe,
        onRepo: (repo, index, total) => {
          r.progress.total = total;
          r.progress.done = index;
          r.progress.current = `${repo.owner}/${repo.name}`;
        },
      });
      r.progress.results = results;
      r.progress.done = r.progress.total;
      return results;
    } catch (err) {
      r.progress.error = describe(err);
      return [];
    } finally {
      r.progress.running = false;
      r.progress.current = null;
      r.progress.finishedAt = new Date().toISOString();
      r.pending = null;
    }
  })();
  return r.pending;
}

const MINUTE = 60_000;
/** Délai avant la première synchronisation après le démarrage : le temps d'ouvrir le navigateur. */
const FIRST_DELAY = 8_000;

/**
 * Planifie les synchronisations automatiques : une au démarrage, puis toutes les
 * `sync_interval_minutes`. Sans effet si déjà planifié ; ne retient pas le processus.
 */
export function ensureScheduler(): void {
  const r = runner();
  if (r.timer) return;

  const tick = async () => {
    let delay = 15 * MINUTE;
    try {
      const settings = await getStore().settings();
      delay = Math.max(5, settings.sync_interval_minutes) * MINUTE;
      if (await isConfigured()) await runSyncAll();
    } catch {
      // Le prochain tour réessaiera ; l'erreur est déjà dans la progression.
    }
    r.timer = setTimeout(tick, delay);
    r.timer.unref();
  };

  r.timer = setTimeout(tick, FIRST_DELAY);
  r.timer.unref();
}
