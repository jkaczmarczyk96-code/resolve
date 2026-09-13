import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";
import { runFullWorkflow } from "@/lib/orchestration/full";
import { MemoryFullStore, fullDependencies } from "./fixtures/full-workflow";
import type { FullSnapshot } from "@/lib/orchestration/full-state";
let db: PGlite;
const owner = randomUUID(); const other = randomUUID(); const runId = randomUUID(); const secret = "a".repeat(64);
let problemId: string; let paused: FullSnapshot; let store: MemoryFullStore;
async function actor(id: string) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec("set role authenticated"); }
async function respond(id: string, answers: unknown = ["October 15, 2026"], token = secret) { return db.query("select public.respond_web_run($1,$2,$3,$4,$5) as job", [runId, problemId, token, id, JSON.stringify(answers)]); }
beforeAll(async () => {
  db = await createTestDatabase(); await db.query("insert into auth.users(id) values($1),($2)", [owner, other]); await actor(owner);
  const reserved = await db.query<{ job: { problemId: string } }>("select public.reserve_web_run($1,$2,null,'Plan a fictional community documentation event.') as job", [runId, secret]); problemId = reserved.rows[0].job.problemId;
  await db.query("select public.claim_web_run($1,$2)", [runId, secret]);
  store = new MemoryFullStore(); paused = await runFullWorkflow({ runId, problemId }, store, fullDependencies(), { humanInput: true });
  for (const value of store.history) {
    if (value.revision === 0) await db.query("insert into public.full_workflow_runs(id,problem_id,state,revision,snapshot) values($1,$2,$3,$4,$5)", [runId, problemId, value.state, value.revision, JSON.stringify(value)]);
    else await db.query("update public.full_workflow_runs set state=$1,revision=$2,snapshot=$3 where id=$4", [value.state, value.revision, JSON.stringify(value), runId]);
  }
});
afterAll(async () => { await db?.close(); });
it("requires the worker secret to publish the immutable question checkpoint", async () => {
  const pause = (token: string) => db.query("select public.pause_web_run($1,$2,$3) as done", [runId, token, JSON.stringify(paused)]);
  expect((await pause("b".repeat(64))).rows).toEqual([{ done: false }]);
  expect((await pause(secret)).rows).toEqual([{ done: true }]);
  expect((await pause(secret)).rows).toEqual([{ done: true }]);
  await expect(db.query("update public.human_requests set questions='[]' where run_id=$1", [runId])).rejects.toThrow(/permission denied/);
  await expect(db.query("delete from public.human_requests where run_id=$1", [runId])).rejects.toThrow(/permission denied/);
  await expect(db.query("select public.reserve_web_run($1,$2,$3,null)", [randomUUID(), secret, problemId])).rejects.toThrow("INPUT_REQUIRED");
});
it("rejects foreign identities, bad secrets, empty, oversized and mismatched answers", async () => {
  await actor(other);
  expect((await db.query("select run_id from public.human_requests")).rows).toEqual([]);
  await expect(respond(randomUUID())).rejects.toThrow("NOT_FOUND");
  await actor(owner);
  await expect(respond(randomUUID(), ["ok"], "b".repeat(64))).rejects.toThrow("CONFLICT");
  for (const invalid of [[], [" "], ["x".repeat(1201)], ["one", "two"], [7], null]) await expect(respond(randomUUID(), invalid)).rejects.toThrow("INVALID_INPUT");
});
it("waits without holding an active slot and prevents concurrent continuations", async () => {
  await db.exec("reset role");
  await db.query("update public.web_runs set expires_at=now()-interval '1 day' where id=$1", [runId]);
  await actor(owner);
  const extra = randomUUID();
  await db.query("select public.reserve_web_run($1,$2,null,'Another fictional community problem to consider.')", [extra, secret]);
  await expect(respond(randomUUID())).rejects.toThrow("ACTIVE_RUN");
  await db.query("select public.claim_web_run($1,$2)", [extra, secret]);
  await db.query("select public.finish_web_run($1,$2,'failed','PROVIDER')", [extra, secret]);
});
it("rejects continuation if the editable workflow diverged from the protected checkpoint", async () => {
  await db.exec("begin");
  try {
    const changed = { ...paused, state: "RESUME", revision: 5 };
    await db.query("update public.full_workflow_runs set state='RESUME',revision=5,snapshot=$1 where id=$2", [JSON.stringify(changed), runId]);
    await expect(respond(randomUUID())).rejects.toThrow("CONFLICT");
  } finally { await db.exec("rollback"); }
});
it("accepts responses once, rejects changed replay and persists the same resumed workflow", async () => {
  const responseId = randomUUID(); const first = await respond(responseId);
  expect(await respond(responseId)).toEqual(first);
  await expect(respond(responseId, ["A changed answer"])).rejects.toThrow("RESPONSE_CONFLICT");
  await expect(respond(randomUUID())).rejects.toThrow("RESPONSE_CONFLICT");
  const claim = await db.query<{ job: { resume: { checkpoint: FullSnapshot; responseId: string; answers: string[] } } }>("select public.claim_web_run($1,$2) as job", [runId, secret]);
  expect(claim.rows[0].job.resume).toEqual({ checkpoint: paused, responseId, answers: ["October 15, 2026"] });
  expect((await db.query("select public.claim_web_run($1,$2) as job", [runId, secret])).rows).toEqual([{ job: null }]);
  const result = await runFullWorkflow({ runId, problemId }, store, fullDependencies(), { resume: { responseId, answers: ["October 15, 2026"] } });
  for (const value of store.history.filter((item) => item.revision > paused.revision)) {
    await db.query("update public.full_workflow_runs set state=$1,revision=$2,snapshot=$3 where id=$4", [value.state, value.revision, JSON.stringify(value), runId]);
    if (value.state === "RESUME") {
      expect((await db.query("select public.yield_web_run($1,$2) as yielded", [runId, secret])).rows).toEqual([{ yielded: true }]);
      const recovered = await db.query<{ job: { recover: boolean; resume: unknown } }>("select public.claim_web_run($1,$2) as job", [runId, secret]);
      expect(recovered.rows[0].job.recover).toBe(true);
      expect(recovered.rows[0].job.resume).toBeNull();
    }
  }
  expect(result.state).toBe("COMPLETED");
  await db.query("select public.finish_web_run($1,$2,'completed',null)", [runId, secret]);
  await respond(responseId);
  expect((await db.query("select public.claim_web_run($1,$2) as job", [runId, secret])).rows).toEqual([{ job: null }]);
});
