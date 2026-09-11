import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";

let db: PGlite;
let owner: string;
const secret = "a".repeat(64);
const description = "Plan a fictional community documentation workshop.";
type Job = { id: string; problemId: string; status: string; error: string | null };
async function reserve(id: string = randomUUID(), problem: string | null = null, text = description) {
  return (await db.query<{ job: Job }>("select public.reserve_web_run($1,$2,$3,$4) as job", [id, secret, problem, text])).rows[0].job;
}
async function claim(job: Job, token = secret) {
  return (await db.query<{ job: Job | null }>("select public.claim_web_run($1,$2) as job", [job.id, token])).rows[0].job;
}
async function finish(job: Job, status = "failed", token = secret) {
  return (await db.query<{ done: boolean }>("select public.finish_web_run($1,$2,$3,'PROVIDER') as done", [job.id, token, status])).rows[0].done;
}
beforeAll(async () => { db = await createTestDatabase(); });
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("reset role"); owner = randomUUID();
  await db.query("insert into auth.users(id) values ($1)", [owner]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
  await db.exec("set role authenticated");
});
it("reserves idempotently, binds the body and claims exactly once", async () => {
  const job = await reserve();
  expect(await reserve(job.id)).toEqual(job);
  await expect(reserve(job.id, null, "A different fictional community workshop.")).rejects.toThrow("CONFLICT");
  expect(await claim(job, "b".repeat(64))).toBeNull();
  expect((await claim(job))?.status).toBe("running");
  expect(await claim(job)).toBeNull();
  expect(await finish(job, "completed", "b".repeat(64))).toBe(false);
  expect(await finish(job, "completed")).toBe(true);
  expect(await finish(job)).toBe(false);
  await expect(reserve(randomUUID(), job.problemId)).rejects.toThrow("ALREADY_COMPLETED");
});
it("protects secrets, mutations and other accounts", async () => {
  const job = await reserve();
  await expect(db.query("select secret_token from public.web_runs")).rejects.toThrow(/permission denied/);
  await expect(db.query("update public.web_runs set status='completed' where id=$1", [job.id])).rejects.toThrow(/permission denied/);
  await expect(db.query("delete from public.web_runs where id=$1", [job.id])).rejects.toThrow(/permission denied/);
  await db.exec("reset role"); const other = randomUUID();
  await db.query("insert into auth.users(id) values ($1)", [other]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
  await db.exec("set role authenticated");
  expect((await db.query("select id from public.web_runs where id=$1", [job.id])).rows).toEqual([]);
  expect(await claim(job)).toBeNull();
  expect(await finish(job)).toBe(false);
  await expect(reserve(randomUUID(), job.problemId)).rejects.toThrow("NOT_FOUND");
  await expect(reserve(job.id)).rejects.toThrow("CONFLICT");
  await db.exec("set role anon");
  await expect(reserve()).rejects.toThrow(/permission denied/);
});
it("limits active runs and keeps quota after a problem is deleted", async () => {
  for (let index = 0; index < 5; index++) {
    const job = await reserve();
    await expect(reserve()).rejects.toThrow("ACTIVE_RUN");
    await claim(job); await finish(job);
    await db.query("delete from public.problems where id=$1", [job.problemId]);
  }
  await expect(reserve()).rejects.toThrow("DAILY_LIMIT");
});
it("allows explicit retry but stops after three attempts", async () => {
  let job = await reserve(); const problem = job.problemId;
  for (let index = 0; index < 3; index++) {
    if (index) job = await reserve(randomUUID(), problem);
    await claim(job); await finish(job);
  }
  await expect(reserve(randomUUID(), problem)).rejects.toThrow("ATTEMPT_LIMIT");
});
it("expires abandoned workers and rejects their late claim or finish", async () => {
  const job = await reserve(); await claim(job);
  await db.exec("reset role");
  await db.query("update public.web_runs set expires_at=now()-interval '1 minute' where id=$1", [job.id]);
  await db.exec("set role authenticated");
  expect(await finish(job)).toBe(false);
  expect(await claim(job)).toBeNull();
  await reserve(randomUUID(), job.problemId);
  expect((await db.query("select status,error from public.web_runs where id=$1", [job.id])).rows).toEqual([{ status: "failed", error: "INTERRUPTED" }]);
});
