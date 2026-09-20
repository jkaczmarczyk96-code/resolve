import "server-only";
import { z } from "zod";
import { AIError, bounded } from "./errors";
import { readJSON } from "./http";
import { canonicalSource } from "./quality";
import { type Source, sourceSchema, sourcesSchema } from "./schemas";

export interface ResearchProvider {
  search(question: string, signal: AbortSignal): Promise<Source[]>;
}
const researchQuestions = z.array(z.string().trim().min(1).max(2000)).min(1).max(3);
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

/** Run a small query set concurrently, then deduplicate and re-key evidence for one agent context. */
export async function searchMany(provider: ResearchProvider, rawQuestions: string[], signal: AbortSignal): Promise<Source[]> {
  const parsed=researchQuestions.safeParse([...new Set(rawQuestions.map((question)=>question.trim()))]);
  if (!parsed.success) throw new AIError("INVALID_INPUT");
  const batches=await Promise.all(parsed.data.map((question)=>provider.search(question,signal)));
  const unique=new Map<string,Source>();
  const depth=Math.max(...batches.map((batch)=>batch.length));
  for (let index=0;index<depth;index++) {
    for (const batch of batches) {
      const source=batch[index]; if (!source) continue;
      const checked=sourceSchema.safeParse(source);
      if (!checked.success) throw new AIError("INVALID_OUTPUT");
      const key=canonicalSource(checked.data.url);
      if (!unique.has(key)) unique.set(key,checked.data);
    }
  }
  return sourcesSchema.parse([...unique.values()].slice(0,10).map((source,index)=>({...source,id:`source-${index+1}`,content:source.content.slice(0,6000)})));
}

/** Only explicit ISO metadata from search is accepted; never infer dates from snippets or URLs. */
export function publicationDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  if (!z.iso.datetime({ offset: true }).safeParse(normalized).success) return null;
  return new Date(normalized).toISOString();
}
