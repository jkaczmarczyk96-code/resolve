import "server-only";

import { cookies } from "next/headers";
import { getSiteOrigin } from "@/lib/config/server-env";
import { recoveryTokenSchema } from "./schemas";

export const recoveryCookieName = "resolve-recovery";

export async function storeRecoveryToken(tokenHash: string) {
  const store = await cookies();
  store.set(recoveryCookieName, recoveryTokenSchema.parse(tokenHash), {
    httpOnly: true,
    secure: getSiteOrigin().startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

export async function getRecoveryToken() {
  const store = await cookies();
  const result = recoveryTokenSchema.safeParse(store.get(recoveryCookieName)?.value);
  return result.success ? result.data : null;
}

export async function clearRecoveryToken() {
  const store = await cookies();
  store.delete(recoveryCookieName);
}
