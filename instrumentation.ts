/**
 * Point d'entrée du serveur (convention Next) : démarre le planificateur de synchronisation.
 * GITFELLOW_NO_SYNC=1 le désactive (captures d'écran, tests).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.GITFELLOW_NO_SYNC === "1") return;
  const { ensureScheduler } = await import("./src/lib/sync-runner");
  ensureScheduler();
}
