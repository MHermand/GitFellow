"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { beginDeviceFlow, connectWithToken, pollDeviceFlow, type ActionResult } from "@/actions/setup";
import { CheckIcon, CopyIcon, ExternalLinkIcon, GitHubIcon } from "@/components/icons";
import { btnGhost, btnPrimary, inputBase, Notice } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DeviceCode } from "@/lib/github";

type Phase = { kind: "idle"; error: string | null } | { kind: "code"; code: DeviceCode };

const IDLE: Phase = { kind: "idle", error: null };

/** Étape 1 : connexion par GitHub (code à saisir sur github.com), le jeton collé en secours. */
export function ConnectGitHub({ deviceFlow }: { deviceFlow: boolean }) {
  const { m, t } = useI18n();
  const g = m.setup.github;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(IDLE);
  const [tokenOpen, setTokenOpen] = useState(!deviceFlow);
  const [starting, setStarting] = useState(false);
  const stop = useRef(false);

  async function start() {
    setStarting(true);
    const result = await beginDeviceFlow();
    setStarting(false);
    if ("error" in result) {
      setPhase({ kind: "idle", error: result.error });
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
    const fail = (message: string) => setPhase({ kind: "idle", error: message });
    const tick = async () => {
      if (stop.current) return;
      if (Date.now() > deadline) return fail(g.expired);
      const result = await pollDeviceFlow(phase.code.deviceCode);
      if (stop.current) return;
      if (result.status === "done") {
        router.push("/setup?step=repos");
        router.refresh();
        return;
      }
      if (result.status === "expired") return fail(g.expired);
      if (result.status === "denied") return fail(g.denied);
      if (result.status === "error") return fail(result.message);
      if (result.status === "slow_down") delay += 5000;
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, delay);
    return () => {
      stop.current = true;
      clearTimeout(timer);
    };
  }, [phase, router, g.expired, g.denied]);

  if (phase.kind === "code") {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{g.codeTitle}</h2>
          <p className="mt-1.5 text-sm text-ink-2">{g.codeIntro}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <code className="tnum flex h-16 flex-1 items-center justify-center rounded-xl border border-line bg-bg px-4 text-[30px] font-bold tracking-[0.22em] whitespace-nowrap text-ink">
            {phase.code.userCode}
          </code>
          <CopyButton value={phase.code.userCode} />
        </div>
        <a href={phase.code.verificationUri} target="_blank" rel="noreferrer" className={`${btnPrimary} w-full`}>
          {g.openDevice}
          <ExternalLinkIcon />
        </a>
        <p className="flex items-center gap-2.5 text-xs text-ink-2">
          <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden />
          {t(g.waitingFor, { minutes: Math.max(1, Math.round(phase.code.expiresIn / 60)) })}
        </p>
        <div className="border-t border-line pt-5">
          <button type="button" onClick={() => setPhase(IDLE)} className="text-sm text-ink-2 underline-offset-[3px] hover:text-ink hover:underline">
            {g.cancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      {deviceFlow ? (
        <>
          <div>
            <h2 className="text-xl font-bold tracking-tight">{g.connectTitle}</h2>
            {/* Justifiée sur la largeur du bouton, comme la note qui le suit. */}
            <p className="mt-1.5 text-justify text-sm text-ink-2">{g.connectIntro}</p>
          </div>
          {phase.error ? <Notice kind="error">{phase.error}</Notice> : null}
          <button type="button" onClick={start} disabled={starting} className={`${btnPrimary} h-11 w-full`}>
            <GitHubIcon />
            {phase.error ? g.retry : g.device}
          </button>
          {/* Justifiée sur la largeur du bouton : le bloc de texte a le même aplomb que lui. */}
          <p className="w-full text-justify text-xs leading-relaxed text-muted">{g.codeNote}</p>
        </>
      ) : (
        <>
          <h2 className="text-xl font-bold tracking-tight">{g.tokenTitleOnly}</h2>
          <Notice kind="info">{g.noClientId}</Notice>
        </>
      )}

      <div className={deviceFlow ? "border-t border-line pt-5" : ""}>
        {/* Souligné en permanence : c'est la seule autre voie, elle doit se voir sans survol. */}
        {tokenOpen ? (
          <TokenForm withTitle={deviceFlow} />
        ) : (
          <button
            type="button"
            onClick={() => setTokenOpen(true)}
            className="text-sm text-ink-2 underline underline-offset-[3px] transition-colors hover:text-accent"
          >
            {g.useToken}
          </button>
        )}
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const { m } = useI18n();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Presse-papiers indisponible : le code reste lisible à l'écran.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? m.setup.github.copied : m.setup.github.copy}
      title={copied ? m.setup.github.copied : m.setup.github.copy}
      className={`${btnGhost} h-11 w-11 shrink-0 px-0`}
    >
      {copied ? <CheckIcon className="text-good" /> : <CopyIcon />}
    </button>
  );
}

function TokenForm({ withTitle }: { withTitle: boolean }) {
  const { m } = useI18n();
  const g = m.setup.github;
  const [state, action, pending] = useActionState<ActionResult, FormData>(connectWithToken, { error: null });
  return (
    <form action={action} className="flex flex-col gap-3">
      {withTitle ? (
        <label htmlFor="token" className="text-sm font-medium">
          {g.tokenTitle}
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="off"
          autoFocus={withTitle}
          required
          placeholder={g.tokenPlaceholder}
          aria-label={g.tokenTitleOnly}
          className={`${inputBase} h-10 min-w-0 flex-1 px-3`}
        />
        <button type="submit" disabled={pending} className={btnGhost}>
          {g.tokenButton}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-muted">{g.tokenHelp}</p>
      {state.error ? <Notice kind="error">{state.error}</Notice> : null}
    </form>
  );
}
