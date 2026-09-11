import { LiveProblemList } from "@/components/workspace/problem-list";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DemoProblemList } from "@/components/demo/problem-list";

export const metadata: Metadata = { title: "Problems" };

export default async function ProblemsPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  await requireUser("/problems");
  return (await searchParams).demo === "1" ? <DemoProblemList /> : <LiveProblemList />;
}
