"use client";

import { useActionState, useMemo, useState } from "react";
import { chooseRepos, type ActionResult } from "@/actions/setup";
import { btnPrimary, inputBase, Notice } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { GhRepo } from "@/lib/github";

/** Étape 2 : cocher les dépôts à suivre, et la date à partir de laquelle on lit. */
/** Hauteurs mesurées au navigateur : une ligne de dépôt, un en-tête d'organisation. */
const ROW_PX = 37;
const HEADER_PX = 30;
/** Cinq dépôts visibles sous le premier en-tête ; au-delà, la liste défile. */
const VISIBLE_ROWS = 5;
const LIST_MAX_PX = HEADER_PX + VISIBLE_ROWS * ROW_PX;

export function ChooseRepos({ repos, tracked, defaultSince, loadError }: { repos: GhRepo[]; tracked: string[]; defaultSince: string; loadError: string | null }) {
  const { m } = useI18n();
  const r = m.setup.repos;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(tracked));
  const [state, action, pending] = useActionState<ActionResult, FormData>(chooseRepos, { error: null });

  const needle = query.trim().toLowerCase();
  const shown = useMemo(() => repos.filter((repo) => !needle || repo.fullName.toLowerCase().includes(needle)), [repos, needle]);
  const groups = useMemo(() => {
    const map = new Map<string, GhRepo[]>();
    for (const repo of shown) map.set(repo.owner, [...(map.get(repo.owner) ?? []), repo]);
    return [...map.entries()];
  }, [shown]);

  function toggle(fullName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{m.setup.steps.repos}</h2>
        <p className="mt-1.5 text-sm text-ink-2">{r.intro}</p>
      </div>
      {loadError ? <Notice kind="error">{loadError}</Notice> : null}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={r.search}
        aria-label={r.search}
        className={`${inputBase} h-10 w-full px-3`}
      />

      {/* Cinq dépôts visibles, le reste au défilement : la liste ne pousse pas le bouton hors de l'écran.
          ROW_PX est la hauteur réelle d'une ligne, mesurée au navigateur. */}
      <div className="overflow-y-auto rounded-xl border border-line" style={{ maxHeight: LIST_MAX_PX }}>
        {groups.length === 0 ? <p className="p-4 text-sm text-ink-2">{r.empty}</p> : null}
        {groups.map(([owner, list]) => (
          <div key={owner}>
            <div className="sticky top-0 border-b border-line bg-bg px-3 py-1.5 text-[11px] font-semibold tracking-wide text-ink-2 uppercase">
              {owner}
            </div>
            <ul>
              {list.map((repo) => {
                const checked = selected.has(repo.fullName);
                return (
                  <li key={repo.fullName} className="border-b border-line/60 last:border-b-0">
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-track">
                      <input
                        type="checkbox"
                        name="repos"
                        value={repo.fullName}
                        checked={checked}
                        onChange={() => toggle(repo.fullName)}
                        className="h-4 w-4 accent-accent"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className={checked ? "font-medium text-ink" : "text-ink"}>{repo.name}</span>
                        {repo.description ? <span className="ml-2 text-xs text-ink-2">{repo.description}</span> : null}
                      </span>
                      {repo.private ? <Badge>{r.private}</Badge> : null}
                      {repo.archived ? <Badge>{r.archived}</Badge> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* La date et le bouton se partagent la largeur du champ de filtre, juste au-dessus. */}
      <div className="flex flex-col gap-1 border-t border-line pt-4">
        <label htmlFor="tracked_since" className="text-xs font-medium text-ink-2">
          {r.trackedSince}
        </label>
        <div className="flex items-center gap-2">
          <input id="tracked_since" name="tracked_since" type="date" defaultValue={defaultSince} className={`${inputBase} h-10 w-[172px] shrink-0 px-3`} />
          <button type="submit" disabled={pending || selected.size === 0} className={`${btnPrimary} min-w-0 flex-1`}>
            {r.submit}
          </button>
        </div>
        <span className="text-xs text-ink-2">{r.trackedSinceHint}</span>
      </div>
      {state.error ? <Notice kind="error">{state.error}</Notice> : null}
    </form>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 rounded-full bg-track px-2 py-0.5 text-[10px] font-medium text-ink-2 uppercase">{children}</span>;
}
