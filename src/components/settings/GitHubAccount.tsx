"use client";

import Link from "next/link";
import { disconnectGitHub } from "@/actions/setup";
import { btnGhost } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export interface GitHubAccountItem {
  login: string;
  avatarUrl: string | null;
  method: "device" | "token";
}

/** Compte GitHub qui lit les dépôts : qui, comment, et de quoi le changer. */
export function GitHubAccount({ account }: { account: GitHubAccountItem | null }) {
  const { m, t } = useI18n();
  const g = m.settings.github;
  if (!account) {
    return (
      <Link href="/setup" className={btnGhost}>
        {m.nav.connect}
      </Link>
    );
  }
  const avatar = account.avatarUrl ?? `https://github.com/${encodeURIComponent(account.login)}.png?size=80`;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <img src={avatar} alt="" width={40} height={40} className="h-10 w-10 rounded-full bg-track" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{t(g.connectedAs, { login: account.login })}</div>
        <div className="text-xs text-muted">{g.via[account.method]}</div>
      </div>
      <form action={disconnectGitHub}>
        <button type="submit" title={g.disconnectTitle} className={btnGhost}>
          {g.disconnect}
        </button>
      </form>
    </div>
  );
}
