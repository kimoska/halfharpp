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
  const makesFactualClaims = brief.calculations.length > 0 || brief.slides.some((slide) => /\d[\d,.]*\s*(원|%|개|g|kg|ml|l|일|개월|시간)/i.test(`${slide.headline} ${slide.body}`));
  if (!makesFactualClaims || brief.evidence.some((item) => item.sourceTier <= 2)) score += 20;
  if (brief.slides.some((slide) => slide.role === "hook")) score += 10;
  if (brief.slides.some((slide) => slide.role === "action")) score += 15;
  if (brief.slides.some((slide) => slide.role === "question") || /[?？]/.test(brief.cta)) score += 10;
  if ((brief.cardCountReason?.trim().length ?? 0) >= 10) score += 10;
  if (new Set(brief.slides.map((slide) => `${slide.headline.replace(/\s+/g, "")}\n${slide.body.replace(/\s+/g, "")}`)).size === brief.slides.length) score += 5;
  return score;
}

export function validateBrief(brief: EditorialBrief, leads?: ResearchLead[], products: import("../types.js").Product[] = []): ResearchValidationIssue[] {
  const issues: ResearchValidationIssue[] = [];
  const fullCopy = [brief.topic, brief.angle, brief.oneLineValue, brief.caption, brief.cta, ...brief.slides.flatMap((slide) => [slide.headline, slide.body])].join(" ");
  const aiCliche = /(현명한\s*(소비|선택)|똑똑한\s*(소비|선택)|한눈에\s*(확인|정리)|꼭\s*기억해\s*두세요|도움이\s*될\s*거예요|알아두면\s*좋아요|지금부터\s*알아볼까요|꿀팁을\s*소개)/;
  const depthSignals = [
    brief.calculations.length > 0,
    /(보다|초과|미만|이상|이하|이면|경우|기준|차이|합계|총액|정산)/.test(fullCopy),
    /(다만|예외|달라|제외|포함|해지|위약|환급|실제|계약)/.test(fullCopy),
    /(문서|청구서|견적서|문자|메일|조회|적어|계산|비교|요청)/.test(fullCopy)
  ].filter(Boolean).length;
  if (brief.slides.length < 2 || brief.slides.length > 10) issues.push({ level: "error", code: "SLIDE_COUNT", message: "카드뉴스는 내용에 따라 2~10장으로 구성해야 합니다.", id: brief.id });
  if (!brief.cardCountReason?.trim() || brief.cardCountReason.trim().length < 10) issues.push({ level: "error", code: "CARD_COUNT_REASON_MISSING", message: "이 장수가 필요한 편집상 이유가 없습니다.", id: brief.id });
  if (brief.slides.some((slide, index) => slide.order !== index + 1)) issues.push({ level: "error", code: "SLIDE_ORDER", message: "슬라이드 순번이 연속적이지 않습니다.", id: brief.id });
  if (brief.slides.some((slide) => slide.headline.length > 36 || slide.body.length > 120)) issues.push({ level: "error", code: "SLIDE_COPY_TOO_LONG", message: "슬라이드 문구가 화면 기준을 초과했습니다.", id: brief.id });
  const slideCopies = brief.slides.map((slide) => `${slide.headline.replace(/\s+/g, "")}\n${slide.body.replace(/\s+/g, "")}`);
  if (new Set(slideCopies).size !== slideCopies.length) issues.push({ level: "error", code: "SLIDE_REDUNDANT", message: "같은 내용을 반복하는 카드가 있습니다. 합치거나 삭제하세요.", id: brief.id });
  if (!brief.slides.some((slide) => slide.role === "action" || slide.role === "question")) issues.push({ level: "error", code: "ACTION_MISSING", message: "독자가 실행하거나 답할 항목이 없습니다.", id: brief.id });
  const makesFactualClaims = brief.calculations.length > 0 || brief.slides.some((slide) => /\d[\d,.]*\s*(원|%|개|g|kg|ml|l|일|개월|시간)/i.test(`${slide.headline} ${slide.body}`));
  if (makesFactualClaims && !brief.evidence.some((item) => item.sourceTier <= 2)) issues.push({ level: "error", code: "EVIDENCE_REQUIRED", message: "숫자·사실 주장을 뒷받침하는 1~2등급 근거가 없습니다.", id: brief.id });
  if (brief.pillar === "affiliate" && !brief.risks.some((risk) => /광고|제휴|수수료/.test(risk))) issues.push({ level: "error", code: "AFFILIATE_DISCLOSURE_PLAN_MISSING", message: "제휴 표시 계획이 없습니다.", id: brief.id });
  if (brief.pillar === "affiliate") {
    const product = products.find((item) => item.id === brief.productId && item.active);
    if (!product) issues.push({ level: "error", code: "AFFILIATE_PRODUCT_MISSING", message: "활성 상품 스냅샷과 연결되지 않은 제휴 기획안입니다.", id: brief.id });
  }
  if (!brief.oneLineValue.trim()) issues.push({ level: "error", code: "VALUE_EMPTY", message: "독자가 얻는 한 줄 가치가 없습니다.", id: brief.id });
  if (aiCliche.test(fullCopy)) issues.push({ level: "error", code: "AI_CLICHE_COPY", message: "AI식 상투어 대신 구체적인 사실·행동·판단 기준으로 다시 쓰세요.", id: brief.id });
  if (depthSignals < 2) issues.push({ level: "error", code: "DEPTH_SIGNAL_MISSING", message: "계산·판단 기준·예외 조건·복사 가능한 행동 중 두 가지 이상이 필요합니다.", id: brief.id });
  if (scoreBriefQuality(brief) < 75) issues.push({ level: "error", code: "BRIEF_QUALITY_LOW", message: "문제·근거·실행·질문의 기획 품질 점수가 75점 미만입니다.", id: brief.id });
  if (leads) {
    const allowed = new Set(leads.filter((lead) => brief.leadIds.includes(lead.id)).map((lead) => lead.canonicalUrl));
    for (const evidence of brief.evidence) {
      if (!allowed.has(evidence.url)) issues.push({ level: "error", code: "EVIDENCE_NOT_IN_RESEARCH", message: "수집 자료에 없는 근거 URL이 기획안에 들어갔습니다.", id: brief.id });
    }
  }
  return issues;
}
