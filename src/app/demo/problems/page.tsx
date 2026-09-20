import type { Metadata } from "next";
import { DemoProblemList } from "@/components/demo/problem-list";

export const metadata: Metadata = { title: "Demo problems" };

export default function DemoProblemsPage() {
  return <DemoProblemList />;
}
