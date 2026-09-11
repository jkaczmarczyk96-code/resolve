import { vi } from "vitest";
import { WorkflowError, type WorkflowStore } from "@/lib/orchestration/state";
import { parseFullSnapshot, type FullSnapshot } from "@/lib/orchestration/full-state";
import { outputs, sources, inputs } from "./ai";
import type { GenerationRequest } from "@/lib/ai/provider";
import type { ResearchProvider } from "@/lib/ai/research";

export class MemoryFullStore implements WorkflowStore<FullSnapshot> {
  history: FullSnapshot[] = [];
  async loadProblem() { return { description: inputs.intake.description }; }
  async create(value: FullSnapshot) {
    if (this.history.some((item) => item.id === value.id)) throw new WorkflowError("CONFLICT");
    this.history.push(parseFullSnapshot(value));
  }
  async save(value: FullSnapshot, revision: number) {
    if (this.history.findLast((item) => item.id === value.id)?.revision !== revision) throw new WorkflowError("CONFLICT");
    this.history.push(parseFullSnapshot(value));
  }
  async load(id: string) {
    const value = this.history.findLast((item) => item.id === id);
    if (!value) throw new WorkflowError("NOT_FOUND");
    return parseFullSnapshot(value);
  }
}
export function fullDependencies() {
  return { ai: { model: "fixture", generate: vi.fn(async (request: GenerationRequest): Promise<unknown> => outputs[request.name as keyof typeof outputs]) }, research: { search: vi.fn<ResearchProvider["search"]>(async () => sources) } };
}
