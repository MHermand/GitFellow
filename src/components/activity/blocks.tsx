"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import type { BlockView } from "@/lib/activity-view";

export type { BlockView };

/** Libellés 1h → 23h de la grille sur 24 heures (0h reste vide, sous l'en-tête collant). */
export function hourLabels(hourPx: number) {
  return Array.from({ length: 24 }, (_, h) => (
    <div key={h} className="tnum -translate-y-[7px] pr-2 text-right text-[11px] text-muted" style={{ height: hourPx }}>
      {h > 0 ? `${h}h` : ""}
    </div>
  ));
}

export function gridBackground(hourPx: number): React.CSSProperties {
  return {
    backgroundImage: `repeating-linear-gradient(to bottom, var(--track) 0, var(--track) 1px, transparent 1px, transparent ${hourPx}px)`,
  };
}

/** Bloc compact (vue Semaine). */
export function SessionBlock({ block, hourPx }: { block: BlockView; hourPx: number }) {
  const { m, n } = useI18n();
  const top = Math.round((block.startMin / 60) * hourPx);
  const height = Math.max(18, Math.round(((block.endMin - block.startMin) / 60) * hourPx) - 2);
  const showCommits = height >= 62;
  return (
    <Link
      href={block.href}
      title={block.title}
      className="absolute flex flex-col overflow-hidden rounded-md px-1.5 py-[3px] text-[11px] leading-[1.25] transition-opacity hover:opacity-90"
      style={{
        top,
        height,
        left: `calc(4px + ${block.lane * 22}%)`,
        right: 4,
        background: block.swatch.tint,
        color: block.swatch.ink,
        zIndex: block.lane + 1,
        boxShadow: block.lane > 0 ? "0 0 0 2px var(--surface)" : undefined,
      }}
    >
      <span className="tnum font-semibold whitespace-nowrap">{block.time}</span>
      <span className="truncate">{block.primary}</span>
      <span className="truncate opacity-80">{block.secondary}</span>
      {showCommits ? <span className="opacity-70">{n(m.common.commits, block.commits)}</span> : null}
    </Link>
  );
}

/** Bloc détaillé (vue Jour) avec les commits. */
export function DayBlock({ block, hourPx }: { block: BlockView; hourPx: number }) {
  const { m, n } = useI18n();
  const top = Math.round((block.startMin / 60) * hourPx);
  const height = Math.max(24, Math.round(((block.endMin - block.startMin) / 60) * hourPx) - 2);
  const lines = block.lines ?? [];
  const capacity = Math.max(0, Math.floor((height - 46) / 17));
  const shown = lines.length > capacity ? lines.slice(0, Math.max(0, capacity - 1)) : lines;
  const hidden = lines.length - shown.length;
  return (
    <Link
      href={block.href}
      title={block.title}
      className="absolute flex flex-col overflow-hidden rounded-lg px-2.5 py-1.5 text-xs leading-[1.3] transition-opacity hover:opacity-90"
      style={{
        top,
        height,
        left: `calc(6px + ${block.lane * 22}%)`,
        right: 6,
        background: block.swatch.tint,
        color: block.swatch.ink,
        zIndex: block.lane + 1,
        boxShadow: block.lane > 0 ? "0 0 0 2px var(--surface)" : undefined,
      }}
    >
      <span className="tnum font-semibold">{block.time}</span>
      <span>{block.secondary}</span>
      {shown.length > 0 ? (
        <span className="mt-1 flex flex-col gap-[3px] text-[11px]">
          {shown.map((line, i) => (
            <span key={i} className="flex gap-2">
              <span className="tnum shrink-0 opacity-70">{line.time}</span>
              <span className="shrink-0 opacity-70">{line.repo}</span>
              <span className="truncate">{line.message}</span>
            </span>
          ))}
          {hidden > 0 ? (
            <span className="opacity-70">{n(m.activity.otherCommits, hidden)}</span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}
