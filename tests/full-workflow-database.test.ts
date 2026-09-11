import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";
import { runFullWorkflow } from "@/lib/orchestration/full";
import { parseFullSnapshot, type FullSnapshot } from "@/lib/orchestration/full-state";
import { MemoryFullStore, fullDependencies } from "./fixtures/full-workflow";
import { workflowRequest } from "./fixtures/workflow";

let db: PGlite; let snapshots: FullSnapshot[];
const owner = randomUUID(); const request = workflowRequest();
async function insert(value: FullSnapshot) {
  return db.query("insert into public.full_workflow_runs(id,problem_id,state,revision,snapshot) values ($1,$2,$3,$4,$5)", [value.id, value.problemId, value.state, value.revision, JSON.stringify(value)]);
}
async function save(value: FullSnapshot, revision: number) {
  return db.query("update public.full_workflow_runs set state=$1,revision=$2,snapshot=$3 where id=$4 and revision=$5 returning id", [value.state, value.revision, JSON.stringify(value), value.id, revision]);
}
beforeAll(async () => {
  db = await createTestDatabase();
  await db.query("insert into auth.users(id) values ($1)", [owner]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]); await db.exec("set role authenticated");
  await db.query("insert into public.problems(id,user_id,title,original_input) values ($1,$2,'Full test','Fictional problem')", [request.problemId, owner]);
  const store = new MemoryFullStore(); await runFullWorkflow(request, store, fullDependencies()); snapshots = store.history;
  await insert(snapshots[0]);
});
afterAll(async () => { await db?.close(); });
it("rejects duplicate IDs, skipped states, version confusion and identity mutation", async () => {
  await expect(insert(snapshots[0])).rejects.toThrow(/duplicate key/);
  await expect(save(snapshots[3], 0)).rejects.toThrow(/Invalid workflow transition/);
  await expect(insert({ ...snapshots[0], id: randomUUID(), version: 1 } as never)).rejects.toThrow(/check constraint/);
  await expect(db.query("update public.full_workflow_runs set problem_id=$1 where id=$2", [randomUUID(), request.runId])).rejects.toThrow(/identity is immutable/);
});
it("writes every stage, preserves outputs and rejects stale or terminal writes", async () => {
  for (const value of snapshots.slice(1)) expect((await save(value, value.revision - 1)).rows).toHaveLength(1);
  expect((await save(snapshots[1], 0)).rows).toEqual([]);
  const result = await db.query<{ snapshot: unknown }>("select snapshot from public.full_workflow_runs where id=$1", [request.runId]);
  expect(parseFullSnapshot(result.rows[0].snapshot)).toEqual(snapshots.at(-1));
  await expect(db.query("update public.full_workflow_runs set state='FAILED',revision=10 where id=$1", [request.runId])).rejects.toThrow(/Invalid workflow transition/);
});
it("enforces version-specific basic and full contracts", async () => {
  const first = snapshots[0];
  await expect(db.query("insert into public.workflow_runs(id,problem_id,state,revision,snapshot) values ($1,$2,'PENDING',0,$3)", [first.id, first.problemId, JSON.stringify(first)])).rejects.toThrow(/check constraint/);
});
it("removes full snapshots on problem deletion", async () => {
  await db.query("delete from public.problems where id=$1", [request.problemId]);
  expect((await db.query("select id from public.full_workflow_runs where id=$1", [request.runId])).rows).toEqual([]);
});
