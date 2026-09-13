import "server-only";
export function enabledOAuthProviders(): Array<"google"> {
  const providers: Array<"google"> = [];
  if (process.env.AUTH_GOOGLE_ENABLED === "true") providers.push("google");
  return providers;
}
