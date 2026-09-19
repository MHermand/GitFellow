import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Serveur autonome : ce que scripts/pack.mjs met dans le paquet npm.
  output: "standalone",
  // Pas d'optimisation d'images côté serveur : rien à télécharger, pas de module natif…
  images: { unoptimized: true },
  // …et donc pas de sharp ni de ses binaires par plateforme (46 Mo) dans le paquet.
  outputFileTracingExcludes: {
    "*": ["node_modules/sharp/**", "node_modules/@img/**", "node_modules/@emnapi/**", "node_modules/detect-libc/**"],
  },
};

export default nextConfig;
