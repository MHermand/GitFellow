"use client";

import { CheckIcon } from "@/components/icons";
import { useI18n } from "@/i18n/client";

export type SetupStep = "github" | "repos" | "sync";
const STEPS: SetupStep[] = ["github", "repos", "sync"];

/**
 * Cadre de l'assistant : un panneau d'encre porte la marque, la promesse et les trois garanties ;
 * la moitié claire accueille l'étape, sans cadre — c'est le panneau qui tient la page.
 */
export function SetupFrame({ step, children }: { step: SetupStep; children: React.ReactNode }) {
  const { m } = useI18n();
  const index = STEPS.indexOf(step);
  const guarantees = [m.setup.guarantees.local, m.setup.guarantees.readOnly, m.setup.guarantees.revocable];

  return (
    // Le panneau garde une largeur de lecture : il ne s'étire pas avec l'écran.
    <main className="flex min-h-screen flex-col md:grid md:h-screen md:min-h-0 md:grid-cols-[minmax(18rem,30rem)_1fr] md:overflow-hidden">
      <aside className="relative flex flex-col justify-between gap-10 overflow-hidden bg-ink px-8 py-10 text-white md:px-12 md:py-14">
        {/* Trame discrète : le fond sombre respire sans rien raconter. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="relative flex flex-col gap-5">
          <img src="/gitfellow-logo.svg" alt="" width={64} height={64} style={{ width: 64, height: 64 }} />
          {/* Aligné à gauche : justifié, une ligne de trois mots à 38 px écarte les blancs du simple au triple.
              38 px est le plafond ici — au-delà, l'anglais casse en trois lignes dans les 384 px du panneau. */}
          <h1 className="text-[28px] leading-[1.1] font-bold tracking-[-0.035em] md:text-[38px]">
            {m.setup.headline} <span className="text-accent-dark">{m.setup.headlineBrand}</span>
          </h1>
          {/* Un peu d'air sous le titre : la phrase se lit comme une suite, pas comme un sous-titre collé. */}
          <p className="mt-3 text-justify text-[15px] leading-relaxed text-muted hyphens-auto">{m.setup.tagline}</p>
        </div>
        <ul className="relative flex flex-col gap-3">
          {guarantees.map((text) => (
            <li key={text} className="flex items-start gap-2.5 text-sm leading-snug text-white/85">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent-dark" strokeWidth={2.4} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* Le panneau reste en place d'une étape à l'autre ; c'est cette colonne seule qui défile. */}
      <section className="flex flex-1 items-center justify-center px-6 py-10 md:min-h-0 md:overflow-y-auto md:px-12 md:py-14">
        <div className="flex w-full max-w-[400px] flex-col gap-6">
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
          {children}
        </div>
      </section>
    </main>
  );
}
