import { saveSettings } from "@/actions/settings";
import { Card, Notice, PageHeader } from "@/components/ui";
import {
  AuthorPicker,
  ContributorListHeader,
  ContributorRow,
  type AuthorItem,
  type ContributorItem,
} from "./Contributors";
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
}

/**
 * Corps de la page Paramètres : trois cards, une ligne par dépôt et par personne.
 * Sans accès aux données, pour être rendu aussi par l'aperçu de scripts/preview-settings.tsx.
 */
export function SettingsView({ notice, repos, contributors, authors, rules }: SettingsViewProps) {
  return (
    <>
      <PageHeader title="Paramètres" subtitle="Dépôts suivis, contributeurs et règles de calcul." />

      {notice ? <Notice kind={notice.kind}>{notice.msg}</Notice> : null}

      <Card title="Dépôts suivis">
        <div>
          {repos.length === 0 ? (
            <p className="pb-3 text-sm text-muted">Aucun dépôt suivi. Ajoute le premier ci-dessous.</p>
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
        <Card title="Auteurs suivis">
          <div>
            {contributors.length === 0 ? (
              <p className="pb-3 text-sm text-muted">
                Aucun auteur suivi. Synchronise, puis choisis qui suivre ci-dessous.
              </p>
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
        <Card title="Calcul des sessions">
          <RulesFields pre={rules.preMinutes} gap={rules.gapMinutes} post={rules.postMinutes} />
        </Card>
      </form>
    </>
  );
}
