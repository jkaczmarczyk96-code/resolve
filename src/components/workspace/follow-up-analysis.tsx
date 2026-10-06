"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackProductEvent } from "@/lib/product/analytics";
import { followUpSubmission } from "@/lib/workspace/follow-up";
import { webJobSchema } from "@/lib/workspace/contracts";
import { post } from "./remote";
import { ui, useCzech } from "./ui-language";

export function FollowUpAnalysis({ goal, unknown, disabled = false }: { goal: string; unknown: string; disabled?: boolean }) {
  const router = useRouter();
  const cs = useCzech();
  const lock = useRef(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return <li className="rounded-lg border p-4">
    <p className="break-words text-sm leading-relaxed">{unknown}</p>
    <Button className="mt-3" size="sm" variant="outline" disabled={disabled || pending} onClick={async () => {
      if (lock.current) return;
      const input = followUpSubmission(requestId, goal, unknown);
      if (!input.success) { setError("This question cannot be used for a follow-up analysis."); return; }
      lock.current = true; setPending(true); setError("");
      try {
        const job = webJobSchema.parse(await post("/api/problems", input.data));
        if (!job.problemId) throw new Error("The follow-up problem is no longer available.");
        trackProductEvent("problem_created", "/problems/new", { source: "unresolved_unknown" });
        router.push(`/problems/${job.problemId}`);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Unable to start the follow-up analysis.");
      } finally {
        lock.current = false; setPending(false);
      }
    }}><Search aria-hidden="true" />{pending ? ui(cs,"Starting follow-up…","Spouštím navazující analýzu…") : ui(cs,"Start follow-up analysis","Prozkoumat tuto otázku")}</Button>
    {disabled && <p className="mt-2 text-xs text-muted-foreground">{ui(cs,"Finish the active analysis before starting another one.","Nejprve dokončete probíhající analýzu.")}</p>}
    {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
  </li>;
}
