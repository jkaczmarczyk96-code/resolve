import { z } from "zod";
import { fullSnapshotSchema } from "@/lib/orchestration/full-state";
import { intakeInput } from "@/lib/ai/schemas";

export const submissionSchema = z.strictObject({ requestId: z.uuid(), description: intakeInput.shape.description });
export const retrySchema = z.strictObject({ requestId: z.uuid() });
export const webJobSchema = z.object({ id: z.uuid(), problemId: z.uuid().nullable(), status: z.enum(["queued", "running", "action_required", "completed", "failed"]), error: z.string().nullable(), expiresAt: z.iso.datetime({ offset: true }) });
export type WebJob = z.infer<typeof webJobSchema>;
export const problemSummarySchema = z.object({ id: z.uuid(), title: z.string(), original_input: z.string(), created_at: z.string() });
export const responseSchema = z.strictObject({ requestId: z.uuid(), runId: z.uuid(), answers: z.array(z.string().trim().min(1).max(1200)).min(1).max(8) });
export const humanRequestSchema = z.object({ runId: z.uuid(), questions: z.array(z.string()).min(1).max(8), answers: z.array(z.string()).nullable(), answeredAt: z.string().nullable() });
export const monitoringResultSchema = z.object({ outcome: z.enum(["met", "not_met", "uncertain"]), summary: z.string(), evidenceSourceIds: z.array(z.string()), evidence: z.array(z.object({ id: z.string(), url: z.url(), title: z.string(), publishedAt: z.string().nullable() })) });
export const monitoringConditionSchema = z.object({ id: z.uuid(), problemId: z.uuid(), description: z.string(), searchQuery: z.string(), status: z.enum(["active", "checking", "met", "paused", "failed"]), lastResult: monitoringResultSchema.nullable(), lastError: z.string().nullable(), lastCheckedAt: z.string().nullable(), nextCheckAt: z.string() });
export const monitoringCreateSchema = z.strictObject({ description: z.string().trim().min(10).max(1000), searchQuery: z.string().trim().min(10).max(500) });
export const monitoringUpdateSchema = z.strictObject({ conditionId: z.uuid(), status: z.enum(["active", "paused"]) });
export const detailSchema = z.object({ problem: problemSummarySchema, job: webJobSchema.nullable(), snapshot: fullSnapshotSchema.nullable(), humanRequest: humanRequestSchema.nullable(), conditions: z.array(monitoringConditionSchema).default([]) });
export type ProblemDetail = z.infer<typeof detailSchema>;
export const listSchema = z.array(z.object({ problem: problemSummarySchema, job: webJobSchema.nullable() }));
export type ProblemList = z.infer<typeof listSchema>;
export function jobActive(job: WebJob | null) { return Boolean(job && ["queued", "running"].includes(job.status) && Date.parse(job.expiresAt) > Date.now()); }
export function jobLabel(job: WebJob | null) {
  if (!job) return "Not started";
  if (["queued", "running"].includes(job.status) && !jobActive(job)) return "Interrupted";
  return { queued: "Queued", running: "Analyzing", action_required: "Needs your input", completed: "Ready to review", failed: "Needs retry" }[job.status];
}
