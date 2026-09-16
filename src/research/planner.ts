import type { EditorialBrief, ResearchLead } from "../research-types.js";
import type { Product } from "../types.js";
import { sha256 } from "../utils.js";

function outputText(payload: unknown): string {
  const response = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (response.output_text) return response.output_text;
  for (const item of response.output ?? []) for (const content of item.content ?? []) if (content.type === "output_text" && content.text) return content.text;
  throw new Error("기획 API 응답에서 JSON 문안을 찾지 못했습니다.");
}

function makeBriefSchema(affiliate: boolean) { return {
  type: "object",
  properties: {
    pillar: { type: "string", enum: affiliate ? ["affiliate"] : ["info", "relatable", "community"] },
    topic: { type: "string", maxLength: 60 },
    angle: { type: "string", maxLength: 120 },
    audienceProblem: { type: "string", maxLength: 160 },
    oneLineValue: { type: "string", maxLength: 120 },
    evidence: { type: "array", items: { type: "object", properties: {
      title: { type: "string" }, url: { type: "string" }, publisher: { type: "string" }, publishedAt: { type: "string" }, claim: { type: "string" }, sourceTier: { type: "integer", enum: [1, 2] }
    }, required: ["title", "url", "publisher", "publishedAt", "claim", "sourceTier"], additionalProperties: false } },
    calculations: { type: "array", items: { type: "object", properties: {
      label: { type: "string" }, formula: { type: "string" }, result: { type: "string" }, inputs: { type: "object", additionalProperties: { anyOf: [{ type: "number" }, { type: "string" }] } }
    }, required: ["label", "formula", "result", "inputs"], additionalProperties: false } },
    cardCountReason: { type: "string", minLength: 10, maxLength: 160 },
    slides: { type: "array", minItems: 2, maxItems: 10, items: { type: "object", properties: {
      order: { type: "integer" }, role: { type: "string", enum: ["hook", "problem", "evidence", "calculation", "action", "question", "product"] }, headline: { type: "string", maxLength: 36 }, body: { type: "string", maxLength: 120 }, visualDirection: { type: "string", maxLength: 120 }
    }, required: ["order", "role", "headline", "body", "visualDirection"], additionalProperties: false } },
    caption: { type: "string", maxLength: 500 },
    cta: { type: "string", maxLength: 80 },
    risks: { type: "array", items: { type: "string" } }
  },
  required: ["pillar", "topic", "angle", "audienceProblem", "oneLineValue", "evidence", "calculations", "cardCountReason", "slides", "caption", "cta", "risks"],
  additionalProperties: false
} as const; }

export async function generateEditorialBrief(leads: ResearchLead[], now = new Date(), product?: Product): Promise<EditorialBrief> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY가 없어 기획안 생성을 실행할 수 없습니다.");
  if (leads.length === 0) throw new Error("기획에 사용할 소재가 없습니다.");
  const model = process.env.OPENAI_MODEL_QUALITY || "gpt-6-astra";
  const sourceBundle = leads.slice(0, 12).map((lead) => ({
    id: lead.id,
    source: lead.source,
    sourceTier: lead.sourceTier,
    title: lead.title,
    excerpt: lead.excerpt,
    url: lead.canonicalUrl,
    publishedAt: lead.publishedAt,
    verification: lead.verification
  }));
  const productBundle = product ? {
    id: product.id,
    name: product.name,
    price: product.price,
    originalPrice: product.originalPrice,
    discountRate: product.discountRate,
    reviewScore: product.reviewScore,
    reviewCount: product.reviewCount,
    rank: product.rank,
    priceCheckedAt: product.priceCheckedAt,
    affiliateUrl: product.affiliateUrl
  } : undefined;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 5000,
      input: [
        { role: "developer", content: `당신은 한국 생활비 절약 전문 편집자입니다. SNS 글은 문제를 발견하는 신호일 뿐 사실 근거가 아닙니다. 제공된 자료와 상품 스냅샷 밖의 숫자·효능·체험을 만들지 마세요. 원문 문장을 복사하지 말고 완전히 새로 구성하세요. 흔한 조언 대신 구체적인 문제, 계산, 실행 규칙을 만드세요. 하프물범 모하프는 쿠폰과 무료배송 앞에서 엉뚱한 실수를 하지만 계산으로 바로잡습니다. 카드 수는 2~10장 안에서 내용에 맞는 최소 장수로 정하세요. 정해진 역할 순서를 반복하지 말고, 각 카드는 앞 카드에 없던 판단 근거·계산·행동 중 하나를 추가해야 합니다. 짧은 주제를 장수에 맞춰 늘이거나 서로 다른 내용을 한 카드에 억지로 압축하지 마세요. 선택한 장수가 필요한 이유를 cardCountReason에 적으세요.${product ? " 이 글은 제휴 콘텐츠이므로 누구에게 맞고 누구에게 불필요한지, 가격·옵션 재확인과 광고 고지 계획을 risks에 반드시 넣으세요." : ""}` },
        { role: "user", content: `다음 수집 자료로 저장·공유할 가치가 있는 카드뉴스 기획안을 하나 만드세요. 1~2등급 근거가 없으면 일반 수치 주장을 만들지 말고 risks에 필요한 검증을 적으세요. 게시 기준일: ${now.toISOString()}\n자료:\n${JSON.stringify(sourceBundle)}\n상품 스냅샷:\n${JSON.stringify(productBundle ?? "없음")}` }
      ],
      text: { format: { type: "json_schema", name: "moharp_editorial_brief", strict: true, schema: makeBriefSchema(Boolean(product)) } }
    })
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenAI 기획 API 실패(${response.status}): ${raw}`);
  const generated = JSON.parse(outputText(JSON.parse(raw))) as Omit<EditorialBrief, "id" | "leadIds" | "status" | "createdAt" | "updatedAt">;
  const stamp = now.toISOString();
  const hasEvidence = generated.evidence.some((item) => item.sourceTier <= 2);
  return {
    ...generated,
    id: sha256(`${generated.topic}|${stamp}`).slice(0, 18),
    leadIds: leads.map((lead) => lead.id),
    productId: product?.id,
    status: hasEvidence || product ? "draft" : "needs_evidence",
    createdAt: stamp,
    updatedAt: stamp
  };
}
