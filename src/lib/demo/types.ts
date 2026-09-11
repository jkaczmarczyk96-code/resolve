export type DemoStatus = "Needs your input" | "Ready to review" | "Waiting" | "Draft";
export type DemoTask = { id: string; title: string; detail: string; priority: "High" | "Medium"; done: boolean };
export type DemoProblem = {
  id: string;
  category: "Travel" | "Life" | "Work" | "Personal";
  title: string;
  originalInput: string;
  goal: string;
  status: DemoStatus;
  progress: number;
  priority: string;
  confidence: "Low" | "Not assessed";
  constraints: { label: string; value: string; hard: boolean }[];
  unknowns: { question: string; detail: string }[];
  plan: { title: string; detail: string; status: "done" | "current" | "pending" }[];
  research: { id: string; title: string; claim: string; source: string }[];
  options: { id: string; title: string; description: string; cost: string; timing: string; advantages: string[]; disadvantages: string[]; recommended: boolean }[];
  recommendation: { title: string; summary: string; assumptions: string[] } | null;
  risks: { title: string; severity: "High" | "Medium"; detail: string; mitigation: string }[];
  tasks: DemoTask[];
  decisions: { title: string; summary: string; why: string; evidence: string[]; assumptions: string[]; time: string }[];
  activity: { label: string; detail: string; time: string }[];
};

export type DemoPreferences = { language: string; timezone: string; inputAlerts: boolean; researchAlerts: boolean };
