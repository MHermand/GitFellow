"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import { parseDay } from "@/lib/calendar";
import { forgetConnection, saveConnection } from "@/lib/connect";
import { describeError, pollDeviceToken, requestDeviceCode, type DeviceCode, type DevicePoll } from "@/lib/github";
import { githubClientId } from "@/lib/github-app";
import { isFakeGitHub } from "@/lib/github-client";
import { autoTrackAuthors } from "@/lib/onboarding";
import { forgetRepos } from "@/lib/repos-catalog";
import { getStore } from "@/lib/runtime";
import { DuplicateError } from "@/lib/store";
import { runSyncAll } from "@/lib/sync-runner";

export interface ActionResult {
  error: string | null;
}

function refreshAll() {
  revalidatePath("/", "layout");
}

// ---- Étape 1 : GitHub

export async function beginDeviceFlow(): Promise<DeviceCode | { error: string }> {
  const { m } = await getI18n();
  const clientId = githubClientId();
  if (!clientId) return { error: m.setup.github.noClientId };
  if (isFakeGitHub()) {
    return { deviceCode: "fake", userCode: "ABCD-1234", verificationUri: "https://github.com/login/device", expiresIn: 900, interval: 5 };
  }
  try {
    return await requestDeviceCode(clientId);
  } catch (err) {
    return { error: describeError(err, m) };
  }
}

/** Une interrogation de GitHub ; « done » enregistre la connexion. */
export async function pollDeviceFlow(deviceCode: string): Promise<DevicePoll> {
  const { m } = await getI18n();
  const clientId = githubClientId();
  if (!clientId || !deviceCode || deviceCode.length > 200) return { status: "error", message: m.setup.github.noClientId };
  if (isFakeGitHub()) return { status: "pending" };
  let result: DevicePoll;
  try {
    result = await pollDeviceToken(clientId, deviceCode);
  } catch (err) {
    return { status: "error", message: describeError(err, m) };
  }
  if (result.status !== "done") return result;
  try {
    await saveConnection(result.token, "device");
    refreshAll();
    // Le jeton ne repart pas vers le navigateur : il est déjà enregistré.
    return { status: "done", token: "" };
  } catch (err) {
    return { status: "error", message: describeError(err, m) };
  }
}

export async function connectWithToken(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { m } = await getI18n();
  const token = String(formData.get("token") ?? "").trim();
  if (!/^[A-Za-z0-9_]{20,255}$/.test(token)) return { error: m.setup.github.tokenRejected };
  try {
    await saveConnection(token, "token");
  } catch {
    return { error: m.setup.github.tokenRejected };
  }
  refreshAll();
  redirect("/setup?step=repos");
}

export async function disconnectGitHub() {
  forgetConnection();
  forgetRepos();
  refreshAll();
  redirect("/setup");
}

// ---- Étape 2 : dépôts

const REPO_NAME = /^[\w.-]+\/[\w.-]+$/;

const chooseSchema = z.object({
  repos: z.array(z.string().regex(REPO_NAME)).min(1).max(200),
  tracked_since: z.string().nullable(),
});

export async function chooseRepos(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = chooseSchema.safeParse({
    repos: formData.getAll("repos").map((v) => String(v)),
    tracked_since: parseDay(String(formData.get("tracked_since") ?? "").trim() || null),
  });
  if (!parsed.success) return { error: m.setup.repos.needOne };

  const store = getStore();
  for (const fullName of parsed.data.repos) {
    const [owner, name] = fullName.split("/");
    try {
      await store.addRepo({ owner, name, tracked_since: parsed.data.tracked_since });
    } catch (err) {
      if (!(err instanceof DuplicateError)) throw err;
    }
  }
  // La première synchronisation part tout de suite ; l'étape suivante en montre la progression.
  void runSyncAll({ describe: (err) => describeError(err, m) });
  refreshAll();
  redirect("/setup?step=sync");
}

// ---- Étape 3 : après la première synchronisation

export async function finalizeSetup(): Promise<{ authors: number }> {
  const authors = await autoTrackAuthors(getStore());
  refreshAll();
  return { authors };
}
