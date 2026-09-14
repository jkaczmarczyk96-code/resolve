import { beforeEach,expect,it,vi } from "vitest";

const mock=vi.hoisted(()=>({ identity:vi.fn(),body:vi.fn(),rpc:vi.fn(),execute:vi.fn() }));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/workspace/http",()=>({
  identity:mock.identity,body:mock.body,json:(value:unknown,status=200)=>Response.json(value,{ status }),
  WorkspaceError:class extends Error { constructor(public code:string,public status=400){ super(code); } },
  failure:(error:{ code?:string;status?:number })=>Response.json({ error:error.code??"SERVICE_UNAVAILABLE" },{ status:error.status??503 }),
}));
vi.mock("@/lib/actions/execution",()=>({ executeClaimedAction:mock.execute }));
import { POST as propose } from "@/app/api/problems/[id]/actions/route";
import { POST as approve } from "@/app/api/actions/[id]/approve/route";
import { POST as cancel } from "@/app/api/actions/[id]/cancel/route";

const problem="de305d54-75b4-431b-adb2-eb6b9e546014"; const action="de305d54-75b4-431b-adb2-eb6b9e546015";
function request(){ return new Request("https://avenli.example/api",{ method:"POST" }); }
beforeEach(()=>{ vi.resetAllMocks();mock.identity.mockResolvedValue({ user:{ id:"owner" },client:{ rpc:mock.rpc } });mock.execute.mockResolvedValue({ id:action,status:"succeeded",result:{ eventId:"one",eventUrl:"https://www.google.com/calendar/event?eid=one" },error:null }); });

it("saves a validated proposal with an idempotency key",async()=>{
  mock.body.mockResolvedValue({ requestId:"de305d54-75b4-431b-adb2-eb6b9e546016",payload:{ summary:"Review",description:"",location:"",start:new Date(Date.now()+3_600_000).toISOString(),end:new Date(Date.now()+7_200_000).toISOString() } });
  mock.rpc.mockReturnValue({ abortSignal:vi.fn().mockResolvedValue({ data:action,error:null }) });
  const response=await propose(request(),{ params:Promise.resolve({ id:problem }) });
  expect(response.status).toBe(201); expect(mock.rpc).toHaveBeenCalledWith("propose_calendar_action",expect.objectContaining({ p_problem_id:problem }));
});

it("requires the exact approval phrase before claiming and executing",async()=>{
  mock.body.mockResolvedValue({ confirmation:"NO" });
  expect((await approve(request(),{ params:Promise.resolve({ id:action }) })).status).toBe(400); expect(mock.rpc).not.toHaveBeenCalled();
  mock.body.mockResolvedValue({ confirmation:"CREATE" });
  mock.rpc.mockReturnValue({ abortSignal:vi.fn().mockResolvedValue({ data:{ id:action,problemId:problem,actionType:"calendar_create_event",status:"executing",payload:{ summary:"Review",description:"",location:"",start:new Date(Date.now()+3_600_000).toISOString(),end:new Date(Date.now()+7_200_000).toISOString() },result:null,alreadyCompleted:false },error:null }) });
  const response=await approve(request(),{ params:Promise.resolve({ id:action }) });
  expect(response.status).toBe(200); expect(mock.execute).toHaveBeenCalledWith("owner",expect.objectContaining({ id:action }));
});

it("cancels only through the owner-scoped database function",async()=>{
  mock.body.mockResolvedValue({});mock.rpc.mockReturnValue({ abortSignal:vi.fn().mockResolvedValue({ data:true,error:null }) });
  expect((await cancel(request(),{ params:Promise.resolve({ id:action }) })).status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith("cancel_external_action",{ p_action_id:action });
});
