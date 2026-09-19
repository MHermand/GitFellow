"use client";

import { useTransition } from "react";
import { addRepo, deleteRepo, setRepoTrackedSince } from "@/actions/settings";
import { runSyncOne } from "@/actions/sync";
import { CalendarIcon, PlusIcon, RefreshIcon, TrashIcon } from "@/components/icons";
import { inputBase } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export interface RepoItem {
  id: string;
  owner: string;
  name: string;
  /** Jour de début de suivi, "" quand le dépôt est suivi depuis toujours. */
  trackedSince: string;
  syncedLabel: string;
  error: string | null;
}

/** Colonnes partagées par l'en-tête et les lignes, pour que tout s'aligne. */
const NAME_COL = "w-60 shrink-0 truncate";
const DATE_COL = "w-[150px] shrink-0";
const ICON_COL = "w-9 shrink-0";
/** Colonnes « synchroniser » + « début du suivi » réunies, pour le champ d'ajout. */
const ADD_COL = "w-[198px] shrink-0";
/** Déclencheur natif du calendrier rendu invisible et posé sur la zone de l'icône. */
const PICKER =
  "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";

const iconButton =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent-fg disabled:opacity-50";
const iconDanger =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:border-danger/30 hover:bg-danger/10 hover:text-danger";

/** Ajout d'un dépôt, sous la liste, sur les colonnes « synchroniser » et « début du suivi ». */
export function AddRepoForm() {
  const { m } = useI18n();
  return (
    <form action={addRepo} className="flex items-center gap-x-3 border-t border-line pt-3 max-sm:flex-wrap">
      <span className={`${NAME_COL} max-sm:hidden`} />
      <span className="flex-1 max-sm:hidden" />
      <input
        name="repo"
        required
        placeholder={m.settings.repos.addPlaceholder}
        aria-label={m.settings.repos.add}
        className={`${inputBase} h-9 px-3 placeholder:text-xs ${ADD_COL} max-sm:w-full`}
      />
      <button type="submit" aria-label={m.settings.repos.addTitle} title={m.settings.repos.addTitle} className={iconButton}>
        <PlusIcon />
      </button>
    </form>
  );
}

/** En-tête de colonne : la date que porte chaque ligne. */
export function RepoListHeader() {
  const { m } = useI18n();
  return (
    <div className="flex items-center gap-x-3 pb-2 text-[11px] font-semibold tracking-wide text-muted uppercase max-sm:hidden">
      <span className={NAME_COL} />
      <span className="flex-1" />
      <span className={ICON_COL} />
      <span className={DATE_COL}>{m.settings.repos.trackedSince}</span>
      <span className={ICON_COL} />
    </div>
  );
}

/** Ligne d'un dépôt : état de la dernière synchro, synchro à la demande, date de début de suivi. */
export function RepoRow({ repo }: { repo: RepoItem }) {
  const label = `${repo.owner}/${repo.name}`;
  const [syncing, startSync] = useTransition();
  const { m, t } = useI18n();

  return (
    <form
      action={setRepoTrackedSince}
      className="flex items-center gap-x-3 gap-y-2 border-t border-line py-2.5 max-sm:flex-wrap"
    >
      <input type="hidden" name="id" value={repo.id} />
      <span className={`${NAME_COL} text-sm font-medium max-sm:w-full`} title={label}>
        {label}
      </span>
      <div className="min-w-0 flex-1 max-sm:w-full max-sm:flex-none">
        <span className="text-xs text-muted">{repo.syncedLabel}</span>
        {repo.error ? <div className="mt-0.5 text-xs text-warning">{repo.error}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => startSync(async () => void (await runSyncOne(repo.id)))}
        disabled={syncing}
        aria-label={t(m.settings.repos.syncOne, { repo: label })}
        title={m.settings.repos.syncOneTitle}
        className={iconButton}
      >
        <RefreshIcon className={syncing ? "animate-spin" : undefined} />
      </button>
      {/* Icône dessinée à la main : celle du navigateur se colle au bord et ne s'aligne sur rien. */}
      <span className={`relative inline-flex ${DATE_COL}`}>
        <input
          type="date"
          name="tracked_since"
          defaultValue={repo.trackedSince}
          onBlur={(e) => {
            // Enregistrer à chaque frappe refermerait le sélecteur de date en pleine navigation.
            if (e.currentTarget.value !== e.currentTarget.defaultValue) e.currentTarget.form?.requestSubmit();
          }}
          aria-label={t(m.settings.repos.dateFor, { repo: label })}
          title={m.settings.repos.dateHint}
          className={`${inputBase} relative h-9 w-full px-3 pr-9 ${PICKER}`}
        />
        <CalendarIcon className="pointer-events-none absolute top-1/2 right-[9px] size-4 -translate-y-1/2 text-ink-2" />
      </span>
      <button
        type="submit"
        formAction={deleteRepo}
        aria-label={t(m.settings.repos.remove, { repo: label })}
        title={m.settings.repos.removeTitle}
        className={iconDanger}
      >
        <TrashIcon />
      </button>
    </form>
  );
}
