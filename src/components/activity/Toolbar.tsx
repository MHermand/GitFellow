import { runSync } from "@/actions/sync";
import type { ChipItem } from "@/lib/activity-view";
import { activityHref, type ActivityParams } from "@/lib/activity";
import { FilterMenus } from "./FilterMenus";
import { SyncButton } from "./SyncButton";

/** Filtres et synchronisation : la même barre sur le rapport et sur une fiche. */
export function ActivityToolbar({
  params,
  today,
  people,
  repos,
  hue,
  base,
}: {
  params: ActivityParams;
  today: string;
  people: ChipItem[];
  repos: ChipItem[];
  hue: string;
  base?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <FilterMenus params={params} today={today} people={people} repos={repos} hue={hue} base={base} />
      <form action={runSync}>
        <input type="hidden" name="back" value={activityHref(params, {}, today, base)} />
        <SyncButton />
      </form>
    </div>
  );
}
