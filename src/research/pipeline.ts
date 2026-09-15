import type { EditorialBrief, ResearchConfig, ResearchLead, ResearchRun, SourceDiagnostic } from "../research-types.js";
import { sha256 } from "../utils.js";
import { deduplicateLeads } from "./normalize.js";
import { scoreLead } from "./score.js";

export function mergeAndRankLeads(
  existing: ResearchLead[],
  collected: ResearchLead[],
  config: ResearchConfig,
  now = new Date(),
): { leads: ResearchLead[]; accepted: number; duplicates: number } {
  const byId = new Map(existing.map((lead) => [lead.id, lead]));
  const scored = collected.map((lead) => scoreLead(lead, config, now));
  const { unique, duplicates } = deduplicateLeads([...existing, ...scored]);
  for (const lead of unique) {
    const old = byId.get(lead.id);
    byId.set(lead.id, old ? { ...lead, verification: old.verification } : lead);
  }
  const leads = [...byId.values()]
    .sort((a, b) => b.score - a.score || b.discoveredAt.localeCompare(a.discoveredAt))
    .slice(0, config.maxLeadsPerRun * 10);
  const acceptedIds = new Set(scored.filter((lead) => lead.score >= config.minLeadScore).map((lead) => lead.id));
  return { leads, accepted: acceptedIds.size, duplicates: duplicates.length };
}

export function makeResearchRun(
  startedAt: string,
  finishedAt: string,
  collected: number,
  accepted: number,
  duplicates: number,
  diagnostics: SourceDiagnostic[],
): ResearchRun {
  return {
    id: sha256(`${startedAt}|${finishedAt}|${collected}`).slice(0, 16),
    startedAt,
    finishedAt,
    collected,
    accepted,
    duplicates,
    diagnostics
  };
}

function host(value: string): string {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

export interface ResearchValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  id?: string;
}

export function validateLead(lead: ResearchLead, config: ResearchConfig): ResearchValidationIssue[] {
  const issues: ResearchValidationIssue[] = [];
  if (!/^https?:\/\//.test(lead.url)) issues.push({ level: "error", code: "LEAD_URL_INVALID", message: "HTTP(S) 원문 링크가 없습니다.", id: lead.id });
  if (!lead.title.trim()) issues.push({ level: "error", code: "LEAD_TITLE_EMPTY", message: "제목이 없습니다.", id: lead.id });
  if (lead.excerpt.length > config.maxExcerptChars) issues.push({ level: "error", code: "EXCERPT_TOO_LONG", message: "원문 요약 저장 한도를 초과했습니다.", id: lead.id });
  if (lead.sourceTier === 1 && !config.primaryDomains.some((domain) => host(lead.url) === domain || host(lead.url).endsWith(`.${domain}`))) {
    issues.push({ level: "error", code: "PRIMARY_DOMAIN_MISMATCH", message: "1등급 출처가 허용된 공식 도메인이 아닙니다.", id: lead.id });
  }
  if (lead.score < config.minLeadScore) issues.push({ level: "warning", code: "LEAD_SCORE_LOW", message: `소재 점수가 기준(${config.minLeadScore})보다 낮습니다.`, id: lead.id });
  return issues;
}

export function scoreBriefQuality(brief: EditorialBrief): number {
  let score = 0;
  if (brief.audienceProblem.trim().length >= 20) score += 15;
  if (brief.oneLineValue.trim().length >= 20) score += 15;
  if (brief.evidence.some((item) => item.sourceTier <= 2)) score += 25;
  if (brief.slides.length >= 5 && new Set(brief.slides.map((slide) => slide.role)).size >= 4) score += 20;
  if (brief.slides.some((slide) => slide.role === "action")) score += 15;
  if (brief.slides.some((slide) => slide.role === "question") || /[?？]/.test(brief.cta)) score += 10;
  return score;
}

export function validateBrief(brief: EditorialBrief, leads?: ResearchLead[]): ResearchValidationIssue[] {
  const issues: ResearchValidationIssue[] = [];
  if (brief.slides.length < 4 || brief.slides.length > 7) issues.push({ level: "error", code: "SLIDE_COUNT", message: "카드뉴스는 4~7장이어야 합니다.", id: brief.id });
  if (brief.slides.some((slide, index) => slide.order !== index + 1)) issues.push({ level: "error", code: "SLIDE_ORDER", message: "슬라이드 순번이 연속적이지 않습니다.", id: brief.id });
  if (brief.slides.some((slide) => slide.headline.length > 36 || slide.body.length > 120)) issues.push({ level: "error", code: "SLIDE_COPY_TOO_LONG", message: "슬라이드 문구가 화면 기준을 초과했습니다.", id: brief.id });
  if (!brief.slides.some((slide) => slide.role === "action" || slide.role === "question")) issues.push({ level: "error", code: "ACTION_MISSING", message: "독자가 실행하거나 답할 항목이 없습니다.", id: brief.id });
  const makesFactualClaims = brief.calculations.length > 0 || brief.slides.some((slide) => /\d[\d,.]*\s*(원|%|개|g|kg|ml|l|일|개월|시간)/i.test(`${slide.headline} ${slide.body}`));
  if (makesFactualClaims && !brief.evidence.some((item) => item.sourceTier <= 2)) issues.push({ level: "error", code: "EVIDENCE_REQUIRED", message: "숫자·사실 주장을 뒷받침하는 1~2등급 근거가 없습니다.", id: brief.id });
  if (brief.pillar === "affiliate" && !brief.risks.some((risk) => /광고|제휴|수수료/.test(risk))) issues.push({ level: "error", code: "AFFILIATE_DISCLOSURE_PLAN_MISSING", message: "제휴 표시 계획이 없습니다.", id: brief.id });
  if (!brief.oneLineValue.trim()) issues.push({ level: "error", code: "VALUE_EMPTY", message: "독자가 얻는 한 줄 가치가 없습니다.", id: brief.id });
  if (scoreBriefQuality(brief) < 75) issues.push({ level: "error", code: "BRIEF_QUALITY_LOW", message: "문제·근거·실행·질문의 기획 품질 점수가 75점 미만입니다.", id: brief.id });
  if (leads) {
    const allowed = new Set(leads.filter((lead) => brief.leadIds.includes(lead.id)).map((lead) => lead.canonicalUrl));
    for (const evidence of brief.evidence) {
      if (!allowed.has(evidence.url)) issues.push({ level: "error", code: "EVIDENCE_NOT_IN_RESEARCH", message: "수집 자료에 없는 근거 URL이 기획안에 들어갔습니다.", id: brief.id });
    }
  }
  return issues;
}
