import { redirect } from "next/navigation";
import { ChooseRepos } from "@/components/setup/ChooseRepos";
import { ConnectGitHub } from "@/components/setup/ConnectGitHub";
import { FirstSync } from "@/components/setup/FirstSync";
import { SetupFrame, type SetupStep } from "@/components/setup/SetupFrame";
import { getI18n } from "@/i18n/server";
import { githubConnection } from "@/lib/config";
import { describeError } from "@/lib/github";
import { githubClientId } from "@/lib/github-app";
import { accessibleRepos } from "@/lib/repos-catalog";
import { getStore } from "@/lib/runtime";
import { dayKey } from "@/lib/weeks";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

/**
 * Assistant de première installation. L'étape se déduit de l'état — GitHub connecté ? des dépôts
 * suivis ? — sauf demande explicite (`?step=`), pour revenir ajouter des dépôts ou suivre une synchro.
 */
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { step: requested } = await searchParams;
  const { m } = await getI18n();
  const connection = githubConnection();
  const store = getStore();
  const repos = await store.repos();

  let step: SetupStep;
  if (!connection) step = "github";
  else if (requested === "sync") step = "sync";
  else if (requested === "repos" || repos.length === 0) step = "repos";
  else redirect("/");

  if (step === "github") {
    return (
      <SetupFrame step="github">
        <ConnectGitHub deviceFlow={githubClientId() !== ""} />
      </SetupFrame>
    );
  }

  if (step === "repos") {
    let catalog: Awaited<ReturnType<typeof accessibleRepos>> = [];
    let loadError: string | null = null;
    try {
      catalog = await accessibleRepos();
    } catch (err) {
      loadError = m.setup.repos.loadError.replace("{error}", describeError(err, m));
    }
    const settings = await store.settings();
    const defaultSince = dayKey(new Date(Date.now() - 90 * DAY), settings.timezone);
    return (
      <SetupFrame step="repos">
        <ChooseRepos repos={catalog} tracked={repos.map((r) => `${r.owner}/${r.name}`)} defaultSince={defaultSince} loadError={loadError} />
      </SetupFrame>
    );
  }

  return (
    <SetupFrame step="sync">
      <FirstSync />
    </SetupFrame>
  );
}
