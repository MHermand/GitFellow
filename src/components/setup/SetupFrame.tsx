"use client";

import { useI18n } from "@/i18n/client";

export type SetupStep = "github" | "repos" | "sync";
const STEPS: SetupStep[] = ["github", "repos", "sync"];

/** Cadre de l'assistant : la marque, les trois étapes, et la carte de l'étape en cours. */
export function SetupFrame({ step, children }: { step: SetupStep; children: React.ReactNode }) {
  const { m } = useI18n();
  const index = STEPS.indexOf(step);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-4 py-12 md:py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <img src="/gitfellow-logo.svg" alt="" width={56} height={56} style={{ width: 56, height: 56 }} />
        <h1 className="text-2xl font-bold tracking-tight">{m.setup.title}</h1>
      </header>

      <ol className="flex items-center justify-center gap-2 text-xs font-medium" aria-label={m.setup.title}>
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
                {done ? "✓" : i + 1}
              </span>
              <span className={current ? "text-ink" : "text-muted"}>{m.setup.steps[s]}</span>
              {i < STEPS.length - 1 ? <span className="mx-1 h-px w-6 bg-line" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>

      <section className="rounded-xl border border-line bg-surface p-6 shadow-sm md:p-8">{children}</section>
    </main>
  );
}
