"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";

/**
 * Bouton texte ouvrant un panneau à cocher, sur le modèle des filtres de la page Activité :
 * il reste ouvert pendant les enregistrements pour permettre plusieurs coches d'affilée.
 */
export function Menu({
  label,
  badge,
  align = "right",
  width,
  children,
}: {
  label: string;
  badge?: ReactNode;
  align?: "left" | "right";
  /** Largeur imposée, pour caler le bouton sur une colonne (« w-[246px] » par exemple). */
  width?: string;
  children: ReactNode;
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

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors ${
          width ? `${width} justify-between` : ""
        } ${
          open ? "border-[#c7d2fe] bg-accent-soft text-accent-fg" : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink-2"
        }`}
      >
        {label}
        {badge}
        <ChevronDownIcon className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className={`absolute top-11 z-30 w-80 rounded-xl border border-line bg-surface p-2 shadow-lg shadow-slate-900/10 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export const menuItem =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-track";

export const menuGroup = "px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase";

/** Compteur discret (nombre de commits, par exemple) aligné à droite d'une ligne de menu. */
export function MenuCount({ children }: { children: ReactNode }) {
  return <span className="ml-auto shrink-0 text-xs text-muted tabular-nums">{children}</span>;
}
