/**
 * Captures d'écran du README, prises sur l'application lancée avec le GitHub simulé :
 *
 *   npm i -D playwright && npx playwright install chromium   (une fois)
 *   node scripts/pack.mjs
 *   node scripts/screenshots.mjs        → docs/*.png
 *
 * Lance le lanceur du paquet (dist/bin/gitfellow.mjs) sur un port libre avec un dossier de données
 * jetable, déroule l'assistant, puis photographie chaque écran en anglais et en français.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Playwright n'est pas une dépendance du projet : son installation télécharge un navigateur
// de 150 Mo, inutile à qui veut seulement faire tourner GitFellow.
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Ce script demande Playwright :\n  npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const PORT = 4760;
/** Fenêtre des captures : la hauteur normale, et celle des pages qui défilent dans leur cadre. */
const WIDE = 1440;
const NORMAL = 900;
const TALL = 1380;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = join(process.cwd(), "docs");
const home = mkdtempSync(join(tmpdir(), "gitfellow-shots-"));
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || undefined;

const server = spawn(process.execPath, ["dist/bin/gitfellow.mjs", "--no-open", "--port", String(PORT), "--data-dir", home], {
  env: { ...process.env, GITFELLOW_FAKE_GITHUB: "1", GITFELLOW_NO_SYNC: "1" },
  stdio: "ignore",
});

async function ready() {
  for (let i = 0; i < 80; i += 1) {
    try {
      await fetch(BASE + "/setup");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("serveur injoignable");
}

async function shoot(page, name, options = {}) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `${name}.png`), ...options });
  console.log(`docs/${name}.png`);
}

try {
  await ready();
  const browser = await chromium.launch({ executablePath });
  for (const [lang, accept] of [["en", "en-US,en;q=0.9"], ["fr", "fr-FR,fr;q=0.9"]]) {
    const context = await browser.newContext({ viewport: { width: WIDE, height: NORMAL }, extraHTTPHeaders: { "Accept-Language": accept } });
    const page = await context.newPage();
    if (lang === "en") {
      // L'assistant, une seule fois : la connexion vaut pour les deux langues.
      await page.goto(`${BASE}/`);
      await shoot(page, "setup-1-github");
      // Le code à saisir (le GitHub simulé en montre un sans jamais le confirmer).
      const popup = page.context().waitForEvent("page", { timeout: 5000 }).catch(() => null);
      await page.getByRole("button", { name: /sign in with github|se connecter avec github/i }).click();
      await page.waitForSelector("code");
      const opened = await popup;
      if (opened) await opened.close();
      await shoot(page, "setup-1-code");
      await page.getByRole("button", { name: /cancel|annuler/i }).click();
      // Le jeton, replié derrière un lien.
      await page.getByRole("button", { name: /token|jeton/i }).click();
      await page.fill("input[name=token]", "ghp_" + "x".repeat(36));
      await page.click("form button[type=submit]");
      await page.waitForURL("**/setup?step=repos");
      for (const name of ["acme/web-app", "acme/api", "acme/mobile"]) await page.check(`input[name=repos][value="${name}"]`);
      await shoot(page, "setup-2-repos");
      await page.click("button[type=submit]:not([disabled])");
      await page.waitForURL("**/setup?step=sync");
      await page.waitForSelector('a[href="/"]', { timeout: 120_000 });
      await shoot(page, "setup-3-sync");
    }
    await page.goto(`${BASE}/`);
    await shoot(page, `activity-week-${lang}`);
    await page.goto(`${BASE}/?view=mois`);
    await shoot(page, `activity-month-${lang}`);
    await page.goto(`${BASE}/?view=jour&date=${await lastWorkday(page)}`);
    await shoot(page, `activity-day-${lang}`);
    await page.goto(`${BASE}/`);
    const detail = await page.locator('a[href^="/contributors/"]').first().getAttribute("href");
    // Ces deux pages défilent dans leur cadre, pas dans la fenêtre : une fenêtre haute montre tout.
    // Elles se font face dans le README, donc elles se prennent à la même hauteur.
    await page.setViewportSize({ width: WIDE, height: TALL });
    await page.goto(`${BASE}${detail}`);
    await shoot(page, `contributor-${lang}`);
    await page.goto(`${BASE}/settings`);
    await shoot(page, `settings-${lang}`);
    await page.setViewportSize({ width: WIDE, height: NORMAL });
    await context.close();
  }
  await browser.close();
} finally {
  server.kill("SIGTERM");
  rmSync(home, { recursive: true, force: true });
}

/** Le dernier jour ouvré (la vue Jour a alors de quoi montrer). */
async function lastWorkday(page) {
  return page.evaluate(() => {
    const d = new Date();
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });
}
