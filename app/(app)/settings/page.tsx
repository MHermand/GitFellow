import type { AuthorItem, ContributorItem } from "@/components/settings/Contributors";
import type { RepoItem } from "@/components/settings/Repos";
import { SettingsView } from "@/components/settings/SettingsView";
import { groupDetectedAuthors, resolveContributor } from "@/lib/attribution";
import { loadContributors, loadRepos, loadSettings, toContributorRow, trackingFloors } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { getStore } from "@/lib/runtime";
import { parseTargetUnit } from "@/lib/target";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; msg?: string }>;
}) {
  const store = getStore();
  const { kind, msg } = await searchParams;

  const [settings, repos, contributorsDb] = await Promise.all([loadSettings(store), loadRepos(store), loadContributors(store)]);
  const tz = settings.timezone;
  const identities = await store.identitySummary(trackingFloors(repos, tz));
  const contributors = contributorsDb.map(toContributorRow);

  const repoItems: RepoItem[] = repos.map((repo) => ({
    id: repo.id,
    owner: repo.owner,
    name: repo.name,
    trackedSince: repo.tracked_since ?? "",
    syncedLabel: repo.last_synced_at
      ? `synchronisé le ${fmtDateTime(repo.last_synced_at, tz)}${
          repo.last_sync_commits !== null ? ` · ${repo.last_sync_commits} commits lus` : ""
        }`
      : "jamais synchronisé",
    error: repo.last_sync_error,
  }));

  const contributorItems: ContributorItem[] = contributorsDb.map((c) => ({
    id: c.id,
    displayName: c.display_name,
    logins: c.github_logins.join(", "),
    emails: c.author_emails.join(", "),
    names: c.author_names.join(", "),
    handle: [...c.github_logins, ...c.author_emails, ...c.author_names][0] ?? null,
    targetHours: Number(c.target_hours) > 0 ? String(Number(c.target_hours)) : "",
    targetUnit: parseTargetUnit(c.target_unit),
  }));

  // Auteurs vus dans les dépôts suivis qui ne correspondent à aucun contributeur, regroupés
  // par l'identité qui les rattachera : plusieurs lignes d'une même personne n'en font qu'une.
  const authors: AuthorItem[] = groupDetectedAuthors(identities.filter((row) => !resolveContributor(row, contributors))).map((author) => ({
    key: author.key,
    label: author.handle,
    email: author.email,
    commits: author.commits,
    title: [
      author.authorNames.length > 0 ? author.authorNames.join(", ") : null,
      author.viaPullRequests > 0
        ? `dont ${author.viaPullRequests} commit${author.viaPullRequests > 1 ? "s" : ""} d'agent via ses pull requests`
        : null,
      author.lastAt ? `dernier commit le ${fmtDateTime(author.lastAt, tz)}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    identity: {
      displayName: author.handle,
      githubLogins: author.githubLogins,
      authorEmails: author.authorEmails,
      authorNames: author.authorNames,
    },
  }));

  return (
    <SettingsView
      notice={msg ? { kind: kind === "error" ? "error" : "success", msg } : null}
      repos={repoItems}
      contributors={contributorItems}
      authors={authors}
      rules={{
        preMinutes: settings.pre_minutes,
        gapMinutes: settings.gap_minutes,
        postMinutes: settings.post_minutes,
      }}
    />
  );
}
