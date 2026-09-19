export function StatCard({
  title,
  actions,
  fill,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  /** Occupe la hauteur restante de la colonne, pour que celle-ci tombe juste. */
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border border-line bg-surface px-5 py-4 shadow-sm ${
        fill ? "min-h-[150px] flex-1" : "shrink-0"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions}
      </div>
      {fill ? <div className="min-h-0 flex-1">{children}</div> : children}
    </section>
  );
}
