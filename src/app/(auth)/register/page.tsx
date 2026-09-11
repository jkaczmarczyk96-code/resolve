import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return <div className="space-y-7"><div className="space-y-2"><h1 className="text-3xl font-semibold tracking-tight">Your next step starts here</h1><p className="text-muted-foreground">Create your Resolve account.</p></div><AuthForm mode="register" /></div>;
}
