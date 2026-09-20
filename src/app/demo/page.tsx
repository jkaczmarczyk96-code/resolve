import type { Metadata } from "next";
import { DemoDashboard } from "@/components/demo/dashboard";

export const metadata: Metadata = { title: "Interactive demo" };

export default function DemoPage() {
  return <DemoDashboard />;
}
