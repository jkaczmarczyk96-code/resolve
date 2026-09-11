import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <div className="space-y-5"><p className="text-sm font-medium text-primary">404</p><h1 className="text-3xl font-semibold">This page is not available</h1><p className="text-muted-foreground">Check the address or return to the Resolve preview.</p><Button asChild><Link href="/">Back to Resolve</Link></Button></div>;
}
