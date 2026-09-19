"use client";

import { useRef, useState } from "react";
import { inputBase } from "@/components/ui";
import { DATA_HUE, rampFor } from "@/lib/palette";
import { fmtMinutes } from "@/lib/format";

const FIELDS = [
  { key: "pre_minutes", label: "Temps avant le premier commit", min: 0, max: 240 },
  { key: "gap_minutes", label: "Temps maximal entre deux commits", min: 1, max: 720 },
  { key: "post_minutes", label: "Temps après le dernier commit", min: 0, max: 240 },
] as const;

/** Colonne des libellés : les champs démarrent alors sur la même verticale que les listes du dessus. */
const LABEL_COL = "w-60 shrink-0";

/**
 * Les trois tampons de la règle, avec la session qu'ils dessinent mise à jour en direct.
 * L'enregistrement part quand un champ est quitté, pas à chaque incrément.
 */
export function RulesFields({ pre, gap, post }: { pre: number; gap: number; post: number }) {
  const initial = { pre_minutes: String(pre), gap_minutes: String(gap), post_minutes: String(post) };
  const [values, setValues] = useState<Record<string, string>>(initial);
  const saved = useRef<Record<string, string>>({ ...initial });
  const shown = (key: string) => Math.max(0, Number(values[key]) || 0);

  function saveIfChanged(field: HTMLInputElement) {
    if (field.value === "" || field.value === saved.current[field.name]) return;
    saved.current[field.name] = field.value;
    field.form?.requestSubmit();
  }

  return (
    <div className="grid items-center gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        {FIELDS.map((field) => (
          <div key={field.key} className="flex max-w-[26rem] items-center gap-x-3">
            <label htmlFor={field.key} className={`${LABEL_COL} text-sm text-ink-2`}>
              {field.label}
            </label>
            <input
              id={field.key}
              name={field.key}
              type="number"
              min={field.min}
              max={field.max}
              value={values[field.key]}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              onBlur={(e) => saveIfChanged(e.currentTarget)}
              className={`${inputBase} h-9 w-9 px-0 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
            />
            <span className="text-xs text-muted">min</span>
          </div>
        ))}
      </div>

      <SessionDiagram pre={shown("pre_minutes")} gap={Math.max(1, shown("gap_minutes"))} post={shown("post_minutes")} />
    </div>
  );
}

function dur(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return minutes % 60 === 0 ? `${minutes / 60} h` : fmtMinutes(minutes);
}

/**
 * Une session d'exemple posée sur une échelle horaire : les commits en pastilles, les deux
 * tampons hachurés, et trois légendes reliées à la partie qu'elles gouvernent. Les commits
 * sont placés en fraction de l'écart maximal, pour que le dessin reste vrai quelle qu'en
 * soit la valeur — l'écart le plus large y reste toujours inférieur au réglage.
 */
function SessionDiagram({ pre, gap, post }: { pre: number; gap: number; post: number }) {
  const step = Math.floor(gap * 0.28);
  const widest = Math.floor(gap * 0.9);
  // L'écart le plus large est placé au milieu : la légende centrée sur le cœur tombe dessus.
  const commits = [0, step, step + widest, 2 * step + widest];
  const last = commits[commits.length - 1];
  const start = -pre;
  const end = last + post;
  const margin = Math.max(12, (end - start) * 0.06);
  const from = start - margin;
  const to = end + margin;

  const W = 500;
  const H = 134;
  const PAD = 8;
  const x = (m: number) => PAD + ((m - from) / (to - from)) * (W - PAD * 2);
  const yBand = 58;
  const hBand = 36;

  // La frise est une donnée, pas une commande : elle porte la teinte de données.
  const ramp = rampFor(DATA_HUE);
  const coreStart = x(commits[0]);
  const coreEnd = Math.max(coreStart + 2, x(last));

  const lead = (cx: number, label: string, value: string) => (
    <g>
      <text x={cx} y={22} textAnchor="middle" fontSize={11} fill="var(--color-ink-2)">
        {label}
      </text>
      <text x={cx} y={37} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--color-ink)" className="tnum">
        {value}
      </text>
      <line x1={cx} y1={44} x2={cx} y2={yBand - 3} stroke="var(--color-line-strong)" strokeWidth={1} />
    </g>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img"
      aria-label={`Une session d'exemple : ${pre} minutes avant le premier commit, ${post} minutes après le dernier, commits séparés d'au plus ${gap} minutes.`}>
      <defs>
        <pattern id="cra-buffer" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke={DATA_HUE} strokeWidth={1.4} opacity={0.45} />
        </pattern>
      </defs>

      {/* Tampons hachurés, cœur plein : le temps ajouté se distingue du temps entre commits. */}
      {pre > 0 ? (
        <>
          <rect x={x(start)} y={yBand} width={coreStart - x(start)} height={hBand} rx={7} fill={ramp[1]} />
          <rect x={x(start)} y={yBand} width={coreStart - x(start)} height={hBand} rx={7} fill="url(#cra-buffer)" />
        </>
      ) : null}
      {post > 0 ? (
        <>
          <rect x={coreEnd} y={yBand} width={x(end) - coreEnd} height={hBand} rx={7} fill={ramp[1]} />
          <rect x={coreEnd} y={yBand} width={x(end) - coreEnd} height={hBand} rx={7} fill="url(#cra-buffer)" />
        </>
      ) : null}
      <rect x={coreStart} y={yBand} width={coreEnd - coreStart} height={hBand} rx={5} fill={DATA_HUE} />
      {commits.map((m, i) => (
        <circle key={i} cx={x(m)} cy={yBand + hBand / 2} r={4} fill={DATA_HUE} stroke="var(--color-surface)" strokeWidth={2} />
      ))}

      {pre > 0 ? lead((x(start) + coreStart) / 2, "avant le 1er commit", `${pre} min`) : null}
      {post > 0 ? lead((coreEnd + x(end)) / 2, "après le dernier", `${post} min`) : null}

      {/* Légende de l'écart, centrée sur le cœur du bloc. */}
      <line x1={(coreStart + coreEnd) / 2} y1={yBand + hBand + 3} x2={(coreStart + coreEnd) / 2} y2={yBand + hBand + 14}
        stroke="var(--color-line-strong)" strokeWidth={1} />
      <text x={(coreStart + coreEnd) / 2} y={yBand + hBand + 28} textAnchor="middle" fontSize={11} fill="var(--color-ink-2)">
        écart entre deux commits{" "}
        <tspan fontWeight={600} fill="var(--color-ink)" className="tnum">
          {dur(widest)} ≤ {dur(gap)}
        </tspan>
      </text>

    </svg>
  );
}
