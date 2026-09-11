"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createEphemeralClient } from "@/lib/supabase/ephemeral";
import { getSiteOrigin } from "@/lib/config/server-env";
import { clearRecoveryToken, getRecoveryToken } from "./recovery";
import { safeReturnTo } from "./routes";
import { emailSchema, loginSchema, registrationSchema, resetPasswordSchema, type AuthFormState } from "./schemas";

const unavailable: AuthFormState = { status: "error", message: "The account service is unavailable. Please try again shortly." };
const inbox: AuthFormState = { status: "success", message: "If this address can receive a recovery email, a link is on its way. Check your inbox and spam folder." };

function invalid(error: z.ZodError): AuthFormState {
  return { status: "error", message: "Please check the highlighted fields.", fieldErrors: z.flattenError(error).fieldErrors };
}

export async function loginAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const result = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!result.success) return invalid(result.error);
  try {
    const supabase = await createClient({ writable: true });
    const { error } = await supabase.auth.signInWithPassword(result.data);
    if (error) return { status: "error", message: error.code === "email_not_confirmed" ? "Please confirm your email before signing in. Check your inbox and spam folder." : "Unable to sign in. Check your email and password, or try again later." };
    await clearRecoveryToken();
  } catch { return unavailable; }
  redirect(safeReturnTo(form.get("next")));
}

export async function registerAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const result = registrationSchema.safeParse({ email: form.get("email"), password: form.get("password"), confirmPassword: form.get("confirmPassword"), displayName: form.get("displayName") ?? "" });
  if (!result.success) return invalid(result.error);
  const confirmation: AuthFormState = { status: "success", message: "Check your email for a confirmation link. If you already have an account, sign in or request a password reset." };
  let signedIn = false;
  try {
    const supabase = await createClient({ writable: true });
    const { data, error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        data: { display_name: result.data.displayName },
        emailRedirectTo: `${getSiteOrigin()}/auth/callback?next=/dashboard`,
      },
    });
    if (error) {
      if (["user_already_exists", "email_exists"].includes(error.code ?? "")) return confirmation;
      return { status: "error", message: "We could not create your account. Please try again later or use another password." };
    }
    signedIn = Boolean(data.session);
    if (signedIn) await clearRecoveryToken();
  } catch { return unavailable; }
  if (signedIn) redirect("/dashboard");
  return confirmation;
}

export async function forgotPasswordAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const result = z.object({ email: emailSchema }).safeParse({ email: form.get("email") });
  if (!result.success) return invalid(result.error);
  try {
    const supabase = createEphemeralClient();
    // Deliberately return identical content for unknown accounts, throttling and provider failures.
    await supabase.auth.resetPasswordForEmail(result.data.email, { redirectTo: `${getSiteOrigin()}/auth/callback?next=/reset-password` });
  } catch { /* Do not expose whether an email/account exists. */ }
  return inbox;
}

export async function resetPasswordAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const result = resetPasswordSchema.safeParse({ password: form.get("password"), confirmPassword: form.get("confirmPassword") });
  if (!result.success) return invalid(result.error);
  const token = await getRecoveryToken();
  const expired: AuthFormState = { status: "error", message: "This recovery link is invalid, expired, or already used. Request a new link and try again." };
  if (!token) return expired;
  let destination = "/reset-password?error=invalid-link";
  let passwordChanged = false;
  try {
    const supabase = createEphemeralClient();
    // A browser session alone cannot authorize a password reset. This single-use proof must verify.
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: "recovery" });
    await clearRecoveryToken();
    if (!error && data.session && data.user) {
      const update = await supabase.auth.updateUser({ password: result.data.password });
      passwordChanged = !update.error;
      // Recovery sessions are never persisted in browser cookies. Revoke refresh sessions afterward.
      const signedOut = await supabase.auth.signOut({ scope: "global" });
      if (!passwordChanged) {
        destination = "/reset-password?error=update-failed";
      } else {
        const browser = await createClient({ writable: true });
        const browserLogout = await browser.auth.signOut({ scope: "local" });
        destination = signedOut.error || browserLogout.error ? "/login?message=password-updated-sessions" : "/login?message=password-updated";
      }
    }
  } catch {
    await clearRecoveryToken();
    destination = passwordChanged ? "/login?message=password-updated-sessions" : "/reset-password?error=reset-incomplete";
  }
  // Cookie deletion re-renders Server Components; carry errors in a safe, fixed code across that render.
  redirect(destination);
}

export async function logoutAction(): Promise<AuthFormState> {
  try {
    const supabase = await createClient({ writable: true });
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { status: "error", message: "Sign out failed. Please try again." };
    await clearRecoveryToken();
  } catch { return unavailable; }
  redirect("/login?message=signed-out");
}
