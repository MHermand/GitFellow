/**
 * GitHub simulé pour les captures d'écran, les essais et les tests de l'assistant
 * (GITFELLOW_FAKE_GITHUB=1) : trois dépôts, quatre auteurs, huit semaines de commits vraisemblables,
 * toujours les mêmes d'un lancement à l'autre.
 */
import type { GhCommit, GhPull, GhRepo, GhViewer } from "./github";
import type { GitHubService } from "./github-client";

const DAY = 86_400_000;
const MINUTE = 60_000;

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sha(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    h1 = Math.imul(h1 ^ input.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ input.charCodeAt(i), 0x811c9dc5) >>> 0;
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).repeat(3).slice(0, 40);
}

interface Author {
  login: string | null;
  name: string;
  email: string;
  /** Jours de la semaine travaillés (lundi = 0). */
  days: number[];
  /** Probabilité de travailler un jour donné, et sessions typiques. */
  presence: number;
  starts: number[];
  /** Dépôts favoris, par index. */
  repos: number[];
  /** Auteur d'agent : commits signés d'une adresse générique, rattachés par la PR. */
  viaPullRequestOf?: string;
}

const AUTHORS: Author[] = [
  { login: "alice-dev", name: "Alice Martin", email: "alice@acme.example", days: [0, 1, 2, 3, 4], presence: 0.85, starts: [9, 14], repos: [0, 1] },
  { login: "bob-k", name: "Bob Keller", email: "bob@acme.example", days: [0, 1, 3, 4], presence: 0.7, starts: [10, 15, 21], repos: [1, 2] },
  { login: "chloe", name: "Chloé Durand", email: "chloe@acme.example", days: [1, 2, 3], presence: 0.9, starts: [9, 13], repos: [0, 2] },
  { login: null, name: "Claude", email: "noreply@anthropic.com", days: [0, 2, 4], presence: 0.4, starts: [11, 16], repos: [0], viaPullRequestOf: "alice-dev" },
];

const REPOS: GhRepo[] = [
  { owner: "acme", name: "web-app", fullName: "acme/web-app", private: true, archived: false, fork: false, description: "Customer-facing web application", pushedAt: null },
  { owner: "acme", name: "api", fullName: "acme/api", private: true, archived: false, fork: false, description: "Public API and workers", pushedAt: null },
  { owner: "acme", name: "mobile", fullName: "acme/mobile", private: false, archived: false, fork: false, description: "iOS and Android apps", pushedAt: null },
  { owner: "acme", name: "design-system", fullName: "acme/design-system", private: false, archived: true, fork: false, description: "Archived: components moved to web-app", pushedAt: null },
  { owner: "alice-dev", name: "dotfiles", fullName: "alice-dev/dotfiles", private: false, archived: false, fork: false, description: null, pushedAt: null },
];

const MESSAGES = [
  "Fix flaky checkout test", "Add invoice export", "Refactor session store", "Bump dependencies", "Improve empty state copy",
  "Handle timezone edge case", "Add retry to webhook client", "Polish onboarding screens", "Migrate settings to new schema",
  "Speed up dashboard query", "Fix typo in README", "Add contributor filters", "Tighten CSP headers", "Remove dead code",
  "Support monthly targets", "Cache repository list", "Fix overlapping blocks in week view", "Add French translation",
];

interface FakeCommit extends GhCommit {
  branch: string;
  repo: string;
  prNumber: number | null;
  prAuthor: string | null;
}

function generate(now: Date): FakeCommit[] {
  const out: FakeCommit[] = [];
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  let prCounter = 100;

  AUTHORS.forEach((author, ai) => {
    const rand = prng(1000 + ai);
    for (let back = 63; back >= 0; back -= 1) {
      const day = new Date(today.getTime() - back * DAY);
      const weekday = (day.getUTCDay() + 6) % 7;
      if (!author.days.includes(weekday) || rand() > author.presence) continue;
      const sessions = rand() < 0.35 ? 2 : 1;
      for (let si = 0; si < sessions; si += 1) {
        const startHour = author.starts[Math.min(author.starts.length - 1, si + (rand() < 0.5 ? 0 : 1))];
        // Heure locale Paris ≈ UTC+2 en septembre : on décale pour que les blocs tombent en journée.
        let at = day.getTime() + (startHour - 2) * 60 * MINUTE + Math.floor(rand() * 40) * MINUTE;
        const count = 2 + Math.floor(rand() * 6);
        const repoIndex = author.repos[Math.floor(rand() * author.repos.length)];
        const repo = REPOS[repoIndex].fullName;
        const branch = rand() < 0.3 ? `feat/${MESSAGES[Math.floor(rand() * MESSAGES.length)].toLowerCase().replace(/[^a-z]+/g, "-").slice(0, 18)}` : "main";
        const pr = author.viaPullRequestOf ? { number: prCounter++, author: author.viaPullRequestOf } : null;
        for (let ci = 0; ci < count; ci += 1) {
          at += (5 + Math.floor(rand() * 65)) * MINUTE;
          const iso = new Date(at).toISOString();
          const id = sha(`${repo}|${author.name}|${iso}`);
          out.push({
            sha: id,
            htmlUrl: `https://github.com/${repo}/commit/${id}`,
            message: MESSAGES[Math.floor(rand() * MESSAGES.length)],
            authorName: author.name,
            authorEmail: author.email,
            authorLogin: author.login,
            committerName: author.login ? author.name : "GitHub",
            committerEmail: author.login ? author.email : "noreply@github.com",
            authoredAt: iso,
            committedAt: iso,
            parentsCount: ci === count - 1 && rand() < 0.15 ? 2 : 1,
            branch,
            repo,
            prNumber: pr?.number ?? null,
            prAuthor: pr?.author ?? null,
          });
        }
      }
    }
  });
  return out;
}

export class FakeGitHub implements GitHubService {
  private readonly commits: FakeCommit[];

  constructor(now: Date = new Date()) {
    this.commits = generate(now);
  }

  async viewer(): Promise<GhViewer> {
    return { login: "alice-dev", name: "Alice Martin", avatarUrl: "/avatar.svg" };
  }

  async listRepos(): Promise<GhRepo[]> {
    return REPOS.map((r) => ({
      ...r,
      pushedAt: this.commits.filter((c) => c.repo === r.fullName).map((c) => c.authoredAt).sort().at(-1) ?? null,
    }));
  }

  async listBranches(owner: string, repo: string): Promise<string[]> {
    const full = `${owner}/${repo}`;
    if (!REPOS.some((r) => r.fullName === full)) return [];
    return [...new Set(["main", ...this.commits.filter((c) => c.repo === full).map((c) => c.branch)])];
  }

  async *iterCommits(owner: string, repo: string, options: { sha: string; since?: string }): AsyncGenerator<GhCommit[]> {
    const full = `${owner}/${repo}`;
    const since = options.since ? Date.parse(options.since) : 0;
    // Les commits de main sont visibles depuis toute branche (les branches partent de main).
    const rows = this.commits
      .filter((c) => c.repo === full && (c.branch === options.sha || (c.branch === "main" && options.sha !== "main")))
      .filter((c) => Date.parse(c.authoredAt) >= since)
      .sort((a, b) => b.authoredAt.localeCompare(a.authoredAt));
    for (let i = 0; i < rows.length; i += 100) yield rows.slice(i, i + 100);
  }

  async pullsForCommit(_owner: string, _repo: string, sha: string): Promise<GhPull[]> {
    const commit = this.commits.find((c) => c.sha === sha);
    if (!commit?.prNumber) return [];
    return [{ number: commit.prNumber, authorLogin: commit.prAuthor, mergedAt: commit.authoredAt }];
  }
}
