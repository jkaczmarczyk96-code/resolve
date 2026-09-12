import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";

let db: PGlite;
const owner = randomUUID(); const other = randomUUID(); const runId = randomUUID(); const secret = "c".repeat(64);
let problemId: string;
async function actor(id: string) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec("set role authenticated"); }

beforeAll(async () => {
  db = await createTestDatabase(); await db.query("insert into auth.users(id) values($1),($2)", [owner, other]); await actor(owner);
  const row = await db.query<{ job: { problemId: string } }>("select public.reserve_web_run($1,$2,null,'A fictional persistent workflow recovery test problem.') as job", [runId, secret]);
  problemId = row.rows[0].job.problemId;
});
afterAll(async () => { await db?.close(); });

it("renews an expired queued job without creating another attempt", async () => {
  await db.exec("reset role"); await db.query("update public.web_runs set expires_at=now()-interval '1 minute' where id=$1", [runId]); await actor(owner);
  const recovered = await db.query<{ job: { status: string } }>("select public.recover_web_run($1,$2) as job", [runId, secret]);
  expect(recovered.rows[0].job.status).toBe("queued");
  expect((await db.query<{ count: number }>("select count(*)::int as count from public.web_runs where problem_id=$1", [problemId])).rows[0].count).toBe(1);
});

it("requeues an expired claimed job from a validated checkpoint and marks the next claim recoverable", async () => {
  await db.query("select public.claim_web_run($1,$2)", [runId, secret]); await db.exec("reset role");
  const snapshot = { version: 2, id: runId, problemId, description: "A fictional persistent workflow recovery test problem.", model: "fixture", state: "PENDING", revision: 0, intake: null, plan: null, research: null, verification: null, options: null, critique: null, decision: null, tasks: null, error: null, events: [{ state: "PENDING", at: new Date().toISOString() }], qualityPolicy: 1 };
  await db.query("insert into public.full_workflow_runs(id,problem_id,state,revision,snapshot) values($1,$2,'PENDING',0,$3)", [runId, problemId, JSON.stringify(snapshot)]);
  await db.query("update public.web_runs set expires_at=now()-interval '1 minute' where id=$1", [runId]); await actor(owner);
  expect((await db.query<{ job: { status: string } }>("select public.recover_web_run($1,$2) as job", [runId, secret])).rows[0].job.status).toBe("queued");
  const claim = await db.query<{ job: { recover: boolean } }>("select public.claim_web_run($1,$2) as job", [runId, secret]);
  expect(claim.rows[0].job.recover).toBe(true);
});

it("does not expose or recover another user's job", async () => {
  await actor(other);
  await expect(db.query("select public.recover_web_run($1,$2)", [runId, secret])).rejects.toThrow("NOT_FOUND");
  expect((await db.query("select id from public.web_runs where id=$1", [runId])).rows).toEqual([]);
});
