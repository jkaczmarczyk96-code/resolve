import { DemoProvider } from "@/components/demo/demo-provider";
import { PublicDemoShell } from "@/components/demo/public-demo-shell";

const publicAccount = { id: "public-demo", email: "", displayName: "Demo visitor", timezone: "UTC", language: "en" };

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <DemoProvider account={publicAccount} basePath="/demo"><PublicDemoShell>{children}</PublicDemoShell></DemoProvider>;
}
