"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { finalizeSetup } from "@/actions/setup";
import { btnPrimary, Notice } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { SyncProgress } from "@/lib/sync-runner";

/** Étape 3 : la première synchronisation, suivie en direct, puis la mise sous suivi des auteurs. */
export function FirstSync() {
  const { m, t, n } = useI18n();
  const s = m.setup.sync;
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [authors, setAuthors] = useState<number | null>(null);
  const finalized = useRef(false);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/sync/status", { cache: "no-store" });
        const data = (await res.json()) as SyncProgress;
        if (!active) return;
        setProgress(data);
        // La synchro s'est terminée (ou n'a jamais démarré, page rechargée) : on conclut une fois.
        if (!data.running && data.finishedAt && !finalized.current) {
          finalized.current = true;
          const result = await finalizeSetup();
          if (active) setAuthors(result.authors);
          return;
        }
      } catch {
        // Le serveur redémarre peut-être : on réessaie au prochain tour.
      }
      if (active) setTimeout(poll, 1000);
    };
    void poll();
    return () => {
      active = false;
    };
  }, []);

  const done = progress !== null && !progress.running && progress.finishedAt !== null;
  const total = progress?.total ?? 0;
  const doneCount = progress?.done ?? 0;
  const ratio = total > 0 ? doneCount / total : progress?.running ? 0.05 : 0;
  const commits = progress?.results.reduce((sum, r) => sum + r.commits, 0) ?? 0;
  const failed = progress?.results.filter((r) => !r.ok).length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">{done ? t(s.done, { commits, repos: total - failed }) : s.title}</span>
          {total > 0 ? <span className="tnum text-xs text-muted">{t(s.progress, { done: doneCount, total })}</span> : null}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
          <div className="h-full rounded-full bg-data transition-[width] duration-500" style={{ width: `${Math.max(2, ratio * 100)}%` }} />
        </div>
        {progress?.current ? <span className="text-xs text-muted">{t(s.current, { repo: progress.current })}</span> : null}
      </div>

      {progress?.error ? <Notice kind="error">{progress.error}</Notice> : null}
      {done && failed > 0 ? <Notice kind="error">{t(s.partial, { failed })}</Notice> : null}
      {authors !== null && authors > 0 ? <Notice kind="success">{n(s.authorsCreated, authors)}</Notice> : null}

      {done && authors !== null ? (
        <Link href="/" className={`${btnPrimary} self-start`}>
          {s.open}
        </Link>
      ) : null}
    </div>
  );
}
