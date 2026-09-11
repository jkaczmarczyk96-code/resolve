import { randomUUID } from "node:crypto";
import { parseSnapshot, WorkflowError, type WorkflowSnapshot, type WorkflowStore } from "@/lib/orchestration/state";
import { inputs } from "./ai";

/** Test double only. Production uses the authenticated Supabase adapter. */
export class MemoryWorkflowStore implements WorkflowStore {
  history: WorkflowSnapshot[] = [];
  async loadProblem() { return { description: inputs.intake.description }; }
  async create(value: WorkflowSnapshot) {
    if (this.history.some((item) => item.id === value.id)) throw new WorkflowError("CONFLICT");
    this.history.push(parseSnapshot(value));
  }
  async save(value: WorkflowSnapshot, revision: number) {
    const previous = this.history.findLast((item) => item.id === value.id);
    if (!previous || previous.revision !== revision) throw new WorkflowError("CONFLICT");
    this.history.push(parseSnapshot(value));
  }
  async load(id: string) {
    const value = this.history.findLast((item) => item.id === id);
    if (!value) throw new WorkflowError("NOT_FOUND");
    return parseSnapshot(value);
  }
}
export const workflowRequest = () => ({ runId: randomUUID(), problemId: randomUUID() });
