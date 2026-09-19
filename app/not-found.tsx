"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";

export default function NotFound() {
  const { m } = useI18n();
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-2xl font-semibold">{m.common.notFound}</h1>
      <p className="mt-2 text-sm text-ink-2">
        <Link href="/" className="underline">
          {m.common.backHome}
        </Link>
      </p>
    </main>
  );
}
