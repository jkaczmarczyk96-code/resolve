import { expect, it } from "vitest";
import { ensureResearchQuestions, needsExternalEvidence } from "@/lib/orchestration/research-policy";
import { outputs, problem } from "./fixtures/ai";

it("keeps a personal study schedule source-free", () => {
  const description = "Připrav mi harmonogram učení na státnice z historie. Obor historie už jsem uvedl. Bez hledání aktuálních předpisů.";
  expect(needsExternalEvidence(description, problem)).toBe(false);
  const plan = { steps: [{ ...outputs.planner.steps[0], researchQuestions: [] }] };
  expect(ensureResearchQuestions(plan, problem, false)).toEqual(plan);
});

it("restores bounded research queries when current external facts are explicitly requested", () => {
  const intake = { ...problem, title: "Compare JSON output formats", goal: "Compare JSON object and JSON schema output in Nebius Token Factory" };
  expect(needsExternalEvidence("Use current official Nebius documentation for product limits.", intake)).toBe(true);
  const plan = ensureResearchQuestions({ steps: [{ ...outputs.planner.steps[0], researchQuestions: [] }] }, intake, true);
  expect(plan.steps[0].researchQuestions).toHaveLength(2);
  expect(plan.steps[0].researchQuestions[0]).toContain("Nebius Token Factory");
});

it("does not treat an opt-out of web search as permission to invent medical or legal facts", () => {
  expect(needsExternalEvidence("Give current medical treatment advice without web research.", problem)).toBe(true);
});

it("uses the user's intent rather than the product category for troubleshooting", () => {
  const product = { ...problem, category: "product" as const };
  const description = "Tiskárna netiskne. Potřebuji bezpečný postup kontroly. Nepotřebuji vyhledávání na webu.";
  expect(needsExternalEvidence(description, product)).toBe(false);
  expect(ensureResearchQuestions(outputs.planner, product, false, description).steps[0].researchQuestions).toEqual([]);
  expect(needsExternalEvidence("Compare the best current printers to buy", product)).toBe(true);
  expect(needsExternalEvidence("What is the current official price of this printer? No web research", product)).toBe(true);
  expect(needsExternalEvidence("Zjisti cenu vstupného do muzea.", problem)).toBe(true);
});
