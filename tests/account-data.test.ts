import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";
let db: PGlite; const owner = randomUUID(); const other = randomUUID(); const run = randomUUID(); let problem: string;
async function actor(id: string) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec("set role authenticated"); }
beforeAll(async () => {
  db = await createTestDatabase(); await db.query("insert into auth.users(id) values($1),($2)", [owner, other]); await actor(owner);
  const result = await db.query<{ job: { problemId: string } }>("select public.reserve_web_run($1,$2,null,'A fictional private account export problem.') as job", [run, "a".repeat(64)]); problem = result.rows[0].job.problemId;
  await db.query("select public.claim_web_run($1,$2)", [run, "a".repeat(64)]); await db.query("select public.finish_web_run($1,$2,'completed',null)", [run, "a".repeat(64)]);
  await db.query("select public.create_monitoring_condition($1,'An official condition becomes true.','example official condition status')", [problem]);
});
afterAll(async () => { await db?.close(); });
it("exports all owned data but excludes worker credentials and other accounts", async () => {
  await db.query("select public.record_product_event('page_view','/dashboard','{}')");
  const result = await db.query<{ data: { profile: { id: string }; problems: Array<{ id: string }>; web_runs: Array<Record<string, unknown>>; monitoring_conditions: unknown[]; notifications: unknown[]; product_events: unknown[] } }>("select public.export_account_data() as data");
  const data = result.rows[0].data; expect(data.profile.id).toBe(owner); expect(data.problems.map((p) => p.id)).toEqual([problem]); expect(data.web_runs[0].secret_token).toBeUndefined(); expect(JSON.stringify(data)).not.toContain("a".repeat(64)); expect(data.monitoring_conditions).toHaveLength(1); expect(data.notifications).toHaveLength(1); expect(data.product_events).toHaveLength(1);
  await actor(other); const foreign = await db.query<{ data: { problems: unknown[]; web_runs: unknown[] } }>("select public.export_account_data() as data"); expect(foreign.rows[0].data.problems).toEqual([]); expect(foreign.rows[0].data.web_runs).toEqual([]);
});
it("rejects missing identity and deletes owned workspace data through Auth cascades", async () => {
  await actor(""); await expect(db.query("select public.export_account_data()")).rejects.toThrow("AUTHENTICATION");
  await db.exec("reset role"); await db.query("delete from auth.users where id=$1", [owner]);
  for (const table of ["profiles", "problems", "web_runs", "monitoring_conditions", "notifications", "notification_events", "product_events"]) {
    const column = table === "profiles" ? "id" : "user_id";
    expect((await db.query(`select 1 from public.${table} where ${column}=$1`, [owner])).rows).toHaveLength(0);
  }
  expect((await db.query("select id from public.profiles where id=$1", [other])).rows).toHaveLength(1);
});
