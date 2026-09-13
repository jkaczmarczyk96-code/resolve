import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getGoogleIntegrationConfig } from "./config";

export const googleIntegrationStateCookie = "avenli-google-integration";
const lifetimeSeconds = 10 * 60;

function signature(payload: string) {
  return createHmac("sha256", getGoogleIntegrationConfig().encryptionKey).update(payload).digest("base64url");
}

export function createGoogleIntegrationState(userId: string, now = Date.now()) {
  const payload = [userId, Math.floor(now / 1000) + lifetimeSeconds, randomBytes(18).toString("base64url")].join(".");
  return `${payload}.${signature(payload)}`;
}

export function validGoogleIntegrationState(value: string | undefined, userId: string, now = Date.now()) {
  if (!value || value.length > 512) return false;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== userId || !/^\d+$/.test(parts[1]) || !parts[2] || !parts[3]) return false;
  const expiry = Number(parts[1]);
  if (!Number.isSafeInteger(expiry) || expiry < Math.floor(now / 1000) || expiry > Math.floor(now / 1000) + lifetimeSeconds) return false;
  const payload = parts.slice(0, 3).join(".");
  const expected = Buffer.from(signature(payload)); const supplied = Buffer.from(parts[3]);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
