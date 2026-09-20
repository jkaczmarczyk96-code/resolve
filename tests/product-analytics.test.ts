import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";
import { normalizedProductPath, productEventSchema } from "@/lib/product/analytics";

let db: PGlite; const owner = randomUUID(); const other = randomUUID();
async function actor(id: string) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec("set role authenticated"); }
beforeAll(async () => { db = await createTestDatabase(); await db.query("insert into auth.users(id) values($1),($2)", [owner,other]); });
afterAll(async () => { await db.close(); });

it("normalizes private problem identifiers and rejects query strings", () => {
  expect(normalizedProductPath("/problems/5e700248-398f-42fe-93b2-160cfb1aaa48?view=tasks")).toBe("/problems/:id");
  expect(productEventSchema.safeParse({ event:"page_view", path:"/dashboard", properties:{} }).success).toBe(true);
  expect(productEventSchema.safeParse({ event:"page_view", path:"/dashboard?secret=x", properties:{} }).success).toBe(false);
});

it("records only allowlisted owner events and respects the account opt-out", async () => {
  await actor(owner);
  await db.query("select public.record_product_event('page_view','/problems/:id','{}')");
  expect((await db.query("select event_name,path from public.product_events")).rows).toEqual([{event_name:"page_view",path:"/problems/:id"}]);
  await expect(db.query("select public.record_product_event('unknown','/dashboard','{}')")).rejects.toThrow("INVALID_EVENT");
  await db.query("update public.profiles set product_analytics_enabled=false where id=$1", [owner]);
  await db.query("select public.record_product_event('page_view','/settings','{}')");
  expect((await db.query("select id from public.product_events")).rows).toHaveLength(1);
  await actor(other); expect((await db.query("select id from public.product_events")).rows).toHaveLength(0);
});
