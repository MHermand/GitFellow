"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { beginDeviceFlow, connectWithToken, pollDeviceFlow, type ActionResult } from "@/actions/setup";
import { GitHubIcon } from "@/components/icons";
import { btnGhost, btnPrimary, inputBase, Notice } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DeviceCode } from "@/lib/github";

type Phase = { kind: "idle" } | { kind: "code"; code: DeviceCode } | { kind: "error"; message: string };

/** Étape 1 : connexion par GitHub (code à saisir sur github.com) ou jeton collé. */
export function ConnectGitHub({ deviceFlow }: { deviceFlow: boolean }) {
  const { m } = useI18n();
  const g = m.setup.github;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const stop = useRef(false);

  async function start() {
    setStarting(true);
    const result = await beginDeviceFlow();
    setStarting(false);
    if ("error" in result) {
      setPhase({ kind: "error", message: result.error });
      return;
    }
    setPhase({ kind: "code", code: result });
    window.open(result.verificationUri, "_blank", "noopener");
  }

  // Interroge GitHub au rythme qu'il demande, jusqu'à la confirmation ou l'expiration du code.
  useEffect(() => {
    if (phase.kind !== "code") return;
    stop.current = false;
    let delay = (phase.code.interval + 1) * 1000;
    const deadline = Date.now() + phase.code.expiresIn * 1000;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stop.current) return;
      if (Date.now() > deadline) {
        setPhase({ kind: "error", message: g.expired });
        return;
      }
      const result = await pollDeviceFlow(phase.code.deviceCode);
      if (stop.current) return;
      if (result.status === "done") {
        router.push("/setup?step=repos");
        router.refresh();
        return;
      }
      if (result.status === "expired") return setPhase({ kind: "error", message: g.expired });
      if (result.status === "denied") return setPhase({ kind: "error", message: g.denied });
      if (result.status === "error") return setPhase({ kind: "error", message: result.message });
      if (result.status === "slow_down") delay += 5000;
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, delay);
    return () => {
      stop.current = true;
      clearTimeout(timer);
    };
  }, [phase, router, g.expired, g.denied]);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Presse-papiers indisponible : le code reste lisible à l'écran.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-2">{g.intro}</p>

      {deviceFlow ? (
        <div className="flex flex-col gap-4">
          {phase.kind !== "code" ? (
            <button type="button" onClick={start} disabled={starting} className={`${btnPrimary} self-start`}>
              <GitHubIcon />
              {g.device}
            </button>
          ) : (
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg p-4">
              <span className="text-sm text-ink-2">{g.codeLabel}</span>
              <div className="flex flex-wrap items-center gap-3">
                <code className="tnum rounded-md border border-line bg-surface px-3 py-2 text-2xl font-bold tracking-[0.2em] text-ink">
                  {phase.code.userCode}
                </code>
                <button type="button" onClick={() => copy(phase.code.userCode)} className={btnGhost}>
                  {copied ? g.copied : g.copy}
                </button>
                <a href={phase.code.verificationUri} target="_blank" rel="noreferrer" className={btnGhost}>
                  {g.open}
                </a>
              </div>
              <span className="flex items-center gap-2 text-xs text-muted">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden />
                {g.waiting}
              </span>
            </div>
          )}
          {phase.kind === "error" ? <Notice kind="error">{phase.message}</Notice> : null}
        </div>
      ) : (
        <Notice kind="info">{g.noClientId}</Notice>
      )}

      <TokenForm only={!deviceFlow} />
    </div>
  );
}

function TokenForm({ only }: { only: boolean }) {
  const { m } = useI18n();
  const g = m.setup.github;
  const [state, action, pending] = useActionState<ActionResult, FormData>(connectWithToken, { error: null });
  return (
    <form action={action} className={`flex flex-col gap-3 ${only ? "" : "border-t border-line pt-6"}`}>
      <label htmlFor="token" className="text-sm font-medium">
        {only ? g.tokenTitleOnly : g.tokenTitle}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="off"
          required
          placeholder={g.tokenPlaceholder}
          className={`${inputBase} h-10 min-w-0 flex-1 px-3`}
        />
        <button type="submit" disabled={pending} className={btnGhost}>
          {g.tokenButton}
        </button>
      </div>
      <p className="text-xs text-muted">{g.tokenHelp}</p>
      {state.error ? <Notice kind="error">{state.error}</Notice> : null}
    </form>
  );
}
