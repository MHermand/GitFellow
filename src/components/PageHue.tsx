/**
 * Teinte de la page, exposée au cadre (barre latérale) qui entoure la page.
 * La poignée de pliage vit dans AppShell, au-dessus des pages : une variable CSS
 * posée sur :root est le seul chemin du contenu vers son cadre, et elle part avec
 * le HTML — aucune couleur ne clignote au chargement.
 */
export function PageHue({ hue }: { hue: string }) {
  if (!/^#[0-9a-f]{3,8}$/i.test(hue)) return null;
  return <style>{`:root{--page-hue:${hue}}`}</style>;
}
