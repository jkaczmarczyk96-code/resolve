import { z } from "zod";

export const calendarActionPayloadSchema = z.strictObject({
  summary:z.string().trim().min(1).max(200),
  description:z.string().trim().max(2000),
  location:z.string().trim().max(500),
  start:z.iso.datetime({ offset:true }),
  end:z.iso.datetime({ offset:true }),
}).superRefine((value,context)=>{
  const start=Date.parse(value.start); const end=Date.parse(value.end);
  if (end<=start || end>start+7*86_400_000) context.addIssue({ code:"custom",path:["end"],message:"End must be after start and within seven days." });
});

export const actionProposalSchema=z.strictObject({ requestId:z.uuid(),payload:calendarActionPayloadSchema });
export const actionApprovalSchema=z.strictObject({ confirmation:z.literal("CREATE") });
export const externalActionStatusSchema=z.enum(["proposed","executing","succeeded","failed","cancelled"]);
export const calendarActionResultSchema=z.strictObject({ eventId:z.string(),eventUrl:z.url().refine((value)=>value.startsWith("https://www.google.com/calendar/")) });
export const externalActionSchema=z.object({
  id:z.uuid(),problemId:z.uuid(),actionType:z.literal("calendar_create_event"),status:externalActionStatusSchema,
  payload:calendarActionPayloadSchema,result:calendarActionResultSchema.nullable(),error:z.string().nullable(),attemptCount:z.number().int().min(0).max(5),
  requestedAt:z.iso.datetime({ offset:true }),approvedAt:z.iso.datetime({ offset:true }).nullable(),executedAt:z.iso.datetime({ offset:true }).nullable(),
});
export const actionAccessSchema=z.object({ calendarEnabled:z.boolean(),calendarWriteAuthorized:z.boolean() });
export const claimedActionSchema=z.object({
  id:z.uuid(),problemId:z.uuid(),actionType:z.literal("calendar_create_event"),status:externalActionStatusSchema,
  payload:calendarActionPayloadSchema,result:calendarActionResultSchema.nullable(),alreadyCompleted:z.boolean(),
});
export const actionExecutionResultSchema=z.object({ id:z.uuid(),status:z.enum(["succeeded","failed"]),result:calendarActionResultSchema.nullable(),error:z.string().nullable() });
export type ExternalAction=z.infer<typeof externalActionSchema>;
export type ActionAccess=z.infer<typeof actionAccessSchema>;
