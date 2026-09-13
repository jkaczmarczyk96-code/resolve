import { z } from "zod";
export const preferencesSchema = z.strictObject({ analysis_updates: z.boolean(), action_required: z.boolean(), monitoring_updates: z.boolean() });
export const defaultPreferences = { analysis_updates: true, action_required: true, monitoring_updates: true };
export const notificationSchema = z.object({ id: z.uuid(), problem_id: z.uuid(), kind: z.enum(["analysis_completed", "analysis_failed", "input_required", "condition_met", "monitor_failed"]), created_at: z.string(), read_at: z.string().nullable() });
export const inboxSchema = z.object({ items: z.array(notificationSchema), preferences: preferencesSchema });
export const readSchema = z.strictObject({ id: z.uuid() });
export const notificationLabels = {
  analysis_completed: "Your analysis is ready to review",
  analysis_failed: "Your analysis needs a retry",
  input_required: "Avenli needs your answers",
  condition_met: "A monitored condition was met",
  monitor_failed: "A monitoring check needs attention",
};
