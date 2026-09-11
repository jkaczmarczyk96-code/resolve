import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DemoSettings } from "@/components/demo/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireUser("/settings");
  return <DemoSettings />;
}
