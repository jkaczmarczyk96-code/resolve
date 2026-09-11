import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";
import { runBasicWorkflow } from "@/lib/orchestration/basic";
import { parseSnapshot, type WorkflowSnapshot } from "@/lib/orchestration/state";
import { MemoryWorkflowStore, workflowRequest } from "./fixtures/workflow";
import { outputs } from "./fixtures/ai";

let db: PGlite;
let snapshots: WorkflowSnapshot[];
const alice = randomUUID();
const bob = randomUUID();
const request = workflowRequest();
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec("set role authenticated");
}
async function insert(snapshot: WorkflowSnapshot) {
  return db.query("insert into public.workflow_runs (id, problem_id, state, revision, snapshot) values ($1,$2,$3,$4,$5)", [snapshot.id, snapshot.problemId, snapshot.state, snapshot.revision, JSON.stringify(snapshot)]);
}
async function update(snapshot: WorkflowSnapshot, expected: number) {
  return db.query("update public.workflow_runs set state=$1, revision=$2, snapshot=$3 where id=$4 and revision=$5 returning snapshot", [snapshot.state, snapshot.revision, JSON.stringify(snapshot), snapshot.id, expected]);
}
beforeAll(async () => {
  db = await createTestDatabase();
  await db.query("insert into auth.users(id) values ($1),($2)", [alice, bob]);
  await asUser(alice);
  await db.query("insert into public.problems(id,user_id,title,original_input) values ($1,$2,'Workflow test','Test-only problem')", [request.problemId, alice]);
  const memory = new MemoryWorkflowStore();
  await runBasicWorkflow(request, memory, { ai: { model: "fixture", generate: async (item) => item.name === "decision" ? { ...outputs.decision, selectedOptionId: "proposed-plan", supportingEvidence: [] } : item.name === "intake" ? outputs.intake : outputs.planner } });
  snapshots = memory.history;
  await insert(snapshots[0]);
});
afterAll(async () => { await db?.close(); });
it("enforces ownership on all operations and denies anonymous access", async () => {
  await asUser(bob);
  expect((await db.query("select id from public.workflow_runs")).rows).toEqual([]);
  await expect(insert({ ...snapshots[0], id: randomUUID() })).rejects.toThrow(/row-level security/);
  expect((await update(snapshots[1], 0)).rows).toEqual([]);
  expect((await db.query("delete from public.workflow_runs where id=$1 returning id", [request.runId])).rows).toEqual([]);
  await db.exec("reset role; set role anon");
  await expect(db.query("select id from public.workflow_runs")).rejects.toThrow(/permission denied/);
  await asUser(alice);
});
it("rejects stage skipping, revision skipping, malformed identity and duplicate runs", async () => {
  await expect(update(snapshots[2], 0)).rejects.toThrow(/Invalid workflow transition/);
  await expect(insert(snapshots[0])).rejects.toThrow(/duplicate key/);
  await expect(insert({ ...snapshots[1], id: randomUUID() })).rejects.toThrow(/begin pending/);
  await expect(db.query("update public.workflow_runs set problem_id=$1 where id=$2", [randomUUID(), request.runId])).rejects.toThrow(/identity is immutable/);
  await expect(db.query("insert into public.workflow_runs(id,problem_id,state,revision,snapshot) values ($1,$2,'PENDING',0,$3)", [randomUUID(), request.problemId, JSON.stringify({ ...snapshots[0], id: null })])).rejects.toThrow(/check constraint/);
});
it("persists the complete chain, rejects stale writes and freezes terminal states", async () => {
  for (const snapshot of snapshots.slice(1)) {
    expect((await update(snapshot, snapshot.revision - 1)).rows).toHaveLength(1);
  }
  expect((await update(snapshots[1], 0)).rows).toHaveLength(0);
  const read = await db.query<{ snapshot: unknown }>("select snapshot from public.workflow_runs where id=$1", [request.runId]);
  expect(parseSnapshot(read.rows[0].snapshot)).toEqual(snapshots.at(-1));
  await expect(db.query("update public.workflow_runs set state='PENDING',revision=0 where id=$1", [request.runId])).rejects.toThrow(/Invalid workflow transition/);
});
it("cascades workflow checkpoints when their owned problem is deleted", async () => {
  await db.query("delete from public.problems where id=$1", [request.problemId]);
  expect((await db.query("select id from public.workflow_runs where id=$1", [request.runId])).rows).toHaveLength(0);
});
