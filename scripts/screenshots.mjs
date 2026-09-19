/**
 * Captures d'écran du README, prises sur l'application lancée avec le GitHub simulé :
 *
 *   node scripts/pack.mjs --no-build   (ou npm run build, puis)
 *   node scripts/screenshots.mjs        → docs/*.png
 *
 * Lance le lanceur du paquet (dist/bin/gitfellow.mjs) sur un port libre avec un dossier de données
 * jetable, déroule l'assistant, puis photographie chaque écran en anglais et en français.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const PORT = 4760;
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
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "Accept-Language": accept } });
    const page = await context.newPage();
    if (lang === "en") {
      // L'assistant, une seule fois : la connexion vaut pour les deux langues.
      await page.goto(`${BASE}/`);
      await shoot(page, "setup-1-github");
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
    await page.goto(`${BASE}${detail}`);
    await shoot(page, `contributor-${lang}`);
    // La page défile dans son cadre, pas dans la fenêtre : une fenêtre haute montre tout.
    await page.setViewportSize({ width: 1440, height: 1380 });
    await page.goto(`${BASE}/settings`);
    await shoot(page, `settings-${lang}`);
    await page.setViewportSize({ width: 1440, height: 900 });
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
