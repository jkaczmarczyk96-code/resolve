import "server-only";
export function enabledOAuthProviders(): Array<"google" | "apple"> {
  const providers: Array<"google" | "apple"> = [];
  if (process.env.AUTH_GOOGLE_ENABLED === "true") providers.push("google");
  if (process.env.AUTH_APPLE_ENABLED === "true") providers.push("apple");
  return providers;
}
