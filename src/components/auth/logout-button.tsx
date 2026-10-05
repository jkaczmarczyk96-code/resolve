"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div className="space-y-2"><Button type="button" variant="outline" disabled={pending} onClick={async () => {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error("Sign out failed");
      window.location.replace("/login?message=signed-out");
    } catch {
      setError("Sign out failed. Please try again.");
      setPending(false);
    }
  }}>{pending ? "Signing out…" : "Sign out"}</Button>{error && <p role="alert" className="max-w-xs text-sm text-destructive">{error}</p>}</div>;
}
