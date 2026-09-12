import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";

let db: PGlite; const owner = randomUUID(); const other = randomUUID(); const runId = randomUUID(); const secret = "a".repeat(64); let problemId: string; let conditionId: string;
async function actor(id: string) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec("set role authenticated"); }

beforeAll(async () => {
  db = await createTestDatabase(); await db.query("insert into auth.users(id) values($1),($2)", [owner, other]); await actor(owner);
  const reserved = await db.query<{ job: { problemId: string } }>("select public.reserve_web_run($1,$2,null,'Monitor a fictional public transit service threshold.') as job", [runId, secret]); problemId = reserved.rows[0].job.problemId;
  await db.query("select public.claim_web_run($1,$2)", [runId, secret]); await db.query("select public.finish_web_run($1,$2,'completed',null)", [runId, secret]);
});
afterAll(async () => { await db?.close(); });

it("creates an owned condition only after a completed analysis", async () => {
  const result = await db.query<{ item: { id: string; status: string } }>("select public.create_monitoring_condition($1,$2,$3) as item", [problemId, "A monthly transit pass costs 40 euros or less.", "current monthly public transit pass price example city"]);
  conditionId = result.rows[0].item.id; expect(result.rows[0].item.status).toBe("active");
  expect((await db.query<{ status: string }>("select status from public.problems where id=$1", [problemId])).rows[0].status).toBe("monitoring");
});

it("keeps conditions private and worker functions unavailable to users", async () => {
  await actor(other); expect((await db.query("select id from public.monitoring_conditions where id=$1", [conditionId])).rows).toEqual([]);
  await expect(db.query("select public.claim_due_monitoring_conditions(2)")).rejects.toThrow(/permission denied/);
});

it("leases due work and reschedules an inconclusive check", async () => {
  await db.exec("reset role; set role service_role");
  const claimed = await db.query<{ items: Array<{ id: string }> }>("select public.claim_due_monitoring_conditions(2) as items"); expect(claimed.rows[0].items.map((item) => item.id)).toContain(conditionId);
  const result = { outcome: "uncertain", summary: "The current price could not be established.", evidenceSourceIds: [], evidence: [] };
  expect((await db.query<{ done: boolean }>("select public.finish_monitoring_condition($1,'uncertain',$2,null) as done", [conditionId, JSON.stringify(result)])).rows[0].done).toBe(true);
  await db.exec("reset role");
  const row = (await db.query<{ status: string; last_error: string | null }>("select status,last_error from public.monitoring_conditions where id=$1", [conditionId])).rows[0]; expect(row).toEqual({ status: "active", last_error: null });
});

it("returns a problem for review when evidence meets the condition", async () => {
  await db.exec("reset role"); await db.query("update public.monitoring_conditions set next_check_at=now() where id=$1", [conditionId]); await db.exec("set role service_role");
  await db.query("select public.claim_due_monitoring_conditions(2)");
  const result = { outcome: "met", summary: "The published price is 39 euros.", evidenceSourceIds: ["source-1"], evidence: [{ id: "source-1", url: "https://example.com/fares", title: "Current fares", publishedAt: null }] };
  await db.query("select public.finish_monitoring_condition($1,'met',$2,null)", [conditionId, JSON.stringify(result)]);
  await db.exec("reset role");
  expect((await db.query<{ status: string }>("select status from public.monitoring_conditions where id=$1", [conditionId])).rows[0].status).toBe("met");
  expect((await db.query<{ status: string }>("select status from public.problems where id=$1", [problemId])).rows[0].status).toBe("action_required");
});
