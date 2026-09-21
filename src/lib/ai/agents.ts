import "server-only";
import { AIError, bounded } from "./errors";
import type { AIProvider } from "./provider";
import type { ResearchProvider } from "./research";
import { contracts, verifierInput, verifierOutput, researchInput, sourcesSchema, type AgentName, type AgentInput, type AgentOutput, type Source } from "./schemas";
import { commonInstructions, instructions } from "./prompts";
import { groundVerification, validateInput, validateOutput, validateSources } from "./integrity";

export interface AgentDependencies {
  ai: AIProvider;
  research?: ResearchProvider;
}
export interface RunOptions { signal?: AbortSignal }
export interface AgentResult<N extends AgentName> {
  agent: N;
  model: string;
  output: AgentOutput<N>;
  sources: Source[];
}

/** Exactly one agent invocation, not an orchestrator. No persistence or external actions. */
export function runAgent<N extends AgentName>(name: N, rawInput: AgentInput<N>, dependencies: AgentDependencies, options: RunOptions = {}): Promise<AgentResult<N>> {
  return bounded(async (signal) => {
    if (!Object.hasOwn(contracts, name)) throw new AIError("INVALID_INPUT");
    const contract = contracts[name];
    if (!contract) throw new AIError("INVALID_INPUT");
    const parsed = contract.input.safeParse(rawInput);
    if (!parsed.success || JSON.stringify(parsed.data).length > 100_000) throw new AIError("INVALID_INPUT");
    validateInput(name, parsed.data);
    let sources: Source[] = [];
    if (name === "researcher") {
      if (!dependencies.research) throw new AIError("CONFIGURATION");
      const search = await dependencies.research.search(researchInput.parse(parsed.data).question, signal);
      const checked = sourcesSchema.safeParse(search);
      if (!checked.success) throw new AIError("INVALID_OUTPUT");
      sources = checked.data;
      validateSources(sources);
    }
    const input = name === "researcher" ? { ...parsed.data, sources } : parsed.data;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await dependencies.ai.generate({
          name,
          input,
          instructions: `${commonInstructions}\n${instructions[name]}${attempt ? "\nYour previous response was rejected because it violated the required output contract. Rebuild the complete response from the supplied input. Follow the schema and every ID, cardinality, reference, dependency and evidence rule exactly; do not mention this repair attempt." : ""}`,
          schema: contract.output,
          signal,
        });
        const output = contract.output.safeParse(response);
        if (!output.success) throw new AIError("INVALID_OUTPUT");
        const checked = name === "verifier" ? groundVerification(verifierOutput.parse(output.data), verifierInput.parse(parsed.data)) : output.data;
        validateOutput(name, parsed.data, checked, sources);
        // The selected contract validated this exact named agent's output above.
        return { agent: name, model: dependencies.ai.model, output: checked as AgentOutput<N>, sources };
      } catch (error) {
        if (!(error instanceof AIError) || error.code !== "INVALID_OUTPUT" || attempt === 1) throw error;
      }
    }
    throw new AIError("INVALID_OUTPUT");
  }, 90_000, options.signal);
}

export const intake = (input: AgentInput<"intake">, deps: AgentDependencies, options?: RunOptions) => runAgent("intake", input, deps, options);
export const planner = (input: AgentInput<"planner">, deps: AgentDependencies, options?: RunOptions) => runAgent("planner", input, deps, options);
export const researcher = (input: AgentInput<"researcher">, deps: AgentDependencies, options?: RunOptions) => runAgent("researcher", input, deps, options);
export const verifier = (input: AgentInput<"verifier">, deps: AgentDependencies, options?: RunOptions) => runAgent("verifier", input, deps, options);
export const critic = (input: AgentInput<"critic">, deps: AgentDependencies, options?: RunOptions) => runAgent("critic", input, deps, options);
export const decision = (input: AgentInput<"decision">, deps: AgentDependencies, options?: RunOptions) => runAgent("decision", input, deps, options);
