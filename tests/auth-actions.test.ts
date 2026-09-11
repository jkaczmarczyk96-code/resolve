import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialAuthState } from "@/lib/auth/schemas";

const mock = vi.hoisted(() => ({
  signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
  getToken: vi.fn(), clearToken: vi.fn(), storeToken: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: mock }) }));
vi.mock("@/lib/supabase/ephemeral", () => ({ createEphemeralClient: () => ({ auth: mock }) }));
vi.mock("@/lib/config/server-env", () => ({ getSiteOrigin: () => "https://resolve.example" }));
vi.mock("@/lib/auth/recovery", () => ({ getRecoveryToken: mock.getToken, clearRecoveryToken: mock.clearToken, storeRecoveryToken: mock.storeToken }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));

import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction, logoutAction } from "@/lib/auth/actions";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}
const credentials = { email: "person@example.com", password: "MySecurePassword12" };
const passwordForm = () => form({ password: credentials.password, confirmPassword: credentials.password });

beforeEach(() => {
  vi.resetAllMocks();
  mock.signInWithPassword.mockResolvedValue({ error: null });
  mock.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mock.resetPasswordForEmail.mockResolvedValue({ error: null });
  mock.signOut.mockResolvedValue({ error: null });
  mock.getToken.mockResolvedValue("a".repeat(64));
  mock.verifyOtp.mockResolvedValue({ data: { session: { access_token: "test" }, user: { id: "user" } }, error: null });
  mock.updateUser.mockResolvedValue({ error: null });
});

describe("auth actions (provider mocked)", () => {
  it("rejects invalid fields before a provider call", async () => {
    const state = await registerAction(initialAuthState, form({ ...credentials, confirmPassword: "mismatch" }));
    expect(state.fieldErrors?.confirmPassword).toHaveLength(1);
    expect(mock.signUp).not.toHaveBeenCalled();
  });
  it("redirects successful login only to a safe destination", async () => {
    await expect(loginAction(initialAuthState, form({ ...credentials, next: "https://attacker.invalid" }))).rejects.toThrow("REDIRECT:/dashboard");
    expect(mock.clearToken).toHaveBeenCalled();
  });
  it("preserves a private return URL", async () => {
    await expect(loginAction(initialAuthState, form({ ...credentials, next: "/problems/123?tab=plan" }))).rejects.toThrow("REDIRECT:/problems/123?tab=plan");
  });
  it("does not leak provider errors", async () => {
    mock.signInWithPassword.mockResolvedValue({ error: { message: "secret raw backend details" } });
    expect((await loginAction(initialAuthState, form(credentials))).message).not.toContain("secret");
  });
  it("shows email verification when sign-up returns no session", async () => {
    const state = await registerAction(initialAuthState, form({ ...credentials, confirmPassword: credentials.password, displayName: "Person" }));
    expect(state.status).toBe("success");
    expect(state.message).toContain("confirmation link");
    expect(mock.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { data: { display_name: "Person" }, emailRedirectTo: "https://resolve.example/auth/callback?next=/dashboard" } }));
  });
  it("supports projects with email confirmation disabled", async () => {
    mock.signUp.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });
    await expect(registerAction(initialAuthState, form({ ...credentials, confirmPassword: credentials.password }))).rejects.toThrow("REDIRECT:/dashboard");
  });
  it("returns the same recovery response for existing, absent and unavailable accounts", async () => {
    const existing = await forgotPasswordAction(initialAuthState, form({ email: credentials.email }));
    mock.resetPasswordForEmail.mockResolvedValue({ error: { code: "user_not_found" } });
    const absent = await forgotPasswordAction(initialAuthState, form({ email: "absent@example.com" }));
    mock.resetPasswordForEmail.mockRejectedValue(new Error("provider secret"));
    const unavailable = await forgotPasswordAction(initialAuthState, form({ email: "absent@example.com" }));
    expect(absent).toEqual(existing);
    expect(unavailable).toEqual(existing);
  });
  it("refuses reset without a recovery credential, even if a browser session exists", async () => {
    mock.getToken.mockResolvedValue(null);
    expect((await resetPasswordAction(initialAuthState, passwordForm())).status).toBe("error");
    expect(mock.updateUser).not.toHaveBeenCalled();
  });
  it.each(["otp_expired", "token_used", "invalid_token"])("refuses reset for %s", async (code) => {
    mock.verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: { code } });
    await expect(resetPasswordAction(initialAuthState, passwordForm())).rejects.toThrow("REDIRECT:/reset-password?error=invalid-link");
    expect(mock.updateUser).not.toHaveBeenCalled();
    expect(mock.clearToken).toHaveBeenCalled();
  });
  it("requires the recovery verification to establish a session", async () => {
    mock.verifyOtp.mockResolvedValue({ data: { session: null, user: { id: "user" } }, error: null });
    await expect(resetPasswordAction(initialAuthState, passwordForm())).rejects.toThrow("REDIRECT:/reset-password?error=invalid-link");
    expect(mock.updateUser).not.toHaveBeenCalled();
  });
  it("verifies the single-use token before changing the password and signing out", async () => {
    await expect(resetPasswordAction(initialAuthState, passwordForm())).rejects.toThrow("REDIRECT:/login?message=password-updated");
    expect(mock.verifyOtp).toHaveBeenCalledWith({ token_hash: "a".repeat(64), type: "recovery" });
    expect(mock.verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(mock.updateUser.mock.invocationCallOrder[0]);
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
  it("clears a spent token when password update fails", async () => {
    mock.updateUser.mockResolvedValue({ error: { message: "raw internal failure" } });
    await expect(resetPasswordAction(initialAuthState, passwordForm())).rejects.toThrow("REDIRECT:/reset-password?error=update-failed");
    expect(mock.clearToken).toHaveBeenCalled();
    expect(mock.signOut).toHaveBeenCalled();
  });
  it("signs out with a POST server action and clears the pending recovery token", async () => {
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login?message=signed-out");
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mock.clearToken).toHaveBeenCalled();
  });
});
