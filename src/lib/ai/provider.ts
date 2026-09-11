import type { z } from "zod";

export interface GenerationRequest {
  name: string;
  instructions: string;
  input: unknown;
  schema: z.ZodType;
  signal: AbortSignal;
}
export interface AIProvider {
  readonly model: string;
  generate(request: GenerationRequest): Promise<unknown>;
}
