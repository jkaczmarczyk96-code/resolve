import "server-only";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/lib/database/types";
import { getPublicEnvironment } from "@/lib/config/public-env";
import { WorkspaceError } from "@/lib/workspace/http";
import { decryptCredential, encryptCredential } from "./crypto";
import { getGoogleIntegrationConfig } from "./config";
import { integrationCredentialSchema, type CalendarItem, type GmailItem, type GoogleService } from "./contracts";

export const GOOGLE_READ_SCOPES: Record<GoogleService, string> = {
  calendar: "https://www.googleapis.com/auth/calendar.readonly",
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
};

export function googleScopesForServices(services: GoogleService[]) { return services.map((service) => GOOGLE_READ_SCOPES[service]); }
export function googleServicesForScopes(scopes: string[]): GoogleService[] {
  return (["calendar", "gmail"] as const).filter((service) => scopes.includes(GOOGLE_READ_SCOPES[service]));
}

const gmailProfileSchema = z.object({ emailAddress: z.email() }).loose();
const googleUserSchema = z.object({ email: z.email(), email_verified: z.boolean().optional() }).loose();
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

export async function completeGoogleIntegration(client: SupabaseClient<Database>, user: User, session: Session, authorized: GoogleService[], enabled: GoogleService[]) {
  const access = session.provider_token;
  const refresh = session.provider_refresh_token;
  if (!access || !refresh) throw new WorkspaceError("INTEGRATION_AUTH_FAILED", 409);
  const responses = await Promise.all([
    directGoogleGet("https://openidconnect.googleapis.com/v1/userinfo", access),
    ...(authorized.includes("gmail") ? [directGoogleGet("https://gmail.googleapis.com/gmail/v1/users/me/profile", access)] : []),
    ...(authorized.includes("calendar") ? [directGoogleGet("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1", access)] : []),
  ]);
  if (responses.some((response) => !response.ok)) throw new WorkspaceError("INTEGRATION_PERMISSION_REQUIRED", 403);
  const googleUser = googleUserSchema.safeParse(await responses[0].json());
  if (!googleUser.success || googleUser.data.email_verified === false || googleUser.data.email.toLowerCase() !== user.email?.toLowerCase()) throw new WorkspaceError("INTEGRATION_ACCOUNT_MISMATCH", 403);
  if (authorized.includes("gmail")) {
    const profile = gmailProfileSchema.safeParse(await responses[1].json());
    if (!profile.success || profile.data.emailAddress.toLowerCase() !== googleUser.data.email.toLowerCase()) throw new WorkspaceError("INTEGRATION_ACCOUNT_MISMATCH", 403);
  }
  const expiresAt = new Date(Date.now() + 55 * 60_000).toISOString();
  const result = await client.rpc("save_google_integration", {
    p_email: googleUser.data.email,
    p_scopes: googleScopesForServices(authorized),
    p_enabled_services: enabled,
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

async function accessToken(userId: string, service: GoogleService, forceRefresh = false) {
  const credential = await storedCredential(userId);
  if (!credential.enabledServices.includes(service)) throw new WorkspaceError("INTEGRATION_SERVICE_DISABLED", 409);
  if (!forceRefresh && Date.parse(credential.expiresAt) > Date.now() + 60_000) return decryptCredential(credential.accessTokenCiphertext);
  return refreshAccess(userId, credential);
}

async function googleGet(userId: string, service: GoogleService, url: string) {
  let response = await directGoogleGet(url, await accessToken(userId, service));
  if (response.status === 401) response = await directGoogleGet(url, await accessToken(userId, service, true));
  if (!response.ok) throw new WorkspaceError(response.status === 403 ? "INTEGRATION_PERMISSION_REQUIRED" : "INTEGRATION_UNAVAILABLE", response.status === 403 ? 403 : 503);
  return response;
}

async function record(userId: string, action: "calendar_read" | "gmail_read" | "error", detail: Json) {
  await serviceRpc<boolean>("record_google_integration_event", { p_user: userId, p_action: action, p_detail: detail });
}

export async function readCalendar(userId: string, days: number): Promise<CalendarItem[]> {
  const timeMin = new Date(); const timeMax = new Date(timeMin.getTime() + days * 86_400_000);
  const query = new URLSearchParams({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "50", fields: "items(id,summary,status,location,start,end)" });
  const parsed = calendarSchema.parse(await (await googleGet(userId, "calendar", `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`)).json());
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
  const list = gmailListSchema.parse(await (await googleGet(userId, "gmail", `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listQuery}`)).json());
  const messages = await Promise.all(list.messages.map(async ({ id }) => {
    const params = new URLSearchParams({ format: "metadata", metadataHeaders: "Subject" });
    params.append("metadataHeaders", "From"); params.append("metadataHeaders", "Date");
    return gmailMessageSchema.parse(await (await googleGet(userId, "gmail", `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?${params}`)).json());
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

export async function setGoogleServiceEnabled(client: SupabaseClient<Database>, service: GoogleService, enabled: boolean) {
  const result = await client.rpc("set_google_integration_service", { p_service: service, p_enabled: enabled });
  if (result.error || !result.data) throw new WorkspaceError("INTEGRATION_PERMISSION_REQUIRED", 409);
}
