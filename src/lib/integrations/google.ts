import "server-only";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/lib/database/types";
import { getPublicEnvironment } from "@/lib/config/public-env";
import { WorkspaceError } from "@/lib/workspace/http";
import { decryptCredential, encryptCredential } from "./crypto";
import { getGoogleIntegrationConfig } from "./config";
import { integrationCredentialSchema, type CalendarItem, type GmailItem } from "./contracts";

export const GOOGLE_READ_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

const gmailProfileSchema = z.object({ emailAddress: z.email() }).loose();
const tokenSchema = z.object({ access_token: z.string().min(10), expires_in: z.number().int().positive().max(7200), token_type: z.string() }).loose();
const calendarSchema = z.object({ items: z.array(z.object({
  id: z.string(), summary: z.string().optional(), status: z.string().optional(), location: z.string().optional(),
  start: z.object({ dateTime: z.string().optional(), date: z.string().optional() }).loose(),
  end: z.object({ dateTime: z.string().optional(), date: z.string().optional() }).loose(),
}).loose()).default([]) }).loose();
const gmailListSchema = z.object({ messages: z.array(z.object({ id: z.string() }).loose()).default([]) }).loose();
const gmailMessageSchema = z.object({
  id: z.string(), snippet: z.string().default(""),
  payload: z.object({ headers: z.array(z.object({ name: z.string(), value: z.string() }).loose()).default([]) }).loose(),
}).loose();

async function serviceRpc<T>(name: string, args: Record<string, unknown>) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret?.startsWith("sb_secret_")) throw new WorkspaceError("SERVICE_UNAVAILABLE", 503);
  const response = await fetch(`${getPublicEnvironment().url}/rest/v1/rpc/${name}`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(10_000),
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new WorkspaceError("SERVICE_UNAVAILABLE", 503);
  return await response.json() as T;
}

async function directGoogleGet(url: string, accessToken: string) {
  return fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
}

export async function completeGoogleIntegration(client: SupabaseClient<Database>, user: User, session: Session) {
  const access = session.provider_token;
  const refresh = session.provider_refresh_token;
  if (!access || !refresh) throw new WorkspaceError("INTEGRATION_AUTH_FAILED", 409);
  const [profileResponse, calendarResponse] = await Promise.all([
    directGoogleGet("https://gmail.googleapis.com/gmail/v1/users/me/profile", access),
    directGoogleGet("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1", access),
  ]);
  if (!profileResponse.ok || !calendarResponse.ok) throw new WorkspaceError("INTEGRATION_PERMISSION_REQUIRED", 403);
  const profile = gmailProfileSchema.safeParse(await profileResponse.json());
  if (!profile.success || profile.data.emailAddress.toLowerCase() !== user.email?.toLowerCase()) throw new WorkspaceError("INTEGRATION_ACCOUNT_MISMATCH", 403);
  const expiresAt = new Date(Date.now() + 55 * 60_000).toISOString();
  const result = await client.rpc("save_google_integration", {
    p_email: profile.data.emailAddress,
    p_scopes: [...GOOGLE_READ_SCOPES],
    p_access_ciphertext: encryptCredential(access),
    p_refresh_ciphertext: encryptCredential(refresh),
    p_expires_at: expiresAt,
  });
  if (result.error || !result.data) throw new WorkspaceError("INTEGRATION_SAVE_FAILED", 503);
}

async function storedCredential(userId: string) {
  const parsed = integrationCredentialSchema.safeParse(await serviceRpc<unknown>("get_google_integration_credential", { p_user: userId }));
  if (!parsed.success) throw new WorkspaceError("INTEGRATION_NOT_CONNECTED", 409);
  return parsed.data;
}

async function refreshAccess(userId: string, credential: z.infer<typeof integrationCredentialSchema>) {
  const config = getGoogleIntegrationConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: decryptCredential(credential.refreshTokenCiphertext), grant_type: "refresh_token" }),
  });
  const parsed = tokenSchema.safeParse(response.ok ? await response.json() : null);
  if (!parsed.success) throw new WorkspaceError("INTEGRATION_RECONNECT_REQUIRED", 409);
  const expiresAt = new Date(Date.now() + Math.max(60, parsed.data.expires_in - 60) * 1000).toISOString();
  const saved = await serviceRpc<boolean>("update_google_integration_access", { p_user: userId, p_access_ciphertext: encryptCredential(parsed.data.access_token), p_expires_at: expiresAt });
  if (!saved) throw new WorkspaceError("INTEGRATION_NOT_CONNECTED", 409);
  return parsed.data.access_token;
}

async function accessToken(userId: string, forceRefresh = false) {
  const credential = await storedCredential(userId);
  if (!forceRefresh && Date.parse(credential.expiresAt) > Date.now() + 60_000) return decryptCredential(credential.accessTokenCiphertext);
  return refreshAccess(userId, credential);
}

async function googleGet(userId: string, url: string) {
  let response = await directGoogleGet(url, await accessToken(userId));
  if (response.status === 401) response = await directGoogleGet(url, await accessToken(userId, true));
  if (!response.ok) throw new WorkspaceError(response.status === 403 ? "INTEGRATION_PERMISSION_REQUIRED" : "INTEGRATION_UNAVAILABLE", response.status === 403 ? 403 : 503);
  return response;
}

async function record(userId: string, action: "calendar_read" | "gmail_read" | "error", detail: Json) {
  await serviceRpc<boolean>("record_google_integration_event", { p_user: userId, p_action: action, p_detail: detail });
}

export async function readCalendar(userId: string, days: number): Promise<CalendarItem[]> {
  const timeMin = new Date(); const timeMax = new Date(timeMin.getTime() + days * 86_400_000);
  const query = new URLSearchParams({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "50", fields: "items(id,summary,status,location,start,end)" });
  const parsed = calendarSchema.parse(await (await googleGet(userId, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`)).json());
  const items = parsed.items.filter((item) => item.status !== "cancelled" && (item.start.dateTime || item.start.date) && (item.end.dateTime || item.end.date)).map((item) => ({
    id: item.id, title: item.summary?.slice(0, 200) || "Busy", start: item.start.dateTime ?? item.start.date ?? "", end: item.end.dateTime ?? item.end.date ?? "", allDay: !item.start.dateTime, location: item.location?.slice(0, 300) ?? null,
  }));
  await record(userId, "calendar_read", { resultCount: items.length, windowDays: days });
  return items;
}

function header(headers: Array<{ name: string; value: string }>, name: string) {
  return headers.find((item) => item.name.toLowerCase() === name)?.value.slice(0, 500) ?? "";
}

export async function readGmail(userId: string, queryText: string): Promise<GmailItem[]> {
  const listQuery = new URLSearchParams({ q: queryText, maxResults: "10", includeSpamTrash: "false" });
  const list = gmailListSchema.parse(await (await googleGet(userId, `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listQuery}`)).json());
  const messages = await Promise.all(list.messages.map(async ({ id }) => {
    const params = new URLSearchParams({ format: "metadata", metadataHeaders: "Subject" });
    params.append("metadataHeaders", "From"); params.append("metadataHeaders", "Date");
    return gmailMessageSchema.parse(await (await googleGet(userId, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?${params}`)).json());
  }));
  const items = messages.map((message) => ({ id: message.id, subject: header(message.payload.headers, "subject") || "(No subject)", from: header(message.payload.headers, "from"), date: header(message.payload.headers, "date"), snippet: message.snippet.slice(0, 500) }));
  await record(userId, "gmail_read", { resultCount: items.length });
  return items;
}

export async function revokeAndDisconnect(client: SupabaseClient<Database>, userId: string) {
  let revoked = false;
  try {
    const credential = await storedCredential(userId);
    const token = decryptCredential(credential.refreshTokenCiphertext);
    const response = await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
    revoked = response.ok;
  } catch { /* Local credential removal must remain available. */ }
  const result = await client.rpc("disconnect_google_integration", { p_remote_revoked: revoked });
  if (result.error || !result.data) throw new WorkspaceError("INTEGRATION_NOT_CONNECTED", 409);
  return revoked;
}
