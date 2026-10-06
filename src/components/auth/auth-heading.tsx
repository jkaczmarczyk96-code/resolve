"use client";
import { usePublicCzech } from "@/components/public-language";

export function AuthHeading({ kind }: { kind: "login" | "register" | "forgot" | "reset" }) {
  const cs = usePublicCzech();
  const labels = {
    login: ["Welcome back", "Sign in to your Avenli account.", "Vítejte zpět", "Přihlaste se ke svému účtu Avenli."],
    register: ["Your next step starts here", "Create your Avenli account.", "Váš další krok začíná zde", "Vytvořte si účet Avenli."],
    forgot: ["Reset your password", "We'll send you a recovery link.", "Obnovit heslo", "Pošleme vám odkaz pro obnovení."],
    reset: ["Choose a new password", "Set a secure password for your account.", "Zvolte nové heslo", "Nastavte si bezpečné heslo ke svému účtu."],
  }[kind];
  return <div className="space-y-2"><h1 className="text-3xl font-semibold tracking-tight">{labels[cs ? 2 : 0]}</h1><p className="text-muted-foreground">{labels[cs ? 3 : 1]}</p></div>;
}
