import type { EditorialBrief, ResearchLead } from "../research-types.js";
import { sha256 } from "../utils.js";

function outputText(payload: unknown): string {
  const response = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (response.output_text) return response.output_text;
  for (const item of response.output ?? []) for (const content of item.content ?? []) if (content.type === "output_text" && content.text) return content.text;
  throw new Error("기획 API 응답에서 JSON 문안을 찾지 못했습니다.");
}

const briefSchema = {
  type: "object",
  properties: {
    pillar: { type: "string", enum: ["info", "relatable", "community"] },
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
    slides: { type: "array", minItems: 5, maxItems: 6, items: { type: "object", properties: {
      order: { type: "integer" }, role: { type: "string", enum: ["hook", "problem", "evidence", "calculation", "action", "question"] }, headline: { type: "string", maxLength: 36 }, body: { type: "string", maxLength: 120 }, visualDirection: { type: "string", maxLength: 120 }
    }, required: ["order", "role", "headline", "body", "visualDirection"], additionalProperties: false } },
    caption: { type: "string", maxLength: 500 },
    cta: { type: "string", maxLength: 80 },
    risks: { type: "array", items: { type: "string" } }
  },
  required: ["pillar", "topic", "angle", "audienceProblem", "oneLineValue", "evidence", "calculations", "slides", "caption", "cta", "risks"],
  additionalProperties: false
} as const;

export async function generateEditorialBrief(leads: ResearchLead[], now = new Date()): Promise<EditorialBrief> {
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
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 5000,
      input: [
        { role: "developer", content: `당신은 한국 생활비 절약 전문 편집자입니다. SNS 글은 문제를 발견하는 신호일 뿐 사실 근거가 아닙니다. 제공된 자료 밖의 숫자나 체험을 만들지 마세요. 원문 문장을 복사하지 말고 완전히 새로 구성하세요. 흔한 조언 대신 구체적인 문제, 계산, 실행 규칙을 만드세요. 하프물범 모하프는 쿠폰과 무료배송 앞에서 엉뚱한 실수를 하지만 계산으로 바로잡습니다. 결과는 5~6장 카드뉴스 한 편이어야 합니다.` },
        { role: "user", content: `다음 수집 자료로 저장·공유할 가치가 있는 카드뉴스 기획안을 하나 만드세요. 1~2등급 근거가 없으면 숫자 주장을 만들지 말고 risks에 필요한 검증을 적으세요. 게시 기준일: ${now.toISOString()}\n자료:\n${JSON.stringify(sourceBundle)}` }
      ],
      text: { format: { type: "json_schema", name: "moharp_editorial_brief", strict: true, schema: briefSchema } }
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
    status: hasEvidence ? "draft" : "needs_evidence",
    createdAt: stamp,
    updatedAt: stamp
  };
}

