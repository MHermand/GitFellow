import type { ReactNode } from "react";

const base =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

export const btnPrimary = `${base} bg-accent text-white shadow-sm shadow-accent/20 hover:bg-accent/90`;
export const btnGhost = `${base} border border-line bg-surface text-ink hover:bg-accent-soft hover:text-accent-fg`;
export const btnDanger = `${base} border border-danger/30 bg-surface text-danger hover:bg-danger/10`;
export const btnLink = "text-sm text-accent underline-offset-4 hover:underline";

/** Champ sans dimensions ni marge interne : à composer (les classes se battraient sinon). */
export const inputBase =
  "flex rounded-md border border-line bg-surface text-sm text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20";

export const input = `${inputBase} h-10 w-full px-3`;
export const label = "block text-sm font-medium text-ink";

export function Card({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="text-sm text-ink-2">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Notice({ kind, children }: { kind: "info" | "success" | "error"; children: ReactNode }) {
  const styles = {
    info: "border-accent/30 bg-accent-soft",
    success: "border-good/40 bg-good/10",
    error: "border-danger/40 bg-danger/10",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm text-ink ${styles}`}>
      {children}
    </div>
  );
}

export function Field({ id, text, children, hint }: { id: string; text: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-ink-2">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  crumb,
  leading,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  crumb?: ReactNode;
  /** Élément posé à gauche du titre : le retour depuis une fiche, par exemple. */
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {leading}
        <div>
          {crumb ? <p className="text-xs text-ink-2">{crumb}</p> : null}
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
