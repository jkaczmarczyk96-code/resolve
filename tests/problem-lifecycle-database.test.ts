import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";

let db: PGlite;
const owner = randomUUID(); const other = randomUUID(); const problem = randomUUID(); const run = randomUUID();
async function actor(id: string) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec("set role authenticated"); }

beforeAll(async () => {
  db = await createTestDatabase();
  await db.query("insert into auth.users(id) values($1),($2)", [owner, other]);
  await db.query("insert into public.problems(id,user_id,title,original_input,status) values($1,$2,'Launch plan','Prepare a careful launch plan','evaluating')", [problem, owner]);
  await db.query("insert into public.web_runs(id,user_id,problem_id,status,secret_token) values($1,$2,$3,'completed',$4)", [run, owner, problem, "e".repeat(64)]);
  await actor(owner);
  await db.query("select public.create_monitoring_condition($1,'A verified launch condition is met','official launch readiness status documentation')", [problem]);
});
afterAll(async () => { await db?.close(); });

it("closes a completed problem, pauses monitoring and records one idempotent event", async () => {
  await actor(owner);
  const result = await db.query<{ value: { status: string; solvedAt: string } }>("select public.set_problem_resolution($1,true) as value", [problem]);
  expect(result.rows[0].value.status).toBe("solved");
  expect(result.rows[0].value.solvedAt).toBeTruthy();
  expect((await db.query("select status from public.monitoring_conditions where problem_id=$1", [problem])).rows).toEqual([{ status: "paused" }]);
  await db.query("select public.set_problem_resolution($1,true)", [problem]);
  expect((await db.query("select event from public.problem_lifecycle_events where problem_id=$1", [problem])).rows).toEqual([{ event: "solved" }]);
  const condition = (await db.query<{ id: string }>("select id from public.monitoring_conditions where problem_id=$1", [problem])).rows[0];
  await expect(db.query("select public.set_monitoring_condition_status($1,'active')", [condition.id])).rejects.toThrow("PROBLEM_SOLVED");
  await expect(db.query("select public.create_monitoring_condition($1,'Another condition to verify','another official condition search query')", [problem])).rejects.toThrow("PROBLEM_SOLVED");
});

it("isolates lifecycle events and reopens before monitoring can resume", async () => {
  await actor(other);
  expect((await db.query("select id from public.problem_lifecycle_events where problem_id=$1", [problem])).rows).toEqual([]);
  await expect(db.query("select public.set_problem_resolution($1,false)", [problem])).rejects.toThrow("NOT_FOUND");

  await actor(owner);
  const reopened = await db.query<{ value: { status: string; solvedAt: null } }>("select public.set_problem_resolution($1,false) as value", [problem]);
  expect(reopened.rows[0].value).toEqual({ status: "evaluating", solvedAt: null });
  const condition = (await db.query<{ id: string }>("select id from public.monitoring_conditions where problem_id=$1", [problem])).rows[0];
  await db.query("select public.set_monitoring_condition_status($1,'active')", [condition.id]);
  expect((await db.query("select status,solved_at from public.problems where id=$1", [problem])).rows).toEqual([{ status: "monitoring", solved_at: null }]);
  expect((await db.query("select event from public.problem_lifecycle_events where problem_id=$1 order by created_at", [problem])).rows).toEqual([{ event: "solved" }, { event: "reopened" }]);
  const exported = (await db.query<{ data: { version: number; problem_lifecycle_events: unknown[] } }>("select public.export_account_data() as data")).rows[0].data;
  expect(exported.version).toBe(3); expect(exported.problem_lifecycle_events).toHaveLength(2);
});
