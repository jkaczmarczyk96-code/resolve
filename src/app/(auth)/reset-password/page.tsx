import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";
import { getRecoveryToken } from "@/lib/auth/recovery";

export const metadata: Metadata = { title: "Reset password" };

const errors: Record<string, string> = {
  "invalid-link": "This recovery link is invalid, expired, or already used. Request a new link and try again.",
  "update-failed": "Your password could not be changed. Request a new link and choose a different password.",
  "reset-incomplete": "We could not finish the password reset. Request a new link before trying again.",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const token = await getRecoveryToken();
  const { error } = await searchParams;
  const message = typeof error === "string" && Object.hasOwn(errors, error) ? errors[error] : null;
  if (!token) return <div className="space-y-5"><h1 className="text-3xl font-semibold">You need a recovery link</h1>{message ? <p role="alert" className="text-destructive">{message}</p> : <p className="text-muted-foreground">Open the link from your recovery email. If it has expired or was already used, request a new one.</p>}<Button asChild><Link href="/forgot-password">Request recovery link</Link></Button></div>;
  return <div className="space-y-7"><div className="space-y-2"><h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1><p className="text-muted-foreground">Your recovery link will be verified when you save.</p></div><AuthForm mode="reset-password" /></div>;
}
