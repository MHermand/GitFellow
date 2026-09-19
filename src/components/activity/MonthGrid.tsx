"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { fmtMinutes } from "@/lib/format";
import type { MonthWeekRow } from "@/lib/activity-view";
import { weekId } from "@/lib/weeks";
import { CALENDAR_BOX } from "./frame";

export type { MonthWeekRow };

const HEADER_PX = 44;

export function MonthGrid({ rows, hue }: { rows: MonthWeekRow[]; hue: string }) {
  const { m } = useI18n();
  return (
    <div className={CALENDAR_BOX}>
      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className="grid h-full min-w-[680px] grid-cols-[repeat(7,minmax(0,1fr))]"
          style={{ gridTemplateRows: `${HEADER_PX}px repeat(${Math.max(1, rows.length)}, minmax(88px, 1fr))` }}
        >
          {m.dates.weekdaysShort.map((name, i) => (
            <div key={i} className="flex items-center border-b border-line px-2 text-[11px] tracking-[0.04em] text-ink-2 uppercase">
              {name}
            </div>
          ))}
          {rows.map((row) => (
            <MonthRow key={weekId(row.week)} row={row} hue={hue} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthRow({ row, hue }: { row: MonthWeekRow; hue: string }) {
  return (
    <>
      {row.days.map((cell) => {
        const [, , d] = cell.day.split("-");
        return (
          <div key={cell.day} className="flex flex-col gap-1 overflow-hidden border-t border-l border-line/60 px-1 py-1.5 first:border-l-0">
            <span
              className={`tnum inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                cell.isToday ? "text-white" : cell.inMonth ? "text-ink" : "text-line-strong"
              }`}
              style={cell.isToday ? { background: hue } : undefined}
            >
              {Number(d)}
            </span>
            {cell.chips.map((chip) => (
              <Link
                key={chip.id}
                href={chip.href}
                title={`${chip.name} · ${fmtMinutes(chip.minutes)}`}
                className="tnum h-[18px] shrink-0 truncate rounded px-1 text-[11px] leading-[18px] font-medium tracking-[-0.01em]"
                style={{ background: chip.swatch.tint, color: chip.swatch.ink }}
              >
                {chip.name} {fmtMinutes(chip.minutes)}
              </Link>
            ))}
          </div>
        );
      })}
    </>
  );
}
