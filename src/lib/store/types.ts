/**
 * Contrat de stockage de GitFellow. Une seule implémentation aujourd'hui (SQLite, en local) ;
 * le contrat est asynchrone pour qu'une base distante puisse un jour prendre la même place.
 * Les lignes gardent les noms de colonnes en snake_case, comme le schéma.
 */
import type { IdentityCount } from "../attribution";

export type Locale = "fr" | "en";

export interface SettingsRow {
  id: 1;
  pre_minutes: number;
  gap_minutes: number;
  post_minutes: number;
  /** Fuseau des calculs : celui de la machine à la première ouverture. */
  timezone: string;
  /** Langue choisie ; null tant que l'utilisateur n'a rien fixé (celle du navigateur s'applique). */
  locale: Locale | null;
  /** Minutes entre deux synchronisations automatiques tant que l'application est ouverte. */
  sync_interval_minutes: number;
  updated_at: string;
}

export type SettingsPatch = Partial<Omit<SettingsRow, "id" | "updated_at">>;

export interface RepoRow {
  id: string;
  owner: string;
  name: string;
  enabled: boolean;
  /** "YYYY-MM-DD" ; null = suivi depuis toujours. */
  tracked_since: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  last_sync_commits: number | null;
  created_at: string;
}

export type RepoPatch = Partial<Pick<RepoRow, "enabled" | "tracked_since" | "last_synced_at" | "last_sync_error" | "last_sync_commits">>;

export interface ContributorDbRow {
  id: string;
  display_name: string;
  github_logins: string[];
  author_emails: string[];
  author_names: string[];
  target_hours: number;
  target_unit: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type ContributorValues = Pick<
  ContributorDbRow,
  "display_name" | "github_logins" | "author_emails" | "author_names" | "target_hours" | "target_unit"
> & { active?: boolean };

export interface CommitInsert {
  repo_id: string;
  sha: string;
  author_name: string | null;
  author_email: string | null;
  author_login: string | null;
  committer_name: string | null;
  committer_email: string | null;
  authored_at: string;
  committed_at: string;
  message: string | null;
  is_merge: boolean;
  parents_count: number;
  branches: string[];
  html_url: string | null;
  synced_at: string;
}

/** Colonnes lues par les pages. */
export interface CommitSelect {
  repo_id: string;
  sha: string;
  author_name: string | null;
  author_email: string | null;
  author_login: string | null;
  pr_author_login: string | null;
  authored_at: string;
  message: string | null;
  is_merge: boolean;
  html_url: string | null;
}

export interface PendingCommit {
  sha: string;
  author_login: string | null;
  author_email: string | null;
}

export class DuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateError";
  }
}

export interface Store {
  settings(): Promise<SettingsRow>;
  updateSettings(patch: SettingsPatch): Promise<SettingsRow>;

  repos(): Promise<RepoRow[]>;
  repo(id: string): Promise<RepoRow | null>;
  /** Lève DuplicateError si owner/name est déjà suivi. */
  addRepo(values: { owner: string; name: string; tracked_since: string | null }): Promise<RepoRow>;
  updateRepo(id: string, patch: RepoPatch): Promise<void>;
  /** Supprime le dépôt et ses commits. */
  deleteRepo(id: string): Promise<void>;

  contributors(): Promise<ContributorDbRow[]>;
  contributor(id: string): Promise<ContributorDbRow | null>;
  insertContributor(values: ContributorValues): Promise<ContributorDbRow>;
  updateContributor(id: string, values: ContributorValues): Promise<void>;
  deleteContributor(id: string): Promise<void>;

  /** Insère ou remplace les commits (clé repo_id + sha) sans toucher à l'état « PR vérifiée ». */
  upsertCommits(rows: CommitInsert[]): Promise<void>;
  /** Branches déjà connues des commits donnés. */
  commitBranches(repoId: string, shas: string[]): Promise<Map<string, string[]>>;
  /** Commits authored entre `from` (inclus) et `to` (exclu), du plus ancien au plus récent. */
  commitsBetween(from: Date, to: Date): Promise<CommitSelect[]>;
  /** Nombre de commits d'un dépôt. */
  countCommits(repoId?: string): Promise<number>;
  pendingPullRequestChecks(repoId: string, limit: number): Promise<PendingCommit[]>;
  markPullRequestChecked(
    repoId: string,
    shas: string[],
    pr?: { number: number | null; authorLogin: string | null },
  ): Promise<void>;

  /**
   * Identités vues dans les dépôts suivis, depuis leur date de début de suivi, avec leur nombre
   * de commits et la date du dernier. `floors` donne, par dépôt, l'instant avant lequel on ignore.
   */
  identitySummary(floors: Map<string, Date>): Promise<IdentityCount[]>;

  close(): void;
}
