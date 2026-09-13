import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DemoSettings } from "@/components/demo/settings";
import Link from "next/link";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireUser("/settings");
  return <div className="space-y-6"><p className="text-sm"><Link className="text-primary underline" href="/notifications">Manage saved notification preferences</Link></p><DemoSettings /></div>;
}
