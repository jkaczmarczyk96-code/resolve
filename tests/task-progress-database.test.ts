import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";

let db: PGlite;
const owner = randomUUID();
const other = randomUUID();
const runId = randomUUID();
const secret = "d".repeat(64);
let problemId: string;

async function actor(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}

beforeAll(async () => {
  db = await createTestDatabase();
  await db.query("insert into auth.users(id) values($1),($2)", [owner, other]);
  await actor(owner);
  const reserved = await db.query<{ job: { problemId: string } }>("select public.reserve_web_run($1,$2,null,'Prepare a careful launch plan with owners and rollback checks.') as job", [runId, secret]);
  problemId = reserved.rows[0].job.problemId;
  await db.query("select public.claim_web_run($1,$2)", [runId, secret]);

  const states = ["PENDING", "INTAKE", "PLAN", "RESEARCH", "VERIFY", "OPTIONS", "CRITIQUE", "DECIDE", "TASKS", "COMPLETED"];
  const snapshot = (state: string, revision: number) => ({
    version: 2, id: runId, problemId, state, revision,
    tasks: state === "COMPLETED" ? { tasks: [{ id: "launch-check", title: "Run launch checks", description: "Verify security, deployment and rollback.", priority: "high", dependencies: [], planStepId: null, optionId: null, status: "proposed" }] } : null,
  });
  await db.query("insert into public.full_workflow_runs(id,problem_id,state,revision,snapshot) values($1,$2,'PENDING',0,$3)", [runId, problemId, JSON.stringify(snapshot("PENDING", 0))]);
  for (let revision = 1; revision < states.length; revision += 1) {
    await db.query("update public.full_workflow_runs set state=$1,revision=$2,snapshot=$3 where id=$4", [states[revision], revision, JSON.stringify(snapshot(states[revision], revision)), runId]);
  }
});

afterAll(async () => { await db?.close(); });

it("materializes generated tasks atomically when a workflow completes", async () => {
  await actor(owner);
  const result = await db.query<{ finished: boolean }>("select public.finish_web_run($1,$2,'completed',null) as finished", [runId, secret]);
  expect(result.rows[0].finished).toBe(true);
  const tasks = await db.query<{ id: string; source_task_id: string; status: string; completed_at: string | null }>("select id,source_task_id,status,completed_at from public.tasks where problem_id=$1", [problemId]);
  expect(tasks.rows).toHaveLength(1);
  expect(tasks.rows[0]).toMatchObject({ source_task_id: "launch-check", status: "pending", completed_at: null });
  expect((await db.query("select public.finish_web_run($1,$2,'completed',null)", [runId, secret])).rows[0]).toEqual({ finish_web_run: false });
});

it("lets only the owner track progress and enforces completion timestamps", async () => {
  await actor(owner);
  const task = (await db.query<{ id: string }>("select id from public.tasks where problem_id=$1", [problemId])).rows[0];
  await expect(db.query("update public.tasks set status='completed' where id=$1", [task.id])).rejects.toThrow(/check constraint/);
  expect((await db.query("update public.tasks set status='completed',completed_at=now() where id=$1 returning status", [task.id])).rows).toEqual([{ status: "completed" }]);

  await actor(other);
  expect((await db.query("select id from public.tasks where id=$1", [task.id])).rows).toEqual([]);
  expect((await db.query("update public.tasks set status='cancelled',completed_at=null where id=$1 returning id", [task.id])).rows).toEqual([]);
});

