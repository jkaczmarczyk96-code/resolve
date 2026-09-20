import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoProblemWorkspace } from "@/components/demo/problem-workspace";
import { demoProblems } from "@/lib/demo/data";

export const metadata: Metadata = { title: "Demo problem" };

export default async function DemoProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = /^draft-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
  if (!draft && !demoProblems.some((problem) => problem.id === id)) notFound();
  return <DemoProblemWorkspace key={id} id={id} />;
}
