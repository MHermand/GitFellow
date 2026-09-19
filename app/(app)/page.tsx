import Link from "next/link";
import { PeriodControls } from "@/components/activity/Controls";
import { DayGrid } from "@/components/activity/DayGrid";
import { MonthGrid } from "@/components/activity/MonthGrid";
import { ActivityToolbar } from "@/components/activity/Toolbar";
import { WeekGrid } from "@/components/activity/WeekGrid";
import { StatCard } from "@/components/activity/cards";
import { PeriodStats, RepoStats, RhythmChart, TrendChart } from "@/components/activity/charts";
import { PageHue } from "@/components/PageHue";
import { Notice, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { parseActivityParams, type RawSearchParams } from "@/lib/activity";
import { buildActivityView } from "@/lib/activity-view";
import { periodFor } from "@/lib/calendar";
import { loadCommitsBetween, loadContributors, loadRepos, loadSettings, toContributorRow, toReportParams } from "@/lib/data";
import { buildReport } from "@/lib/report";
import { getStore } from "@/lib/runtime";
import { addWeeksToKey, compareWeeks, currentWeek, dayKey, weekEnd, weekStart, weeksRange } from "@/lib/weeks";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const store = getStore();
  const { locale, m } = await getI18n();
  const raw = await searchParams;

  const [settings, contributorsDb, repos] = await Promise.all([
    loadSettings(store),
    loadContributors(store),
    loadRepos(store),
  ]);
  const tz = settings.timezone;
  const now = new Date();
  const today = dayKey(now, tz);
  const thisWeek = currentWeek(tz, now);

  const params = parseActivityParams(raw, tz, now);
  const period = periodFor(params.view, params.day, tz, locale);
  // La tendance se calcule par rapport à la période affichée, sans dépasser la semaine en cours.
  const reference = compareWeeks(period.week, thisWeek) < 0 ? period.week : thisWeek;
  const trendWeeks = weeksRange(addWeeksToKey(reference, -1, tz), 7, tz);

  const from = new Date(Math.min(weekStart(trendWeeks[0], tz).getTime(), period.start.getTime()) - DAY);
  const to = new Date(Math.max(period.end.getTime(), weekEnd(reference, tz).getTime()));
  const allCommits = await loadCommitsBetween(store, from, to, tz, repos);

  const enabledRepos = repos.filter((r) => r.enabled);
  const repoLabels = enabledRepos.map((r) => `${r.owner}/${r.name}`);
  const selectedRepoIds = params.repos === null ? null : new Set(params.repos);
  const commits = selectedRepoIds ? allCommits.filter((c) => selectedRepoIds.has(c.repo)) : allCommits;

  const contributors = contributorsDb.filter((c) => c.active).map(toContributorRow);
  const { reports } = buildReport(commits, contributors, toReportParams(settings));

  const view = buildActivityView({ params, period, reports, contributors, repoLabels, tz, today, thisWeek, trendWeeks, locale });

  return (
    <div className="flex flex-col gap-6 lg:h-full lg:min-h-0">
      <PageHue hue={view.hue} />
      <PageHeader
        title={m.activity.title}
        subtitle={period.label}
        actions={
          <div className="flex flex-wrap items-center gap-4">
            <ActivityToolbar params={params} today={today} people={view.people} repos={view.repos} hue={view.hue} />
            <PeriodControls params={params} today={today} prevDay={period.prevDay} nextDay={period.nextDay} />
          </div>
        }
      />

      {raw.kind === "error" && typeof raw.msg === "string" ? <Notice kind="error">{raw.msg}</Notice> : null}
      {repos.length === 0 ? (
        <Notice kind="info">
          {m.activity.noRepos}{" "}
          <Link href="/settings" className="underline">
            {m.common.settings}
          </Link>
          .
        </Notice>
      ) : null}
      {contributors.length === 0 ? (
        <Notice kind="info">
          {m.activity.noContributors}{" "}
          <Link href="/settings" className="underline">
            {m.common.settings}
          </Link>
          .
        </Notice>
      ) : null}

      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row">
        <div className="min-w-0 flex-1 lg:h-full">
          {params.view === "semaine" ? (
            <WeekGrid days={period.days} today={today} blocksByDay={view.blocksByDay} tz={tz} hue={view.hue} />
          ) : params.view === "jour" ? (
            <DayGrid columns={view.dayColumns} />
          ) : (
            <MonthGrid rows={view.monthRows} hue={view.hue} />
          )}
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 lg:h-full lg:w-72 lg:overflow-y-auto">
          <StatCard title={view.periodTitle}>
            <PeriodStats summary={view.summary} />
          </StatCard>
          <StatCard title={m.activity.byRepo}>
            <RepoStats repos={view.repoStats} />
          </StatCard>
          {view.rhythm ? (
            <StatCard title={m.activity.rhythm}>
              <RhythmChart rhythm={view.rhythm} hue={view.hue} />
            </StatCard>
          ) : null}
          {view.trend.length > 0 ? (
            <StatCard title={m.activity.trend} fill>
              <TrendChart points={view.trend} thresholdHours={view.trendThreshold} color={view.hue} />
            </StatCard>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
