import { AppShell } from "@/components/AppShell";
import { githubConnection } from "@/lib/config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const connection = githubConnection();
  return <AppShell login={connection?.login ?? null} avatarUrl={connection?.avatarUrl ?? null}>{children}</AppShell>;
}
