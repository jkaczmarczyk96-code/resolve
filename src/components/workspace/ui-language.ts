"use client";

import { useDemo } from "@/components/demo/demo-provider";

export function useCzech() {
  const { preferences } = useDemo();
  return preferences.language === "cs";
}

export function ui(cs: boolean, english: string, czech: string) {
  return cs ? czech : english;
}

const statusLabels: Record<string, string> = {
  "Not started": "Nezahájeno", Queued: "Ve frontě", Analyzing: "Probíhá analýza",
  "Needs your input": "Čeká na odpověď", "Ready to review": "K posouzení",
  "Needs retry": "Zkusit znovu", Interrupted: "Přerušeno", Solved: "Vyřešeno",
};
export function uiStatus(cs: boolean, status: string) { return cs ? statusLabels[status] ?? status : status; }
