/**
 * Dépôts accessibles au compte connecté, gardés en mémoire dix minutes : l'assistant et les
 * paramètres les listent sans interroger GitHub à chaque rendu.
 */
import { githubConnection } from "./config";
import type { GhRepo } from "./github";
import { githubClient } from "./github-client";

const TTL = 10 * 60_000;

interface Cached {
  token: string;
  at: number;
  repos: GhRepo[];
}

const registry = globalThis as typeof globalThis & { __gitfellowRepos?: Cached };

export async function accessibleRepos(force = false): Promise<GhRepo[]> {
  const connection = githubConnection();
  if (!connection) return [];
  const cached = registry.__gitfellowRepos;
  if (!force && cached && cached.token === connection.token && Date.now() - cached.at < TTL) return cached.repos;
  const repos = await (await githubClient(connection.token)).listRepos();
  registry.__gitfellowRepos = { token: connection.token, at: Date.now(), repos };
  return repos;
}

export function forgetRepos(): void {
  registry.__gitfellowRepos = undefined;
}
