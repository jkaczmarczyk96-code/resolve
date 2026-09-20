import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";
let db: PGlite; const owner = randomUUID(); const other = randomUUID(); const secret = "a".repeat(64); let problem: string; let notice: string;
async function actor(id: string) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec("set role authenticated"); }
async function run() {
  const id = randomUUID(); const result = await db.query<{ job: { problemId: string } }>("select public.reserve_web_run($1,$2,null,'A fictional notification integration test problem.') as job", [id, secret]);
  await db.query("select public.claim_web_run($1,$2)", [id, secret]);
  await db.query("select public.finish_web_run($1,$2,'completed',null)", [id, secret]);
  return { id, problem: result.rows[0].job.problemId };
}
beforeAll(async () => { db = await createTestDatabase(); await db.query("insert into auth.users(id) values($1),($2)", [owner, other]); await actor(owner); });
afterAll(async () => { await db?.close(); });
it("atomically publishes completion once and preserves read state on retry", async () => {
  const result = await run(); problem = result.problem;
  await db.query("select public.finish_web_run($1,$2,'completed',null)", [result.id, secret]);
  const rows = (await db.query<{ id: string; kind: string }>("select id,kind from public.notifications")).rows;
  expect(rows).toHaveLength(1); expect(rows[0].kind).toBe("analysis_completed"); notice = rows[0].id;
  await db.query("select public.read_notification($1)", [notice]);
  const before = (await db.query("select read_at from public.notifications where id=$1", [notice])).rows;
  await db.query("select public.read_notification($1)", [notice]);
  expect((await db.query("select read_at from public.notifications where id=$1", [notice])).rows).toEqual(before);
});
it("isolates inbox and preferences and prevents forged domain events", async () => {
  await actor(other);
  expect((await db.query("select * from public.notifications")).rows).toEqual([]);
  expect((await db.query("select public.read_notification($1) as done", [notice])).rows).toEqual([{ done: false }]);
  await expect(db.query("select public.emit_notification_event($1,$2,'input_required','forged')", [owner, problem])).rejects.toThrow(/permission denied/);
  await expect(db.query("insert into public.notifications(id,user_id,problem_id,kind) values($1,$2,$3,'input_required')", [randomUUID(), other, problem])).rejects.toThrow(/permission denied/);
  await actor(owner);
});
it("suppresses future delivery while retaining the event and independent preferences", async () => {
  await db.query("select public.save_notification_preferences(false,true,true,true)");
  const muted = await run();
  expect((await db.query("select id from public.notifications where problem_id=$1", [muted.problem])).rows).toHaveLength(0);
  await db.exec("reset role");
  expect((await db.query("select id from public.notification_events where problem_id=$1", [muted.problem])).rows).toHaveLength(1);
  await actor(other); expect((await db.query("select * from public.notification_preferences")).rows).toHaveLength(0); await actor(owner);
});
it("emits one optional reminder for each active due task", async () => {
  await db.exec("reset role");
  const task = randomUUID();
  await db.query("insert into public.tasks(id,problem_id,title,due_at) values($1,$2,'Review recommendation',now()+interval '1 hour')", [task, problem]);
  await actor(owner);
  await expect(db.query("select public.emit_due_task_notifications(100)")).rejects.toThrow(/permission denied/);
  await db.exec("reset role; set role service_role");
  expect((await db.query<{ count: number }>("select public.emit_due_task_notifications(100) as count")).rows).toEqual([{ count: 1 }]);
  expect((await db.query<{ count: number }>("select public.emit_due_task_notifications(100) as count")).rows).toEqual([{ count: 0 }]);
  await actor(owner);
  expect((await db.query("select kind from public.notifications where kind='task_due' and problem_id=$1",[problem])).rows).toEqual([{ kind:"task_due" }]);

  await db.query("select public.save_notification_preferences(true,true,true,false)");
  await db.exec("reset role");
  await db.query("insert into public.tasks(problem_id,title,due_at) values($1,'Muted reminder',now()+interval '2 hours')",[problem]);
  await db.exec("set role service_role");
  expect((await db.query<{ count:number }>("select public.emit_due_task_notifications(100) as count")).rows).toEqual([{ count:1 }]);
  await actor(owner);
  expect((await db.query("select kind from public.notifications where kind='task_due' and problem_id=$1",[problem])).rows).toHaveLength(1);
});
it("delivers monitoring updates through the same event abstraction", async () => {
  const condition = (await db.query<{ item: { id: string } }>("select public.create_monitoring_condition($1,'A public threshold is reached.','current official public threshold') as item", [problem])).rows[0].item.id;
  await db.exec("reset role; set role service_role"); await db.query("select public.claim_due_monitoring_conditions(2)");
  await db.query("select public.finish_monitoring_condition($1,'met',$2,null)", [condition, JSON.stringify({ outcome: "met", summary: "Threshold met", evidenceSourceIds: ["s1"], evidence: [] })]);
  await actor(owner);
  expect((await db.query("select kind from public.notifications where kind='condition_met'")).rows).toEqual([{ kind: "condition_met" }]);
});
