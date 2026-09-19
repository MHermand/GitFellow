/**
 * Client minimal de l'API REST GitHub (fetch natif, pas de dépendance).
 * Token attendu : fine-grained PAT en lecture seule (Contents, Metadata, Pull requests) sur les repos suivis.
 */
const API = "https://api.github.com";

export class GitHubError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
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
        "User-Agent": "cra-dashboard",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let message = `GitHub a répondu ${res.status} sur ${path}`;
      if (res.status === 404) {
        message += " : dépôt introuvable ou token sans accès à ce dépôt";
      } else if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
        const reset = res.headers.get("x-ratelimit-reset");
        const at = reset ? new Date(Number(reset) * 1000).toISOString() : "?";
        message += ` : quota de l'API épuisé, réinitialisation à ${at}`;
      } else if (body) {
        message += ` : ${body.slice(0, 200)}`;
      }
      throw new GitHubError(message, res.status);
    }

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
}
