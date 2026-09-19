"use client";

import { useI18n } from "@/i18n/client";
import { btnGhost } from "@/components/ui";

/** Une page qui a échoué côté serveur : on le dit simplement, le détail est dans le terminal. */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { m } = useI18n();
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 py-16">
      <h1 className="text-xl font-bold tracking-tight">{m.common.errorTitle}</h1>
      <p className="text-sm text-ink-2">{m.common.errorHint}</p>
      <button type="button" onClick={reset} className={`${btnGhost} self-start`}>
        {m.common.retry}
      </button>
    </div>
  );
}
