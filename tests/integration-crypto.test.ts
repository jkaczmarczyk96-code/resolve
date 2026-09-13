import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { decryptCredential, encryptCredential } from "@/lib/integrations/crypto";

beforeEach(() => {
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client-id-for-tests.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "test-client-secret-value");
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64url"));
});

it("round-trips credentials with randomized authenticated encryption", () => {
  const first = encryptCredential("private-token"); const second = encryptCredential("private-token");
  expect(first).not.toBe(second); expect(first).not.toContain("private-token"); expect(decryptCredential(first)).toBe("private-token");
});

it("rejects tampering and invalid encryption keys", () => {
  const encrypted = encryptCredential("private-token");
  const parts = encrypted.split("."); parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
  expect(() => decryptCredential(parts.join("."))).toThrow();
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "too-short");
  expect(() => encryptCredential("private-token")).toThrow("Google integrations are not configured.");
});
