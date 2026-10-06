"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeading, Panel } from "@/components/demo/primitives";
import { profileSchema, passwordChangeSchema } from "@/lib/account/contracts";
import { post } from "./remote";
import { GoogleIntegrationSettings, type GoogleConnection } from "./google-integration-settings";
import { ui, useCzech } from "./ui-language";
type Profile = { display_name: string | null; avatar_url: string | null; timezone: string; preferred_language: string; product_analytics_enabled: boolean };
export function AccountSettings({ profile, email, providers, googleEnabled, googleConnection, integrationNotice }: { profile: Profile; email: string; providers: string[]; googleEnabled: boolean; googleConnection: GoogleConnection; integrationNotice?: string }) {
  const router = useRouter();
  const cs = useCzech();
  const [values, setValues] = useState({ display_name: profile.display_name ?? "", avatar_url: profile.avatar_url ?? "", timezone: profile.timezone, preferred_language: profile.preferred_language });
  const [passwords, setPasswords] = useState({ currentPassword: "", password: "", confirmPassword: "" });
  const [confirmation, setConfirmation] = useState(""); const [deletePassword, setDeletePassword] = useState("");
  const [analyticsEnabled, setAnalyticsEnabled] = useState(profile.product_analytics_enabled);
  const [pending, setPending] = useState(""); const [message, setMessage] = useState<{ section: string; text: string; error?: boolean } | null>(null);
  async function save(section: string, url: string, value: unknown, success: string) {
    if (pending) return false; setPending(section); setMessage(null);
    try { await post(url, value); setMessage({ section, text: success }); return true; }
    catch (error) { setMessage({ section, text: error instanceof Error ? error.message : "Unable to save.", error: true }); return false; }
    finally { setPending(""); }
  }
  const feedback = (section: string) => message?.section === section && <p role={message.error ? "alert" : "status"} className="mt-3 text-sm">{message.text}</p>;
  return <div className="max-w-5xl space-y-6"><PageHeading eyebrow={ui(cs,"Settings","Nastavení")} title={ui(cs,"Account settings","Nastavení účtu")} description={ui(cs,"Manage your profile, optional services, privacy and account security.","Spravujte profil, volitelné služby, soukromí a zabezpečení účtu.")} />
    <Panel title={ui(cs,"Profile","Profil")} description={ui(cs,`Signed in as ${email}`,`Přihlášeni jako ${email}`)}><form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault(); const parsed = profileSchema.safeParse(values);
      if (!parsed.success) { setMessage({ section: "profile", text: ui(cs,"Check your name, HTTPS avatar URL, language and timezone.","Zkontrolujte jméno, HTTPS adresu avatara, jazyk a časové pásmo."), error: true }); return; }
      if (await save("profile", "/api/account/profile", parsed.data, ui(cs,"Profile saved.","Profil byl uložen."))) router.refresh();
    }}><label className="block space-y-2 text-sm">{ui(cs,"Display name","Zobrazované jméno")}<Input maxLength={100} value={values.display_name} onChange={(event) => setValues({ ...values, display_name: event.target.value })} /></label>
      <label className="block space-y-2 text-sm">{ui(cs,"Avatar image URL","Adresa obrázku profilu")}<Input type="url" maxLength={2000} placeholder="https://…" value={values.avatar_url} onChange={(event) => setValues({ ...values, avatar_url: event.target.value })} /></label><p className="text-xs text-muted-foreground">{ui(cs,"Optional HTTPS image address. Your browser loads the image from that host.","Volitelná HTTPS adresa obrázku. Prohlížeč jej načte přímo z uvedeného webu.")}</p>
      {profile.avatar_url?.startsWith("https://") && <div role="img" aria-label={ui(cs,"Your saved avatar","Uložený profilový obrázek")} className="size-16 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(profile.avatar_url)})` }} />}
      <label className="block space-y-2 text-sm">{ui(cs,"Timezone","Časové pásmo")}<Input required maxLength={100} value={values.timezone} onChange={(event) => setValues({ ...values, timezone: event.target.value })} /></label>
      <label className="block space-y-2 text-sm">{ui(cs,"Preferred language","Preferovaný jazyk")}<select className="block h-11 w-full rounded-md border bg-background px-3" value={values.preferred_language} onChange={(event) => setValues({ ...values, preferred_language: event.target.value })}><option value="en">English</option><option value="cs">Čeština</option><option value="de">Deutsch</option></select></label><p className="text-xs text-muted-foreground">{ui(cs,"Czech is available in the main problem-solving flow. Some advanced settings and older saved AI results may remain in English.","Čeština je dostupná v hlavním postupu řešení. Některá pokročilá nastavení a dříve uložené výsledky AI mohou zůstat anglicky.")}</p>
      <Button disabled={Boolean(pending)}>{ui(cs,"Save profile","Uložit profil")}</Button>{feedback("profile")}</form></Panel>
    <Panel title={ui(cs,"Sign-in methods","Způsoby přihlášení")}><p className="text-sm">{providers.join(", ") || "Email"}</p><Link href="/notifications" className="mt-3 inline-block text-sm text-primary underline">{ui(cs,"Notification preferences","Nastavení upozornění")}</Link></Panel>
    <GoogleIntegrationSettings enabled={googleEnabled} connection={googleConnection} notice={integrationNotice} />
    <Panel title={ui(cs,"Product analytics","Analytika produktu")} description={ui(cs,"Help improve Avenli with small first-party usage events such as opening a page or finishing onboarding.","Pomozte zlepšovat Avenli anonymními událostmi, například otevřením stránky.")}><div className="flex flex-wrap items-center justify-between gap-4"><div className="max-w-xl"><p className="text-sm">{ui(cs,"No problem text, search queries, email content, Google data, auth URLs, or third-party tracking scripts are collected.","Neukládáme text zadání, vyhledávací dotazy, obsah e-mailů, data Google ani přihlašovací adresy. Nepoužíváme externí sledovací skripty.")}</p><p className="mt-2 text-xs text-muted-foreground">{ui(cs,"Events stay in Avenli's Supabase database, are included in your export, and are deleted with your account.","Události zůstávají v databázi Avenli, jsou součástí exportu a smažou se s účtem.")}</p></div><Button variant="outline" disabled={Boolean(pending)} onClick={async () => { const next = !analyticsEnabled; if (await save("analytics", "/api/account/analytics", { enabled: next }, ui(cs,`Product analytics ${next ? "enabled" : "disabled"}.`,`Analytika byla ${next ? "zapnuta" : "vypnuta"}.`))) setAnalyticsEnabled(next); }}>{analyticsEnabled ? ui(cs,"Disable analytics","Vypnout analytiku") : ui(cs,"Enable analytics","Zapnout analytiku")}</Button></div>{feedback("analytics")}</Panel>
    <Panel title={ui(cs,"Change password","Změna hesla")} description={ui(cs,"Confirm your current password before setting a new one.","Před nastavením nového hesla potvrďte stávající heslo.")}><form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault(); const parsed = passwordChangeSchema.safeParse(passwords);
      if (!parsed.success) { setMessage({ section: "password", text: ui(cs,"Use matching passwords with at least 12 characters, uppercase, lowercase and a number.","Hesla se musí shodovat a mít alespoň 12 znaků, velké i malé písmeno a číslo."), error: true }); return; }
      if (await save("password", "/api/account/password", parsed.data, ui(cs,"Password changed.","Heslo bylo změněno."))) setPasswords({ currentPassword: "", password: "", confirmPassword: "" });
    }}>{([{ key: "currentPassword", label: ui(cs,"Current password","Současné heslo") }, { key: "password", label: ui(cs,"New password","Nové heslo") }, { key: "confirmPassword", label: ui(cs,"Confirm new password","Potvrďte nové heslo") }] as const).map(({ key, label }) => <label key={key} className="block space-y-2 text-sm">{label}<Input type="password" required maxLength={128} autoComplete={key === "currentPassword" ? "current-password" : "new-password"} value={passwords[key]} onChange={(event) => setPasswords({ ...passwords, [key]: event.target.value })} /></label>)}<Button disabled={Boolean(pending)}>{ui(cs,"Change password","Změnit heslo")}</Button>{feedback("password")}</form><Link className="mt-4 inline-block text-sm text-primary underline" href="/forgot-password">{ui(cs,"Forgot your password or need to set your first password?","Zapomněli jste heslo nebo jej potřebujete nastavit?")}</Link></Panel>
    <Panel title={ui(cs,"Export your data","Export dat")} description={ui(cs,"Download your profile, saved problems, analyses, evidence, monitoring and notifications as JSON.","Stáhněte si profil, zadání, analýzy, podklady, sledování a upozornění ve formátu JSON.")}><Button disabled={Boolean(pending)} onClick={async () => {
      setPending("export"); setMessage(null);
      try { const response = await fetch("/api/account/export", { cache: "no-store", signal: AbortSignal.timeout(60_000) }); if (!response.ok) throw new Error(ui(cs,"Unable to export your data. Try again later.","Data se nepodařilo exportovat. Zkuste to později.")); const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "avenli-account-export.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage({ section: "export", text: ui(cs,"Export downloaded.","Export byl stažen.") }); }
      catch (error) { setMessage({ section: "export", text: error instanceof Error ? error.message : ui(cs,"Export failed.","Export selhal."), error: true }); }
      finally { setPending(""); }
    }}>{ui(cs,"Download account data","Stáhnout data účtu")}</Button>{feedback("export")}</Panel>
    <Panel title={ui(cs,"Delete account","Smazat účet")} description={ui(cs,"Permanently delete your Avenli account, problems, analyses and notifications. This cannot be undone.","Trvale smaže účet, zadání, analýzy a upozornění. Tento krok nelze vrátit.")}><form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault(); if (confirmation !== "DELETE") return;
      if (await save("delete", "/api/account/delete", { confirmation, currentPassword: deletePassword }, ui(cs,"Account deleted.","Účet byl smazán."))) { router.replace("/login"); router.refresh(); }
    }}><label className="block space-y-2 text-sm">{ui(cs,"Current password for deletion","Současné heslo pro smazání účtu")}<Input type="password" autoComplete="current-password" maxLength={128} value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></label><p className="text-xs text-muted-foreground">{ui(cs,"Alternatively, sign in again with Google and delete within five minutes.","Případně se znovu přihlaste přes Google a účet smažte do pěti minut.")}</p><label className="block space-y-2 text-sm">{ui(cs,"Type DELETE to confirm","Pro potvrzení napište DELETE")}<Input required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><Button variant="destructive" disabled={Boolean(pending) || confirmation !== "DELETE"}>{ui(cs,"Permanently delete my account","Trvale smazat účet")}</Button>{feedback("delete")}</form></Panel>
  </div>;
}
