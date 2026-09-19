"use client";

import { Fragment, useState, type ReactNode } from "react";
import type { TipRow } from "@/lib/activity-view";

const WIDTH = 232;

/** Contenu standard d'un panneau de survol : un titre, puis des lignes libellé / valeur. */
export function TipCard({ title, dot, rows }: { title: string; dot?: string; rows: TipRow[] }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {dot ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} /> : null}
        <span className="truncate text-xs font-semibold text-ink">{title}</span>
      </div>
      {rows.length > 0 ? (
        <dl className="mt-0.5 grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-[3px] text-[11px]">
          {rows.map((row, i) => (
            <Fragment key={`${row.label}-${i}`}>
              <dt className="truncate text-ink-2">{row.label}</dt>
              <dd className="tnum text-right font-medium text-ink">{row.value}</dd>
              <dd className="tnum text-right text-ink-2">{row.share ? `(${row.share})` : ""}</dd>
            </Fragment>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/**
 * Panneau de survol suivant le curseur. `bind(contenu)` renvoie les gestionnaires à poser sur
 * l'élément survolé (ou rien si `contenu` est null) ; `layer` se rend une fois dans le composant.
 */
export function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; node: ReactNode } | null>(null);

  function bind(node: ReactNode | null) {
    if (node === null) return {};
    const at = (event: React.MouseEvent) => ({ x: event.clientX, y: event.clientY, node });
    return {
      onMouseEnter: (event: React.MouseEvent) => setTip(at(event)),
      onMouseMove: (event: React.MouseEvent) => setTip(at(event)),
      onMouseLeave: () => setTip(null),
    };
  }

  // Sous le curseur, sauf dans le bas de la fenêtre où le panneau est ancré au-dessus.
  const below = tip !== null && tip.y < window.innerHeight * 0.58;
  const layer = tip ? (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-lg border border-line bg-surface p-2.5 shadow-lg shadow-slate-900/10"
      style={{
        width: WIDTH,
        left: Math.max(8, Math.min(tip.x + 14, window.innerWidth - WIDTH - 8)),
        ...(below ? { top: tip.y + 16 } : { bottom: Math.max(8, window.innerHeight - tip.y + 16) }),
      }}
    >
      {tip.node}
    </div>
  ) : null;

  return { bind, layer };
}
