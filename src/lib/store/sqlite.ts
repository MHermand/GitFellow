/**
 * Store SQLite sur `node:sqlite`, le moteur livré avec Node — rien à compiler, rien à installer.
 * Un seul fichier par installation ; `:memory:` pour les tests.
 */
import { randomUUID } from "node:crypto";
import { chmodSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { IdentityCount } from "../attribution";
import { MIGRATIONS } from "./schema";
import {
  DuplicateError,
  type CommitInsert,
  type CommitSelect,
  type ContributorDbRow,
  type ContributorValues,
  type Locale,
  type PendingCommit,
  type RepoPatch,
  type RepoRow,
  type SettingsPatch,
  type SettingsRow,
  type Store,
} from "./types";

/** Nombre de paramètres liés par requête `in (…)`, sous la limite de SQLite. */
const IN_CHUNK = 500;

type Row = Record<string, unknown>;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function list(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Instant au format ISO complet, pour que les comparaisons de texte suivent l'ordre du temps. */
function iso(value: string): string {
  const time = Date.parse(value);
  return Number.isNaN(time) ? value : new Date(time).toISOString();
}

function toRepo(row: Row): RepoRow {
  return {
    id: String(row.id),
    owner: String(row.owner),
    name: String(row.name),
    enabled: row.enabled === 1,
    tracked_since: (row.tracked_since as string | null) ?? null,
    last_synced_at: (row.last_synced_at as string | null) ?? null,
    last_sync_error: (row.last_sync_error as string | null) ?? null,
    last_sync_commits: row.last_sync_commits === null ? null : Number(row.last_sync_commits),
    created_at: String(row.created_at),
  };
}

function toContributor(row: Row): ContributorDbRow {
  return {
    id: String(row.id),
    display_name: String(row.display_name),
    github_logins: list(row.github_logins),
    author_emails: list(row.author_emails),
    author_names: list(row.author_names),
    target_hours: Number(row.target_hours ?? 0),
    target_unit: String(row.target_unit ?? "week"),
    active: row.active === 1,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function toSettings(row: Row): SettingsRow {
  return {
    id: 1,
    pre_minutes: Number(row.pre_minutes),
    gap_minutes: Number(row.gap_minutes),
    post_minutes: Number(row.post_minutes),
    timezone: String(row.timezone),
    locale: row.locale === "fr" || row.locale === "en" ? (row.locale as Locale) : null,
    sync_interval_minutes: Number(row.sync_interval_minutes),
    updated_at: String(row.updated_at),
  };
}

export interface SqliteStoreOptions {
  /** Fuseau posé à la création du fichier (celui de la machine, en pratique). */
  timezone?: string;
}

export class SqliteStore implements Store {
  private readonly db: DatabaseSync;

  constructor(path: string, options: SqliteStoreOptions = {}) {
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") {
      // Le fichier vient d'être créé avec les droits par défaut : on le réserve à l'utilisateur
      // avant que le journal n'en hérite.
      try {
        chmodSync(path, 0o600);
      } catch {
        // Système de fichiers sans droits POSIX : rien à resserrer.
      }
    }
    this.db.exec("pragma journal_mode = wal");
    this.db.exec("pragma foreign_keys = on");
    this.db.exec("pragma busy_timeout = 5000");
    this.migrate();
    this.ensureSettings(options.timezone ?? "UTC");
  }

  private migrate() {
    const { user_version } = this.db.prepare("pragma user_version").get() as { user_version: number };
    for (let version = user_version; version < MIGRATIONS.length; version += 1) {
      this.transaction(() => {
        this.db.exec(MIGRATIONS[version]);
        this.db.exec(`pragma user_version = ${version + 1}`);
      });
    }
  }

  private ensureSettings(timezone: string) {
    this.db
      .prepare("insert into settings (id, timezone, updated_at) values (1, ?, ?) on conflict (id) do nothing")
      .run(timezone, new Date().toISOString());
  }

  private transaction<T>(work: () => T): T {
    this.db.exec("begin");
    try {
      const result = work();
      this.db.exec("commit");
      return result;
    } catch (err) {
      this.db.exec("rollback");
      throw err;
    }
  }

  // ---- Réglages

  async settings(): Promise<SettingsRow> {
    return toSettings(this.db.prepare("select * from settings where id = 1").get() as Row);
  }

  async updateSettings(patch: SettingsPatch): Promise<SettingsRow> {
    const keys = Object.keys(patch) as (keyof SettingsPatch)[];
    if (keys.length > 0) {
      const sets = keys.map((key) => `${key} = ?`).join(", ");
      const values = keys.map((key) => patch[key] ?? null);
      this.db.prepare(`update settings set ${sets}, updated_at = ? where id = 1`).run(...values, new Date().toISOString());
    }
    return this.settings();
  }

  // ---- Dépôts

  async repos(): Promise<RepoRow[]> {
    return (this.db.prepare("select * from repos order by created_at, owner, name").all() as Row[]).map(toRepo);
  }

  async repo(id: string): Promise<RepoRow | null> {
    const row = this.db.prepare("select * from repos where id = ?").get(id) as Row | undefined;
    return row ? toRepo(row) : null;
  }

  async addRepo(values: { owner: string; name: string; tracked_since: string | null }): Promise<RepoRow> {
    const exists = this.db
      .prepare("select id from repos where lower(owner) = lower(?) and lower(name) = lower(?)")
      .get(values.owner, values.name);
    if (exists) throw new DuplicateError(`${values.owner}/${values.name}`);
    const id = randomUUID();
    this.db
      .prepare("insert into repos (id, owner, name, tracked_since, created_at) values (?, ?, ?, ?, ?)")
      .run(id, values.owner, values.name, values.tracked_since, new Date().toISOString());
    return (await this.repo(id))!;
  }

  async updateRepo(id: string, patch: RepoPatch): Promise<void> {
    const keys = Object.keys(patch) as (keyof RepoPatch)[];
    if (keys.length === 0) return;
    const sets = keys.map((key) => `${key} = ?`).join(", ");
    const values = keys.map((key) => {
      const value = patch[key];
      return typeof value === "boolean" ? (value ? 1 : 0) : (value ?? null);
    });
    this.db.prepare(`update repos set ${sets} where id = ?`).run(...values, id);
  }

  async deleteRepo(id: string): Promise<void> {
    this.transaction(() => {
      this.db.prepare("delete from commits where repo_id = ?").run(id);
      this.db.prepare("delete from repos where id = ?").run(id);
    });
  }

  // ---- Contributeurs

  async contributors(): Promise<ContributorDbRow[]> {
    return (this.db.prepare("select * from contributors order by display_name collate nocase").all() as Row[]).map(toContributor);
  }

  async contributor(id: string): Promise<ContributorDbRow | null> {
    const row = this.db.prepare("select * from contributors where id = ?").get(id) as Row | undefined;
    return row ? toContributor(row) : null;
  }

  async insertContributor(values: ContributorValues): Promise<ContributorDbRow> {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `insert into contributors (id, display_name, github_logins, author_emails, author_names, target_hours, target_unit, active, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        values.display_name,
        JSON.stringify(values.github_logins),
        JSON.stringify(values.author_emails),
        JSON.stringify(values.author_names),
        values.target_hours,
        values.target_unit,
        values.active === false ? 0 : 1,
        now,
        now,
      );
    return (await this.contributor(id))!;
  }

  async updateContributor(id: string, values: ContributorValues): Promise<void> {
    this.db
      .prepare(
        `update contributors
            set display_name = ?, github_logins = ?, author_emails = ?, author_names = ?,
                target_hours = ?, target_unit = ?, active = coalesce(?, active), updated_at = ?
          where id = ?`,
      )
      .run(
        values.display_name,
        JSON.stringify(values.github_logins),
        JSON.stringify(values.author_emails),
        JSON.stringify(values.author_names),
        values.target_hours,
        values.target_unit,
        values.active === undefined ? null : values.active ? 1 : 0,
        new Date().toISOString(),
        id,
      );
  }

  async deleteContributor(id: string): Promise<void> {
    this.db.prepare("delete from contributors where id = ?").run(id);
  }

  // ---- Commits

  async upsertCommits(rows: CommitInsert[]): Promise<void> {
    if (rows.length === 0) return;
    const stmt = this.db.prepare(
      `insert into commits (repo_id, sha, author_name, author_email, author_login, committer_name, committer_email,
                            authored_at, committed_at, message, is_merge, parents_count, branches, html_url, synced_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (repo_id, sha) do update set
         author_name = excluded.author_name, author_email = excluded.author_email, author_login = excluded.author_login,
         committer_name = excluded.committer_name, committer_email = excluded.committer_email,
         authored_at = excluded.authored_at, committed_at = excluded.committed_at, message = excluded.message,
         is_merge = excluded.is_merge, parents_count = excluded.parents_count, branches = excluded.branches,
         html_url = excluded.html_url, synced_at = excluded.synced_at`,
    );
    this.transaction(() => {
      for (const row of rows) {
        stmt.run(
          row.repo_id,
          row.sha,
          row.author_name,
          row.author_email,
          row.author_login,
          row.committer_name,
          row.committer_email,
          iso(row.authored_at),
          iso(row.committed_at),
          row.message,
          row.is_merge ? 1 : 0,
          row.parents_count,
          JSON.stringify(row.branches),
          row.html_url,
          iso(row.synced_at),
        );
      }
    });
  }

  async commitBranches(repoId: string, shas: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    for (const chunk of chunks(shas, IN_CHUNK)) {
      const marks = chunk.map(() => "?").join(", ");
      const rows = this.db
        .prepare(`select sha, branches from commits where repo_id = ? and sha in (${marks})`)
        .all(repoId, ...chunk) as Row[];
      for (const row of rows) map.set(String(row.sha), list(row.branches));
    }
    return map;
  }

  async commitsBetween(from: Date, to: Date): Promise<CommitSelect[]> {
    const rows = this.db
      .prepare(
        `select repo_id, sha, author_name, author_email, author_login, pr_author_login, authored_at, message, is_merge, html_url
           from commits
          where authored_at >= ? and authored_at < ?
          order by authored_at, sha`,
      )
      .all(from.toISOString(), to.toISOString()) as Row[];
    return rows.map((row) => ({
      repo_id: String(row.repo_id),
      sha: String(row.sha),
      author_name: (row.author_name as string | null) ?? null,
      author_email: (row.author_email as string | null) ?? null,
      author_login: (row.author_login as string | null) ?? null,
      pr_author_login: (row.pr_author_login as string | null) ?? null,
      authored_at: String(row.authored_at),
      message: (row.message as string | null) ?? null,
      is_merge: row.is_merge === 1,
      html_url: (row.html_url as string | null) ?? null,
    }));
  }

  async countCommits(repoId?: string): Promise<number> {
    const row = repoId
      ? (this.db.prepare("select count(*) as n from commits where repo_id = ?").get(repoId) as Row)
      : (this.db.prepare("select count(*) as n from commits").get() as Row);
    return Number(row.n);
  }

  async pendingPullRequestChecks(repoId: string, limit: number): Promise<PendingCommit[]> {
    const rows = this.db
      .prepare(
        `select sha, author_login, author_email from commits
          where repo_id = ? and pr_checked = 0
          order by authored_at desc limit ?`,
      )
      .all(repoId, limit) as Row[];
    return rows.map((row) => ({
      sha: String(row.sha),
      author_login: (row.author_login as string | null) ?? null,
      author_email: (row.author_email as string | null) ?? null,
    }));
  }

  async markPullRequestChecked(
    repoId: string,
    shas: string[],
    pr?: { number: number | null; authorLogin: string | null },
  ): Promise<void> {
    for (const chunk of chunks(shas, IN_CHUNK)) {
      const marks = chunk.map(() => "?").join(", ");
      if (pr) {
        this.db
          .prepare(`update commits set pr_checked = 1, pr_number = ?, pr_author_login = ? where repo_id = ? and sha in (${marks})`)
          .run(pr.number, pr.authorLogin, repoId, ...chunk);
      } else {
        this.db.prepare(`update commits set pr_checked = 1 where repo_id = ? and sha in (${marks})`).run(repoId, ...chunk);
      }
    }
  }

  // ---- Identités

  async identitySummary(floors: Map<string, Date>): Promise<IdentityCount[]> {
    const repos = (await this.repos()).filter((r) => r.enabled);
    const merged = new Map<string, IdentityCount>();
    const stmt = this.db.prepare(
      `select author_name, author_email, author_login, pr_author_login, count(*) as n, max(authored_at) as last_at
         from commits
        where repo_id = ? and authored_at >= ?
        group by author_name, author_email, author_login, pr_author_login`,
    );
    for (const repo of repos) {
      const floor = floors.get(repo.id)?.toISOString() ?? "";
      for (const row of stmt.all(repo.id, floor) as Row[]) {
        const identity: IdentityCount = {
          authorName: (row.author_name as string | null) ?? null,
          authorEmail: (row.author_email as string | null) ?? null,
          authorLogin: (row.author_login as string | null) ?? null,
          prAuthorLogin: (row.pr_author_login as string | null) ?? null,
          count: Number(row.n),
          lastAt: (row.last_at as string | null) ?? null,
        };
        const key = [identity.authorName, identity.authorEmail, identity.authorLogin, identity.prAuthorLogin]
          .map((v) => v ?? "")
          .join("|");
        const entry = merged.get(key);
        if (!entry) {
          merged.set(key, identity);
        } else {
          entry.count += identity.count;
          if (identity.lastAt && (!entry.lastAt || identity.lastAt > entry.lastAt)) entry.lastAt = identity.lastAt;
        }
      }
    }
    return [...merged.values()].sort((a, b) => b.count - a.count);
  }

  close(): void {
    this.db.close();
  }
}
