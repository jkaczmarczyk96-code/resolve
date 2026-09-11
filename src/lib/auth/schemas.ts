import { z } from "zod";

export const emailSchema = z.string().trim().pipe(z.email("Enter a valid email address.").max(254)).transform((value) => value.toLowerCase());
export const passwordSchema = z.string().min(12, "Use at least 12 characters.").max(128, "Use no more than 128 characters.").regex(/[a-z]/, "Include a lowercase letter.").regex(/[A-Z]/, "Include an uppercase letter.").regex(/[0-9]/, "Include a number.");
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.").max(128) });
export const registrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  displayName: z.string().trim().max(100, "Use no more than 100 characters."),
}).refine((value) => value.password === value.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });
export const resetPasswordSchema = z.object({ password: passwordSchema, confirmPassword: z.string() }).refine((value) => value.password === value.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });
// Supabase SSR signups use PKCE-prefixed hashes; recovery hashes may be plain hex.
export const recoveryTokenSchema = z.string().regex(/^(?:pkce_)?[a-f0-9]{40,128}$/i);

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialAuthState: AuthFormState = { status: "idle" };
