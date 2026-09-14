import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DemoSettings } from "@/components/demo/settings";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AccountSettings } from "@/components/workspace/account-settings";
import { googleIntegrationEnabledFor } from "@/lib/integrations/config";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ demo?: string; integration?: string }> }) {
  const user = await requireUser("/settings");
  const params = await searchParams;
  if (params.demo === "1") return <div className="space-y-6"><p className="text-sm"><Link className="text-primary underline" href="/settings">Manage your real account</Link></p><DemoSettings /></div>;
  const client = await createClient(); const profile = await client.from("profiles").select("display_name,avatar_url,timezone,preferred_language").eq("id", user.id).single();
  if (profile.error) throw new Error("Unable to load account settings.");
  const googleEnabled = googleIntegrationEnabledFor(user.email);
  const integration = googleEnabled ? await client.from("integrations").select("status,account_email,scopes,enabled_services,connected_at,last_synced_at").eq("user_id",user.id).eq("provider","google").maybeSingle() : { data: null, error: null };
  if (integration.error) throw new Error("Unable to load integration settings.");
  return <AccountSettings profile={profile.data} email={user.email ?? ""} providers={user.identities?.map((entry) => entry.provider) ?? []} googleEnabled={googleEnabled} googleConnection={integration.data} integrationNotice={params.integration} />;
}
