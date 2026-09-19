/**
 * Singletons du processus serveur : le store (un fichier SQLite ouvert une fois, y compris à
 * travers les rechargements du mode développement) et ce qui en découle.
 */
import { databasePath, githubConnection, systemTimezone } from "./config";
import { SqliteStore, type Store } from "./store";

const registry = globalThis as typeof globalThis & { __gitfellowStore?: Store };

export function getStore(): Store {
  if (!registry.__gitfellowStore) {
    registry.__gitfellowStore = new SqliteStore(databasePath(), { timezone: systemTimezone() });
  }
  return registry.__gitfellowStore;
}

/** Remplace le store (tests, aperçus) ; `null` rouvre le fichier par défaut au prochain appel. */
export function setStore(store: Store | null): void {
  registry.__gitfellowStore = store ?? undefined;
}

/** L'installation est prête quand GitHub est connecté et qu'au moins un dépôt est suivi. */
export async function isConfigured(): Promise<boolean> {
  if (!githubConnection()) return false;
  return (await getStore().repos()).length > 0;
}
