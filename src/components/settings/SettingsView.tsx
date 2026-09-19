import { saveSettings } from "@/actions/settings";
import { Card, Notice, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import {
  AuthorPicker,
  ContributorListHeader,
  ContributorRow,
  type AuthorItem,
  type ContributorItem,
} from "./Contributors";
import { LanguageField } from "./LanguageField";
import { AddRepoForm, RepoListHeader, RepoRow, type RepoItem } from "./Repos";
import { RulesFields } from "./RulesFields";

export interface RulesValues {
  preMinutes: number;
  gapMinutes: number;
  postMinutes: number;
}

export interface SettingsViewProps {
  notice: { kind: "success" | "error"; msg: string } | null;
  repos: RepoItem[];
  contributors: ContributorItem[];
  authors: AuthorItem[];
  rules: RulesValues;
  locale: "auto" | "fr" | "en";
}

/**
 * Corps de la page Paramètres : trois cards, une ligne par dépôt et par personne.
 * Sans accès aux données, pour être rendu aussi par l'aperçu de scripts/preview-settings.tsx.
 */
export async function SettingsView({ notice, repos, contributors, authors, rules, locale }: SettingsViewProps) {
  const { m } = await getI18n();
  return (
    <>
      <PageHeader title={m.settings.title} subtitle={m.settings.subtitle} />

      {notice ? <Notice kind={notice.kind}>{notice.msg}</Notice> : null}

      <Card title={m.settings.repos.title}>
        <div>
          {repos.length === 0 ? (
            <p className="pb-3 text-sm text-muted">{m.settings.repos.empty}</p>
          ) : (
            <>
              <RepoListHeader />
              {repos.map((repo) => (
                <RepoRow key={repo.id} repo={repo} />
              ))}
            </>
          )}
          <AddRepoForm />
        </div>
      </Card>

      <div id="identites">
        <Card title={m.settings.authors.title}>
          <div>
            {contributors.length === 0 ? (
              <p className="pb-3 text-sm text-muted">{m.settings.authors.empty}</p>
            ) : (
              <>
                <ContributorListHeader />
                {contributors.map((contributor) => (
                  <ContributorRow key={contributor.id} contributor={contributor} />
                ))}
              </>
            )}
            <div className="flex justify-end border-t border-line pt-3">
              <AuthorPicker authors={authors} />
            </div>
          </div>
        </Card>
      </div>

      <form action={saveSettings}>
        <Card title={m.settings.rules.title}>
          <RulesFields pre={rules.preMinutes} gap={rules.gapMinutes} post={rules.postMinutes} />
        </Card>
      </form>

      <Card title={m.settings.language.title}>
        <LanguageField value={locale} />
      </Card>
    </>
  );
}
