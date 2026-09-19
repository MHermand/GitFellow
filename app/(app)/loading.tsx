"use client";

import { useI18n } from "@/i18n/client";

/** Squelette affiché pendant le rendu serveur d'une page ; la coquille (barre latérale, en-tête) reste en place. */
export default function Loading() {
  const { m } = useI18n();
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-64 rounded-md bg-track" />
        <div className="h-4 w-96 max-w-full rounded-md bg-track" />
      </div>
      <div className="h-56 rounded-xl border border-line bg-surface" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-line bg-surface" />
        ))}
      </div>
      <span className="sr-only">{m.common.loading}</span>
    </div>
  );
}
