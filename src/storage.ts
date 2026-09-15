import fs from "node:fs/promises";
import path from "node:path";
import type { AutomationConfig, BrandConfig, ContentSeed, Product, QueuePost } from "./types.js";
import type { EditorialBrief, ResearchConfig, ResearchLead, ResearchRun } from "./research-types.js";
import { paths } from "./paths.js";

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, "utf8")) as T;
}

export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temp, file);
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"' && line[index + 1] === '"' && quoted) {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

export async function loadProducts(): Promise<Product[]> {
  const raw = (await fs.readFile(paths.products, "utf8")).replace(/^\uFEFF/, "").trim();
  if (!raw) return [];
  const [headerLine, ...rows] = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(headerLine!);
  return rows.map((row) => {
    const values = parseCsvLine(row);
    const item = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    return {
      id: item.id ?? "",
      name: item.name ?? "",
      category: item.category ?? "",
      affiliateUrl: item.affiliate_url ?? "",
      price: Number(item.price || 0),
      priceCheckedAt: item.price_checked_at ?? "",
      active: (item.active ?? "").toLowerCase() === "true",
      notes: item.notes ?? ""
    };
  });
}

export const loadBrand = () => readJson<BrandConfig>(paths.brand);
export const loadAutomation = () => readJson<AutomationConfig>(paths.automation);
export const loadSeeds = () => readJson<ContentSeed[]>(paths.seeds);
export const loadQueue = () => readJson<QueuePost[]>(paths.queue);
export const saveQueue = (queue: QueuePost[]) => writeJsonAtomic(paths.queue, queue);
export const loadResearchConfig = () => readJson<ResearchConfig>(paths.researchConfig);
export const loadResearchLeads = () => readJson<ResearchLead[]>(paths.researchLeads).catch(() => [] as ResearchLead[]);
export const saveResearchLeads = (leads: ResearchLead[]) => writeJsonAtomic(paths.researchLeads, leads);
export const loadResearchBriefs = () => readJson<EditorialBrief[]>(paths.researchBriefs).catch(() => [] as EditorialBrief[]);
export const saveResearchBriefs = (briefs: EditorialBrief[]) => writeJsonAtomic(paths.researchBriefs, briefs);
export const loadResearchRuns = () => readJson<ResearchRun[]>(paths.researchRuns).catch(() => [] as ResearchRun[]);
export const saveResearchRuns = (runs: ResearchRun[]) => writeJsonAtomic(paths.researchRuns, runs);

export async function appendLog(event: Record<string, unknown>): Promise<void> {
  await fs.mkdir(paths.logs, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  await fs.appendFile(path.join(paths.logs, `${date}.log`), `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, "utf8");
}
