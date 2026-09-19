/**
 * Lectures utilisées par les pages, au-dessus du store.
 */
import { dayStart } from "./calendar";
import type { CommitRow, ContributorRow, ReportParams } from "./report";
import type { ContributorDbRow, RepoRow, SettingsRow, Store } from "./store";
import { parseTargetUnit } from "./target";

export async function loadSettings(store: Store): Promise<SettingsRow> {
  return store.settings();
}

export function toReportParams(settings: SettingsRow): ReportParams {
  return {
    preMinutes: settings.pre_minutes,
    gapMinutes: settings.gap_minutes,
    postMinutes: settings.post_minutes,
    timezone: settings.timezone,
  };
}

export async function loadContributors(store: Store): Promise<ContributorDbRow[]> {
  return store.contributors();
}

export function toContributorRow(row: ContributorDbRow): ContributorRow {
  return {
    id: row.id,
    displayName: row.display_name,
    githubLogins: row.github_logins,
    authorEmails: row.author_emails,
    authorNames: row.author_names,
    target: { hours: Number(row.target_hours ?? 0), unit: parseTargetUnit(row.target_unit) },
    active: row.active,
  };
}

export async function loadRepos(store: Store): Promise<RepoRow[]> {
  return store.repos();
}

/** Instant, par dépôt suivi, avant lequel les commits ne comptent pas (date de début de suivi). */
export function trackingFloors(repos: RepoRow[], tz: string): Map<string, Date> {
  return new Map(repos.filter((r) => r.tracked_since).map((r) => [r.id, dayStart(r.tracked_since!, tz)]));
}

/**
 * Commits authored entre `from` (inclus) et `to` (exclu).
 * Seuls les dépôts suivis comptent, et seulement à partir de leur date de début de suivi.
 */
export async function loadCommitsBetween(
  store: Store,
  from: Date,
  to: Date,
  tz: string,
  knownRepos?: RepoRow[],
): Promise<CommitRow[]> {
  const repos = (knownRepos ?? (await loadRepos(store))).filter((r) => r.enabled);
  const labels = new Map(repos.map((r) => [r.id, `${r.owner}/${r.name}`]));
  const floors = new Map([...trackingFloors(repos, tz)].map(([id, date]) => [id, date.getTime()]));
  const out: CommitRow[] = [];

  for (const row of await store.commitsBetween(from, to)) {
    if (!labels.has(row.repo_id)) continue;
    const floor = floors.get(row.repo_id);
    if (floor !== undefined && Date.parse(row.authored_at) < floor) continue;
    out.push({
      repoId: row.repo_id,
      repo: labels.get(row.repo_id) ?? row.repo_id,
      sha: row.sha,
      authorName: row.author_name,
      authorEmail: row.author_email,
      authorLogin: row.author_login,
      prAuthorLogin: row.pr_author_login,
      authoredAt: row.authored_at,
      message: row.message,
      isMerge: row.is_merge,
      htmlUrl: row.html_url,
    });
  }
  return out;
}
