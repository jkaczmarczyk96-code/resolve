"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageSwitch } from "@/components/language-switch";
import { useDemo } from "@/components/demo/demo-provider";
import { patch } from "./remote";

export function WorkspaceLanguageSwitch() {
  const router = useRouter();
  const { preferences, savePreferences } = useDemo();
  const language = preferences.language === "cs" ? "cs" : "en";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function changeLanguage(next: "en" | "cs") {
    if (pending || next === language) return;
    setPending(true);
    setError("");
    try {
      await patch("/api/account/profile", { preferred_language: next });
      savePreferences({ ...preferences, language: next });
      router.refresh();
    } catch {
      setError(language === "cs" ? "Jazyk se nepodařilo uložit. Zkuste to znovu." : "Could not save the language. Please try again.");
    } finally { setPending(false); }
  }

  return <div className="flex flex-col items-end gap-1"><LanguageSwitch language={language} onChange={changeLanguage} disabled={pending} />{error && <p role="alert" className="max-w-48 text-right text-xs text-destructive">{error}</p>}</div>;
}
