import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <p className="mt-2 text-sm text-ink-2">
        <Link href="/" className="underline">
          Retour au tableau de bord
        </Link>
      </p>
    </main>
  );
}
