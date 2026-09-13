import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { safeReturnTo } from "@/lib/auth/routes";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export const metadata: Metadata = { title: "Sign in" };
const notices: Record<string, string> = {
  "oauth-unavailable": "This sign-in provider is not available. Use email and password or try again later.",
  "oauth-failed": "Provider sign-in was cancelled or expired. Start again from this page.",
  "password-updated": "Your password has been changed. Sign in with your new password.",
  "password-updated-sessions": "Your password has been changed. Sign in with your new password. We could not end all other sessions; sign out on your other devices.",
  "signed-out": "You have been signed out.",
  "invalid-link": "This email link is invalid, expired, or already used. Sign in or request a new password recovery link.",
  configuration: "Account setup is not complete on this installation. Please try again once Supabase is configured.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; message?: string }> }) {
  const params = await searchParams;
  const noticeKey = params.error ?? params.message;
  const notice = typeof noticeKey === "string" && Object.hasOwn(notices, noticeKey) ? notices[noticeKey] : undefined;
  return <div className="space-y-7"><div className="space-y-2"><h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1><p className="text-muted-foreground">Sign in to your Avenli account.</p></div>{notice && <p role="status" className="rounded-lg bg-secondary p-4 text-sm leading-relaxed">{notice}</p>}<OAuthButtons next={safeReturnTo(params.next)} /><AuthForm mode="login" next={safeReturnTo(params.next)} /></div>;
}
