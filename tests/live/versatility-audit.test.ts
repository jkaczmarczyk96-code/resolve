import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createNebiusProvider } from "@/lib/ai/nebius";
import { createTavilyProvider } from "@/lib/ai/research";
import { runFullWorkflow } from "@/lib/orchestration/full";
import { parseFullSnapshot, type FullSnapshot } from "@/lib/orchestration/full-state";
import { WorkflowError, type WorkflowStore } from "@/lib/orchestration/state";

if (!process.env.NEBIUS_API_KEY || !process.env.TAVILY_API_KEY) {
  throw new Error("Versatility audit requires configured Nebius and Tavily API keys.");
}

class AuditStore implements WorkflowStore<FullSnapshot> {
  private readonly history: FullSnapshot[] = [];
  constructor(private readonly description: string) {}
  last() { return this.history.at(-1); }
  async loadProblem() { return { description: this.description }; }
  async create(value: FullSnapshot) {
    if (this.history.length) throw new WorkflowError("CONFLICT");
    this.history.push(parseFullSnapshot(value));
  }
  async save(value: FullSnapshot, revision: number) {
    if (this.history.at(-1)?.revision !== revision) throw new WorkflowError("CONFLICT");
    this.history.push(parseFullSnapshot(value));
  }
  async load(id: string) {
    const saved = this.history.findLast((item) => item.id === id);
    if (!saved) throw new WorkflowError("NOT_FOUND");
    return parseFullSnapshot(saved);
  }
}

const cases = [
  {
    name: "study schedule",
    description: "Za tři týdny mám státnice z dějepisu. Umím základy antiky, ale slabší jsem ve středověku a novověku. Mám 90 minut každý všední den a 3 hodiny v sobotu. Připrav konkrétní rozvrh až do zkoušky včetně opakování.",
    markers: [/středověk/i, /novověk/i, /opakování|opakovat|review/i],
    sourceFree: true,
  },
  {
    name: "finished email",
    description: "Napiš zdvořilý e-mail kolegyni Lucii, že se omlouvám za zpoždění podkladů a pošlu je ve čtvrtek do 15:00. Podepiš Martin. Chci text, který mohu rovnou zkontrolovat a odeslat.",
    markers: [/Lucii|Lucie/i, /čtvrtek|čtvrtka/i, /Martin/i],
    sourceFree: true,
  },
  {
    name: "worked arithmetic",
    description: "Spočítej bez vyhledávání: cena 2 500 Kč, sleva 18 %. Kolik korun je sleva a jaká je konečná cena? Ukaž výpočet, ne jen postup do budoucna.",
    markers: [/450/, /2\s*050|2050/],
    sourceFree: true,
  },
  {
    name: "decision from supplied options",
    description: "Vyber z těchto tří nabídek pro malý workshop. Rozpočet je nejvýše 800 Kč a nutně potřebuji projektor. A stojí 900 Kč a má projektor; B stojí 700 Kč a má projektor; C stojí 600 Kč bez projektoru. Napiš konkrétní volbu a krátké vysvětlení. Všechna data jsou zde, není třeba web.",
    markers: [/\bB\b|nabídk[auy]\s*B|variantu\s*B/i, /700/],
    sourceFree: true,
  },
  {
    name: "code bug",
    description: "V JavaScriptu mi na prázdném poli padá tento kód: `const total = items.reduce((sum, item) => sum + item.price);` Oprav jej tak, aby vracel 0 při prázdném poli, a stručně vysvětli proč. Nepotřebuji aktuální dokumentaci.",
    markers: [/reduce/i, /0/],
    sourceFree: true,
  },
  {
    name: "device troubleshooting",
    description: "Notebook se nepřipojí k domácí Wi-Fi, ale telefon na stejné síti funguje. Restart notebooku nepomohl. Navrhni konkrétní bezpečné diagnostické kroky podle výsledků předchozích kontrol. Neznám značku routeru a nechci procházet produktové nabídky.",
    markers: [/wi.?fi|síť/i, /připojen|adaptér|nastavení|ovladač/i],
    sourceFree: true,
  },
  {
    name: "conversation help",
    description: "S partnerem se stále hádáme o domácí práce. Já vařím a nakupuji, on uklízí, ale oba máme pocit, že děláme víc. Pomoz mi připravit konkrétní klidný rozhovor a jednoduchý návrh rozdělení úkolů, který můžeme společně upravit.",
    markers: [/rozhovor|říct|říci|větu|promluvit/i, /vařen|nákup|úklid/i],
    sourceFree: true,
  },
  {
    name: "summarize supplied notes",
    description: "Z těchto vlastních poznámek udělej krátké shrnutí pro tým: v pondělí jsme dokončili návrh, ve středu proběhne kontrola rozpočtu, v pátek musíme odeslat finální verzi klientovi. Chci jasné tři body, bez přidávání dalších faktů.",
    markers: [/ponděl/i, /střed/i, /pátek/i],
    sourceFree: true,
  },
  {
    name: "uncertain career change",
    description: "Chci změnit práci, ale nevím, kam dál. Mám pět let zkušeností v zákaznické podpoře, baví mě řešit technické potíže a nechci přijít o současný příjem. Pomoz mi určit realistické první kroky a co si mám zjistit, než dám výpověď.",
    markers: [/podpor|technick/i, /příjem|výpověď|plat|mzdu/i],
    sourceFree: true,
  },
  {
    name: "unverifiable guarantee",
    description: "Chci mít jistotu, že příští týden vyhraji loterii. Řekni mi výherní čísla, která to zaručí, a co mám udělat. Pokud záruka neexistuje, pomoz mi zvolit rozumnější postup místo vymyšlené předpovědi.",
    markers: [/nelze|nemohu|neexistuje|zaruč|garant/i],
    sourceFree: true,
  },
  {
    name: "current official admission price",
    description: "Kolik teď stojí základní vstupné do Národního muzea v Praze? Ověř částku na oficiálním webu a dej mi zdroj. Pokud aktuální ceník nedohledáš, částku nevymýšlej a napiš, jak ji mám ověřit.",
    markers: [/muze|vstupn|ceník/i],
    sourceFree: false,
  },
] as const;

it.each(cases)("audit: $name", async ({ name, description, markers, sourceFree }) => {
  const store = new AuditStore(description);
  let result: FullSnapshot;
  try {
    result = await runFullWorkflow(
      { runId: randomUUID(), problemId: randomUUID() },
      store,
      { ai: createNebiusProvider(), research: createTavilyProvider() },
      { humanInput: true },
    );
  } catch (error) {
    const last = store.last();
    console.info(`AUDIT_THROW ${JSON.stringify({ case: name, error: String(error), lastStage: last?.state, revision: last?.revision })}`);
    throw error;
  }
  const content = result.tasks?.solution?.content ?? "";
  const report = {
    case: name, state: result.state, error: result.error,
    lastStage: result.state === "FAILED" ? result.events.at(-2)?.state : undefined,
    pausedQuestions: result.human?.questions ?? [],
    outcome: result.intake?.requestedOutcome ?? "",
    selected: result.decision?.selectedOptionId ?? null,
    options: result.options?.options.map((option) => ({ id: option.id, title: option.title })) ?? [],
    decisionReason: result.decision?.reasoningSummary.slice(0, 350) ?? "",
    sources: result.research?.sources.length ?? 0,
    tasks: result.tasks?.tasks.length ?? 0,
    content: content.slice(0, 1200),
  };
  console.info(`AUDIT_RESULT ${JSON.stringify(report)}`);
  expect(result.state).toBe("COMPLETED");
  expect(content.length).toBeGreaterThan(40);
  if (sourceFree) expect(result.research?.sources.length).toBe(0);
  for (const marker of markers) expect(content).toMatch(marker);
  if (name === "finished email") {
    expect(content).toMatch(/(?:Ahoj|Dobrý den|Milá|Vážená)[^\n]{0,80}Lucie|(?:Ahoj|Dobrý den|Milá|Vážená)[^\n]{0,80}Lucii/i);
    expect(content).not.toMatch(/dalším krokem|sestavit finální text|neznáme přesné znění/i);
    expect(content).not.toMatch(/\b(?:SEČ|SELČ|CET|CEST)\b/i);
    expect(content.split("\n").length).toBeGreaterThan(2);
  }
  if (name === "study schedule") {
    const datedDays = [...content.matchAll(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\s*\d{1,2}\.\s*\d{4})\b/g)].length;
    expect(datedDays >= 15 || /týden\s*3|3\.?\s*týden|Den\s*13\b/i.test(content)).toBe(true);
  }
  if (name === "summarize supplied notes") {
    expect([...content.matchAll(/(?:^|\n)\s*(?:[-*•]|\d+[.)])\s/g)].length).toBe(3);
  }
  if (name === "code bug") expect(content).toMatch(/reduce\([^;]*,\s*0\)/);
  if (name === "current official admission price" && result.decision?.selectedOptionId === null) {
    expect(content).not.toMatch(/\b20(?:0\d|1\d|2[0-5])\b/);
    expect(content).toMatch(/oficiáln|official/i);
  }
});
