import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { AuthHeading } from "@/components/auth/auth-heading";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return <div className="space-y-7"><AuthHeading kind="register" /><OAuthButtons /><AuthForm mode="register" /></div>;
}
