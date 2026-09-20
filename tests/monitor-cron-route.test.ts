import { beforeEach,expect,it,vi } from "vitest";

const mock=vi.hoisted(()=>({ authorizedCron:vi.fn(),emitDueTaskNotifications:vi.fn(),monitorDueConditions:vi.fn() }));
vi.mock("@/lib/monitoring/execution",()=>mock);
import { GET } from "@/app/api/cron/monitor/route";

beforeEach(()=>vi.resetAllMocks());

it("rejects an unauthorized cron request before doing work",async()=>{
  mock.authorizedCron.mockReturnValue(false);
  const response=await GET(new Request("https://avenli.example/api/cron/monitor"));
  expect(response.status).toBe(401);
  expect(mock.emitDueTaskNotifications).not.toHaveBeenCalled();
});

it("emits task reminders and then checks monitoring conditions",async()=>{
  mock.authorizedCron.mockReturnValue(true);
  mock.emitDueTaskNotifications.mockResolvedValue(3);
  mock.monitorDueConditions.mockResolvedValue({ claimed:2,completed:2 });
  const response=await GET(new Request("https://avenli.example/api/cron/monitor",{ headers:{ authorization:"Bearer valid" } }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ claimed:2,completed:2,taskNotifications:3 });
  expect(mock.emitDueTaskNotifications.mock.invocationCallOrder[0]).toBeLessThan(mock.monitorDueConditions.mock.invocationCallOrder[0]);
});
