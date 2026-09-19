"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseList } from "@/lib/attribution";
import { parseLocale } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { parseDay } from "@/lib/calendar";
import { getStore } from "@/lib/runtime";
import { DuplicateError } from "@/lib/store";

function back(kind: "success" | "error", msg: string): never {
  redirect(`/settings?kind=${kind}&msg=${encodeURIComponent(msg)}`);
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/contributors/[id]", "page");
}

/** Champ date d'un formulaire : "" ou une date invalide valent « pas de date ». */
function optionalDay(value: FormDataEntryValue | null): string | null {
  return parseDay(typeof value === "string" ? value.trim() : null);
}

const REPO_RE = /^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

export async function addRepo(formData: FormData) {
  const { m, t } = await getI18n();
  const raw = String(formData.get("repo") ?? "").trim();
  const match = REPO_RE.exec(raw);
  if (!match) back("error", m.settings.repos.formatError);
  const [, owner, name] = match;

  // Sans date de début de suivi, tout l'historique du dépôt est lu.
  try {
    await getStore().addRepo({ owner, name, tracked_since: optionalDay(formData.get("tracked_since")) });
  } catch (err) {
    back("error", err instanceof DuplicateError ? t(m.settings.repos.duplicate, { repo: `${owner}/${name}` }) : String(err instanceof Error ? err.message : err));
  }
  refresh();
  back("success", t(m.settings.repos.added, { repo: `${owner}/${name}` }));
}

/** Date à partir de laquelle l'activité du dépôt est synchronisée et comptée. */
export async function setRepoTrackedSince(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const trackedSince = optionalDay(formData.get("tracked_since"));
  await getStore().updateRepo(id, { tracked_since: trackedSince });
  refresh();
  redirect("/settings");
}

export async function deleteRepo(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const { m } = await getI18n();
  await getStore().deleteRepo(id);
  refresh();
  back("success", m.settings.repos.removed);
}

const contributorSchema = z.object({
  id: z.uuid().optional(),
  display_name: z.string().trim().min(1, "required").max(80),
  github_logins: z.string().optional(),
  author_emails: z.string().optional(),
  author_names: z.string().optional(),
  target_hours: z.coerce.number().min(0).max(400),
  target_unit: z.enum(["day", "week", "month"]),
});

export async function saveContributor(formData: FormData) {
  const { m } = await getI18n();
  const parsed = contributorSchema.safeParse({
    id: formData.get("id") || undefined,
    display_name: formData.get("display_name"),
    github_logins: formData.get("github_logins") ?? "",
    author_emails: formData.get("author_emails") ?? "",
    author_names: formData.get("author_names") ?? "",
    target_hours: formData.get("target_hours") || 0,
    target_unit: formData.get("target_unit") || "week",
  });
  if (!parsed.success) back("error", parsed.error.issues.some((i) => i.message === "required") ? m.settings.authors.nameRequired : parsed.error.issues.map((i) => i.message).join(" "));

  const values = {
    display_name: parsed.data.display_name,
    github_logins: parseList(parsed.data.github_logins),
    author_emails: parseList(parsed.data.author_emails),
    author_names: parseList(parsed.data.author_names),
    target_hours: parsed.data.target_hours,
    target_unit: parsed.data.target_unit,
  };

  if (parsed.data.id) await getStore().updateContributor(parsed.data.id, values);
  else await getStore().insertContributor(values);
  refresh();
  redirect("/settings");
}

const authorSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  githubLogins: z.array(z.string().trim().min(1).max(80)).max(20),
  authorEmails: z.array(z.string().trim().min(1).max(160)).max(20),
  authorNames: z.array(z.string().trim().min(1).max(80)).max(20),
});

/** Suit un auteur détecté : crée le contributeur avec ses identités déjà rattachées. */
export async function trackAuthor(author: z.input<typeof authorSchema>) {
  const { m } = await getI18n();
  const parsed = authorSchema.safeParse(author);
  if (!parsed.success) back("error", m.settings.authors.unreadable);

  await getStore().insertContributor({
    display_name: parsed.data.displayName,
    github_logins: parsed.data.githubLogins,
    author_emails: parsed.data.authorEmails,
    author_names: parsed.data.authorNames,
    target_hours: 0,
    target_unit: "week",
    active: true,
  });
  refresh();
}

export async function deleteContributor(formData: FormData) {
  const id = z.uuid().parse(formData.get("id"));
  const { m } = await getI18n();
  await getStore().deleteContributor(id);
  refresh();
  back("success", m.settings.authors.deleted);
}

const settingsSchema = z.object({
  pre_minutes: z.coerce.number().int().min(0).max(240),
  gap_minutes: z.coerce.number().int().min(1).max(720),
  post_minutes: z.coerce.number().int().min(0).max(240),
});

export async function saveSettings(formData: FormData) {
  const parsed = settingsSchema.safeParse({
    pre_minutes: formData.get("pre_minutes"),
    gap_minutes: formData.get("gap_minutes"),
    post_minutes: formData.get("post_minutes"),
  });
  if (!parsed.success) back("error", parsed.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(" · "));

  await getStore().updateSettings(parsed.data);
  // Enregistrement automatique : pas de bandeau à chaque champ quitté.
  refresh();
}

/** Langue de l'application : « auto » remet celle du navigateur. */
export async function saveLocale(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  await getStore().updateSettings({ locale });
  revalidatePath("/", "layout");
  redirect("/settings");
}
