"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { patch } from "./remote";

export function ProblemResolution({ id, solved, enabled, refresh }: { id: string; solved: boolean; enabled: boolean; refresh: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!enabled && !solved) return null;
  return <div className="flex flex-col items-end gap-1"><Button variant={solved ? "outline" : "default"} disabled={pending} onClick={async () => {
    setPending(true); setError("");
    try { await patch(`/api/problems/${id}/resolution`, { solved: !solved }); refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to update this problem."); }
    finally { setPending(false); }
  }}>{solved ? <RotateCcw aria-hidden="true"/> : <CheckCircle2 aria-hidden="true"/>}{pending ? "Saving…" : solved ? "Reopen problem" : "Mark solved"}</Button>{error && <p role="alert" className="max-w-xs text-right text-xs text-destructive">{error}</p>}</div>;
}

