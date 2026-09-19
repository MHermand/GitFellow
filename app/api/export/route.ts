import { NextResponse, type NextRequest } from "next/server";
import { loadCommitsBetween, loadSettings, toContributorRow, toReportParams } from "@/lib/data";
import { buildReport, sessionsByDay } from "@/lib/report";
import { getStore } from "@/lib/runtime";
import { rawMinutes, sessionMinutes } from "@/lib/sessions";
import { fmtInTz, parseWeekId, weekEnd, weekId, weekStart } from "@/lib/weeks";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

/**
 * Export CSV des sessions d'un contributeur.
 *   /api/export?contributor=<uuid>&week=2026-W38
 *   /api/export?contributor=<uuid>&from=2026-09-01&to=2026-09-30   (bornes incluses, jours dans le fuseau)
 */
export async function GET(request: NextRequest) {
  const store = getStore();
  const { searchParams } = new URL(request.url);
  const contributorId = searchParams.get("contributor");
  if (!contributorId) return NextResponse.json({ error: "contributor manquant" }, { status: 400 });

  const contributorDb = await store.contributor(contributorId);
  if (!contributorDb) return NextResponse.json({ error: "contributeur inconnu" }, { status: 404 });
  const contributor = toContributorRow(contributorDb);

  const settings = await loadSettings(store);
  const tz = settings.timezone;

  let from: Date;
  let to: Date;
  let label: string;
  const week = parseWeekId(searchParams.get("week"));
  if (week) {
    from = weekStart(week, tz);
    to = weekEnd(week, tz);
    label = weekId(week);
  } else {
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    if (!fromParam || !toParam || !/^\d{4}-\d{2}-\d{2}$/.test(fromParam) || !/^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      return NextResponse.json({ error: "préciser week=YYYY-Www ou from/to=YYYY-MM-DD" }, { status: 400 });
    }
    from = new Date(`${fromParam}T00:00:00Z`);
    to = new Date(new Date(`${toParam}T00:00:00Z`).getTime() + DAY);
    // Décalage grossier pour couvrir le fuseau : on filtre ensuite par jour local.
    from = new Date(from.getTime() - DAY);
    to = new Date(to.getTime() + DAY);
    label = `${fromParam}_${toParam}`;
  }

  const commits = await loadCommitsBetween(store, new Date(from.getTime() - DAY), to, tz);
  const { reports } = buildReport(commits, [contributor], toReportParams(settings));
  const fromDay = fmtInTz(week ? from : new Date(from.getTime() + DAY), tz, "yyyy-MM-dd");
  const toDay = fmtInTz(week ? new Date(to.getTime() - 1) : new Date(to.getTime() - DAY - 1), tz, "yyyy-MM-dd");
  const days = sessionsByDay(reports[0].sessions, tz).filter((d) => d.day >= fromDay && d.day <= toDay);

  const lines = ["Contributeur;Jour;Début;Fin;Durée conventionnelle (min);Durée brute (min);Commits;Dépôts"];
  for (const day of days) {
    for (const session of day.sessions) {
      const repos = [...new Set(session.events.map((e) => e.repo))].join(" ");
      lines.push(
        [
          contributor.displayName,
          day.day,
          fmtInTz(session.start, tz, "yyyy-MM-dd HH:mm"),
          fmtInTz(session.end, tz, "yyyy-MM-dd HH:mm"),
          String(sessionMinutes(session)),
          String(rawMinutes(session)),
          String(session.events.length),
          repos,
        ]
          .map(csvCell)
          .join(";"),
      );
    }
  }
  const total = days.reduce((sum, d) => sum + d.minutes, 0);
  lines.push(["TOTAL", "", "", "", String(total), "", "", ""].join(";"));

  const filename = `gitfellow_${slug(contributor.displayName)}_${label}.csv`;
  return new NextResponse(`\uFEFF${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csvCell(value: string): string {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
