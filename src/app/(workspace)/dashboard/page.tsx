import { LiveProblemList } from "@/components/workspace/problem-list";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DemoDashboard } from "@/components/demo/dashboard";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  await requireUser("/dashboard");
  return (await searchParams).demo === "1" ? <DemoDashboard /> : <LiveProblemList overview />;
}
