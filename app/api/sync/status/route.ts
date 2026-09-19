import { NextResponse } from "next/server";
import { syncProgress } from "@/lib/sync-runner";

export const dynamic = "force-dynamic";

/** Progression de la synchronisation en cours (ou de la dernière), pour l'assistant et la barre d'outils. */
export async function GET() {
  return NextResponse.json(syncProgress(), { headers: { "Cache-Control": "no-store" } });
}
