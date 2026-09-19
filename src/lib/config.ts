/**
 * Dossier de données de l'installation (`~/.gitfellow`, ou GITFELLOW_HOME) et fichier de
 * configuration : la connexion GitHub y vit, hors de la base, en lecture réservée à l'utilisateur.
 */
import type * as FsModule from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Chargé hors de l'analyse statique du bundler : un accès disque à chemin variable lui ferait
// embarquer tout le projet dans la sortie autonome.
const fs = process.getBuiltinModule("node:fs") as typeof FsModule;

export interface GitHubConnection {
  token: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  method: "device" | "token";
  connectedAt: string;
}

export interface AppConfig {
  github: GitHubConnection | null;
}

const EMPTY: AppConfig = { github: null };

export function dataDir(): string {
  const dir = process.env.GITFELLOW_HOME?.trim() || join(homedir(), ".gitfellow");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function databasePath(): string {
  return join(dataDir(), "gitfellow.db");
}

function configPath(): string {
  return join(dataDir(), "config.json");
}

export function readConfig(): AppConfig {
  const path = configPath();
  if (!fs.existsSync(path)) return { ...EMPTY };
  try {
    const parsed = JSON.parse(fs.readFileSync(path, "utf8")) as Partial<AppConfig>;
    const gh = parsed.github;
    const github: GitHubConnection | null =
      gh && typeof gh.token === "string" && gh.token && typeof gh.login === "string"
        ? {
            token: gh.token,
            login: gh.login,
            name: typeof gh.name === "string" ? gh.name : null,
            avatarUrl: typeof gh.avatarUrl === "string" ? gh.avatarUrl : null,
            method: gh.method === "device" ? "device" : "token",
            connectedAt: typeof gh.connectedAt === "string" ? gh.connectedAt : new Date(0).toISOString(),
          }
        : null;
    return { github };
  } catch {
    return { ...EMPTY };
  }
}

export function writeConfig(patch: Partial<AppConfig>): AppConfig {
  const next = { ...readConfig(), ...patch };
  const path = configPath();
  fs.writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  // Le fichier existait peut-être déjà avec d'autres droits : on les resserre à chaque écriture.
  try {
    fs.chmodSync(path, 0o600);
  } catch {
    // Système de fichiers sans droits POSIX (Windows) : rien à resserrer.
  }
  return next;
}

export function githubConnection(): GitHubConnection | null {
  return readConfig().github;
}

/** Fuseau de la machine, repli UTC si l'environnement n'en donne pas. */
export function systemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
