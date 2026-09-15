import type { Pillar } from "./types.js";

export type ResearchSource =
  | "threads"
  | "naver_blog"
  | "naver_cafe"
  | "naver_news"
  | "youtube"
  | "openai_web"
  | "official"
  | "manual";

export type VerificationState = "unverified" | "supported" | "contradicted";
export type BriefStatus = "needs_evidence" | "ready_for_editorial" | "draft" | "approved" | "rejected";

export interface ResearchConfig {
  queries: string[];
  maxItemsPerQuery: number;
  maxExcerptChars: number;
  staleAfterDays: number;
  minLeadScore: number;
  maxLeadsPerRun: number;
  primaryDomains: string[];
  sources: {
    naverBlog: boolean;
    naverCafe: boolean;
    naverNews: boolean;
    youtube: boolean;
    threads: boolean;
    openaiWebSearch?: boolean;
  };
}

export interface ResearchLead {
  id: string;
  source: ResearchSource;
  query: string;
  title: string;
  excerpt: string;
  url: string;
  canonicalUrl: string;
  author?: string;
  publishedAt?: string;
  discoveredAt: string;
  engagement?: number;
  sourceTier: 1 | 2 | 3;
  score: number;
  scoreReasons: string[];
  verification: VerificationState;
  duplicateOf?: string;
}

export interface SourceDiagnostic {
  source: ResearchSource;
  status: "ok" | "skipped" | "failed";
  collected: number;
  message: string;
}

export interface ResearchRun {
  id: string;
  startedAt: string;
  finishedAt: string;
  collected: number;
  accepted: number;
  duplicates: number;
  diagnostics: SourceDiagnostic[];
}

export interface Evidence {
  title: string;
  url: string;
  publisher: string;
  publishedAt?: string;
  claim: string;
  sourceTier: 1 | 2;
}

export interface Calculation {
  label: string;
  formula: string;
  result: string;
  inputs: Record<string, number | string>;
}

export interface CardSlide {
  order: number;
  role: "hook" | "problem" | "evidence" | "calculation" | "action" | "question" | "product";
  headline: string;
  body: string;
  visualDirection: string;
}

export interface EditorialBrief {
  id: string;
  pillar: Pillar;
  topic: string;
  angle: string;
  audienceProblem: string;
  oneLineValue: string;
  leadIds: string[];
  productId?: string;
  evidence: Evidence[];
  calculations: Calculation[];
  slides: CardSlide[];
  caption: string;
  cta: string;
  risks: string[];
  status: BriefStatus;
  createdAt: string;
  updatedAt: string;
}
