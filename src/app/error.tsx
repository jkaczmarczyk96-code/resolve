"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert" className="space-y-5"><h1 className="text-3xl font-semibold">Something went wrong</h1><p className="text-muted-foreground">Please try loading this page again.</p><Button onClick={reset}>Try again</Button></div>;
}
