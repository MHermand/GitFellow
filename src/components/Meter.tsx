/**
 * Jauge « heures / seuil » : piste neutre, remplissage plafonné à 100 %.
 * La couleur est celle de la personne — le statut se lit à l'icône et au texte qui l'accompagnent.
 */
export function Meter({ ratio, color, label }: { ratio: number | null; color: string; label: string }) {
  const pct = ratio === null ? 0 : Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-full bg-track"
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
