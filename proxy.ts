import { NextResponse, type NextRequest } from "next/server";

/**
 * Garde locale (convention Next 16 : proxy.ts remplace middleware.ts).
 * L'application n'a pas de compte : elle n'écoute que sur la boucle locale, et cette garde
 * refuse toute requête dont l'en-tête Host vise autre chose — un site tiers ne peut pas la piloter
 * par rebond DNS. GITFELLOW_ALLOW_ANY_HOST=1 la lève pour un déploiement derrière un domaine.
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function proxy(request: NextRequest) {
  if (process.env.GITFELLOW_ALLOW_ANY_HOST === "1") return NextResponse.next();
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const name = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  if (!LOOPBACK.has(name)) {
    return new NextResponse("GitFellow only answers on this machine (localhost).", { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
