import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DemoSettings } from "@/components/demo/settings";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AccountSettings } from "@/components/workspace/account-settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const user = await requireUser("/settings");
  if ((await searchParams).demo === "1") return <div className="space-y-6"><p className="text-sm"><Link className="text-primary underline" href="/settings">Manage your real account</Link></p><DemoSettings /></div>;
  const client = await createClient(); const profile = await client.from("profiles").select("display_name,avatar_url,timezone,preferred_language").eq("id", user.id).single();
  if (profile.error) throw new Error("Unable to load account settings.");
  return <AccountSettings profile={profile.data} email={user.email ?? ""} providers={user.identities?.map((entry) => entry.provider) ?? []} />;
}
