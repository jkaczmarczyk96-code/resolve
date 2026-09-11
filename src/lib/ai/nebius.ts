import "server-only";
import { z } from "zod";
import { AIError, bounded } from "./errors";
import type { AIProvider, GenerationRequest } from "./provider";
import { getAIConfiguration } from "./models";
import { readJSON } from "./http";

const completion = z.object({ choices: z.array(z.object({
  finish_reason: z.string().nullable(),
  message: z.object({ content: z.string().nullable().optional(), refusal: z.string().nullable().optional() }),
})).length(1) });

export function createNebiusProvider(env: Record<string, string | undefined> = process.env, transport: typeof fetch = fetch): AIProvider {
  const config = getAIConfiguration(env);
  return {
    model: config.model,
    async generate(request: GenerationRequest) {
      return bounded(async (signal) => {
        const schema = z.toJSONSchema(request.schema);
        const response = await transport(`${config.baseURL}/chat/completions`, {
          method: "POST", signal, redirect: "error", cache: "no-store",
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.model, stream: false, max_tokens: 8192, temperature: 0.2,
            messages: [
              { role: "system", content: `${request.instructions}\nReturn only JSON matching this schema: ${JSON.stringify(schema)}` },
              { role: "user", content: JSON.stringify(request.input) },
            ],
            response_format: { type: "json_schema", json_schema: { name: request.name, strict: true, schema } },
          }),
        });
        const parsed = completion.safeParse(await readJSON(response));
        if (!parsed.success) throw new AIError("INVALID_OUTPUT");
        const choice = parsed.data.choices[0];
        if (choice.message.refusal || choice.finish_reason === "content_filter") throw new AIError("REFUSED");
        if (choice.finish_reason === "length") throw new AIError("TRUNCATED");
        if (choice.finish_reason !== "stop" || !choice.message.content) throw new AIError("INVALID_OUTPUT");
        let value: unknown;
        try { value = JSON.parse(choice.message.content); } catch { throw new AIError("INVALID_OUTPUT"); }
        const output = request.schema.safeParse(value);
        if (!output.success) {
          // Schema codes and paths only: never record provider content, prompts or credentials.
          console.warn("AI output contract rejected", { agent: request.name, issues: output.error.issues.slice(0, 10).map((issue) => ({ code: issue.code, path: issue.path.filter((part) => typeof part === "number" || Object.hasOwn(schema.properties ?? {}, String(part))) })) });
          throw new AIError("INVALID_OUTPUT");
        }
        return output.data;
      }, 60_000, request.signal);
    },
  };
}
