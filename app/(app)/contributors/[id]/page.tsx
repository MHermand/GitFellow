import Link from "next/link";
import { notFound } from "next/navigation";
import { PeriodControls } from "@/components/activity/Controls";
import { ActivityToolbar } from "@/components/activity/Toolbar";
import { Meter } from "@/components/Meter";
import { PageHue } from "@/components/PageHue";
import { StatusIcon } from "@/components/StatusIcon";
import { ArrowLeftIcon } from "@/components/icons";
import { Card, Notice, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { activityHref, parseActivityParams, type RawSearchParams } from "@/lib/activity";
import { elapsedWorkingDays, periodFor } from "@/lib/calendar";
import { targetForWorkingDays, WORKING_DAYS_PER_WEEK } from "@/lib/target";
import { filterChips } from "@/lib/activity-view";
import { swatch } from "@/lib/palette";
import { loadCommitsBetween, loadContributors, loadRepos, loadSettings, toContributorRow, toReportParams } from "@/lib/data";
import { fmtHours, fmtMinutes, fmtPercent } from "@/lib/format";
import { buildReport, sessionsByDay, targetStatus } from "@/lib/report";
import { getStore } from "@/lib/runtime";
import { rawMinutes, sessionMinutes } from "@/lib/sessions";
import { dayKey, dayLabel, fmtInTz } from "@/lib/weeks";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export default async function ContributorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const store = getStore();
  const { locale, m, t, n } = await getI18n();
  const { id } = await params;
  const raw = await searchParams;

  const [contributorDb, settings, repos, contributorsDb] = await Promise.all([
    store.contributor(id),
    loadSettings(store),
    loadRepos(store),
    loadContributors(store),
  ]);
  if (!contributorDb) notFound();
  const contributor = toContributorRow(contributorDb);

  const tz = settings.timezone;
  const now = new Date();
  const today = dayKey(now, tz);
  const range = parseActivityParams(raw, tz, now);
  const period = periodFor(range.view, range.day, tz, locale);

  const from = new Date(period.start.getTime() - DAY);
  const allCommits = await loadCommitsBetween(store, from, period.end, tz, repos);
  // Le filtre Dépôts de la barre d'outils s'applique ici aussi.
  const selectedRepos = range.repos === null ? null : new Set(range.repos);
  const commits = selectedRepos ? allCommits.filter((c) => selectedRepos.has(c.repo)) : allCommits;
  // Le rapport est construit sur tout le monde : les commits sans contributeur sont alors
  // correctement identifiés, et les menus de filtres listent les mêmes personnes qu'ailleurs.
  const active = contributorsDb.filter((c) => c.active).map(toContributorRow);
  const roster = active.some((c) => c.id === contributor.id) ? active : [...active, contributor];
  const { reports } = buildReport(commits, roster, toReportParams(settings));
  const own = reports.find((r) => r.contributor.id === contributor.id)!;
  // Une session compte dans la période où elle commence, comme partout ailleurs.
  const sessions = own.sessions.filter(
    (s) => s.start.getTime() >= period.start.getTime() && s.start.getTime() < period.end.getTime(),
  );
  const days = sessionsByDay(sessions, tz);
  const stat = {
    minutes: sessions.reduce((sum, s) => sum + sessionMinutes(s), 0),
    rawMinutes: sessions.reduce((sum, s) => sum + rawMinutes(s), 0),
    sessions: sessions.length,
    commits: sessions.reduce((sum, s) => sum + s.events.length, 0),
  };

  // Objectif de la période : l'objectif quotidien sur cinq jours pour une semaine, cumulé sur les
  // jours ouvrés écoulés sinon.
  const targetHours = targetForWorkingDays(
    contributor.target,
    range.view === "semaine" ? WORKING_DAYS_PER_WEEK : elapsedWorkingDays(period.days, today, tz),
    period.anchorDay,
    tz,
  );
  const inProgress = range.view !== "mois" && period.days.includes(today);
  const status = targetStatus(stat.minutes, targetHours, { inProgress });
  const statusLabel = m.contributor.status[status.key];

  const chips = filterChips(roster, repos.filter((r) => r.enabled).map((r) => `${r.owner}/${r.name}`));
  const base = `/contributors/${contributor.id}`;
  // Même teinte que sur le rapport : la personne garde sa couleur d'une page à l'autre.
  const hue = swatch(Math.max(0, roster.findIndex((c) => c.id === contributor.id))).dot;

  return (
    <>
      <PageHue hue={hue} />
      <PageHeader
        title={t(m.contributor.title, { name: contributor.displayName })}
        subtitle={period.label}
        leading={
          <Link
            href={activityHref(range, {}, today)}
            aria-label={m.contributor.back}
            title={m.contributor.back}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink-2 transition-colors hover:bg-accent-soft hover:text-accent-fg"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
        }
        actions={
          <div className="flex flex-wrap items-center gap-4">
            <ActivityToolbar params={range} today={today} people={chips.people} repos={chips.repos} hue={hue} base={base} />
            <PeriodControls params={range} today={today} prevDay={period.prevDay} nextDay={period.nextDay} base={base} />
          </div>
        }
      />

      {raw.kind === "error" && typeof raw.msg === "string" ? <Notice kind="error">{raw.msg}</Notice> : null}

      {/* Les trois tuiles prennent la largeur des commandes de période, pour s'aligner dessus. */}
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[220px] flex-1 rounded-xl border border-line bg-surface p-4 shadow-sm">
          <div className="text-xs text-ink-2">{m.contributor.conventionalTime}</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="tnum text-3xl font-bold tracking-tight">{fmtMinutes(stat.minutes)}</span>
            {targetHours > 0 ? <span className="text-sm whitespace-nowrap text-muted">{t(m.activity.target, { hours: fmtHours(targetHours, locale) })}</span> : null}
            {status.ratio !== null ? (
              <span className="ml-auto flex items-center gap-1 self-center text-sm whitespace-nowrap text-muted" title={statusLabel}>
                <StatusIcon level={status.level} />
                <span className="tnum">{fmtPercent(status.ratio, locale)}</span>
              </span>
            ) : null}
          </div>
          <div className="mt-2">
            <Meter ratio={status.ratio} color={hue} label={statusLabel} />
          </div>
        </div>
        <Tile label={m.contributor.rawTime} value={fmtMinutes(stat.rawMinutes)} />
        <Tile label={m.contributor.sessions} value={String(stat.sessions)} />
        <Tile label={m.contributor.commits} value={String(stat.commits)} />
      </div>

      {days.length === 0 ? (
        <Card title={m.contributor.noSession}>
          <p className="text-sm text-ink-2">
            {t(m.contributor.noSessionHint, { name: contributor.displayName })}{" "}
            <Link href="/settings" className="underline">
              {m.common.settings}
            </Link>{" "}
            {m.contributor.orSync}
          </p>
        </Card>
      ) : (
        days.map((day) => (
          <Card
            key={day.day}
            title={capitalize(dayLabel(day.day, tz, locale))}
            actions={<span className="tnum text-sm font-semibold">{fmtMinutes(day.minutes)}</span>}
          >
            <ul className="space-y-3">
              {day.sessions.map((session) => (
                <li key={session.start.toISOString()} className="rounded-xl border border-line p-3 md:px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <span className="tnum font-semibold">
                        {fmtInTz(session.start, tz, "HH:mm")} → {fmtInTz(session.end, tz, "HH:mm")}
                      </span>
                      {dayOf(session.end, tz) !== day.day ? (
                        <span className="ml-1 text-xs text-muted">{t(m.contributor.endsOn, { date: fmtInTz(session.end, tz, m.dates.dayMonth, locale) })}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-ink-2">
                      <span className="tnum font-medium text-ink">{fmtMinutes(sessionMinutes(session))}</span> {m.activity.conventional} ·{" "}
                      <span className="tnum">{fmtMinutes(rawMinutes(session))}</span> {m.activity.raw} · {n(m.common.commits, session.events.length)}
                    </div>
                  </div>
                  <ol className="mt-2 space-y-1 text-xs">
                    {session.events.map((event) => (
                      <li key={`${event.repo}-${event.sha}`} className="flex gap-2">
                        <span className="tnum w-10 shrink-0 text-muted">{fmtInTz(event.at, tz, "HH:mm")}</span>
                        <span className="shrink-0 text-muted">{event.repo.split("/")[1]}</span>
                        {event.url ? (
                          <a href={event.url} target="_blank" rel="noreferrer" className="truncate text-ink hover:underline">
                            {event.message || event.sha.slice(0, 7)}
                          </a>
                        ) : (
                          <span className="truncate">{event.message || event.sha.slice(0, 7)}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-full shrink-0 rounded-xl border border-line bg-surface p-4 shadow-sm sm:w-72">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="tnum mt-1 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function dayOf(date: Date, tz: string): string {
  return fmtInTz(date, tz, "yyyy-MM-dd");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
