import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "./routes";

export const getVerifiedUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

export async function requireUser(returnTo = "/dashboard") {
  const user = await getVerifiedUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeReturnTo(returnTo))}`);
  return user;
}
