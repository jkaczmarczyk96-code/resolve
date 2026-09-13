import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/oauth", () => ({ enabledOAuthProviders: () => ["google"] }));

import { OAuthButtons } from "@/components/auth/oauth-buttons";

it("submits the selected OAuth provider and safe return path", () => {
  const html = renderToStaticMarkup(OAuthButtons({ next: "/problems" }));

  expect(html).toContain('href="/auth/oauth?provider=google&amp;next=%2Fproblems"');
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain("or continue with email");
});
