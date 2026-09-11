import { LiveProblem } from "@/components/workspace/problem";
import { z } from "zod";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { demoProblems } from "@/lib/demo/data";
import { DemoProblemWorkspace } from "@/components/demo/problem-workspace";

export const metadata: Metadata = { title: "Problem workspace" };

export default async function ProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/problems/${id}`);
  if (z.uuid().safeParse(id).success) return <LiveProblem key={id} id={id} />;
  if (!demoProblems.some((problem) => problem.id === id) && !/^draft-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) notFound();
  return <DemoProblemWorkspace key={id} id={id} />;
}
