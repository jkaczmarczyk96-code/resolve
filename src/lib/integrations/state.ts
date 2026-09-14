import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getGoogleIntegrationConfig } from "./config";
import { googleServicesSchema, type GoogleService } from "./contracts";
import { z } from "zod";
import { safeReturnTo } from "@/lib/auth/routes";

export const googleIntegrationStateCookie = "avenli-google-integration";
const lifetimeSeconds = 10 * 60;

function signature(payload: string) {
  return createHmac("sha256", getGoogleIntegrationConfig().encryptionKey).update(payload).digest("base64url");
}

const payloadSchema = z.object({ userId: z.string().min(1).max(128), expires: z.number().int(), authorized: googleServicesSchema, enabled: googleServicesSchema, calendarWrite: z.boolean(), returnTo: z.string().min(1).max(2048), nonce: z.string().min(16).max(64) }).strict();

export function createGoogleIntegrationState(userId: string, options: { authorized: GoogleService[]; enabled: GoogleService[]; calendarWrite: boolean; returnTo: string }, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ userId, expires: Math.floor(now / 1000) + lifetimeSeconds, ...options, nonce: randomBytes(18).toString("base64url") })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function readGoogleIntegrationState(value: string | undefined, userId: string, now = Date.now()) {
  if (!value || value.length > 4096) return null;
  const parts = value.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = Buffer.from(signature(parts[0])); const supplied = Buffer.from(parts[1]);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")));
    if (!parsed.success || parsed.data.userId !== userId || parsed.data.expires < Math.floor(now / 1000) || parsed.data.expires > Math.floor(now / 1000) + lifetimeSeconds || safeReturnTo(parsed.data.returnTo) !== parsed.data.returnTo) return null;
    if (!parsed.data.enabled.every((service) => parsed.data.authorized.includes(service))) return null;
    return { authorized: parsed.data.authorized, enabled: parsed.data.enabled, calendarWrite: parsed.data.calendarWrite, returnTo: parsed.data.returnTo };
  } catch { return null; }
}
