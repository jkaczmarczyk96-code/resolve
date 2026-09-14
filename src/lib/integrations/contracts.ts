import { z } from "zod";

export const gmailSearchSchema = z.object({ query: z.string().trim().min(2).max(200).regex(/^[^\u0000-\u001f\u007f]+$/) }).strict();
export const calendarWindowSchema = z.object({ days: z.coerce.number().int().min(1).max(30).default(7) }).strict();
export const googleServiceSchema = z.enum(["calendar", "gmail"]);
export const googleServicesSchema = z.array(googleServiceSchema).min(1).max(2).refine((value) => new Set(value).size === value.length);
export const googleServiceSettingSchema = z.object({ service: googleServiceSchema, enabled: z.boolean() }).strict();
export type GoogleService = z.infer<typeof googleServiceSchema>;

export const integrationCredentialSchema = z.object({
  integrationId: z.uuid(),
  accessTokenCiphertext: z.string().min(32).max(16384),
  refreshTokenCiphertext: z.string().min(32).max(16384),
  expiresAt: z.iso.datetime({ offset: true }),
  enabledServices: z.array(googleServiceSchema).max(2),
}).strict();

export type CalendarItem = { id: string; title: string; start: string; end: string; allDay: boolean; location: string | null };
export type GmailItem = { id: string; subject: string; from: string; date: string; snippet: string };
