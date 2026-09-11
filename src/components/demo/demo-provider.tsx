"use client";

import { createContext, useContext, useState } from "react";
import { demoProblems } from "@/lib/demo/data";
import { createDemoDraft } from "@/lib/demo/draft";
import type { DemoPreferences, DemoProblem } from "@/lib/demo/types";

export type AccountProfile = { id: string; email: string; displayName: string | null; timezone: string; language: string };
type DemoContextValue = {
  problems: DemoProblem[]; account: AccountProfile; preferences: DemoPreferences;
  addDraft: (input: string) => string;
  toggleTask: (problemId: string, taskId: string) => void;
  savePreferences: (values: DemoPreferences) => void;
  reset: () => void;
};
const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ account, children }: { account: AccountProfile; children: React.ReactNode }) {
  const [problems, setProblems] = useState(demoProblems);
  const defaults: DemoPreferences = { language: account.language, timezone: account.timezone, inputAlerts: true, researchAlerts: false };
  const [preferences, setPreferences] = useState(defaults);
  function addDraft(input: string) {
    const id = `draft-${crypto.randomUUID()}`;
    const draft = createDemoDraft(id, input);
    setProblems((current) => [draft, ...current]);
    return id;
  }
  function toggleTask(problemId: string, taskId: string) {
    setProblems((current) => current.map((problem) => problem.id === problemId ? { ...problem, tasks: problem.tasks.map((task) => task.id === taskId ? { ...task, done: !task.done } : task) } : problem));
  }
  return <DemoContext.Provider value={{ problems, account, preferences, addDraft, toggleTask, savePreferences: setPreferences, reset: () => { setProblems(demoProblems); setPreferences(defaults); } }}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("DemoProvider is required.");
  return context;
}
