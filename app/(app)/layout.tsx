import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { githubConnection } from "@/lib/config";
import { isConfigured } from "@/lib/runtime";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isConfigured())) redirect("/setup");
  const connection = githubConnection();
  return <AppShell login={connection?.login ?? null} avatarUrl={connection?.avatarUrl ?? null}>{children}</AppShell>;
}
