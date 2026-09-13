import { z } from "zod";
import { resetPasswordSchema } from "@/lib/auth/schemas";
export const profileSchema = z.strictObject({
  display_name: z.string().trim().max(100),
  avatar_url: z.union([z.literal(""), z.url().max(2000).refine((value) => new URL(value).protocol === "https:", "Use an HTTPS image URL.")]),
  timezone: z.string().max(100).refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }),
  preferred_language: z.enum(["en", "cs", "de"]),
});
export const passwordChangeSchema = resetPasswordSchema.safeExtend({ currentPassword: z.string().min(1).max(128) });
export const deletionSchema = z.strictObject({ confirmation: z.literal("DELETE"), currentPassword: z.string().max(128) });
