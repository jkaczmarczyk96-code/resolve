import { z } from "zod";

export const productEventNames = ["page_view", "onboarding_completed", "onboarding_skipped", "problem_created", "demo_opened", "calendar_action_succeeded"] as const;

export const productEventSchema = z.strictObject({
  event: z.enum(productEventNames),
  path: z.string().min(1).max(200).regex(/^\/[A-Za-z0-9_./:-]*$/),
  properties: z.record(z.string().max(60), z.union([z.string().max(200), z.number().finite(), z.boolean()])).default({}),
});

export type ProductEventName = (typeof productEventNames)[number];

export function normalizedProductPath(pathname: string) {
  const clean = pathname.split("?", 1)[0] || "/";
  return clean.replace(/\/problems\/(?:[0-9a-f-]{36}|demo-[^/]+|draft-[^/]+)/i, "/problems/:id").slice(0, 200);
}

export function trackProductEvent(event: ProductEventName, path: string, properties: Record<string, string | number | boolean> = {}) {
  const input = productEventSchema.safeParse({ event, path: normalizedProductPath(path), properties });
  if (!input.success || typeof window === "undefined") return;
  void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data), keepalive: true }).catch(() => undefined);
}
