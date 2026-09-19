"use client";

import { useI18n } from "@/i18n/client";
import { weekdayIndex } from "@/lib/calendar";
import type { BlockView } from "@/lib/activity-view";
import { gridBackground, hourLabels, SessionBlock } from "./blocks";
import { CALENDAR_BOX } from "./frame";
import { GRID_TOP_PAD, useHourScale } from "./scrollers";

const HEADER_PX = 44;
const COLUMNS = "grid-cols-[48px_repeat(7,minmax(0,1fr))]";

export function WeekGrid({
  days,
  today,
  blocksByDay,
  tz,
  hue,
}: {
  days: string[];
  today: string;
  blocksByDay: Record<string, BlockView[]>;
  tz: string;
  /** Teinte de la page : le repère du jour la porte comme le reste. */
  hue: string;
}) {
  const { m } = useI18n();
  const { ref, hourPx } = useHourScale(HEADER_PX, 12, 8, 44);
  const gridHeight = 24 * hourPx;
  return (
    <div className={CALENDAR_BOX}>
      <div ref={ref} className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[820px]">
          <div className={`sticky top-0 z-10 grid ${COLUMNS} bg-surface`} style={{ height: HEADER_PX }}>
            <div className="border-b border-line" />
            {days.map((day) => {
              const [, , d] = day.split("-");
              const isToday = day === today;
              return (
                <div key={day} className="flex items-center gap-1.5 border-b border-l border-line/60 border-b-line px-2">
                  <span className="text-[11px] tracking-[0.04em] text-ink-2 uppercase">{m.dates.weekdaysShort[weekdayIndex(day, tz)]}</span>
                  <span
                    className="tnum inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-semibold tracking-tight"
                    style={isToday ? { background: hue, color: "#fff" } : undefined}
                  >
                    {Number(d)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className={`grid ${COLUMNS}`} style={{ paddingTop: GRID_TOP_PAD }}>
            <div className="relative" style={{ height: gridHeight }}>
              {hourLabels(hourPx)}
            </div>
            {days.map((day) => (
              <div key={day} className="relative border-l border-line/60" style={{ height: gridHeight, ...gridBackground(hourPx) }}>
                {(blocksByDay[day] ?? []).map((block) => (
                  <SessionBlock key={block.key} block={block} hourPx={hourPx} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
