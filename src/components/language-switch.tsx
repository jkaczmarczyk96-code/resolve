"use client";

import { Globe2 } from "lucide-react";

export function LanguageSwitch({ language, onChange, disabled = false }: {
  language: "en" | "cs";
  onChange: (language: "en" | "cs") => void;
  disabled?: boolean;
}) {
  return <div role="group" aria-label={language === "cs" ? "Jazyk stránky" : "Page language"} className="flex items-center gap-1 rounded-full border border-[#d9dcf7] bg-[#f3f3ff] p-1 shadow-sm">
    <Globe2 className="ml-2 hidden size-4 text-[#4442b8] sm:block" aria-hidden="true" />
    {(["en", "cs"] as const).map((option) => <button key={option} type="button" onClick={() => onChange(option)} disabled={disabled} aria-pressed={language === option} className={`min-w-10 rounded-full px-2.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4b45e9] disabled:cursor-wait ${language === option ? "bg-[#443de0] text-white shadow-sm" : "text-[#4c5185] hover:bg-white"}`}>{option === "cs" ? "CZ" : "EN"}</button>)}
  </div>;
}
