import type { Metadata } from "next";
import { NewDemoProblem } from "@/components/demo/new-problem";

export const metadata: Metadata = { title: "New demo problem" };

export default function NewDemoProblemPage() {
  return <NewDemoProblem />;
}
