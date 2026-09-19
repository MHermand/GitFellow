"use client";

import { useFormStatus } from "react-dom";
import { RefreshIcon } from "@/components/icons";
import { useI18n } from "@/i18n/client";
import { iconButton } from "./FilterMenus";

/** Bouton-icône de la barre d'outils : lance la synchronisation GitHub (action de formulaire). */
export function SyncButton() {
  const { pending } = useFormStatus();
  const { m } = useI18n();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={m.sync.button}
      title={pending ? m.sync.running : m.sync.button}
      className={`${iconButton} border-line bg-surface text-ink-2 shadow-sm hover:bg-accent-soft hover:text-accent-fg disabled:opacity-60`}
    >
      <span className={pending ? "animate-spin" : undefined}>
        <RefreshIcon />
      </span>
    </button>
  );
}
