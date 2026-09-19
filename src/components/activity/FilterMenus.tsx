"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { RepoIcon, UsersIcon } from "@/components/icons";
import { useI18n } from "@/i18n/client";
import { activityHref, isSelected, toggleId, type ActivityParams } from "@/lib/activity";
import type { ChipItem } from "@/lib/activity-view";

/** Base des boutons de la barre d'outils posée sur le calendrier. */
export const iconButton = "relative inline-flex h-10 w-9 items-center justify-center rounded-[10px] border transition-colors";

/** Bouton-icône qui ouvre un panneau ; se ferme au clic à l'extérieur ou avec Échap. */
function IconMenu({
  icon,
  label,
  active,
  hue,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  /** Un filtre est en place (pas « tout ») : pastille sur l'icône. */
  active?: boolean;
  /** Teinte de la page, portée par la pastille. */
  hue: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toneClass = open
    ? "border-[#c7d2fe] bg-accent-soft text-accent-fg"
    : "border-line bg-surface text-ink-2 hover:bg-accent-soft hover:text-accent-fg";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        title={label}
        className={`${iconButton} shadow-sm ${toneClass}`}
      >
        {icon}
        {active ? <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full" style={{ background: hue }} /> : null}
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className="absolute top-11 left-0 z-30 min-w-56 rounded-xl border border-line bg-surface p-2 shadow-lg shadow-slate-900/10"
        >
          <div className="px-2 pt-1 pb-2 text-xs font-semibold text-ink-2">{label}</div>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function CheckList({
  items,
  selection,
  onToggle,
}: {
  items: ChipItem[];
  selection: string[] | null;
  onToggle: (id: string) => void;
}) {
  const { m } = useI18n();
  if (items.length === 0) return <p className="px-2 pb-1 text-sm text-muted">{m.filters.empty}</p>;
  return (
    <ul className="flex max-h-64 flex-col overflow-y-auto">
      {items.map((item) => (
        <li key={item.id}>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-track">
            <input
              type="checkbox"
              checked={isSelected(selection, item.id)}
              onChange={() => onToggle(item.id)}
              className="h-4 w-4 accent-accent"
            />
            {item.swatch ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.swatch.dot }} /> : null}
            <span className="truncate">{item.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function FilterMenus({
  params,
  today,
  people,
  repos,
  hue,
  base,
}: {
  params: ActivityParams;
  today: string;
  people: ChipItem[];
  repos: ChipItem[];
  hue: string;
  /** Page à recharger quand un filtre change (la fiche d'un contributeur, par exemple). */
  base?: string;
}) {
  const { m } = useI18n();
  const router = useRouter();
  // Les cases reflètent immédiatement le choix, le temps que la page se recharge avec la nouvelle URL.
  const [shown, applyPatch] = useOptimistic(params, (state: ActivityParams, patch: Partial<ActivityParams>) => ({ ...state, ...patch }));
  const [, startTransition] = useTransition();
  const go = (patch: Partial<ActivityParams>) =>
    startTransition(() => {
      applyPatch(patch);
      router.push(activityHref(shown, patch, today, base));
    });
  const peopleIds = people.map((p) => p.id);
  const repoIds = repos.map((r) => r.id);

  return (
    <>
      <IconMenu icon={<UsersIcon />} label={m.filters.people} active={shown.people !== null} hue={hue}>
        <CheckList items={people} selection={shown.people} onToggle={(id) => go({ people: toggleId(shown.people, peopleIds, id) })} />
      </IconMenu>
      <IconMenu icon={<RepoIcon />} label={m.filters.repos} active={shown.repos !== null} hue={hue}>
        <CheckList items={repos} selection={shown.repos} onToggle={(id) => go({ repos: toggleId(shown.repos, repoIds, id) })} />
      </IconMenu>
    </>
  );
}
