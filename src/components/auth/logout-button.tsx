"use client";

import { useActionState } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { initialAuthState } from "@/lib/auth/schemas";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [state, action, pending] = useActionState(logoutAction, initialAuthState);
  return <form action={action} className="space-y-2"><Button type="submit" variant="outline" disabled={pending}>{pending ? "Signing out…" : "Sign out"}</Button>{state.message && <p role="alert" className="max-w-xs text-sm text-destructive">{state.message}</p>}</form>;
}
