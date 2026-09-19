/**
 * Couleurs catégorielles (personnes ou dépôts) : ordre fixe, jamais recyclé.
 * `dot` pour les pastilles, `tint` / `ink` pour les blocs de session.
 */
export interface Swatch {
  dot: string;
  tint: string;
  ink: string;
}

export const SWATCHES: Swatch[] = [
  { dot: "#2a78d6", tint: "#dbe9fb", ink: "#0d366b" },
  { dot: "#eb6834", tint: "#fde3d8", ink: "#7c2d12" },
  { dot: "#1baf7a", tint: "#d3f3e6", ink: "#0b4a33" },
  { dot: "#eda100", tint: "#fdefc7", ink: "#6b4300" },
  { dot: "#e87ba4", tint: "#fbe0ea", ink: "#7a1f45" },
  { dot: "#008300", tint: "#d6f0d6", ink: "#0a4d0a" },
  { dot: "#4a3aa7", tint: "#e4e0f7", ink: "#2a2060" },
  { dot: "#e34948", tint: "#fbdcdc", ink: "#7a1c1c" },
];

export function swatch(index: number): Swatch {
  return SWATCHES[((index % SWATCHES.length) + SWATCHES.length) % SWATCHES.length];
}

/** Teinte des agrégats quand plusieurs personnes sont affichées : celle de la première place. */
export const DATA_HUE = SWATCHES[0].dot;

function mix(hex: string, ratio: number, toward: [number, number, number] = [255, 255, 255]): string {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const out = channels.map((c, i) => Math.round(c * (1 - ratio) + toward[i] * ratio));
  return `#${out.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Rampe séquentielle d'une teinte, en six paliers : 0 = piste neutre, 5 = le plus soutenu.
 * Toutes les cartes d'une même page partagent la teinte, donc la même rampe.
 */
export function rampFor(hue: string): string[] {
  return ["#f1f5f9", mix(hue, 0.78), mix(hue, 0.56), mix(hue, 0.3), hue, mix(hue, 0.22, [0, 0, 0])];
}

/**
 * Paliers d'une répartition : la plus grosse part porte le ton le plus soutenu.
 * Au-delà de cinq parts, la rampe recommence — les libellés les distinguent.
 */
export function shadesFor(hue: string, count: number): string[] {
  const ramp = rampFor(hue);
  const order = [5, 4, 3, 2, 1];
  return Array.from({ length: count }, (_, i) => ramp[order[i % order.length]]);
}
