import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";

let db: PGlite; const owner = randomUUID(); const other = randomUUID(); const access = "a".repeat(64); const refresh = "r".repeat(64);
const scopes = ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/gmail.readonly"];
async function actor(id: string) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec("set role authenticated"); }

beforeAll(async () => { db = await createTestDatabase(); await db.query("insert into auth.users(id) values($1),($2)", [owner, other]); await actor(owner); });
afterAll(async () => { await db?.close(); });

it("stores only owner-visible integration metadata while isolating credentials", async () => {
  await db.query("select public.save_google_integration($1,$2,$3,$4,$5,now()+interval '1 hour')", ["owner@example.com", scopes, ["calendar", "gmail"], access, refresh]);
  expect((await db.query("select provider,status,account_email,enabled_services from public.integrations")).rows).toEqual([{ provider: "google", status: "connected", account_email: "owner@example.com", enabled_services: ["calendar", "gmail"] }]);
  expect((await db.query("select action from public.integration_events")).rows).toEqual([{ action: "connected" }]);
  await expect(db.query("select * from private.integration_credentials")).rejects.toThrow(/permission denied/);
  await expect(db.query("select public.get_google_integration_credential($1)", [owner])).rejects.toThrow(/permission denied/);
  await actor(other); expect((await db.query("select * from public.integrations")).rows).toEqual([]); expect((await db.query("select * from public.integration_events")).rows).toEqual([]);
});

it("restricts permissions and lets service operations refresh and audit without exposing tokens", async () => {
  await actor(owner);
  await expect(db.query("select public.save_google_integration($1,$2,$3,$4,$5,now()+interval '1 hour')", ["other@example.com", [scopes[0]], ["calendar", "gmail"], access, refresh])).rejects.toThrow(/INVALID_SCOPES/);
  await expect(db.query("select public.save_google_integration($1,$2,$3,$4,$5,now()+interval '1 hour')", ["other@example.com", scopes, ["calendar", "calendar"], access, refresh])).rejects.toThrow(/INVALID_SERVICES/);
  expect((await db.query("select public.set_google_integration_service('gmail',false) as done")).rows).toEqual([{ done: true }]);
  expect((await db.query("select enabled_services from public.integrations")).rows).toEqual([{ enabled_services: ["calendar"] }]);
  expect((await db.query("select public.set_google_integration_service('gmail',true) as done")).rows).toEqual([{ done: true }]);
  await db.exec("reset role; set role service_role");
  const credential = await db.query<{ value: { accessTokenCiphertext: string; refreshTokenCiphertext: string } }>("select public.get_google_integration_credential($1) as value", [owner]);
  expect(credential.rows[0].value).toMatchObject({ accessTokenCiphertext: access, refreshTokenCiphertext: refresh, enabledServices: ["calendar", "gmail"] });
  expect((await db.query("select public.update_google_integration_access($1,$2,now()+interval '1 hour') as saved", [owner, "b".repeat(64)])).rows).toEqual([{ saved: true }]);
  await db.query("select public.record_google_integration_event($1,'calendar_read',$2)", [owner, JSON.stringify({ resultCount: 2 })]);
  await actor(owner); expect((await db.query<{ action: string }>("select action from public.integration_events order by created_at,id")).rows.map((row) => row.action)).toEqual(["connected", "service_disabled", "service_enabled", "refreshed", "calendar_read"]);
});

it("allows one authorized service without implicitly enabling another", async () => {
  await actor(other);
  await db.query("select public.save_google_integration($1,$2,$3,$4,$5,now()+interval '1 hour')", ["other@example.com", [scopes[0]], ["calendar"], access, refresh]);
  expect((await db.query("select public.set_google_integration_service('gmail',true) as done")).rows).toEqual([{ done: false }]);
  expect((await db.query("select enabled_services from public.integrations")).rows).toEqual([{ enabled_services: ["calendar"] }]);
  await actor(owner);
});

it("preserves an authorized but locally disabled service", async () => {
  await actor(owner);
  await db.query("select public.save_google_integration($1,$2,$3,$4,$5,now()+interval '1 hour')", ["owner@example.com", scopes, ["calendar"], access, refresh]);
  expect((await db.query("select scopes,enabled_services from public.integrations")).rows).toEqual([{ scopes, enabled_services: ["calendar"] }]);
});

it("disconnects locally and removes credentials", async () => {
  expect((await db.query("select public.disconnect_google_integration(true) as done")).rows).toEqual([{ done: true }]);
  expect((await db.query("select status from public.integrations")).rows).toEqual([{ status: "disconnected" }]);
  await db.exec("reset role; set role service_role");
  expect((await db.query("select public.get_google_integration_credential($1) as value", [owner])).rows).toEqual([{ value: null }]);
});
