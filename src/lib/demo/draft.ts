import { z } from "zod";
import type { DemoProblem } from "./types";

export const draftInputSchema = z.string().trim().min(20, "Add a little more detail (at least 20 characters).").max(2000, "Keep your description under 2,000 characters.");

export function createDemoDraft(id: string, input: string): DemoProblem {
  const description = draftInputSchema.parse(input);
  return { id, title: description.length > 72 ? `${description.slice(0, 69)}…` : description, originalInput: description, goal: description, category: "Personal", status: "Draft", progress: 0, confidence: "Not assessed", priority: "Draft captured. Analysis is not available in this UI demo.", constraints: [], unknowns: [], plan: [], research: [], options: [], recommendation: null, risks: [], tasks: [], decisions: [], activity: [{ label: "Demo draft created", detail: "Your description is held only in this open preview. No AI request was made.", time: "This preview" }] };
}
