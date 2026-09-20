"use client";

import { useActionState, useMemo, useState } from "react";
import { chooseRepos, type ActionResult } from "@/actions/setup";
import { btnPrimary, inputBase, Notice } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { GhRepo } from "@/lib/github";

/** Étape 2 : cocher les dépôts à suivre, et la date à partir de laquelle on lit. */
export function ChooseRepos({ repos, tracked, defaultSince, loadError }: { repos: GhRepo[]; tracked: string[]; defaultSince: string; loadError: string | null }) {
  const { m, n } = useI18n();
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

      <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-line">
        {groups.length === 0 ? <p className="p-4 text-sm text-muted">{r.empty}</p> : null}
        {groups.map(([owner, list]) => (
          <div key={owner}>
            <div className="sticky top-0 border-b border-line bg-bg px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
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
                        {repo.description ? <span className="ml-2 text-xs text-muted">{repo.description}</span> : null}
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

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="tracked_since" className="text-xs font-medium text-ink-2">
            {r.trackedSince}
          </label>
          <input id="tracked_since" name="tracked_since" type="date" defaultValue={defaultSince} className={`${inputBase} h-10 w-[180px] px-3`} />
          <span className="max-w-sm text-xs text-muted">{r.trackedSinceHint}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="tnum text-sm text-ink-2">{n(r.selected, selected.size)}</span>
          <button type="submit" disabled={pending || selected.size === 0} className={btnPrimary}>
            {r.submit}
          </button>
        </div>
      </div>
      {state.error ? <Notice kind="error">{state.error}</Notice> : null}
    </form>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 rounded-full bg-track px-2 py-0.5 text-[10px] font-medium text-ink-2 uppercase">{children}</span>;
}
