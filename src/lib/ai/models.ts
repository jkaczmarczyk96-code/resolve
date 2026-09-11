import "server-only";
import { z } from "zod";
import { AIError } from "./errors";

export const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b";
export const DEFAULT_BASE_URL = "https://api.tokenfactory.us-central1.nebius.com/v1";
const configuration = z.object({
  NEBIUS_API_KEY: z.string().trim().min(1),
  NEBIUS_MODEL: z.string().trim().min(1).max(200).default(DEFAULT_MODEL),
  NEBIUS_BASE_URL: z.enum([
    DEFAULT_BASE_URL, "https://api.tokenfactory.nebius.com/v1",
  ]).default(DEFAULT_BASE_URL),
});
export function getAIConfiguration(env: Record<string, string | undefined> = process.env) {
  const result = configuration.safeParse(env);
  if (!result.success) throw new AIError("CONFIGURATION");
  return { apiKey: result.data.NEBIUS_API_KEY, model: result.data.NEBIUS_MODEL, baseURL: result.data.NEBIUS_BASE_URL };
}
