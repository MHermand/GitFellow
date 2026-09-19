"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Bornes de la hauteur d'une heure : lisible sur un écran court, pas démesurée sur un grand. */
const MIN_HOUR_PX = 28;
const MAX_HOUR_PX = 80;
/** Marge au-dessus de la grille, pour que le libellé de la première heure affichée ne soit pas coupé. */
export const GRID_TOP_PAD = 10;

/**
 * Hauteur d'heure élastique : `visibleHours` heures occupent exactement la zone visible sous
 * l'en-tête, le reste de la journée s'atteint au défilement vertical, la vue étant positionnée
 * sur `startHour`. La hauteur est recalculée quand la fenêtre change de taille.
 */
export function useHourScale(headerPx: number, visibleHours: number, startHour: number, fallback: number) {
  const reserved = headerPx + GRID_TOP_PAD;
  const ref = useRef<HTMLDivElement>(null);
  const [hourPx, setHourPx] = useState(fallback);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const available = element.clientHeight - reserved;
      if (available > 0) setHourPx(Math.min(MAX_HOUR_PX, Math.max(MIN_HOUR_PX, available / visibleHours)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [reserved, visibleHours]);

  // Appliqué après le rendu de la grille à sa nouvelle échelle, sinon le défilement serait borné
  // par l'ancienne hauteur.
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = startHour * hourPx;
  }, [hourPx, startHour]);

  return { ref, hourPx };
}

/** Zone de défilement horizontal positionnée sur une fraction de sa largeur au montage. */
export function StartScroll({ ratio, className, children }: { ratio: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth * ratio;
  }, [ratio]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
