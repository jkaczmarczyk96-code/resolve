"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/demo/primitives";
import { profileSchema, passwordChangeSchema } from "@/lib/account/contracts";
import { post } from "./remote";
import { GoogleIntegrationSettings, type GoogleConnection } from "./google-integration-settings";
type Profile = { display_name: string | null; avatar_url: string | null; timezone: string; preferred_language: string };
export function AccountSettings({ profile, email, providers, googleEnabled, googleConnection, integrationNotice }: { profile: Profile; email: string; providers: string[]; googleEnabled: boolean; googleConnection: GoogleConnection; integrationNotice?: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ display_name: profile.display_name ?? "", avatar_url: profile.avatar_url ?? "", timezone: profile.timezone, preferred_language: profile.preferred_language });
  const [passwords, setPasswords] = useState({ currentPassword: "", password: "", confirmPassword: "" });
  const [confirmation, setConfirmation] = useState(""); const [deletePassword, setDeletePassword] = useState("");
  const [pending, setPending] = useState(""); const [message, setMessage] = useState<{ section: string; text: string; error?: boolean } | null>(null);
  async function save(section: string, url: string, value: unknown, success: string) {
    if (pending) return false; setPending(section); setMessage(null);
    try { await post(url, value); setMessage({ section, text: success }); return true; }
    catch (error) { setMessage({ section, text: error instanceof Error ? error.message : "Unable to save.", error: true }); return false; }
    finally { setPending(""); }
  }
  const feedback = (section: string) => message?.section === section && <p role={message.error ? "alert" : "status"} className="mt-3 text-sm">{message.text}</p>;
  return <div className="max-w-3xl space-y-6"><h1 className="text-3xl font-semibold">Account settings</h1>
    <Panel title="Profile" description={`Signed in as ${email}`}><form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault(); const parsed = profileSchema.safeParse(values);
      if (!parsed.success) { setMessage({ section: "profile", text: "Check your name, HTTPS avatar URL, language and timezone.", error: true }); return; }
      if (await save("profile", "/api/account/profile", parsed.data, "Profile saved.")) router.refresh();
    }}><label className="block space-y-2 text-sm">Display name<Input maxLength={100} value={values.display_name} onChange={(event) => setValues({ ...values, display_name: event.target.value })} /></label>
      <label className="block space-y-2 text-sm">Avatar image URL<Input type="url" maxLength={2000} placeholder="https://…" value={values.avatar_url} onChange={(event) => setValues({ ...values, avatar_url: event.target.value })} /></label><p className="text-xs text-muted-foreground">Optional HTTPS image address. Your browser loads the image from that host.</p>
      {profile.avatar_url?.startsWith("https://") && <div role="img" aria-label="Your saved avatar" className="size-16 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(profile.avatar_url)})` }} />}
      <label className="block space-y-2 text-sm">Timezone<Input required maxLength={100} value={values.timezone} onChange={(event) => setValues({ ...values, timezone: event.target.value })} /></label>
      <label className="block space-y-2 text-sm">Preferred language<select className="block h-11 w-full rounded-md border bg-background px-3" value={values.preferred_language} onChange={(event) => setValues({ ...values, preferred_language: event.target.value })}><option value="en">English</option><option value="cs">Čeština</option><option value="de">Deutsch</option></select></label><p className="text-xs text-muted-foreground">Language preference is saved; the current interface remains in English.</p>
      <Button disabled={Boolean(pending)}>Save profile</Button>{feedback("profile")}</form></Panel>
    <Panel title="Sign-in methods"><p className="text-sm">{providers.join(", ") || "Email"}</p><Link href="/notifications" className="mt-3 inline-block text-sm text-primary underline">Notification preferences</Link></Panel>
    <GoogleIntegrationSettings enabled={googleEnabled} connection={googleConnection} notice={integrationNotice} />
    <Panel title="Change password" description="Confirm your current password before setting a new one."><form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault(); const parsed = passwordChangeSchema.safeParse(passwords);
      if (!parsed.success) { setMessage({ section: "password", text: "Use matching passwords with at least 12 characters, uppercase, lowercase and a number.", error: true }); return; }
      if (await save("password", "/api/account/password", parsed.data, "Password changed.")) setPasswords({ currentPassword: "", password: "", confirmPassword: "" });
    }}>{([{ key: "currentPassword", label: "Current password" }, { key: "password", label: "New password" }, { key: "confirmPassword", label: "Confirm new password" }] as const).map(({ key, label }) => <label key={key} className="block space-y-2 text-sm">{label}<Input type="password" required maxLength={128} autoComplete={key === "currentPassword" ? "current-password" : "new-password"} value={passwords[key]} onChange={(event) => setPasswords({ ...passwords, [key]: event.target.value })} /></label>)}<Button disabled={Boolean(pending)}>Change password</Button>{feedback("password")}</form><Link className="mt-4 inline-block text-sm text-primary underline" href="/forgot-password">Forgot your password or need to set your first password?</Link></Panel>
    <Panel title="Export your data" description="Download your profile, saved problems, analyses, evidence, monitoring and notifications as JSON."><Button disabled={Boolean(pending)} onClick={async () => {
      setPending("export"); setMessage(null);
      try { const response = await fetch("/api/account/export", { cache: "no-store", signal: AbortSignal.timeout(60_000) }); if (!response.ok) throw new Error("Unable to export your data. Try again later."); const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "avenli-account-export.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage({ section: "export", text: "Export downloaded." }); }
      catch (error) { setMessage({ section: "export", text: error instanceof Error ? error.message : "Export failed.", error: true }); }
      finally { setPending(""); }
    }}>Download account data</Button>{feedback("export")}</Panel>
    <Panel title="Delete account" description="Permanently delete your Avenli account, problems, analyses and notifications. This cannot be undone."><form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault(); if (confirmation !== "DELETE") return;
      if (await save("delete", "/api/account/delete", { confirmation, currentPassword: deletePassword }, "Account deleted.")) { router.replace("/login"); router.refresh(); }
    }}><label className="block space-y-2 text-sm">Current password for deletion<Input type="password" autoComplete="current-password" maxLength={128} value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></label><p className="text-xs text-muted-foreground">Alternatively, sign in again with Google and delete within five minutes.</p><label className="block space-y-2 text-sm">Type DELETE to confirm<Input required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><Button variant="destructive" disabled={Boolean(pending) || confirmation !== "DELETE"}>Permanently delete my account</Button>{feedback("delete")}</form></Panel>
  </div>;
}
