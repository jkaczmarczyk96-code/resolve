import { beforeEach,expect,it,vi } from "vitest";
const mock=vi.hoisted(()=>({ create:vi.fn(),rpc:vi.fn() }));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/integrations/google",()=>({ createCalendarEvent:mock.create }));
vi.mock("@/lib/supabase/service-rpc",()=>({ serviceRpc:mock.rpc }));
import { executeClaimedAction } from "@/lib/actions/execution";

const action={ id:"de305d54-75b4-431b-adb2-eb6b9e546015",problemId:"de305d54-75b4-431b-adb2-eb6b9e546014",actionType:"calendar_create_event",status:"executing",payload:{ summary:"Review",description:"",location:"",start:new Date(Date.now()+3_600_000).toISOString(),end:new Date(Date.now()+7_200_000).toISOString() },result:null,alreadyCompleted:false };
beforeEach(()=>{ vi.resetAllMocks(); });

it("finishes an approved write with only the bounded provider result",async()=>{
  const result={ eventId:"one",eventUrl:"https://www.google.com/calendar/event?eid=one" };mock.create.mockResolvedValue(result);mock.rpc.mockResolvedValue({ id:action.id,status:"succeeded",result,error:null });
  await expect(executeClaimedAction("owner",action)).resolves.toMatchObject({ status:"succeeded",result });
  expect(mock.rpc).toHaveBeenCalledWith("finish_external_action",expect.objectContaining({ p_success:true,p_result:result }));
});

it("records a sanitized failure without exposing the provider response",async()=>{
  mock.create.mockRejectedValue(new Error("provider secret"));mock.rpc.mockResolvedValue({ id:action.id,status:"failed",result:null,error:"ACTION_PROVIDER_FAILED" });
  await expect(executeClaimedAction("owner",action)).rejects.toMatchObject({ message:"ACTION_PROVIDER_FAILED" });
  expect(mock.rpc).toHaveBeenCalledWith("finish_external_action",expect.objectContaining({ p_success:false,p_error:"ACTION_PROVIDER_FAILED" }));
});
