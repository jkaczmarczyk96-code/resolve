import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/oauth", () => ({ enabledOAuthProviders: () => ["google"] }));

import { OAuthButtons } from "@/components/auth/oauth-buttons";

it("submits the selected OAuth provider and safe return path", () => {
  const html = renderToStaticMarkup(OAuthButtons({ next: "/problems" }));

  expect(html).toContain('action="/auth/oauth"');
  expect(html).toContain('name="next" value="/problems"');
  expect(html).toContain('type="submit"');
  expect(html).toContain('name="provider"');
  expect(html).toContain('value="google"');
});
