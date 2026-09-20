import "server-only";
import { cache } from "react";
import { requireUser } from "./session";
import { createClient } from "@/lib/supabase/server";

export const getAccountProfile = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("display_name, timezone, preferred_language, onboarding_completed_at").eq("id", user.id).single();
  if (error) throw new Error("Unable to load your profile. Please try again.");
  return { id: user.id, email: user.email ?? "", displayName: data.display_name, timezone: data.timezone, language: data.preferred_language, onboardingComplete: Boolean(data.onboarding_completed_at) };
});
