import { describe, expect, it } from "vitest";
import { parseActivityParams } from "./activity";
import { buildActivityView } from "./activity-view";
import { periodFor } from "./calendar";
import { DATA_HUE, shadesFor, SWATCHES } from "./palette";
import { buildReport, type CommitRow, type ContributorRow } from "./report";
import { addWeeksToKey, currentWeek, dayKey, weeksRange } from "./weeks";

const tz = "Europe/Paris";
const now = new Date("2026-09-18T10:00:00+02:00");
const today = dayKey(now, tz);
const thisWeek = currentWeek(tz, now);
const felix: ContributorRow = { id: "felix", displayName: "Félix", githubLogins: ["Felixooos"], authorEmails: [], authorNames: [], target: { hours: 25, unit: "week" }, active: true };
const max: ContributorRow = { id: "max", displayName: "Maxence", githubLogins: ["MHermand"], authorEmails: [], authorNames: [], target: { hours: 0, unit: "week" }, active: true };

let n = 0;
const commit = (login: string, iso: string, repo: string): CommitRow => ({
  repoId: repo, repo, sha: `s${++n}`, authorName: login, authorEmail: null, authorLogin: login, prAuthorLogin: null,
  authoredAt: new Date(iso).toISOString(), message: "m", isMerge: false, htmlUrl: null,
});
const commits = [
  commit("Felixooos", "2026-09-14T09:00:00+02:00", "a/x"),
  commit("Felixooos", "2026-09-14T10:00:00+02:00", "a/x"),
  commit("Felixooos", "2026-09-14T11:00:00+02:00", "a/y"),
  commit("MHermand", "2026-09-14T10:30:00+02:00", "a/y"),
  commit("Felixooos", "2026-09-13T23:00:00+02:00", "a/x"),
  commit("Felixooos", "2026-09-14T00:39:00+02:00", "a/x"),
];

function build(raw: Record<string, string>) {
  const params = parseActivityParams(raw, tz, now);
  const period = periodFor(params.view, params.day, tz);
  const reference = thisWeek;
  const { reports } = buildReport(commits, [felix, max], { preMinutes: 30, gapMinutes: 120, postMinutes: 30, timezone: tz });
  return buildActivityView({
    params, period, reports, contributors: [felix, max], repoLabels: ["a/x", "a/y"], tz, today, thisWeek,
    trendWeeks: weeksRange(addWeeksToKey(reference, -1, tz), 7, tz),
  });
}

describe("buildActivityView", () => {
  it("vue Semaine : blocs par jour, session à cheval sur minuit découpée, voies de chevauchement", () => {
    const view = build({ view: "semaine", date: "2026-09-14" });
    const monday = view.blocksByDay["2026-09-14"];
    // segment 00:00 → 01:09 de la session du dimanche soir + session du matin de Félix + session de Maxence
    expect(monday).toHaveLength(3);
    const spill = monday.find((b) => b.startMin === 0);
    expect(spill?.time).toBe("…–01:09");
    // le dimanche appartient à la semaine précédente : son segment y apparaît, coupé à minuit
    const previous = build({ view: "semaine", date: "2026-09-13" });
    expect(previous.blocksByDay["2026-09-13"][0].time).toBe("22:30–…");
    expect(Object.keys(view.blocksByDay)).not.toContain("2026-09-13");
    const lanes = monday.filter((b) => b.startMin >= 8 * 60).map((b) => b.lane).sort();
    expect(lanes).toEqual([0, 1]);
  });

  it("carte de période groupée, dépôts, rythme et tendance", () => {
    const view = build({ view: "semaine", date: "2026-09-14" });
    // une seule jauge : total des personnes sélectionnées, seuils cumulés
    expect(view.summary.minutes).toBe(240);
    expect(view.summary.shown).toBe("4h00");
    expect(view.summary.suffix).toBe("/ 25 h");
    expect(view.summary.people.map((p) => p.id)).toEqual(["felix", "max"]);
    expect(view.summary.people[0].shown).toBe("3h00");
    // mêmes indicateurs, même ordre, quelle que soit la vue
    expect(view.summary.people[0].rows.map((r) => r.label)).toEqual(["Temps", "Commits", "Sessions", "Jours actifs"]);
    // à plusieurs, chaque valeur porte sa part : Maxence signe 1 commit sur 4, et travaille
    // 1 jour sur les 5 jours ouvrés de la semaine
    const maxence = new Map(view.summary.people[1].rows.map((r) => [r.label, r]));
    expect(maxence.get("Commits")).toMatchObject({ value: "1", share: expect.stringMatching(/^25.%$/) });
    expect(maxence.get("Temps")).toMatchObject({ value: "1h00", share: expect.stringMatching(/^25.%$/) });
    expect(maxence.get("Jours actifs")).toMatchObject({ value: "1", share: expect.stringMatching(/^20.%$/) });
    // parts de la jauge : remplissage (240 / 1500) réparti au prorata du temps de chacun
    expect(view.summary.people[0].share).toBeCloseTo(0.12, 5);
    expect(view.summary.people[1].share).toBeCloseTo(0.04, 5);

    expect(view.repoStats.map((r) => r.repo)).toEqual(["x", "y"]);
    expect(view.repoStats[0].minutes + view.repoStats[1].minutes).toBe(240);
    expect(view.repoStats[0].share + view.repoStats[1].share).toBeCloseTo(1, 5);
    // le survol d'un dépôt donne sa part, sans ventilation par personne
    expect(view.repoStats[0].rows.map((r) => r.label)).toEqual(["Temps", "Commits"]);
    expect(view.repoStats[0].rows[0]).toMatchObject({ value: "2h00", share: expect.stringMatching(/^50.%$/) });

    // rythme : lundi 10h = Félix (60 min) + Maxence (60 min), deux sessions, deux commits
    expect(view.rhythm!.rows).toHaveLength(7);
    expect(view.rhythm!.rows.map((r) => r.letter)).toEqual(["L", "M", "M", "J", "V", "S", "D"]);
    expect(view.rhythm!.rows[0].title).toBe("Lundi 14 septembre");
    expect(view.rhythm!.rows[0].cells[10]).toEqual({ level: 5, shown: "2h00", sessions: 2, commits: 2 });
    expect(view.rhythm!.rows[0].cells[9]).toEqual({ level: 3, shown: "1h00", sessions: 1, commits: 1 });
    expect(view.rhythm!.rows[1].cells[10].shown).toBe("");

    // tendance de la vue Semaine : les sept jours, sans seuil (le seuil est hebdomadaire)
    expect(view.trend.map((t) => t.label)).toEqual(["L 14", "M 15", "M 16", "J 17", "V 18", "S 19", "D 20"]);
    expect(view.trendThreshold).toBe(0);
    expect(view.trend[0]).toMatchObject({ title: "Lundi 14 septembre", minutes: 240, shown: "4h00", current: false });
    expect(view.trend[0].rows.map((r) => r.label)).toEqual(["Temps", "Commits", "Sessions", "Jours actifs"]);
    expect(view.trend[0].rows.find((r) => r.label === "Temps")!.share).toMatch(/^100.%$/);
    expect(view.trend[1].minutes).toBe(0);
    // la barre en clair est celle d'aujourd'hui (vendredi 18)
    expect(view.trend.filter((t) => t.current).map((t) => t.label)).toEqual(["V 18"]);
    // la session du dimanche soir compte dans sa propre semaine
    const previousWeek = build({ view: "semaine", date: "2026-09-13" });
    expect(previousWeek.trend[6]).toMatchObject({ label: "D 13", minutes: 159, shown: "2h39" });
  });

  it("filtre par personne : la sélection porte sur toutes les cartes", () => {
    const view = build({ view: "semaine", date: "2026-09-14", people: "max" });
    expect(view.summary.people.map((p) => p.id)).toEqual(["max"]);
    expect(view.summary.suffix).toBe("sans seuil");
    expect(view.trendThreshold).toBe(0);
    expect(view.blocksByDay["2026-09-14"]).toHaveLength(1);
    // le calendrier n'a plus qu'une lecture des couleurs : une teinte par personne
    expect(view.blocksByDay["2026-09-14"][0].primary).toBe("Maxence");
    expect(view.blocksByDay["2026-09-14"][0].secondary).toBe("y");
    expect(view.people[0].swatch).not.toBeNull();
    expect(view.repos[0].swatch).toBeNull();
  });

  it("vue Jour : colonnes et repères", () => {
    const view = build({ view: "jour", date: "2026-09-14" });
    expect(view.dayColumns.map((c) => c.name)).toEqual(["Félix", "Maxence"]);
    expect(view.dayColumns[0].blocks).toHaveLength(2);
    // tendance de la vue Jour : les sept jours de la semaine du jour affiché, celui-ci en clair
    expect(view.trend.map((t) => t.label)).toEqual(["L 14", "M 15", "M 16", "J 17", "V 18", "S 19", "D 20"]);
    expect(view.trend.filter((t) => t.current).map((t) => t.label)).toEqual(["L 14"]);
    expect(view.trend[0].minutes).toBe(240);
    // rythme : la matrice garde ses sept lignes, seule celle du jour affiché porte des données
    expect(view.rhythm!.rows).toHaveLength(7);
    expect(view.rhythm!.rows[0].title).toBe("Lundi 14 septembre");
    expect(view.rhythm!.rows[0].cells[10].shown).toBe("2h00");
    expect(view.rhythm!.rows[1].title).toBe("Mardi");
    expect(view.rhythm!.rows[1].cells.every((c) => c.shown === "")).toBe(true);
  });

  it("vue Mois : grille, puces et cumul du mois", () => {
    const view = build({ view: "mois", date: "2026-09-18" });
    expect(view.monthRows).toHaveLength(5);
    const s38 = view.monthRows[2];
    expect(s38.inProgress).toBe(true);
    expect(s38.days[0].chips.map((c) => c.name)).toEqual(["Félix", "Maxence"]);
    expect(view.periodTitle).toBe("Septembre 2026");
    // objectif du mois : 25 h par semaine sur cinq jours ouvrés, arrêté au 18 (14 jours ouvrés)
    expect(view.summary.suffix).toBe("/ 70 h");
    // le survol ne répète plus le temps de la personne ni son objectif
    expect(view.summary.people[0].rows.map((r) => r.label)).toEqual(["Temps", "Commits", "Sessions", "Jours actifs"]);
    // mois terminé : les 21 jours ouvrés d'août
    expect(build({ view: "mois", date: "2026-08-10" }).summary.suffix).toBe("/ 105 h");
    // le rythme agrège les jours de même nom sur le mois
    expect(view.rhythm!.rows[0].title).toBe("Lundis du mois");
    expect(view.rhythm!.rows[0].cells[10].shown).toBe("2h00");
    // tendance de la vue Mois : sept semaines, comparées au seuil cumulé
    expect(view.trend).toHaveLength(7);
    expect(view.trendThreshold).toBe(25);
    expect(view.trend[6]).toMatchObject({ label: "S37", title: "Semaine 37 · 7–13 sept.", shown: "2h39", current: true });
    expect(view.trend[6].rows.map((r) => r.label)).toEqual(["Temps", "Commits", "Sessions", "Jours actifs"]);
  });
});

describe("teinte de la page", () => {
  it("prend la couleur de la personne quand elle est seule", () => {
    expect(build({ view: "semaine", date: "2026-09-14", people: "felix" }).hue).toBe(SWATCHES[0].dot);
    expect(build({ view: "semaine", date: "2026-09-14", people: "max" }).hue).toBe(SWATCHES[1].dot);
  });

  it("revient à la teinte de données à plusieurs", () => {
    expect(build({ view: "semaine", date: "2026-09-14" }).hue).toBe(DATA_HUE);
  });

  it("suit la personne visible quand l'autre n'a rien fait sur la période", () => {
    // Le dimanche 13, seul Félix a une session, les deux étant sélectionnés.
    expect(build({ view: "jour", date: "2026-09-13" }).hue).toBe(SWATCHES[0].dot);
    // Le lundi 14, les deux sont à l'écran : retour à la teinte de données.
    expect(build({ view: "jour", date: "2026-09-14" }).hue).toBe(DATA_HUE);
  });

  it("colore les dépôts en paliers de cette teinte, du plus gros au plus petit", () => {
    const view = build({ view: "semaine", date: "2026-09-14" });
    expect(view.repoStats.map((r) => r.dot)).toEqual(shadesFor(DATA_HUE, view.repoStats.length));
  });
});
