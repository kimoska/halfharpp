import type { ResearchConfig, ResearchLead } from "../research-types.js";

const SAVING_TERMS = ["절약", "생활비", "가격", "가성비", "쿠폰", "무료배송", "대용량", "소비기한", "보관", "자취", "1인가구", "구독", "전기요금", "할인"];

function ageDays(value: string | undefined, now: Date): number | undefined {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.max(0, (now.getTime() - time) / 86_400_000) : undefined;
}

export function scoreLead(lead: ResearchLead, config: ResearchConfig, now = new Date()): ResearchLead {
  const haystack = `${lead.title} ${lead.excerpt}`.toLowerCase();
  const reasons: string[] = [];
  let score = 0;
  const termHits = SAVING_TERMS.filter((term) => haystack.includes(term)).length;
  const queryHits = config.queries.filter((term) => haystack.includes(term.replace(/\s+/g, "")) || haystack.includes(term)).length;
  const relevance = Math.min(35, termHits * 6 + queryHits * 3);
  score += relevance;
  if (relevance) reasons.push(`절약 연관어 ${termHits}개`);

  const days = ageDays(lead.publishedAt, now);
  const freshness = days === undefined ? 5 : days <= 2 ? 20 : days <= 7 ? 15 : days <= config.staleAfterDays ? 8 : 0;
  score += freshness;
  reasons.push(days === undefined ? "게시일 미상" : `${Math.floor(days)}일 전 게시`);

  const evidence = lead.sourceTier === 1 ? 30 : lead.sourceTier === 2 ? 20 : 8;
  score += evidence;
  reasons.push(`출처 등급 ${lead.sourceTier}`);

  if (/\d[\d,.]*\s*(원|%|개|g|kg|ml|l|개월|일|시간)/i.test(haystack)) {
    score += 10;
    reasons.push("계산 가능한 숫자 포함");
  }
  if (/[?？]|어떻게|왜|후회|실수|함정|비교/.test(haystack)) {
    score += 5;
    reasons.push("문제·질문 구조");
  }
  if ((lead.engagement ?? 0) >= 100) {
    score += 5;
    reasons.push("반응 신호 있음");
  }
  return { ...lead, score: Math.min(100, score), scoreReasons: reasons };
}

