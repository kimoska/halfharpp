import { describe, expect, it } from "vitest";
import type { EditorialBrief, ResearchConfig } from "../src/research-types.js";
import { makeLead, canonicalizeUrl, deduplicateLeads } from "../src/research/normalize.js";
import { scoreLead } from "../src/research/score.js";
import { collectConfiguredSources, isoFromNaverDate } from "../src/research/sources.js";
import { fetchJson } from "../src/research/http.js";
import { mergeAndRankLeads, validateBrief, validateLead } from "../src/research/pipeline.js";
import type { Product } from "../src/types.js";

const config: ResearchConfig = {
  queries: ["생활비 절약"],
  maxItemsPerQuery: 5,
  maxExcerptChars: 80,
  staleAfterDays: 30,
  minLeadScore: 35,
  maxLeadsPerRun: 20,
  primaryDomains: ["data.go.kr", "kosis.kr"],
  sources: { naverBlog: true, naverCafe: false, naverNews: false, youtube: true, threads: true }
};

describe("research normalization and scoring", () => {
  it("removes tracking parameters and strips HTML", () => {
    expect(canonicalizeUrl("https://EXAMPLE.com/a/?utm_source=x&id=2#top")).toBe("https://example.com/a?id=2");
    const lead = makeLead({ source: "naver_blog", query: "절약", title: "<b>생활비</b> 절약", excerpt: "A &amp; B", url: "https://example.com/a", maxExcerptChars: 80 });
    expect(lead.title).toBe("생활비 절약");
    expect(lead.excerpt).toBe("A & B");
  });

  it("deduplicates the same canonical URL", () => {
    const a = makeLead({ source: "naver_blog", query: "절약", title: "생활비 절약 방법 정리", url: "https://example.com/a?utm_source=x", maxExcerptChars: 80 });
    const b = makeLead({ source: "naver_blog", query: "절약", title: "다른 제목", url: "https://example.com/a", maxExcerptChars: 80 });
    const result = deduplicateLeads([a, b]);
    expect(result.unique).toHaveLength(1);
    expect(result.duplicates[0]?.duplicateOf).toBe(a.id);
  });

  it("rewards relevant, recent, numeric official evidence", () => {
    const lead = makeLead({ source: "official", query: "생활비 절약", title: "생필품 가격 12% 변동", excerpt: "생활비와 가격 비교", url: "https://data.go.kr/x", sourceTier: 1, publishedAt: "2026-09-14T00:00:00Z", maxExcerptChars: 80 });
    const scored = scoreLead(lead, config, new Date("2026-09-15T00:00:00Z"));
    expect(scored.score).toBeGreaterThanOrEqual(70);
    expect(validateLead(scored, config).filter((issue) => issue.level === "error")).toHaveLength(0);
  });
});

describe("research source adapters", () => {
  it("parses both Naver compact dates and news RFC dates", () => {
    expect(isoFromNaverDate("20260915")).toBe("2026-09-15T00:00:00+09:00");
    expect(isoFromNaverDate("Tue, 15 Sep 2026 09:00:00 +0900")).toBe("2026-09-15T00:00:00.000Z");
  });

  it("skips missing credentials without failing the whole run", async () => {
    const result = await collectConfiguredSources(config, {}, fetch);
    expect(result.leads).toHaveLength(0);
    expect(result.diagnostics.every((item) => item.status === "skipped")).toBe(true);
  });

  it("normalizes a mocked Naver result and isolates other missing sources", async () => {
    const fakeFetch: typeof fetch = async (input) => {
      const url = String(input);
      expect(url).toContain("openapi.naver.com/v1/search/blog.json");
      return new Response(JSON.stringify({ items: [{ title: "<b>생활비 절약</b> 5가지", description: "월 10,000원 줄이는 방법", link: "https://blog.naver.com/test/1", bloggername: "테스트", postdate: "20260915" }] }), { status: 200 });
    };
    const result = await collectConfiguredSources(config, { NAVER_CLIENT_ID: "id", NAVER_CLIENT_SECRET: "secret" }, fakeFetch);
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0]?.title).toBe("생활비 절약 5가지");
    expect(result.diagnostics.find((item) => item.source === "naver_blog")?.status).toBe("ok");
  });

  it("merges scored leads while keeping storage bounded", () => {
    const lead = makeLead({ source: "naver_blog", query: "생활비 절약", title: "생활비 절약 가격 비교", excerpt: "무료배송보다 3,000원 더 씀", url: "https://example.com/1", publishedAt: "2026-09-15T00:00:00Z", maxExcerptChars: 80 });
    const result = mergeAndRankLeads([], [lead, lead], config, new Date("2026-09-15T00:00:00Z"));
    expect(result.leads).toHaveLength(1);
    expect(result.duplicates).toBe(1);
    expect(result.accepted).toBe(1);
  });

  it("uses the official unversioned Threads search endpoint and a bearer header", async () => {
    const threadsOnly = { ...config, sources: { naverBlog: false, naverCafe: false, naverNews: false, youtube: false, threads: true } };
    const fakeFetch: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      expect(url.origin + url.pathname).toBe("https://graph.threads.net/keyword_search");
      expect(url.searchParams.get("search_type")).toBe("RECENT");
      expect(url.searchParams.get("search_mode")).toBe("KEYWORD");
      expect(url.searchParams.has("access_token")).toBe(false);
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer token-value");
      return new Response(JSON.stringify({ data: [{ id: "1", text: "생활비 절약 질문", timestamp: "2026-09-15T00:00:00Z", username: "tester", permalink: "https://www.threads.com/@tester/post/1" }] }), { status: 200 });
    };
    const result = await collectConfiguredSources(threadsOnly, { THREADS_ACCESS_TOKEN: "token-value", THREADS_SEARCH_URL: "https://graph.threads.net/v1.0/keyword_search" }, fakeFetch);
    expect(result.leads).toHaveLength(1);
    expect(result.diagnostics[0]?.status).toBe("ok");
  });

  it("redacts long credential-looking strings in HTTP error details", async () => {
    const secret = "s".repeat(100);
    const fakeFetch: typeof fetch = async () => new Response(secret, { status: 400 });
    await expect(fetchJson(`https://example.com/test?access_token=${secret}`, {}, fakeFetch, 1)).rejects.not.toThrow(secret);
    await expect(fetchJson(`https://example.com/test?access_token=${secret}`, {}, fakeFetch, 1)).rejects.toThrow("[REDACTED]");
  });
});

describe("editorial gate", () => {
  const brief: EditorialBrief = {
    id: "b1", pillar: "info", topic: "무료배송", angle: "추가 구매액 비교", audienceProblem: "배송비를 아끼려다 필요하지 않은 상품까지 더 담게 된다", oneLineValue: "추가 구매액과 배송비를 적어 실제 지출 차이를 비교한다", leadIds: ["l1"],
    evidence: [{ title: "공식 자료", url: "https://data.go.kr/x", publisher: "한국소비자원", publishedAt: "2026-09-15", claim: "가격 자료", sourceTier: 1 }],
    calculations: [{ label: "추가 지출", formula: "추가 구매액-배송비", result: "15,000원", inputs: { extra: 18000, shipping: 3000 } }],
    cardCountReason: "문제와 계산법, 실행 결론을 각각 한 카드에서 명확히 설명하기 위해 다섯 장을 사용한다.",
    slides: [
      { order: 1, role: "hook", headline: "배송비 아끼려다", body: "더 많이 사지 않았나요?", visualDirection: "당황한 모하프" },
      { order: 2, role: "problem", headline: "먼저 두 금액을 적어요", body: "배송비와 추가 구매액", visualDirection: "영수증" },
      { order: 3, role: "evidence", headline: "필요한 물건인가요?", body: "원래 살 목록에 있었는지 확인", visualDirection: "체크리스트" },
      { order: 4, role: "calculation", headline: "차이는 15,000원", body: "18,000원에서 3,000원을 뺀 값", visualDirection: "계산기" },
      { order: 5, role: "action", headline: "추가 구매액이 더 크면", body: "배송비를 내는 편을 검토해요", visualDirection: "결론" }
    ],
    caption: "배송비보다 더 담은 금액을 먼저 봐요.", cta: "무료배송 때문에 더 산 적 있나요?", risks: [], status: "draft", createdAt: "2026-09-15T00:00:00Z", updatedAt: "2026-09-15T00:00:00Z"
  };

  it("accepts an actionable, evidenced 5-slide brief", () => {
    expect(validateBrief(brief)).toHaveLength(0);
  });

  it("accepts a concise 2-slide brief when two cards are enough", () => {
    const concise = {
      ...brief,
      calculations: [],
      cardCountReason: "질문과 바로 실행할 답만 있으면 충분해 두 장으로 끝낸다.",
      slides: [
        { order: 1, role: "hook" as const, headline: "무료배송까지 얼마 남았나요?", body: "필요 없는 물건을 더 담기 전에 추가 구매액을 확인해요.", visualDirection: "장바구니를 보는 모하프" },
        { order: 2, role: "action" as const, headline: "배송비와 추가 구매액 비교", body: "추가 구매액이 더 크다면 배송비를 내는 선택도 검토해요.", visualDirection: "두 금액 비교표" }
      ]
    };
    expect(validateBrief(concise)).toHaveLength(0);
  });

  it("blocks filler cards that repeat the same copy", () => {
    const repeated = { ...brief, slides: [brief.slides[0]!, { ...brief.slides[0]!, order: 2 }] };
    expect(validateBrief(repeated).some((issue) => issue.code === "SLIDE_REDUNDANT")).toBe(true);
  });

  it("blocks numeric claims without evidence", () => {
    expect(validateBrief({ ...brief, evidence: [] }).some((issue) => issue.code === "EVIDENCE_REQUIRED")).toBe(true);
  });

  it("blocks AI-like filler wording", () => {
    const clichéd = { ...brief, caption: "현명한 소비를 위한 꿀팁을 소개할게요." };
    expect(validateBrief(clichéd).some((issue) => issue.code === "AI_CLICHE_COPY")).toBe(true);
  });

  it("blocks a shallow brief without a decision rule or concrete action", () => {
    const shallow = {
      ...brief,
      calculations: [],
      evidence: [],
      angle: "생활비를 아끼는 마음가짐",
      oneLineValue: "일상에서 작은 습관을 꾸준히 이어가며 절약한다",
      caption: "작은 습관을 꾸준히 이어가면 생활비를 아낄 수 있습니다.",
      cta: "여러분의 절약 습관은 무엇인가요?",
      slides: [
        { order: 1, role: "hook" as const, headline: "작은 습관의 힘", body: "오늘부터 절약을 시작해요.", visualDirection: "웃는 모하프" },
        { order: 2, role: "action" as const, headline: "꾸준히 실천해요", body: "매일 작은 습관을 이어가요.", visualDirection: "달력" }
      ]
    };
    expect(validateBrief(shallow).some((issue) => issue.code === "DEPTH_SIGNAL_MISSING")).toBe(true);
  });

  it("blocks evidence URLs that were not in the collected research", () => {
    const lead = makeLead({ source: "official", query: "생활비 절약", title: "공식 가격 자료", url: "https://data.go.kr/source", sourceTier: 1, maxExcerptChars: 80 });
    expect(validateBrief(brief, [lead]).some((issue) => issue.code === "EVIDENCE_NOT_IN_RESEARCH")).toBe(true);
  });

  it("blocks an affiliate brief without an active linked product", () => {
    const affiliate = { ...brief, pillar: "affiliate" as const, productId: "toss-123", risks: ["[광고] 제휴 수수료 고지를 본문 첫 줄에 표시"] };
    expect(validateBrief(affiliate, undefined, []).some((issue) => issue.code === "AFFILIATE_PRODUCT_MISSING")).toBe(true);
    const product: Product = {
      id: "toss-123", tacaItemId: 123, name: "생활용품", category: "생활", affiliateUrl: "https://toss.im/_m/test",
      price: 9900, priceCheckedAt: "2026-09-15T00:00:00Z", active: true, notes: "테스트"
    };
    expect(validateBrief(affiliate, undefined, [product]).some((issue) => issue.code === "AFFILIATE_PRODUCT_MISSING")).toBe(false);
  });
});
