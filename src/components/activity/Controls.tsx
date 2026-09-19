"use client";

import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, TodayIcon } from "@/components/icons";
import { useI18n } from "@/i18n/client";
import { activityHref, type ActivityParams } from "@/lib/activity";
import type { View } from "@/lib/calendar";

const VIEWS: { key: View; label: "day" | "week" | "month" }[] = [
  { key: "jour", label: "day" },
  { key: "semaine", label: "week" },
  { key: "mois", label: "month" },
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
  base,
}: {
  params: ActivityParams;
  today: string;
  prevDay: string;
  nextDay: string;
  /** Page visée par chaque commande (la fiche d'une personne, par exemple) ; par défaut le rapport. */
  base?: string;
}) {
  const { m } = useI18n();
  const href = (patch: { view?: View; day?: string }) => activityHref(params, patch, today, base);
  return (
    <div className="flex w-full items-center gap-2 lg:w-72">
      <div className="inline-flex flex-1 justify-between rounded-[10px] bg-track p-[3px]" role="group" aria-label={m.views.group}>
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
              {m.views[v.label]}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-0.5">
        <Link href={href({ day: prevDay })} className={iconButton} aria-label={m.views.previous} title={m.views.previous}>
          <ChevronLeftIcon />
        </Link>
        <Link href={href({ day: today })} className={iconButton} aria-label={m.views.today} title={m.views.today}>
          <TodayIcon />
        </Link>
        <Link href={href({ day: nextDay })} className={iconButton} aria-label={m.views.next} title={m.views.next}>
          <ChevronRightIcon />
        </Link>
      </div>
    </div>
  );
}
