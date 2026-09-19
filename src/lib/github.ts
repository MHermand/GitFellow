/**
 * Client minimal de l'API REST GitHub (fetch natif, pas de dépendance).
 * Token attendu : celui de la connexion par GitHub (device flow), ou un jeton personnel en lecture
 * (Contents, Metadata, Pull requests) sur les dépôts suivis.
 */
import { fill, type Messages } from "@/i18n";

const API = "https://api.github.com";
const USER_AGENT = "gitfellow";

export type GitHubErrorKind = "not_found" | "rate_limited" | "unauthorized" | "http";

/** Réponse en erreur de GitHub : de quoi la décrire dans la langue de l'utilisateur. */
export class GitHubError extends Error {
  readonly status: number;
  readonly path: string;
  readonly kind: GitHubErrorKind;
  /** Fin du quota, pour un 403/429 de limitation. */
  readonly resetAt: string | null;
  readonly body: string;

  constructor(status: number, path: string, kind: GitHubErrorKind, resetAt: string | null, body: string) {
    super(`GitHub answered ${status} on ${path}${body ? `: ${body.slice(0, 200)}` : ""}`);
    this.name = "GitHubError";
    this.status = status;
    this.path = path;
    this.kind = kind;
    this.resetAt = resetAt;
    this.body = body;
  }
}

/** Message d'une erreur GitHub dans la langue donnée. */
export function describeGitHubError(err: GitHubError, m: Messages): string {
  const head = fill(m.github.status, { status: err.status, path: err.path });
  switch (err.kind) {
    case "not_found":
      return `${head} — ${m.github.notFound}`;
    case "rate_limited":
      return `${head} — ${fill(m.github.rateLimited, { at: err.resetAt ?? "?" })}`;
    case "unauthorized":
      return `${head} — ${m.github.unauthorized}`;
    default:
      return err.body ? `${head} — ${err.body.slice(0, 200)}` : head;
  }
}

/** Message de n'importe quelle erreur, les erreurs GitHub traduites. */
export function describeError(err: unknown, m: Messages): string {
  if (err instanceof GitHubError) return describeGitHubError(err, m);
  return err instanceof Error ? err.message : String(err);
}

export interface GhCommit {
  sha: string;
  htmlUrl: string;
  message: string;
  authorName: string | null;
  authorEmail: string | null;
  authorLogin: string | null;
  committerName: string | null;
  committerEmail: string | null;
  authoredAt: string;
  committedAt: string;
  parentsCount: number;
}

export interface GhPull {
  number: number;
  authorLogin: string | null;
  mergedAt: string | null;
}

export interface GhViewer {
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

/** Un dépôt accessible au compte connecté, tel que l'assistant le propose. */
export interface GhRepo {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  archived: boolean;
  fork: boolean;
  description: string | null;
  pushedAt: string | null;
}

interface RawRepo {
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  archived: boolean;
  fork: boolean;
  description: string | null;
  pushed_at: string | null;
}

interface RawCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string } | null;
    committer: { name: string; email: string; date: string } | null;
  };
  author: { login: string } | null;
  parents: { sha: string }[];
}

interface RawPull {
  number: number;
  user: { login: string } | null;
  merged_at: string | null;
}

export function firstLine(message: string): string {
  return message.split("\n")[0].trim().slice(0, 200);
}

function mapCommit(raw: RawCommit): GhCommit {
  return {
    sha: raw.sha,
    htmlUrl: raw.html_url,
    message: raw.commit.message ?? "",
    authorName: raw.commit.author?.name ?? null,
    authorEmail: raw.commit.author?.email ?? null,
    authorLogin: raw.author?.login ?? null,
    committerName: raw.commit.committer?.name ?? null,
    committerEmail: raw.commit.committer?.email ?? null,
    authoredAt: raw.commit.author?.date ?? raw.commit.committer?.date ?? new Date(0).toISOString(),
    committedAt: raw.commit.committer?.date ?? raw.commit.author?.date ?? new Date(0).toISOString(),
    parentsCount: raw.parents?.length ?? 0,
  };
}

async function toError(res: Response, path: string): Promise<GitHubError> {
  const body = await res.text().catch(() => "");
  const limited = (res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0";
  const reset = res.headers.get("x-ratelimit-reset");
  const kind =
    res.status === 404 ? "not_found" : limited ? "rate_limited" : res.status === 401 ? "unauthorized" : "http";
  return new GitHubError(res.status, path, kind, limited && reset ? new Date(Number(reset) * 1000).toISOString() : null, body);
}

export class GitHubClient {
  constructor(private readonly token: string) {}

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<{ data: T; hasNext: boolean }> {
    const url = new URL(API + path);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
    });

    if (!res.ok) throw await toError(res, path);

    const link = res.headers.get("link") ?? "";
    return { data: (await res.json()) as T, hasNext: /rel="next"/.test(link) };
  }

  async listBranches(owner: string, repo: string): Promise<string[]> {
    const names: string[] = [];
    for (let page = 1; ; page += 1) {
      const { data, hasNext } = await this.get<{ name: string }[]>(`/repos/${owner}/${repo}/branches`, {
        per_page: "100",
        page: String(page),
      });
      names.push(...data.map((b) => b.name));
      if (!hasNext) break;
    }
    return names;
  }

  /** Pages de commits d'une branche (100 par page), les plus récents d'abord. */
  async *iterCommits(
    owner: string,
    repo: string,
    options: { sha: string; since?: string; until?: string },
  ): AsyncGenerator<GhCommit[]> {
    for (let page = 1; ; page += 1) {
      const params: Record<string, string> = { sha: options.sha, per_page: "100", page: String(page) };
      if (options.since) params.since = options.since;
      if (options.until) params.until = options.until;
      let result: { data: RawCommit[]; hasNext: boolean };
      try {
        result = await this.get<RawCommit[]>(`/repos/${owner}/${repo}/commits`, params);
      } catch (err) {
        // 409 : dépôt vide.
        if (err instanceof GitHubError && err.status === 409) return;
        throw err;
      }
      yield result.data.map(mapCommit);
      if (!result.hasNext) break;
    }
  }

  /** Pull requests contenant ce commit. */
  async pullsForCommit(owner: string, repo: string, sha: string): Promise<GhPull[]> {
    const { data } = await this.get<RawPull[]>(`/repos/${owner}/${repo}/commits/${sha}/pulls`, { per_page: "10" });
    return data.map((p) => ({ number: p.number, authorLogin: p.user?.login ?? null, mergedAt: p.merged_at }));
  }

  /** Le compte derrière le token. */
  async viewer(): Promise<GhViewer> {
    const { data } = await this.get<{ login: string; name: string | null; avatar_url: string | null }>("/user");
    return { login: data.login, name: data.name ?? null, avatarUrl: data.avatar_url ?? null };
  }

  /** Dépôts accessibles au compte (siens, collaborations, organisations), les plus actifs d'abord. */
  async listRepos(maxPages = 5): Promise<GhRepo[]> {
    const out: GhRepo[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const { data, hasNext } = await this.get<RawRepo[]>("/user/repos", {
        affiliation: "owner,collaborator,organization_member",
        sort: "pushed",
        direction: "desc",
        per_page: "100",
        page: String(page),
      });
      out.push(
        ...data.map((r) => ({
          owner: r.owner.login,
          name: r.name,
          fullName: r.full_name,
          private: r.private,
          archived: r.archived,
          fork: r.fork,
          description: r.description,
          pushedAt: r.pushed_at,
        })),
      );
      if (!hasNext) break;
    }
    return out;
  }
}

// ---- Connexion par GitHub (device flow) : l'utilisateur saisit un code sur github.com, aucun secret côté application.

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  /** Secondes de validité du code. */
  expiresIn: number;
  /** Secondes minimales entre deux interrogations. */
  interval: number;
}

export type DevicePoll =
  | { status: "pending" | "slow_down" | "expired" | "denied" }
  | { status: "done"; token: string }
  | { status: "error"; message: string };

const OAUTH = "https://github.com/login";

async function postForm<T>(url: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });
  if (!res.ok) throw new GitHubError(res.status, url, "http", null, await res.text().catch(() => ""));
  return (await res.json()) as T;
}

export async function requestDeviceCode(clientId: string, scope = "repo"): Promise<DeviceCode> {
  const data = await postForm<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  }>(`${OAUTH}/device/code`, { client_id: clientId, scope });
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval,
  };
}

export async function pollDeviceToken(clientId: string, deviceCode: string): Promise<DevicePoll> {
  const data = await postForm<{ access_token?: string; error?: string; error_description?: string }>(
    `${OAUTH}/oauth/access_token`,
    { client_id: clientId, device_code: deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code" },
  );
  if (data.access_token) return { status: "done", token: data.access_token };
  switch (data.error) {
    case "authorization_pending":
      return { status: "pending" };
    case "slow_down":
      return { status: "slow_down" };
    case "expired_token":
      return { status: "expired" };
    case "access_denied":
      return { status: "denied" };
    default:
      return { status: "error", message: data.error_description ?? data.error ?? "unknown" };
  }
}
