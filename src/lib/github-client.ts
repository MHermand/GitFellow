/**
 * Fabrique du client GitHub : le vrai avec le token de la connexion, ou la simulation
 * (GITFELLOW_FAKE_GITHUB=1) pour les captures et les essais sans compte.
 */
import { githubConnection } from "./config";
import { GitHubClient, type GhRepo, type GhViewer } from "./github";
import type { GitHubApi } from "./sync";

export interface GitHubService extends GitHubApi {
  viewer(): Promise<GhViewer>;
  listRepos(): Promise<GhRepo[]>;
}

export function isFakeGitHub(): boolean {
  return process.env.GITFELLOW_FAKE_GITHUB === "1";
}

const registry = globalThis as typeof globalThis & { __gitfellowFakeGitHub?: GitHubService };

export async function githubClient(token: string): Promise<GitHubService> {
  if (isFakeGitHub()) {
    if (!registry.__gitfellowFakeGitHub) {
      const { FakeGitHub } = await import("./github-fake");
      registry.__gitfellowFakeGitHub = new FakeGitHub();
    }
    return registry.__gitfellowFakeGitHub;
  }
  return new GitHubClient(token);
}

/** Client de la connexion enregistrée, ou null si GitHub n'est pas connecté. */
export async function connectedClient(): Promise<GitHubService | null> {
  const connection = githubConnection();
  return connection ? githubClient(connection.token) : null;
}
