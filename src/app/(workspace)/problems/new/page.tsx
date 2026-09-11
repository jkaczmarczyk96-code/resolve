import { NewLiveProblem } from "@/components/workspace/new-problem";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { NewDemoProblem } from "@/components/demo/new-problem";

export const metadata: Metadata = { title: "New problem" };

export default async function NewProblemPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  await requireUser("/problems/new");
  return (await searchParams).demo === "1" ? <NewDemoProblem /> : <NewLiveProblem />;
}
