"use client";

import { useI18n } from "@/i18n/client";
import { SWATCHES } from "@/lib/palette";

/** Une session posée sur la mini-grille : jour (0-4), début et fin en heures, personne, dépôt. */
interface Block {
  day: number;
  from: number;
  to: number;
  person: number;
  repo: number;
}

const HOURS = [9, 10, 11, 12, 13];
const HOUR_PX = 30;
const BLOCKS: Block[] = [
  { day: 0, from: 9.1, to: 11.9, person: 0, repo: 0 },
  { day: 1, from: 9.7, to: 11.5, person: 1, repo: 1 },
  { day: 1, from: 12.25, to: 13.8, person: 0, repo: 1 },
  { day: 2, from: 8.9, to: 11, person: 2, repo: 0 },
  { day: 3, from: 10.3, to: 13.5, person: 1, repo: 2 },
  { day: 4, from: 9.4, to: 13.3, person: 0, repo: 0 },
];

function clock(hour: number): string {
  const h = Math.floor(hour);
  const min = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Aperçu du rapport : cinq jours, quelques sessions, les vraies couleurs. Illustration, pas donnée. */
export function ProductPeek() {
  const { m } = useI18n();
  const top = HOURS[0];
  const height = HOURS.length * HOUR_PX;
  return (
    <div aria-hidden className="hidden overflow-hidden rounded-xl border border-line bg-surface shadow-sm md:block">
      <div className="grid h-8 grid-cols-[34px_repeat(5,minmax(0,1fr))] border-b border-line">
        <span />
        {[14, 15, 16, 17, 18].map((day, i) => (
          <span key={day} className="flex items-center gap-1.5 border-l border-line/60 pl-2 text-[10px] tracking-[0.04em] text-ink-2 uppercase">
            {m.dates.weekdaysShort[i]}
            <b className="text-xs font-semibold tracking-normal text-ink">{day}</b>
          </span>
        ))}
      </div>
      <div
        className="grid grid-cols-[34px_repeat(5,minmax(0,1fr))]"
        style={{ height, backgroundImage: `repeating-linear-gradient(to bottom, var(--track) 0, var(--track) 1px, transparent 1px, transparent ${HOUR_PX}px)` }}
      >
        <div className="flex flex-col pr-1.5 text-right text-[9px] text-muted">
          {HOURS.map((h) => (
            <span key={h} className="-translate-y-1.5" style={{ height: HOUR_PX }}>
              {h}h
            </span>
          ))}
        </div>
        {[0, 1, 2, 3, 4].map((day) => (
          <div key={day} className="relative border-l border-line/60">
            {BLOCKS.filter((b) => b.day === day).map((b) => {
              const swatch = SWATCHES[b.person];
              return (
                <div
                  key={`${b.day}-${b.from}`}
                  className="absolute right-1 left-1 overflow-hidden rounded-md px-1.5 py-0.5 text-[9px] leading-[1.25]"
                  style={{
                    top: (b.from - top) * HOUR_PX,
                    height: (b.to - b.from) * HOUR_PX,
                    background: swatch.tint,
                    color: swatch.ink,
                  }}
                >
                  <b className="tnum block font-semibold">
                    {clock(b.from)}–{clock(b.to)}
                  </b>
                  {m.setup.peek.people[b.person]} · {m.setup.peek.repos[b.repo]}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
