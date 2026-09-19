/**
 * Assemble le paquet npm dans dist/ : le serveur autonome de Next (app/), le lanceur (bin/) et un
 * package.json sans dépendance — tout ce dont le serveur a besoin est déjà dans app/node_modules.
 *
 *   node scripts/pack.mjs            → construit (next build) puis assemble
 *   node scripts/pack.mjs --no-build → assemble à partir du dernier build
 *   puis : cd dist && npm publish
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const standalone = join(root, ".next", "standalone");

if (!process.argv.includes("--no-build")) {
  execSync("npx next build", { stdio: "inherit", env: { ...process.env, NODE_OPTIONS: "--no-warnings=ExperimentalWarning" } });
}
if (!existsSync(join(standalone, "server.js"))) {
  console.error("Pas de sortie autonome : next.config doit avoir output: \"standalone\".");
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "app"), { recursive: true });
cpSync(standalone, join(dist, "app"), { recursive: true });
cpSync(join(root, ".next", "static"), join(dist, "app", ".next", "static"), { recursive: true });
cpSync(join(root, "public"), join(dist, "app", "public"), { recursive: true });
cpSync(join(root, "bin"), join(dist, "bin"), { recursive: true });
for (const file of ["README.md", "README.fr.md", "LICENSE"]) {
  if (existsSync(join(root, file))) cpSync(join(root, file), join(dist, file));
}

const source = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const pkg = {
  name: source.name,
  version: source.version,
  description: source.description,
  license: source.license,
  repository: source.repository,
  homepage: source.homepage,
  keywords: source.keywords,
  bin: { gitfellow: "bin/gitfellow.mjs" },
  engines: source.engines,
  // Le serveur embarque ses modules : on demande à npm de les garder dans le tarball.
  bundleDependencies: [],
  files: ["app", "bin", "README.md", "README.fr.md", "LICENSE"],
};
writeFileSync(join(dist, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
// Sans .npmignore, npm applique ses règles par défaut ; on veut tout app/, node_modules compris.
writeFileSync(join(dist, ".npmignore"), "");

console.log(`dist/ prêt : ${pkg.name}@${pkg.version}`);
