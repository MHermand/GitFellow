/**
 * Identifiant public de l'OAuth App GitHub qui porte la connexion « Se connecter avec GitHub »
 * (device flow). Il n'est pas secret. Vide, l'assistant ne propose que le jeton personnel.
 *
 * À créer une fois sur github.com/settings/developers → OAuth Apps → New OAuth App, en cochant
 * « Enable Device Flow » ; l'URL de callback n'est pas utilisée (mettre http://127.0.0.1).
 */
const BUILT_IN_CLIENT_ID = "";

export function githubClientId(): string {
  return process.env.GITFELLOW_GITHUB_CLIENT_ID?.trim() || BUILT_IN_CLIENT_ID;
}
