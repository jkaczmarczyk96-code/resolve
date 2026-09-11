"use client";
import { useEffect, useState } from "react";
import type { z } from "zod";

export const messages: Record<string, string> = {
  INPUT_REQUIRED: "This analysis is waiting for your answers. Open the problem to continue.", NOT_WAITING: "This run is not waiting for answers. Refresh its status.", RESPONSE_CONFLICT: "Answers have already been saved for this request. Refresh to see them.",
  SIGN_IN_REQUIRED: "Your session has ended. Sign in again to continue.", NOT_FOUND: "This problem was not found in your account.",
  ACTIVE_RUN: "An analysis is already running. Open Problems to follow it.", DAILY_LIMIT: "You have reached the limit of five analyses in 24 hours. Try again later.",
  ATTEMPT_LIMIT: "This problem has reached its limit of three attempts.", ALREADY_COMPLETED: "This problem already has a completed analysis.",
  INVALID_INPUT: "Describe your problem using 20–12,000 characters.", CONFLICT: "This request conflicts with an existing run. Refresh the problem list.",
  SERVICE_UNAVAILABLE: "The analysis service is unavailable. Please try again later.", LOAD_FAILED: "Unable to refresh the saved data. Please try again.",
};
export function errorMessage(code: unknown) { return typeof code === "string" ? messages[code] ?? "The request could not be completed. Please try again." : "The request could not be completed. Please try again."; }
class RemoteError extends Error {}
export async function post(url: string, value: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value), signal: AbortSignal.timeout(20_000) });
  const data: unknown = await response.json();
  if (!response.ok) throw new RemoteError(errorMessage(typeof data === "object" && data && "error" in data ? data.error : null));
  return data;
}
export function useRemote<T>(url: string, schema: z.ZodType<T>, active: (value: T) => boolean) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState(""); const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        const raw: unknown = await response.json();
        if (!response.ok) throw new RemoteError(errorMessage(typeof raw === "object" && raw && "error" in raw ? raw.error : null));
        const value = schema.parse(raw);
        if (controller.signal.aborted) return;
        setData(value); setError("");
        if (active(value)) timer = setTimeout(load, document.hidden ? 10_000 : 2000);
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof RemoteError ? error.message : "Unable to refresh the saved data. Please try again."); }
    };
    void load(); return () => { controller.abort(); clearTimeout(timer); };
  }, [url, schema, active, version]);
  return { data, error, refresh: () => setVersion((value) => value + 1) };
}
