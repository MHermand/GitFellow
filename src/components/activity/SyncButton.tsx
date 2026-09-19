"use client";

import { useFormStatus } from "react-dom";
import { RefreshIcon } from "@/components/icons";
import { iconButton } from "./FilterMenus";

/** Bouton-icône de la barre d'outils : lance la synchronisation GitHub (action de formulaire). */
export function SyncButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Synchroniser GitHub"
      title={pending ? "Synchronisation en cours…" : "Synchroniser GitHub"}
      className={`${iconButton} border-line bg-surface text-ink-2 shadow-sm hover:bg-accent-soft hover:text-accent-fg disabled:opacity-60`}
    >
      <span className={pending ? "animate-spin" : undefined}>
        <RefreshIcon />
      </span>
    </button>
  );
}
