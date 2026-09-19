"use client";

import { useI18n } from "@/i18n/client";
import { fmtHours } from "@/lib/format";
import { rampFor } from "@/lib/palette";
import type { PeriodSummary, RepoStat, RhythmView, TrendPoint } from "@/lib/activity-view";
import { StartScroll } from "./scrollers";
import { TipCard, useTip } from "./tooltip";

export type { PeriodSummary, RepoStat, RhythmView, TrendPoint };

/** Carte de période : une seule jauge pour toutes les personnes, le détail au survol. */
export function PeriodStats({ summary }: { summary: PeriodSummary }) {
  const { bind, layer } = useTip();
  const { m } = useI18n();
  if (summary.people.length === 0) return <p className="text-sm text-muted">{m.activity.noPeople}</p>;
  const tip = (person: PeriodSummary["people"][number]) => <TipCard title={person.name} dot={person.dot} rows={person.rows} />;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-1.5">
        <span className="tnum text-2xl font-bold tracking-tight">{summary.shown}</span>
        {summary.suffix ? <span className="text-xs text-muted">{summary.suffix}</span> : null}
      </div>

      <div className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-track" aria-label={m.activity.splitPeople}>
        {summary.people
          .filter((p) => p.share > 0)
          .map((p) => (
            <div key={p.id} {...bind(tip(p))} className="h-full" style={{ width: `${p.share * 100}%`, background: p.dot }} />
          ))}
      </div>

      {layer}
    </div>
  );
}

/** Répartition par dépôt : une barre empilée, le détail de chaque dépôt au survol. */
export function RepoStats({ repos }: { repos: RepoStat[] }) {
  const { bind, layer } = useTip();
  const { m } = useI18n();
  if (repos.length === 0) return <p className="text-sm text-muted">{m.activity.noActivity}</p>;
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-track" aria-label={m.activity.splitRepos}>
        {repos.map((r) => (
          <div
            key={r.repo}
            {...bind(<TipCard title={r.repo} dot={r.dot} rows={r.rows} />)}
            className="h-full transition-opacity hover:opacity-75"
            style={{ width: `${Math.max(r.share * 100, 1.5)}%`, background: r.dot }}
          />
        ))}
      </div>
      {layer}
    </div>
  );
}

const CELL = 16;
const GAP = 3;

/** Carte jour × heure : 8h → 20h visibles, le reste au défilement latéral. */
export function RhythmChart({ rhythm, hue }: { rhythm: RhythmView; hue: string }) {
  const { bind, layer } = useTip();
  const { m, t } = useI18n();
  const ramp = rampFor(hue);
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const track = { display: "grid", gridTemplateColumns: "repeat(24, minmax(0, 1fr))", gap: GAP, width: "200%" } as const;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="flex flex-col" style={{ gap: GAP }}>
          {rhythm.rows.map((row, r) => (
            <span key={r} className="flex items-center text-[11px] text-muted" style={{ height: CELL }}>
              {row.letter}
            </span>
          ))}
        </div>
        <StartScroll ratio={8 / 24} className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex flex-col" style={{ gap: GAP, width: "200%" }}>
            {rhythm.rows.map((row, r) => (
              <div key={r} style={{ ...track, width: "100%" }}>
                {hours.map((h) => {
                  const cell = row.cells[h];
                  return (
                    <div
                      key={h}
                      {...bind(
                        cell.shown ? (
                          <TipCard
                            title={`${row.title} · ${t(m.activity.hourRange, { from: h, to: h + 1 })}`}
                            rows={[
                              { label: m.activity.tip.time, value: cell.shown },
                              { label: m.activity.tip.commits, value: String(cell.commits) },
                              { label: m.activity.tip.sessions, value: String(cell.sessions) },
                            ]}
                          />
                        ) : null,
                      )}
                      className="rounded-[3px]"
                      style={{ height: CELL, background: ramp[cell.level] }}
                    />
                  );
                })}
              </div>
            ))}
            <div style={{ ...track, width: "100%" }}>
              {hours.map((h) => (
                <span key={h} className="tnum text-center text-[10px] text-muted">
                  {h % 2 === 0 ? `${h}h` : ""}
                </span>
              ))}
            </div>
          </div>
        </StartScroll>
      </div>
      {layer}
    </div>
  );
}

/** Temps par semaine, comparé au seuil cumulé des personnes sélectionnées. */
export function TrendChart({ points, thresholdHours, color }: { points: TrendPoint[]; thresholdHours: number; color: string }) {
  const { bind, layer } = useTip();
  const { m, t, locale } = useI18n();
  const maxMinutes = Math.max(thresholdHours * 60, ...points.map((p) => p.minutes), 60) * 1.1;
  const pct = (minutes: number) => (minutes / maxMinutes) * 100;
  // La valeur en clair va à la barre de la période affichée ; sinon à la plus haute.
  const labelled = points.find((p) => p.current) ?? points.reduce<TrendPoint | null>((best, p) => (best && best.minutes >= p.minutes ? best : p), null);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 pt-5">
        <div className="relative h-full">
          <div className="flex h-full items-end gap-1">
            {points.map((p) => (
              <div
                key={p.label}
                {...bind(<TipCard title={p.title} rows={p.rows} />)}
                className="relative flex h-full flex-1 items-end"
              >
                <div
                  className="w-full rounded-t-[4px] transition-opacity hover:opacity-75"
                  style={{ height: `max(${pct(p.minutes)}%, 2px)`, background: p.minutes ? color : "var(--line)" }}
                />
                {p === labelled && p.minutes > 0 ? (
                  <span
                    className="tnum absolute left-1/2 -translate-x-1/2 bg-surface px-1 text-[11px] font-semibold whitespace-nowrap text-ink"
                    style={{ bottom: `calc(${pct(p.minutes)}% + 4px)` }}
                  >
                    {p.shown}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          {thresholdHours > 0 ? (
            <>
              <div className="absolute right-0 left-0 border-t border-dashed border-ink-2" style={{ bottom: `${pct(thresholdHours * 60)}%` }} />
              <span className="absolute left-0 bg-surface pr-1 text-[10px] text-ink-2" style={{ bottom: `calc(${pct(thresholdHours * 60)}% + 3px)` }}>
                {t(m.activity.threshold, { hours: fmtHours(thresholdHours, locale) })}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="mt-1 flex gap-1">
        {points.map((p) => (
          <span key={p.label} className="tnum flex-1 text-center text-[11px] text-muted">
            {p.label}
          </span>
        ))}
      </div>
      {layer}
    </div>
  );
}
