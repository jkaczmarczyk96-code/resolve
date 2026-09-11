import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Recover password" };

export default function ForgotPasswordPage() {
  return <div className="space-y-7"><div className="space-y-2"><h1 className="text-3xl font-semibold tracking-tight">Forgot your password?</h1><p className="leading-relaxed text-muted-foreground">Enter your email and we’ll send you a link to choose a new password.</p></div><AuthForm mode="forgot-password" /></div>;
}
