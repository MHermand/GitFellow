"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addRepo, trackRepo } from "@/actions/settings";
import { PlusIcon } from "@/components/icons";
import { inputBase } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { Menu, menuItem } from "./Menu";

export interface RepoChoice {
  fullName: string;
  private: boolean;
  archived: boolean;
}

/** Largeur du champ d'ajout de dépôt d'origine, pour rester calé sur la colonne de droite. */
const ADD_COL = "w-[246px]";

/**
 * Dépôts du compte pas encore suivis, à cocher d'un clic, avec une saisie libre en secours
 * (un dépôt public d'un autre compte, par exemple).
 */
export function RepoPicker({ choices }: { choices: RepoChoice[] }) {
  const { m } = useI18n();
  const r = m.settings.repos;
  const [query, setQuery] = useState("");
  const [shown, hide] = useOptimistic(choices, (state: RepoChoice[], fullName: string) => state.filter((c) => c.fullName !== fullName));
  const [, startTransition] = useTransition();

  const track = (choice: RepoChoice) =>
    startTransition(async () => {
      hide(choice.fullName);
      await trackRepo(choice.fullName);
    });

  const needle = query.trim().toLowerCase();
  const list = shown.filter((c) => c.fullName.toLowerCase().includes(needle));

  return (
    <div className="flex justify-end border-t border-line pt-3">
      <Menu label={r.pick} width={ADD_COL}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={r.pickSearch}
          aria-label={r.pickSearch}
          className={`${inputBase} h-9 w-full px-3`}
        />
        <ul className="mt-1 max-h-64 overflow-y-auto">
          {list.map((choice) => (
            <li key={choice.fullName}>
              <button type="button" onClick={() => track(choice)} className={menuItem}>
                <span className="min-w-0 flex-1 truncate">{choice.fullName}</span>
                {choice.private ? <span className="shrink-0 text-[10px] text-muted uppercase">{m.setup.repos.private}</span> : null}
                {choice.archived ? <span className="shrink-0 text-[10px] text-muted uppercase">{m.setup.repos.archived}</span> : null}
              </button>
            </li>
          ))}
          {list.length === 0 ? <li className="px-2 py-2 text-sm text-muted">{r.pickEmpty}</li> : null}
        </ul>
        <form action={addRepo} className="mt-2 flex items-center gap-2 border-t border-line pt-2">
          <input
            name="repo"
            required
            placeholder={r.pickManual}
            aria-label={r.add}
            className={`${inputBase} h-9 min-w-0 flex-1 px-3 placeholder:text-xs`}
          />
          <button
            type="submit"
            aria-label={r.addTitle}
            title={r.addTitle}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent-fg"
          >
            <PlusIcon />
          </button>
        </form>
      </Menu>
    </div>
  );
}
