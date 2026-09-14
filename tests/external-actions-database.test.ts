import { randomUUID } from "node:crypto";
import { afterAll,beforeAll,expect,it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDatabase } from "../scripts/lib/database.mjs";

let db:PGlite; const owner=randomUUID(); const other=randomUUID(); const problem=randomUUID(); const run=randomUUID();
const readScope="https://www.googleapis.com/auth/calendar.readonly"; const writeScope="https://www.googleapis.com/auth/calendar.events.owned";
const payload={ summary:"Review Avenli plan",description:"Review the saved recommendation.",location:"",start:new Date(Date.now()+3_600_000).toISOString(),end:new Date(Date.now()+7_200_000).toISOString() };
async function actor(id:string){ await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec("set role authenticated"); }

beforeAll(async()=>{
  db=await createTestDatabase();
  await db.query("insert into auth.users(id) values($1),($2)",[owner,other]);
  await db.query("insert into public.problems(id,user_id,title,original_input) values($1,$2,'Plan review','Review the completed plan')",[problem,owner]);
  await db.query("insert into public.web_runs(id,user_id,problem_id,status,secret_token) values($1,$2,$3,'completed',$4)",[run,owner,problem,"a".repeat(64)]);
  await actor(owner);
  await db.query("select public.save_google_integration($1,$2,$3,$4,$5,now()+interval '1 hour')",["owner@example.com",[readScope],["calendar"],"a".repeat(64),"r".repeat(64)]);
});
afterAll(async()=>{ await db?.close(); });

it("creates an idempotent owner-scoped proposal without executing it",async()=>{
  const request=randomUUID();
  const first=await db.query<{ id:string }>("select public.propose_calendar_action($1,$2,$3) as id",[problem,request,JSON.stringify(payload)]);
  const again=await db.query<{ id:string }>("select public.propose_calendar_action($1,$2,$3) as id",[problem,request,JSON.stringify(payload)]);
  expect(again.rows[0].id).toBe(first.rows[0].id);
  expect((await db.query("select status,approved_at,executed_at from public.external_actions")).rows).toEqual([{ status:"proposed",approved_at:null,executed_at:null }]);
  await expect(db.query("select public.propose_calendar_action($1,$2,$3)",[problem,request,JSON.stringify({ ...payload,summary:"Changed" })])).rejects.toThrow(/REQUEST_CONFLICT/);
  await actor(other); expect((await db.query("select * from public.external_actions")).rows).toEqual([]);
  await actor(owner);
});

it("requires the write grant at approval time and records execution audit",async()=>{
  const action=(await db.query<{ id:string }>("select id from public.external_actions limit 1")).rows[0].id;
  await expect(db.query("select public.claim_external_action($1)",[action])).rejects.toThrow(/WRITE_PERMISSION_REQUIRED/);
  await db.query("select public.save_google_integration($1,$2,$3,$4,$5,now()+interval '1 hour')",["owner@example.com",[readScope,writeScope],["calendar"],"b".repeat(64),"s".repeat(64)]);
  const claimed=await db.query<{ value:{ status:string;alreadyCompleted:boolean } }>("select public.claim_external_action($1) as value",[action]);
  expect(claimed.rows[0].value).toMatchObject({ status:"executing",alreadyCompleted:false });
  await expect(db.query("select public.finish_external_action($1,$2,true,$3,null)",[owner,action,JSON.stringify({ eventId:"one",eventUrl:"https://www.google.com/calendar/event?eid=one" })])).rejects.toThrow(/permission denied/);
  await db.exec("reset role; set role service_role");
  await db.query("select public.finish_external_action($1,$2,true,$3,null)",[owner,action,JSON.stringify({ eventId:"one",eventUrl:"https://www.google.com/calendar/event?eid=one" })]);
  await actor(owner);
  expect((await db.query("select status,attempt_count,result from public.external_actions")).rows[0]).toMatchObject({ status:"succeeded",attempt_count:1,result:{ eventId:"one",eventUrl:"https://www.google.com/calendar/event?eid=one" } });
  expect((await db.query<{ event:string }>("select event from public.external_action_events order by sequence")).rows.map((row)=>row.event)).toEqual(["proposed","approved","execution_started","succeeded"]);
  const exported=(await db.query<{ data:{ external_actions:unknown[];external_action_events:unknown[] } }>("select public.export_account_data() as data")).rows[0].data;
  expect(exported.external_actions).toHaveLength(1);
  expect(exported.external_action_events).toHaveLength(4);
});

it("allows cancellation only before execution",async()=>{
  const request=randomUUID(); const action=(await db.query<{ id:string }>("select public.propose_calendar_action($1,$2,$3) as id",[problem,request,JSON.stringify({ ...payload,summary:"Cancel me" })])).rows[0].id;
  expect((await db.query("select public.cancel_external_action($1) as done",[action])).rows).toEqual([{ done:true }]);
  expect((await db.query("select public.cancel_external_action($1) as done",[action])).rows).toEqual([{ done:false }]);
});
