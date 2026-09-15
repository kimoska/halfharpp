import { sha256 } from "../utils.js";
import type { ResearchLead, ResearchSource } from "../research-types.js";

const TRACKING_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"]);

export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function compactExcerpt(value: string, maxChars: number): string {
  const clean = stripHtml(value);
  return clean.length <= maxChars ? clean : `${clean.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function makeLead(input: {
  source: ResearchSource;
  query: string;
  title: string;
  excerpt?: string;
  url: string;
  author?: string;
  publishedAt?: string;
  engagement?: number;
  sourceTier?: 1 | 2 | 3;
  maxExcerptChars: number;
  discoveredAt?: string;
}): ResearchLead {
  const title = stripHtml(input.title);
  const canonicalUrl = canonicalizeUrl(input.url);
  const sourceTier = input.sourceTier ?? (input.source === "official" ? 1 : input.source === "naver_news" ? 2 : 3);
  return {
    id: sha256(`${input.source}|${canonicalUrl}|${title}`).slice(0, 20),
    source: input.source,
    query: input.query,
    title,
    excerpt: compactExcerpt(input.excerpt ?? "", input.maxExcerptChars),
    url: input.url,
    canonicalUrl,
    author: input.author ? stripHtml(input.author) : undefined,
    publishedAt: input.publishedAt,
    discoveredAt: input.discoveredAt ?? new Date().toISOString(),
    engagement: input.engagement,
    sourceTier,
    score: 0,
    scoreReasons: [],
    verification: sourceTier === 1 ? "supported" : "unverified"
  };
}

export function deduplicateLeads(leads: ResearchLead[]): { unique: ResearchLead[]; duplicates: ResearchLead[] } {
  const seenUrl = new Map<string, string>();
  const seenTitle = new Map<string, string>();
  const unique: ResearchLead[] = [];
  const duplicates: ResearchLead[] = [];
  for (const lead of leads) {
    const titleKey = lead.title.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
    const duplicateOf = seenUrl.get(lead.canonicalUrl) ?? (titleKey.length >= 12 ? seenTitle.get(titleKey) : undefined);
    if (duplicateOf) {
      duplicates.push({ ...lead, duplicateOf });
      continue;
    }
    seenUrl.set(lead.canonicalUrl, lead.id);
    if (titleKey.length >= 12) seenTitle.set(titleKey, lead.id);
    unique.push(lead);
  }
  return { unique, duplicates };
}

