import type { BrandConfig, QueuePost } from "./types.js";
import { composeText } from "./policy.js";

interface GeneratedCopy { hook: string; body: string; cta: string; }

function extractOutputText(payload: unknown): string {
  const response = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (response.output_text) return response.output_text;
  for (const item of response.output ?? []) for (const content of item.content ?? []) if (content.type === "output_text" && content.text) return content.text;
  throw new Error("OpenAI 응답에서 문안을 찾지 못했습니다.");
}

export async function enrichPost(post: QueuePost, brand: BrandConfig): Promise<QueuePost> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY가 없어 AI 문안 생성을 건너뜁니다. 내장 문안은 그대로 사용할 수 있습니다.");
  const model = post.pillar === "affiliate" ? (process.env.OPENAI_MODEL_QUALITY || "gpt-5.6-sol") : (process.env.OPENAI_MODEL_FAST || "gpt-5.6-luna");
  const productFacts = post.pillar === "affiliate" ? `상품 ID: ${post.productId ?? "없음"}\n링크: ${post.affiliateUrl ?? "없음"}\n가격 확인 시각: ${post.priceCheckedAt ?? "없음"}` : "상품 추천이 아닌 일반 콘텐츠";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        { role: "developer", content: `당신은 Threads용 한국어 에디터입니다. 브랜드 목소리: ${brand.voice} 과장, 허위 체험, 검증되지 않은 효능, 조작된 긴급성을 금지합니다. 제휴 글은 제공된 사실만 사용합니다.` },
        { role: "user", content: `다음 초안을 짧고 자연스럽게 다듬으세요. 500자 캡션에 들어갈 세 부분만 반환하세요.\n분류: ${post.pillar}\n초안 제목: ${post.hook}\n초안 본문: ${post.body}\n초안 질문: ${post.cta}\n${productFacts}` }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "threads_copy",
          strict: true,
          schema: {
            type: "object",
            properties: {
              hook: { type: "string", maxLength: 60 },
              body: { type: "string", maxLength: 240 },
              cta: { type: "string", maxLength: 80 }
            },
            required: ["hook", "body", "cta"],
            additionalProperties: false
          }
        }
      }
    })
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenAI API 실패(${response.status}): ${raw}`);
  const generated = JSON.parse(extractOutputText(JSON.parse(raw))) as GeneratedCopy;
  const updated: QueuePost = { ...post, ...generated, updatedAt: new Date().toISOString() };
  updated.text = composeText(updated, brand);
  return updated;
}
