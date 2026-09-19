/**
 * Connexion GitHub : vérifie un token auprès de GitHub et l'enregistre avec le compte qu'il ouvre.
 */
import { writeConfig, type GitHubConnection } from "./config";
import { githubClient } from "./github-client";

export async function saveConnection(token: string, method: GitHubConnection["method"]): Promise<GitHubConnection> {
  const viewer = await (await githubClient(token)).viewer();
  const connection: GitHubConnection = {
    token,
    login: viewer.login,
    name: viewer.name,
    avatarUrl: viewer.avatarUrl,
    method,
    connectedAt: new Date().toISOString(),
  };
  writeConfig({ github: connection });
  return connection;
}

export function forgetConnection(): void {
  writeConfig({ github: null });
}
