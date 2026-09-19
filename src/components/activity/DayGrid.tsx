"use client";

import { useI18n } from "@/i18n/client";
import { fmtMinutes } from "@/lib/format";
import type { DayColumn } from "@/lib/activity-view";
import { DayBlock, gridBackground, hourLabels } from "./blocks";
import { CALENDAR_BOX } from "./frame";
import { GRID_TOP_PAD, useHourScale } from "./scrollers";

const HEADER_PX = 44;

export type { DayColumn };

export function DayGrid({ columns }: { columns: DayColumn[] }) {
  const { m, n } = useI18n();
  const { ref, hourPx } = useHourScale(HEADER_PX, 12, 8, 56);
  const gridHeight = 24 * hourPx;
  const template = `48px repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))`;
  return (
    <div className={CALENDAR_BOX}>
      <div ref={ref} className="min-h-0 flex-1 overflow-auto">
        <div style={{ minWidth: 200 + columns.length * 260 }}>
          <div className="sticky top-0 z-10 grid bg-surface" style={{ gridTemplateColumns: template, height: HEADER_PX }}>
            <div className="border-b border-line" />
            {columns.map((col) => (
              <div key={col.id} className="flex items-center justify-between gap-2 border-b border-l border-line/60 border-b-line px-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.swatch.dot }} />
                  <span className="text-sm font-semibold">{col.name}</span>
                  <span className="tnum text-[13px] text-ink-2">{col.minutes ? fmtMinutes(col.minutes) : "—"}</span>
                </div>
                <span className="text-[11px] text-muted">
                  {n(m.common.sessions, col.sessions)} · {n(m.common.commits, col.commits)}
                </span>
              </div>
            ))}
            {columns.length === 0 ? (
              <div className="flex items-center border-b border-line px-3 text-sm text-muted">{m.activity.noColumn}</div>
            ) : null}
          </div>
          <div className="grid" style={{ gridTemplateColumns: template, paddingTop: GRID_TOP_PAD }}>
            <div className="relative" style={{ height: gridHeight }}>
              {hourLabels(hourPx)}
            </div>
            {(columns.length ? columns : [null]).map((col, i) => (
              <div key={col?.id ?? i} className="relative border-l border-line/60" style={{ height: gridHeight, ...gridBackground(hourPx) }}>
                {col?.blocks.map((block) => (
                  <DayBlock key={block.key} block={block} hourPx={hourPx} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
