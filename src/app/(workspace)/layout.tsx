import { getAccountProfile } from "@/lib/auth/profile";
import { DemoProvider } from "@/components/demo/demo-provider";
import { WorkspaceShell } from "@/components/demo/workspace-shell";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccountProfile();
  return <DemoProvider key={account.id} account={account}><WorkspaceShell>{children}</WorkspaceShell></DemoProvider>;
}
