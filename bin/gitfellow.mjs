#!/usr/bin/env node
/**
 * Lanceur de GitFellow : démarre le serveur livré dans ../app sur la boucle locale, attend qu'il
 * réponde, ouvre le navigateur. Aucune dépendance : seulement Node.
 *
 *   npx gitfellow                 — port libre à partir de 4747, ouvre le navigateur
 *   npx gitfellow --port 5000     — port imposé
 *   npx gitfellow --no-open       — sans ouvrir le navigateur
 *   npx gitfellow --data-dir DIR  — dossier de données (défaut : ~/.gitfellow)
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const serverEntry = join(root, "app", "server.js");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const MIN_NODE = [22, 13];
const FIRST_PORT = 4747;

const lang = detectLang();
const T = {
  en: {
    nodeTooOld: (found) => `GitFellow needs Node.js ${MIN_NODE.join(".")} or newer (found ${found}).\nInstall the LTS version from https://nodejs.org and run the command again.`,
    missing: "The application files are missing next to this launcher — reinstall with: npx gitfellow@latest",
    starting: "Starting GitFellow…",
    ready: (url) => `GitFellow is running at ${url}\nKeep this window open while you use it. Press Ctrl+C to stop.`,
    opening: "Opening your browser…",
    openFailed: (url) => `Could not open the browser automatically — open ${url} yourself.`,
    notReady: "The server did not answer in time. Check the messages above.",
    help: `Usage: gitfellow [--port N] [--no-open] [--data-dir DIR]\n\n  --port N        listen on port N (default: first free port from ${FIRST_PORT})\n  --no-open       do not open the browser\n  --data-dir DIR  where the database and the GitHub connection live (default: ~/.gitfellow)\n  --version       print the version`,
  },
  fr: {
    nodeTooOld: (found) => `GitFellow a besoin de Node.js ${MIN_NODE.join(".")} ou plus récent (trouvé : ${found}).\nInstallez la version LTS depuis https://nodejs.org puis relancez la commande.`,
    missing: "Les fichiers de l'application manquent à côté de ce lanceur — réinstallez avec : npx gitfellow@latest",
    starting: "Démarrage de GitFellow…",
    ready: (url) => `GitFellow tourne sur ${url}\nGardez cette fenêtre ouverte pendant l'utilisation. Ctrl+C pour arrêter.`,
    opening: "Ouverture du navigateur…",
    openFailed: (url) => `Impossible d'ouvrir le navigateur automatiquement — ouvrez ${url} vous-même.`,
    notReady: "Le serveur n'a pas répondu à temps. Regardez les messages ci-dessus.",
    help: `Usage : gitfellow [--port N] [--no-open] [--data-dir DIR]\n\n  --port N        écoute sur le port N (défaut : premier port libre à partir de ${FIRST_PORT})\n  --no-open       n'ouvre pas le navigateur\n  --data-dir DIR  où vivent la base et la connexion GitHub (défaut : ~/.gitfellow)\n  --version       affiche la version`,
  },
}[lang];

function detectLang() {
  const env = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || "";
  if (/^fr/i.test(env)) return "fr";
  if (env) return "en";
  try {
    return /^fr/i.test(Intl.DateTimeFormat().resolvedOptions().locale) ? "fr" : "en";
  } catch {
    return "en";
  }
}

function parseArgs(argv) {
  const args = { port: null, open: true, dataDir: null, help: false, version: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--port" || arg === "-p") args.port = Number(argv[++i]);
    else if (arg.startsWith("--port=")) args.port = Number(arg.slice(7));
    else if (arg === "--no-open") args.open = false;
    else if (arg === "--data-dir") args.dataDir = argv[++i];
    else if (arg.startsWith("--data-dir=")) args.dataDir = arg.slice(11);
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--version" || arg === "-v") args.version = true;
  }
  return args;
}

function nodeIsRecent() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1]);
}

function isFree(port) {
  return new Promise((done) => {
    const probe = createServer();
    probe.once("error", () => done(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => done(true)));
  });
}

async function pickPort(wanted) {
  if (wanted) return wanted;
  for (let port = FIRST_PORT; port < FIRST_PORT + 50; port += 1) {
    if (await isFree(port)) return port;
  }
  return 0;
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return true;
    } catch {
      // Pas encore prêt.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function openBrowser(url) {
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url.replace(/&/g, "^&")]]
        : ["xdg-open", [url]];
  return new Promise((done) => {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.once("error", () => done(false));
    child.once("spawn", () => {
      child.unref();
      done(true);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return console.log(T.help);
  if (args.version) return console.log(pkg.version);
  if (!nodeIsRecent()) {
    console.error(T.nodeTooOld(process.versions.node));
    process.exit(1);
  }
  if (!existsSync(serverEntry)) {
    console.error(T.missing);
    process.exit(1);
  }

  const port = await pickPort(args.port);
  const dataDir = resolve(args.dataDir || process.env.GITFELLOW_HOME || join(homedir(), ".gitfellow"));
  const url = `http://127.0.0.1:${port}/`;

  console.log(T.starting);
  const child = spawn(process.execPath, ["--no-warnings=ExperimentalWarning", serverEntry], {
    cwd: join(root, "app"),
    env: { ...process.env, NODE_ENV: "production", PORT: String(port), HOSTNAME: "127.0.0.1", GITFELLOW_HOME: dataDir },
    stdio: ["ignore", "inherit", "inherit"],
  });
  const stop = () => {
    if (!child.killed) child.kill("SIGTERM");
  };
  process.on("SIGINT", () => {
    stop();
    process.exit(0);
  });
  process.on("SIGTERM", stop);
  child.on("exit", (code) => process.exit(code ?? 0));

  if (!(await waitFor(url, 30_000))) {
    console.error(T.notReady);
    stop();
    process.exit(1);
  }
  console.log("");
  console.log(T.ready(url));
  if (args.open) {
    console.log(T.opening);
    if (!(await openBrowser(url))) console.log(T.openFailed(url));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
