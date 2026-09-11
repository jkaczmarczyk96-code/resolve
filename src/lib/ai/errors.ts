export type AIErrorCode = "CONFIGURATION" | "INVALID_INPUT" | "INVALID_OUTPUT" | "TIMEOUT" | "CANCELLED" | "AUTHENTICATION" | "RATE_LIMIT" | "PROVIDER" | "REFUSED" | "TRUNCATED";

/** Deliberately excludes provider bodies, prompts, keys and model reasoning. */
export class AIError extends Error {
  constructor(public readonly code: AIErrorCode) {
    super(`AI request failed: ${code}`);
    this.name = "AIError";
  }
}

export async function bounded<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number, parent?: AbortSignal): Promise<T> {
  if (parent?.aborted) throw new AIError("CANCELLED");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort = () => {};
  const interruption = new Promise<never>((_, reject) => {
    const stop = (code: "TIMEOUT" | "CANCELLED") => {
      reject(new AIError(code));
      controller.abort();
    };
    timer = setTimeout(() => stop("TIMEOUT"), timeoutMs);
    onAbort = () => stop("CANCELLED");
    parent?.addEventListener("abort", onAbort, { once: true });
  });
  try { return await Promise.race([interruption, work(controller.signal)]); }
  catch (error) { throw error instanceof AIError ? error : new AIError("PROVIDER"); }
  finally { clearTimeout(timer); parent?.removeEventListener("abort", onAbort); }
}
