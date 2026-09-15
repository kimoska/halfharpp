import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");
export const paths = {
  brand: path.join(ROOT, "config", "brand.json"),
  automation: path.join(ROOT, "config", "automation.json"),
  products: path.join(ROOT, "data", "products.csv"),
  seeds: path.join(ROOT, "data", "content-seeds.json"),
  queue: path.join(ROOT, "data", "queue.json"),
  metrics: path.join(ROOT, "data", "metrics.json"),
  assets: path.join(ROOT, "assets", "moharp"),
  generated: path.join(ROOT, "public", "generated"),
  researchConfig: path.join(ROOT, "config", "research.json"),
  researchLeads: path.join(ROOT, "data", "research", "leads.json"),
  researchBriefs: path.join(ROOT, "data", "research", "briefs.json"),
  researchRuns: path.join(ROOT, "data", "research", "runs.json"),
  tossProducts: path.join(ROOT, "data", "toss", "products.json"),
  tossLinks: path.join(ROOT, "data", "toss", "links.json"),
  logs: path.join(ROOT, "logs")
};
