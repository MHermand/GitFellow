/**
 * Après la première synchronisation, met sous suivi les auteurs détectés pour que le rapport ait
 * quelque chose à montrer dès l'ouverture. L'utilisateur affine ensuite noms et objectifs.
 */
import { groupDetectedAuthors, isGenericAuthor, type DetectedAuthor } from "./attribution";
import { trackingFloors } from "./data";
import type { Store } from "./store";

/** Au-delà, la liste se règle mieux à la main que d'office. */
const MAX_AUTO_AUTHORS = 20;

function looksLikeBot(author: DetectedAuthor): boolean {
  const handle = author.handle.toLowerCase();
  if (/\[bot\]$|-bot$|^bot-|dependabot|renovate|github-actions/.test(handle)) return true;
  // Un auteur sans login rattachable, dont toutes les adresses sont génériques : un agent, pas une personne.
  return author.githubLogins.length === 0 && author.authorEmails.every((email) => isGenericAuthor(email));
}

export async function autoTrackAuthors(store: Store): Promise<number> {
  if ((await store.contributors()).length > 0) return 0;
  const settings = await store.settings();
  const repos = await store.repos();
  const identities = await store.identitySummary(trackingFloors(repos, settings.timezone));
  const authors = groupDetectedAuthors(identities).filter((a) => !looksLikeBot(a)).slice(0, MAX_AUTO_AUTHORS);
  for (const author of authors) {
    await store.insertContributor({
      // Le nom d'auteur des commits (« Alice Martin ») parle mieux qu'un login ; le login reste rattaché.
      display_name: author.authorNames[0] ?? author.handle,
      github_logins: author.githubLogins,
      author_emails: author.authorEmails,
      author_names: author.authorNames,
      target_hours: 0,
      target_unit: "week",
      active: true,
    });
  }
  return authors.length;
}
