"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/lib/auth/actions";
import { initialAuthState } from "@/lib/auth/schemas";

type Mode = "login" | "register" | "forgot-password" | "reset-password";
const actions = { login: loginAction, register: registerAction, "forgot-password": forgotPasswordAction, "reset-password": resetPasswordAction };
const labels = { login: "Sign in", register: "Create account", "forgot-password": "Send recovery link", "reset-password": "Save new password" };

function Field({ name, label, password = false, errors, autoComplete, required = true, maxLength = 128, hint }: {
  name: string; label: string; password?: boolean; errors?: string[]; autoComplete?: string; required?: boolean; maxLength?: number; hint?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div className="space-y-2">
    <label className="text-sm font-medium" htmlFor={id}>{label}</label>
    <div className="relative">
      <Input id={id} name={name} type={password ? (visible ? "text" : "password") : name === "email" ? "email" : "text"} required={required} maxLength={maxLength} autoComplete={autoComplete} aria-invalid={Boolean(errors?.length)} aria-describedby={errors?.length ? `${id}-error` : hint ? `${id}-hint` : undefined} className={password ? "pr-12" : undefined} />
      {password && <Button type="button" variant="ghost" size="icon" className="absolute right-0.5 top-0.5" onClick={() => setVisible(!visible)} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</Button>}
    </div>
    {hint && <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
    {errors?.length ? <p id={`${id}-error`} className="text-sm text-destructive">{errors[0]}</p> : null}
  </div>;
}

export function AuthForm({ mode, next = "/dashboard" }: { mode: Mode; next?: string }) {
  const [state, action, pending] = useActionState(actions[mode], initialAuthState);
  const completed = state.status === "success";
  return <div className="space-y-6">
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <fieldset disabled={pending || completed} className="space-y-5 disabled:opacity-70">
        <legend className="sr-only">{labels[mode]}</legend>
        {mode === "register" && <Field name="displayName" label="Display name (optional)" required={false} maxLength={100} autoComplete="nickname" errors={state.fieldErrors?.displayName} />}
        {mode !== "reset-password" && <Field name="email" label="Email" maxLength={254} autoComplete="email" errors={state.fieldErrors?.email} />}
        {mode !== "forgot-password" && <Field name="password" label={mode === "reset-password" ? "New password" : "Password"} password autoComplete={mode === "login" ? "current-password" : "new-password"} errors={state.fieldErrors?.password} hint={mode !== "login" ? "At least 12 characters, including uppercase, lowercase, and a number." : undefined} />}
        {(mode === "register" || mode === "reset-password") && <Field name="confirmPassword" label="Confirm password" password autoComplete="new-password" errors={state.fieldErrors?.confirmPassword} />}
        {mode === "login" && <div className="text-right"><Link className="text-sm font-medium text-primary hover:underline" href="/forgot-password">Forgot password?</Link></div>}
        <Button type="submit" className="w-full" disabled={pending || completed}>{pending && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{pending ? "Please wait…" : labels[mode]}</Button>
      </fieldset>
      {state.message && <p role={state.status === "error" ? "alert" : "status"} className={`rounded-lg border p-4 text-sm leading-relaxed ${state.status === "error" ? "border-destructive/25 text-destructive" : "bg-secondary text-secondary-foreground"}`}>{state.message}</p>}
    </form>
    <div className="text-center text-sm text-muted-foreground">
      {mode === "login" ? <>New to Resolve? <Link className="font-medium text-primary hover:underline" href="/register">Create account</Link></> : <Link className="font-medium text-primary hover:underline" href="/login">Back to sign in</Link>}
      {mode === "reset-password" && <p className="mt-3"><Link className="font-medium text-primary hover:underline" href="/forgot-password">Request a new recovery link</Link></p>}
    </div>
  </div>;
}
