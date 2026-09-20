"use client";

import { CheckIcon } from "@/components/icons";
import { useI18n } from "@/i18n/client";
import { ProductPeek } from "./ProductPeek";

export type SetupStep = "github" | "repos" | "sync";
const STEPS: SetupStep[] = ["github", "repos", "sync"];

/**
 * Cadre de l'assistant : à gauche la promesse, les trois garanties et un aperçu du rapport ;
 * à droite la carte de l'étape. Les deux colonnes ont la même hauteur — la plus haute impose
 * la sienne, l'autre répartit son contenu de haut en bas.
 */
export function SetupFrame({ step, children }: { step: SetupStep; children: React.ReactNode }) {
  const { m } = useI18n();
  const index = STEPS.indexOf(step);
  const guarantees = [m.setup.guarantees.local, m.setup.guarantees.readOnly, m.setup.guarantees.revocable];
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-10 md:px-8 md:py-16">
      <div className="grid gap-8 md:grid-cols-2 md:gap-14">
        {/* La marque et la promesse restent en haut ; l'aperçu se cale en bas, quelle que soit la hauteur de la carte. */}
        <aside className="flex flex-col justify-between gap-8">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2.5">
              <img src="/gitfellow-logo.svg" alt="" width={32} height={32} style={{ width: 32, height: 32 }} />
              <span className="text-lg font-bold tracking-tight">{m.app.name}</span>
            </div>
            <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.03em] md:text-3xl">{m.setup.promise}</h1>
            <ul className="flex flex-col gap-2.5">
              {guarantees.map((text) => (
                <li key={text} className="flex items-start gap-2.5 text-sm leading-snug">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-good" strokeWidth={2.4} />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <ProductPeek />
        </aside>

        <section className="flex flex-col rounded-xl border border-line bg-surface p-7 shadow-sm md:p-9">
          <ol className="flex flex-wrap items-center gap-2 text-xs font-medium" aria-label={m.setup.title}>
            {STEPS.map((s, i) => {
              const done = i < index;
              const current = i === index;
              return (
                <li key={s} className="flex items-center gap-2">
                  <span
                    aria-current={current ? "step" : undefined}
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                      current ? "bg-accent text-white" : done ? "bg-accent-soft text-accent-fg" : "bg-track text-muted"
                    }`}
                  >
                    {done ? <CheckIcon className="h-3 w-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={current ? "text-ink" : "text-muted"}>{m.setup.stepsShort[s]}</span>
                  {i < STEPS.length - 1 ? <span className="mx-1 h-px w-5 bg-line" aria-hidden /> : null}
                </li>
              );
            })}
          </ol>
          <div className="mt-6 flex flex-1 flex-col">{children}</div>
        </section>
      </div>
    </main>
  );
}
