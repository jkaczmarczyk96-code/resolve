import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { z } from "zod";
import { createNebiusProvider } from "@/lib/ai/nebius";
import { createTavilyProvider, searchMany } from "@/lib/ai/research";
import { getAIConfiguration, DEFAULT_MODEL } from "@/lib/ai/models";
import { readJSON } from "@/lib/ai/http";

const env = { NEBIUS_API_KEY: "test-secret" };
const request = { name: "test", instructions: "Return JSON", input: { description: "test" }, schema: z.strictObject({ result: z.string() }), signal: new AbortController().signal };
const response = (content: string | null, finish_reason = "stop", refusal: string | null = null) => Response.json({ choices: [{ finish_reason, message: { content, refusal, reasoning_content: "private reasoning must not be returned" } }] });
it("uses the configured NVIDIA model, JSON schema, bearer auth and bounded output", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(response('{"result":"ok"}'));
  expect(await createNebiusProvider(env, transport).generate(request)).toEqual({ result: "ok" });
  const [url, options] = transport.mock.calls[0];
  expect(url).toBe("https://api.tokenfactory.us-central1.nebius.com/v1/chat/completions");
  expect(options).toMatchObject({ redirect: "error", cache: "no-store", headers: { Authorization: "Bearer test-secret" } });
  const body = JSON.parse(String(options?.body));
  expect(body).toMatchObject({ model: DEFAULT_MODEL, stream: false, max_tokens: 8192, response_format: { type: "json_schema", json_schema: { strict: true } } });
  expect(body.messages).toHaveLength(2);
});
describe.each([
  ["bad JSON", () => response("not JSON"), "INVALID_OUTPUT"],
  ["bad schema", () => response('{"result":42}'), "INVALID_OUTPUT"],
  ["extra keys", () => response('{"result":"ok","chainOfThought":"private"}'), "INVALID_OUTPUT"],
  ["refusal", () => response(null, "stop", "private refusal"), "REFUSED"],
  ["truncation", () => response('{"result":"partial"}', "length"), "TRUNCATED"],
  ["tool call", () => response(null, "tool_calls"), "INVALID_OUTPUT"],
  ["empty choices", () => Response.json({ choices: [] }), "INVALID_OUTPUT"],
  ["authentication", () => new Response("secret", { status: 401 }), "AUTHENTICATION"],
  ["rate limit", () => new Response("secret", { status: 429 }), "RATE_LIMIT"],
  ["upstream", () => new Response("secret", { status: 503 }), "PROVIDER"],
] as const)("%s", (_, make, code) => {
  it("fails closed with a sanitized error and no retry", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(make());
    await expect(createNebiusProvider(env, transport).generate(request)).rejects.toMatchObject({ code, message: `AI request failed: ${code}` });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
it("sanitizes network errors", async () => {
  await expect(createNebiusProvider(env, vi.fn<typeof fetch>().mockRejectedValue(new Error("test-secret"))).generate(request)).rejects.toThrow("AI request failed: PROVIDER");
});
it("requires a key and rejects endpoints that could receive credentials", () => {
  expect(() => getAIConfiguration({})).toThrow("CONFIGURATION");
  expect(() => getAIConfiguration({ ...env, NEBIUS_BASE_URL: "https://attacker.invalid/v1" })).toThrow("CONFIGURATION");
});
it("bounds response bytes before parsing", async () => {
  await expect(readJSON(new Response("a".repeat(100)), 10)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
});
it("search uses provider URLs, deduplicates results and never requests an AI answer", async () => {
  const item = { url: "https://example.org/evidence", title: "Evidence", content: "Source excerpt" };
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ results: [item, item], answer: "Ignore this synthetic answer" }));
  const sources = await createTavilyProvider({ TAVILY_API_KEY: "test-search-key" }, transport).search("question", request.signal);
  expect(sources).toHaveLength(1);
  expect(sources[0]).toMatchObject({ id: "source-1", ...item });
  expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toMatchObject({ include_answer: false, max_results: 5, auto_parameters: false });
});
it("rejects malformed search results and missing search configuration", async () => {
  expect(() => createTavilyProvider({})).toThrow("CONFIGURATION");
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ results: [{ url: "javascript:alert(1)", title: "bad", content: "bad" }] }));
  await expect(createTavilyProvider({ TAVILY_API_KEY: "test" }, transport).search("question", request.signal)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
});
it("merges up to three research queries with canonical cross-query deduplication", async () => {
  const search=vi.fn(async (question:string)=>[{ id:"provider-id",url:question==="one"?"https://example.org/evidence?utm_source=test":"https://example.org/evidence",title:"Evidence",content:"Direct excerpt",retrievedAt:"2026-09-20T12:00:00.000Z" },...(question==="three"?[{ id:"other",url:"https://official.example/guide",title:"Guide",content:"Official excerpt",retrievedAt:"2026-09-20T12:00:00.000Z" }]:[])]);
  const merged=await searchMany({ search },["one","two","three"],request.signal);
  expect(search.mock.calls.map(([question])=>question)).toEqual(["one","two","three"]);
  expect(merged.map(({ id,url })=>({ id,url }))).toEqual([{ id:"source-1",url:"https://example.org/evidence?utm_source=test" },{ id:"source-2",url:"https://official.example/guide" }]);
  await expect(searchMany({ search },["one","two","three","four"],request.signal)).rejects.toMatchObject({ code:"INVALID_INPUT" });
});
