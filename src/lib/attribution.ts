/**
 * Rattache un commit à un contributeur.
 *
 * Ordre : login GitHub de l'auteur → e-mail auteur → nom auteur → login de l'auteur de la PR
 * qui contient le commit (utile pour les commits signés « Claude <noreply@anthropic.com> »
 * produits par Claude Code sur le web, qui n'ont pas d'auteur identifiable).
 */

export interface ContributorIdentity {
  id: string;
  displayName: string;
  githubLogins: string[];
  authorEmails: string[];
  authorNames: string[];
}

export interface CommitIdentity {
  authorLogin: string | null;
  authorEmail: string | null;
  authorName: string | null;
  prAuthorLogin: string | null;
}

/** Adresses génériques qui n'identifient personne. */
export const GENERIC_EMAILS = new Set([
  "noreply@anthropic.com",
  "noreply@github.com",
  "action@github.com",
  "actions@github.com",
]);

export function isGenericAuthor(email: string | null | undefined): boolean {
  if (!email) return true;
  const lower = email.trim().toLowerCase();
  if (GENERIC_EMAILS.has(lower)) return true;
  return /\[bot\]@users\.noreply\.github\.com$/.test(lower);
}

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

function includes(list: string[], value: string | null | undefined): boolean {
  const target = norm(value);
  if (!target) return false;
  return list.some((item) => norm(item) === target);
}

export function resolveContributor<T extends ContributorIdentity>(
  commit: CommitIdentity,
  contributors: T[],
): T | null {
  const byLogin = contributors.find((c) => includes(c.githubLogins, commit.authorLogin));
  if (byLogin) return byLogin;

  if (!isGenericAuthor(commit.authorEmail)) {
    const byEmail = contributors.find((c) => includes(c.authorEmails, commit.authorEmail));
    if (byEmail) return byEmail;
    const byName = contributors.find((c) => includes(c.authorNames, commit.authorName));
    if (byName) return byName;
  }

  const byPr = contributors.find((c) => includes(c.githubLogins, commit.prAuthorLogin));
  return byPr ?? null;
}

/** Faut-il interroger GitHub pour connaître la PR d'origine de ce commit ? */
export function needsPullRequestLookup(commit: {
  authorLogin: string | null;
  authorEmail: string | null;
}): boolean {
  return !commit.authorLogin || isGenericAuthor(commit.authorEmail);
}

/** Découpe "a, b ,c" en ["a", "b", "c"]. */
export function parseList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface IdentityCount extends CommitIdentity {
  count: number;
  /** ISO 8601 du dernier commit, pour l'infobulle. */
  lastAt?: string | null;
}

/** Un auteur détecté dans les dépôts suivis, prêt à devenir un contributeur. */
export interface DetectedAuthor {
  key: string;
  /** Pseudo affiché : login GitHub, à défaut nom ou e-mail. */
  handle: string;
  /** E-mail à afficher : le vrai quand il existe, sinon l'adresse générique. */
  email: string;
  commits: number;
  /** Part de ces commits produits par un agent et rattachés via l'auteur de la PR. */
  viaPullRequests: number;
  lastAt: string | null;
  githubLogins: string[];
  authorEmails: string[];
  authorNames: string[];
}

function push(list: string[], value: string | null | undefined) {
  const clean = (value ?? "").trim();
  if (clean && !list.some((item) => norm(item) === norm(clean))) list.push(clean);
}

/**
 * Regroupe les identités par ce qui les rattachera : le login GitHub de l'auteur, à défaut son
 * e-mail, et pour un auteur générique (agent, bot) le login de l'auteur de la PR — c'est lui
 * qui porte ces commits. Deux lignes qui aboutiraient au même contributeur n'en font qu'une.
 */
export function groupDetectedAuthors(rows: IdentityCount[]): DetectedAuthor[] {
  const map = new Map<string, DetectedAuthor>();

  for (const row of rows) {
    const generic = isGenericAuthor(row.authorEmail);
    const login = (row.authorLogin ?? "").trim() || null;
    // Un agent sans login identifiable n'est rattachable que par l'auteur de sa pull request.
    const via = !login && generic ? (row.prAuthorLogin ?? "").trim() || null : null;
    const anchor = login ?? via;
    const email = (row.authorEmail ?? "").trim();
    const key = anchor
      ? `login:${norm(anchor)}`
      : !generic && email
        ? `email:${norm(email)}`
        : `agent:${norm(row.authorName) || norm(email) || "inconnu"}`;

    const entry = map.get(key) ?? {
      key,
      handle: anchor ?? row.authorName ?? email ?? "inconnu",
      email: "",
      commits: 0,
      viaPullRequests: 0,
      lastAt: null,
      githubLogins: [],
      authorEmails: [],
      authorNames: [],
    };

    entry.commits += row.count;
    if (via) entry.viaPullRequests += row.count;
    if (row.lastAt && (!entry.lastAt || row.lastAt > entry.lastAt)) entry.lastAt = row.lastAt;
    push(entry.githubLogins, anchor);
    if (!generic) push(entry.authorEmails, email);
    push(entry.authorNames, row.authorName);
    // Une adresse réelle prend toujours le pas sur une adresse générique.
    if (email && (!entry.email || (isGenericAuthor(entry.email) && !generic))) entry.email = email;

    map.set(key, entry);
  }

  return [...map.values()].sort((a, b) => b.commits - a.commits || a.handle.localeCompare(b.handle));
}
