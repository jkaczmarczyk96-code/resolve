import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { WorkflowError, parseSnapshot, type WorkflowStore, type WorkflowSnapshot } from "./state";
import { z } from "zod";
import { bounded } from "@/lib/ai/errors";
import { parseFullSnapshot, type FullSnapshot } from "./full-state";

/** Verified user-scoped client only. RLS remains in force on every operation. */
async function createCheckpointStore<S extends WorkflowSnapshot | FullSnapshot>(client: SupabaseClient<Database>, table: "workflow_runs" | "full_workflow_runs", parse: (value: unknown) => S): Promise<WorkflowStore<S>> {
  let userId: string;
  try {
    const { data, error } = await bounded(() => client.auth.getUser(), 10_000);
    if (error || !data.user) throw new WorkflowError("AUTHENTICATION");
    userId = data.user.id;
  } catch { throw new WorkflowError("AUTHENTICATION"); }
  const uuid = (id: string) => { if (!z.uuid().safeParse(id).success) throw new WorkflowError("INVALID_REQUEST"); return id; };
  const payload = (snapshot: S) => {
    const parsed = parse(snapshot);
    return { id: parsed.id, problem_id: parsed.problemId, revision: parsed.revision, state: parsed.state, snapshot: parsed };
  };
  const io = async <T>(operation: () => PromiseLike<T>) => {
    try { return await operation(); }
    catch (error) { throw error instanceof WorkflowError ? error : new WorkflowError("PERSISTENCE"); }
  };
  return {
    async loadProblem(id) {
      return io(async () => {
        const { data, error } = await client.from("problems").select("original_input").eq("id", uuid(id)).eq("user_id", userId).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
        if (error) throw new WorkflowError("PERSISTENCE");
        if (!data) throw new WorkflowError("NOT_FOUND");
        return { description: data.original_input };
      });
    },
    async create(snapshot) {
      return io(async () => {
        const { error } = await client.from(table).insert(payload(snapshot)).abortSignal(AbortSignal.timeout(10_000));
        if (error) throw new WorkflowError(error.code === "23505" ? "CONFLICT" : "PERSISTENCE");
      });
    },
    async save(snapshot, expectedRevision) {
      return io(async () => {
        const { data, error } = await client.from(table).update(payload(snapshot)).eq("id", uuid(snapshot.id)).eq("revision", expectedRevision).select("id").abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
        if (error) throw new WorkflowError("PERSISTENCE");
        if (!data) throw new WorkflowError("CONFLICT");
      });
    },
    async load(id) {
      return io(async () => {
        const { data, error } = await client.from(table).select("snapshot").eq("id", uuid(id)).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
        if (error) throw new WorkflowError("PERSISTENCE");
        if (!data) throw new WorkflowError("NOT_FOUND");
        const snapshot = parse(data.snapshot);
        if (snapshot.id !== id) throw new WorkflowError("INVALID_CHECKPOINT");
        return snapshot;
      });
    },
  };
}
export const createWorkflowStore = (client: SupabaseClient<Database>) => createCheckpointStore(client, "workflow_runs", parseSnapshot);
export const createFullWorkflowStore = (client: SupabaseClient<Database>) => createCheckpointStore(client, "full_workflow_runs", parseFullSnapshot);
