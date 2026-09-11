import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";

let db: PGlite;
beforeAll(async () => { db = await createTestDatabase(); });
afterAll(async () => { await db.close(); });

it("creates a basic profile atomically from signup metadata", async () => {
  const user = randomUUID();
  await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2)", [user, { display_name: "  Alice  ", role: "admin", timezone: "evil" }]);
  const { rows } = await db.query("select id, display_name, timezone, preferred_language from public.profiles where id = $1", [user]);
  expect(rows).toEqual([{ id: user, display_name: "Alice", timezone: "UTC", preferred_language: "en" }]);
});

it.each([null, { nested: "value" }, 123, "", " "])("tolerates malformed optional display metadata: %s", async (displayName) => {
  const user = randomUUID();
  await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2)", [user, { display_name: displayName }]);
  expect((await db.query("select display_name from public.profiles where id = $1", [user])).rows).toEqual([{ display_name: null }]);
});

it("bounds oversized provider metadata and denies public trigger execution", async () => {
  const user = randomUUID();
  await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2)", [user, { display_name: "a".repeat(1000) }]);
  expect((await db.query("select display_name from public.profiles where id = $1", [user])).rows).toEqual([{ display_name: "a".repeat(100) }]);
  await db.exec("set role authenticated");
  await expect(db.query("select public.handle_new_user()" )).rejects.toThrow(/permission denied/);
});
