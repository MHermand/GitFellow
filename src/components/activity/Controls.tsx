import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, TodayIcon } from "@/components/icons";
import { activityHref, type ActivityParams } from "@/lib/activity";
import type { View } from "@/lib/calendar";

const VIEWS: { key: View; label: string }[] = [
  { key: "jour", label: "Jour" },
  { key: "semaine", label: "Semaine" },
  { key: "mois", label: "Mois" },
];

const iconButton =
  "inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-ink transition-colors hover:bg-accent-soft hover:text-accent-fg";

/**
 * Commandes de période : le sélecteur de vue et la navigation, sur la largeur de la colonne
 * de droite pour que les deux blocs s'alignent.
 */
export function PeriodControls({
  params,
  today,
  prevDay,
  nextDay,
  hrefFor,
}: {
  params: ActivityParams;
  today: string;
  prevDay: string;
  nextDay: string;
  /** Destination de chaque commande ; par défaut la page d'activité avec ses filtres. */
  hrefFor?: (patch: { view?: View; day?: string }) => string;
}) {
  const href = hrefFor ?? ((patch: { view?: View; day?: string }) => activityHref(params, patch, today));
  return (
    <div className="flex w-full items-center gap-2 lg:w-72">
      <div className="inline-flex flex-1 justify-between rounded-[10px] bg-track p-[3px]" role="group" aria-label="Vue">
        {VIEWS.map((v) => {
          const active = v.key === params.view;
          return (
            <Link
              key={v.key}
              href={href({ view: v.key })}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-[34px] items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors ${
                active ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
              }`}
            >
              {v.label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-0.5">
        <Link href={href({ day: prevDay })} className={iconButton} aria-label="Période précédente" title="Période précédente">
          <ChevronLeftIcon />
        </Link>
        <Link href={href({ day: today })} className={iconButton} aria-label="Aujourd'hui" title="Aujourd'hui">
          <TodayIcon />
        </Link>
        <Link href={href({ day: nextDay })} className={iconButton} aria-label="Période suivante" title="Période suivante">
          <ChevronRightIcon />
        </Link>
      </div>
    </div>
  );
}
