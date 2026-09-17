import type { ResearchConfig, ResearchLead, ResearchSource, SourceDiagnostic } from "../research-types.js";
import { fetchJson, type FetchLike } from "./http.js";
import { makeLead } from "./normalize.js";

interface CollectionResult {
  leads: ResearchLead[];
  diagnostic: SourceDiagnostic;
}

function responseOutputText(payload: unknown): string {
  const response = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (response.output_text) return response.output_text;
  for (const item of response.output ?? []) for (const content of item.content ?? []) if (content.type === "output_text" && content.text) return content.text;
  throw new Error("웹 조사 API 응답에서 구조화 결과를 찾지 못했습니다.");
}

function domainOf(value: string): string {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

export function isoFromNaverDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00+09:00`;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

async function collectNaver(
  source: "naver_blog" | "naver_cafe" | "naver_news",
  endpoint: "blog" | "cafearticle" | "news",
  config: ResearchConfig,
  env: NodeJS.ProcessEnv,
  fetcher: FetchLike,
): Promise<CollectionResult> {
  const clientId = env.NAVER_CLIENT_ID;
  const clientSecret = env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { leads: [], diagnostic: { source, status: "skipped", collected: 0, message: "NAVER_CLIENT_ID/SECRET 없음" } };
  const leads: ResearchLead[] = [];
  for (const query of config.queries) {
    const url = new URL(`https://openapi.naver.com/v1/search/${endpoint}.json`);
    url.searchParams.set("query", query);
    url.searchParams.set("display", String(config.maxItemsPerQuery));
    url.searchParams.set("sort", "date");
    const payload = await fetchJson<{ items?: Array<Record<string, unknown>> }>(url.toString(), {
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret }
    }, fetcher);
    for (const item of payload.items ?? []) {
      const link = String(item.link ?? item.originallink ?? "");
      if (!link) continue;
      leads.push(makeLead({
        source,
        query,
        title: String(item.title ?? ""),
        excerpt: String(item.description ?? ""),
        url: link,
        author: String(item.bloggername ?? item.cafename ?? "") || undefined,
        publishedAt: isoFromNaverDate(String(item.postdate ?? item.pubDate ?? "")),
        sourceTier: source === "naver_news" ? 2 : 3,
        maxExcerptChars: config.maxExcerptChars
      }));
    }
  }
  return { leads, diagnostic: { source, status: "ok", collected: leads.length, message: "정상 수집" } };
}

async function collectYouTube(config: ResearchConfig, env: NodeJS.ProcessEnv, fetcher: FetchLike): Promise<CollectionResult> {
  const source: ResearchSource = "youtube";
  const key = env.YOUTUBE_API_KEY;
  if (!key) return { leads: [], diagnostic: { source, status: "skipped", collected: 0, message: "YOUTUBE_API_KEY 없음" } };
  const leads: ResearchLead[] = [];
  for (const query of config.queries) {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("order", "date");
    url.searchParams.set("regionCode", "KR");
    url.searchParams.set("relevanceLanguage", "ko");
    url.searchParams.set("maxResults", String(Math.min(50, config.maxItemsPerQuery)));
    url.searchParams.set("q", query);
    url.searchParams.set("key", key);
    const payload = await fetchJson<{ items?: Array<{ id?: { videoId?: string }; snippet?: Record<string, unknown> }> }>(url.toString(), {}, fetcher);
    for (const item of payload.items ?? []) {
      const id = item.id?.videoId;
      const snippet = item.snippet ?? {};
      if (!id) continue;
      leads.push(makeLead({
        source,
        query,
        title: String(snippet.title ?? ""),
        excerpt: String(snippet.description ?? ""),
        url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
        author: String(snippet.channelTitle ?? "") || undefined,
        publishedAt: String(snippet.publishedAt ?? "") || undefined,
        maxExcerptChars: config.maxExcerptChars
      }));
    }
  }
  return { leads, diagnostic: { source, status: "ok", collected: leads.length, message: "정상 수집" } };
}

async function collectThreads(config: ResearchConfig, env: NodeJS.ProcessEnv, fetcher: FetchLike): Promise<CollectionResult> {
  const source: ResearchSource = "threads";
  const token = env.THREADS_ACCESS_TOKEN;
  if (!token) return { leads: [], diagnostic: { source, status: "skipped", collected: 0, message: "THREADS_ACCESS_TOKEN 없음" } };
  const leads: ResearchLead[] = [];
  for (const query of config.queries) {
    const configuredUrl = env.THREADS_SEARCH_URL || "https://graph.threads.net/keyword_search";
    const url = new URL(configuredUrl.replace("graph.threads.net/v1.0/keyword_search", "graph.threads.net/keyword_search"));
    url.searchParams.set("q", query);
    url.searchParams.set("search_type", "RECENT");
    url.searchParams.set("search_mode", "KEYWORD");
    url.searchParams.set("limit", String(Math.min(50, config.maxItemsPerQuery)));
    url.searchParams.set("fields", "id,text,timestamp,username,permalink");
    const payload = await fetchJson<{ data?: Array<Record<string, unknown>> }>(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    }, fetcher);
    for (const item of payload.data ?? []) {
      const permalink = String(item.permalink ?? "");
      const text = String(item.text ?? "");
      if (!permalink || !text) continue;
      leads.push(makeLead({
        source,
        query,
        title: text.slice(0, 100),
        excerpt: text,
        url: permalink,
        author: String(item.username ?? "") || undefined,
        publishedAt: String(item.timestamp ?? "") || undefined,
        maxExcerptChars: config.maxExcerptChars
      }));
    }
  }
  return { leads, diagnostic: { source, status: "ok", collected: leads.length, message: "정상 수집" } };
}

export async function probeThreadsKeywordSearch(
  config: ResearchConfig,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: FetchLike = fetch,
): Promise<SourceDiagnostic> {
  if (!config.sources.threads) return { source: "threads", status: "skipped", collected: 0, message: "Threads 수집 설정이 꺼져 있음" };
  if (!env.THREADS_ACCESS_TOKEN) return { source: "threads", status: "failed", collected: 0, message: "THREADS_ACCESS_TOKEN 없음" };
  try {
    // Threads does not expose /me/permissions. Its supported token debugger can
    // inspect a user token when that same token is supplied as the bearer.
    const debugUrl = new URL("https://graph.threads.net/debug_token");
    debugUrl.searchParams.set("input_token", env.THREADS_ACCESS_TOKEN);
    const debugPayload = await fetchJson<{
      data?: { is_valid?: boolean; scopes?: string[] };
    }>(debugUrl.toString(), {
      headers: { Authorization: `Bearer ${env.THREADS_ACCESS_TOKEN}` }
    }, fetcher);
    const scopes = debugPayload.data?.scopes ?? [];
    if (debugPayload.data?.is_valid === false) {
      return { source: "threads", status: "failed", collected: 0, message: "Threads 토큰이 유효하지 않습니다." };
    }
    if (!scopes.includes("threads_keyword_search")) {
      return {
        source: "threads",
        status: "failed",
        collected: 0,
        message: `현재 토큰의 실제 권한에 threads_keyword_search가 없습니다. 앱 화면의 '테스트 준비 완료'와 토큰 동의는 별개입니다. 현재 권한: ${scopes.join(", ") || "없음"}`
      };
    }
    const probeConfig: ResearchConfig = {
      ...config,
      queries: [config.queries[0] || "생활비 절약"],
      maxItemsPerQuery: 1
    };
    const result = await collectThreads(probeConfig, env, fetcher);
    return { ...result.diagnostic, message: "threads_keyword_search 실제 호출 정상" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const permissionFailure = /HTTP 500|permission|OAuth|code\s*10/i.test(message);
    return {
      source: "threads",
      status: "failed",
      collected: 0,
      message: permissionFailure
        ? `현재 토큰으로 키워드 검색이 거부됐습니다. Meta 앱에 threads_keyword_search를 추가하고 새 토큰으로 다시 동의해야 합니다. 원문: ${message}`
        : message
    };
  }
}

async function collectOpenAIWeb(config: ResearchConfig, env: NodeJS.ProcessEnv, fetcher: FetchLike): Promise<CollectionResult> {
  const source: ResearchSource = "openai_web";
  const key = env.OPENAI_API_KEY;
  if (!key) return { leads: [], diagnostic: { source, status: "skipped", collected: 0, message: "OPENAI_API_KEY 없음" } };
  const schema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        maxItems: 30,
        items: {
          type: "object",
          properties: {
            query: { type: "string" },
            title: { type: "string" },
            excerpt: { type: "string" },
            url: { type: "string" },
            author: { type: "string" },
            publishedAt: { type: "string" },
            sourceKind: { type: "string", enum: ["official", "news", "blog", "community", "social", "video"] }
          },
          required: ["query", "title", "excerpt", "url", "author", "publishedAt", "sourceKind"],
          additionalProperties: false
        }
      }
    },
    required: ["items"],
    additionalProperties: false
  } as const;
  const payload = await fetchJson<unknown>("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_MODEL_FAST || "gpt-5.6-luna",
      store: false,
      max_output_tokens: 6000,
      tools: [{ type: "web_search" }],
      input: [
        { role: "developer", content: "한국 생활비 절약 콘텐츠 조사자입니다. 실제 검색 결과의 원문 URL만 반환하고, 찾지 못한 항목을 만들지 마세요. SNS·커뮤니티·블로그·영상은 관심과 문제를 찾는 신호이고, 수치와 사실은 정부·공공기관·원문 보도로 교차 확인합니다." },
        { role: "user", content: `최근 자료를 조사하세요. 검색 대상은 Threads·인스타그램·릴스·유튜브·네이버 블로그·카페·국내 커뮤니티·뉴스·정부 및 공공기관입니다. 반복되는 생활비 고민, 의외의 함정, 계산 가능한 사례를 우선하세요. 검색어: ${config.queries.join(", ")}. 출처별 문장을 길게 복사하지 말고 ${config.maxExcerptChars}자 이내로 요약하세요.` }
      ],
      text: { format: { type: "json_schema", name: "moharp_web_research", strict: true, schema } }
    })
  }, fetcher, 2);
  const parsed = JSON.parse(responseOutputText(payload)) as { items: Array<{ query: string; title: string; excerpt: string; url: string; author: string; publishedAt: string; sourceKind: string }> };
  const leads = parsed.items.filter((item) => /^https?:\/\//.test(item.url)).map((item) => {
    const domain = domainOf(item.url);
    const official = config.primaryDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
    return makeLead({
      source,
      query: item.query,
      title: item.title,
      excerpt: item.excerpt,
      url: item.url,
      author: item.author || undefined,
      publishedAt: item.publishedAt || undefined,
      sourceTier: official ? 1 : item.sourceKind === "news" ? 2 : 3,
      maxExcerptChars: config.maxExcerptChars
    });
  });
  return { leads, diagnostic: { source, status: "ok", collected: leads.length, message: "웹 전반 교차 조사 정상" } };
}

async function safely(source: ResearchSource, task: () => Promise<CollectionResult>): Promise<CollectionResult> {
  try {
    return await task();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hint = source === "threads" && message.includes("HTTP 500")
      ? " · 현재 토큰에 threads_keyword_search가 없습니다. Meta 앱 권한 추가 후 새 토큰으로 다시 동의해야 합니다."
      : "";
    return { leads: [], diagnostic: { source, status: "failed", collected: 0, message: `${message}${hint}` } };
  }
}

export async function collectConfiguredSources(
  config: ResearchConfig,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: FetchLike = fetch,
): Promise<{ leads: ResearchLead[]; diagnostics: SourceDiagnostic[] }> {
  const tasks: Array<Promise<CollectionResult>> = [];
  if (config.sources.naverBlog) tasks.push(safely("naver_blog", () => collectNaver("naver_blog", "blog", config, env, fetcher)));
  if (config.sources.naverCafe) tasks.push(safely("naver_cafe", () => collectNaver("naver_cafe", "cafearticle", config, env, fetcher)));
  if (config.sources.naverNews) tasks.push(safely("naver_news", () => collectNaver("naver_news", "news", config, env, fetcher)));
  if (config.sources.youtube) tasks.push(safely("youtube", () => collectYouTube(config, env, fetcher)));
  if (config.sources.threads) tasks.push(safely("threads", () => collectThreads(config, env, fetcher)));
  if (config.sources.openaiWebSearch) tasks.push(safely("openai_web", () => collectOpenAIWeb(config, env, fetcher)));
  const results = await Promise.all(tasks);
  return { leads: results.flatMap((result) => result.leads), diagnostics: results.map((result) => result.diagnostic) };
}
