import "server-only";
import { z } from "zod";
import { AIError, bounded } from "./errors";
import { readJSON } from "./http";
import { canonicalSource } from "./quality";
import { type Source, sourcesSchema } from "./schemas";

export interface ResearchProvider {
  search(question: string, signal: AbortSignal): Promise<Source[]>;
}
const searchResponse = z.object({ results: z.array(z.object({
  url: z.url({ protocol: /^https?$/ }).max(2048), title: z.string().min(1).max(2000),
  content: z.string().min(1).max(50_000), published_date: z.string().max(100).nullable().optional(),
})).max(10) });

export function createTavilyProvider(env: Record<string, string | undefined> = process.env, transport: typeof fetch = fetch): ResearchProvider {
  const key = env.TAVILY_API_KEY?.trim();
  if (!key) throw new AIError("CONFIGURATION");
  return { async search(question, parent) {
    if (!z.string().trim().min(1).max(2000).safeParse(question).success) throw new AIError("INVALID_INPUT");
    return bounded(async (signal) => {
      const response = await transport("https://api.tavily.com/search", {
        method: "POST", signal, redirect: "error", cache: "no-store",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: question, max_results: 5, search_depth: "basic", include_answer: false, include_raw_content: false, auto_parameters: false }),
      });
      const parsed = searchResponse.safeParse(await readJSON(response));
      if (!parsed.success) throw new AIError("INVALID_OUTPUT");
      const unique = [...new Map(parsed.data.results.map((item) => [canonicalSource(item.url), item])).values()];
      return sourcesSchema.parse(unique.map((item, index) => ({
        id: `source-${index + 1}`, url: item.url, title: item.title,
        content: item.content.slice(0, 8000), retrievedAt: new Date().toISOString(),
        publishedAt: publicationDate(item.published_date),
      })));
    }, 20_000, parent);
  } };
}

/** Only explicit ISO metadata from search is accepted; never infer dates from snippets or URLs. */
export function publicationDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  if (!z.iso.datetime({ offset: true }).safeParse(normalized).success) return null;
  return new Date(normalized).toISOString();
}
