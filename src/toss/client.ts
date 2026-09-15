import fs from "node:fs/promises";
import path from "node:path";
import { secureEnvPath } from "../env.js";

export interface TossProductItem {
  rank: number;
  tacaItemId: number;
  displayName: string;
  thumbnailUrl: string;
  productUrl: string;
  displayPrice: number;
  originalPrice: number;
  discountRate: number;
  isSoldOut: boolean;
  reviewScore: number;
  reviewCount: number;
  categoryIds: number[];
}

export interface TossTrackingLink {
  tacaItemId: number;
  publisherId: string;
  shortUrl: string;
  originUrl: string;
}

interface TossEnvelope<T> {
  resultType: "SUCCESS" | "FAIL";
  success?: T;
  error?: { errorType?: number | string; errorCode?: string; reason?: string };
}

interface TokenRecord { accessToken: string; expiresAt: string; }
type FetchLike = typeof fetch;

export class TossApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable: boolean) { super(message); }
}

export class TossSharelinkClient {
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly publisherId: string;
  private readonly subTagId?: string;
  private readonly tokenFile: string;
  private memoryToken?: TokenRecord;

  constructor(private readonly fetcher: FetchLike = fetch, env: NodeJS.ProcessEnv = process.env, tokenFile?: string) {
    this.accessKey = env.TOSS_SHARELINK_ACCESS_KEY || "";
    this.secretKey = env.TOSS_SHARELINK_SECRET_KEY || "";
    this.publisherId = env.TOSS_SHARELINK_PUBLISHER_ID || "";
    this.subTagId = env.TOSS_SHARELINK_SUBTAG_ID || undefined;
    this.tokenFile = tokenFile || path.join(path.dirname(secureEnvPath), "toss-token.json");
  }

  assertConfigured(requirePublisher = false): void {
    if (!this.accessKey || !this.secretKey) throw new Error("토스 쉐어링크 Access Key 또는 Secret Key가 없습니다.");
    if (requirePublisher && !this.publisherId) throw new Error("TOSS_SHARELINK_PUBLISHER_ID가 없습니다.");
  }

  private async readCachedToken(): Promise<TokenRecord | undefined> {
    if (this.memoryToken && Date.parse(this.memoryToken.expiresAt) - Date.now() > 300_000) return this.memoryToken;
    try {
      const saved = JSON.parse(await fs.readFile(this.tokenFile, "utf8")) as TokenRecord;
      if (Date.parse(saved.expiresAt) - Date.now() > 300_000) return (this.memoryToken = saved);
    } catch { /* missing or invalid cache */ }
    return undefined;
  }

  private async token(): Promise<string> {
    this.assertConfigured();
    const cached = await this.readCachedToken();
    if (cached) return cached.accessToken;
    const form = new URLSearchParams({ grant_type: "client_credentials", client_id: this.accessKey, client_secret: this.secretKey, scope: "sharelink:read sharelink:write" });
    const response = await this.fetcher("https://oauth2.cert.toss.im/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
    const body = await response.text();
    if (!response.ok) throw new TossApiError(`HTTP_${response.status}`, `토스 토큰 발급 실패(HTTP ${response.status})`, false);
    const parsed = JSON.parse(body) as { access_token?: string; expires_in?: number };
    if (!parsed.access_token || !parsed.expires_in) throw new TossApiError("TOKEN_RESPONSE_INVALID", "토스 토큰 응답에 필수 값이 없습니다.", false);
    const record = { accessToken: parsed.access_token, expiresAt: new Date(Date.now() + parsed.expires_in * 1000).toISOString() };
    await fs.mkdir(path.dirname(this.tokenFile), { recursive: true });
    await fs.writeFile(this.tokenFile, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    this.memoryToken = record;
    return record.accessToken;
  }

  private async request<T>(pathname: string, init: RequestInit = {}, attempts = 3): Promise<T> {
    const token = await this.token();
    let last: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await this.fetcher(`https://sharelink.toss.im/openapi/${pathname.replace(/^\//, "")}`, {
          ...init,
          headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
          signal: AbortSignal.timeout(15_000)
        });
        const text = await response.text();
        if (!response.ok) {
          const canRetry = response.status === 429 || response.status >= 500;
          if (canRetry && attempt < attempts - 1) {
            const seconds = Number(response.headers.get("retry-after"));
            await new Promise((resolve) => setTimeout(resolve, Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 5_000) : 500 * 2 ** attempt));
            continue;
          }
          throw new TossApiError(`HTTP_${response.status}`, `토스 API 실패(HTTP ${response.status})`, canRetry);
        }
        const envelope = JSON.parse(text) as TossEnvelope<T>;
        if (envelope.resultType === "SUCCESS" && envelope.success !== undefined) return envelope.success;
        const code = String(envelope.error?.errorCode ?? envelope.error?.errorType ?? "UNKNOWN");
        const canRetry = code === "500";
        if (canRetry && attempt < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
          continue;
        }
        throw new TossApiError(code, `토스 API 거절: ${code} · ${envelope.error?.reason ?? "사유 없음"}`, canRetry);
      } catch (error) {
        last = error;
        if (error instanceof TossApiError || attempt === attempts - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
    throw last;
  }

  async health(): Promise<{ status: string }> {
    return this.request<{ status: string }>("health");
  }

  async bestSelling(size = 20): Promise<TossProductItem[]> {
    const result = await this.request<{ items: TossProductItem[]; nextCursor?: string; hasNext: boolean }>(`products/best-selling?size=${Math.max(1, Math.min(100, size))}`);
    return result.items ?? [];
  }

  async issueLink(tacaItemId: number): Promise<TossTrackingLink> {
    this.assertConfigured(true);
    const body: Record<string, string | number> = { tacaItemId, publisherId: this.publisherId };
    if (this.subTagId) body.subTagId = this.subTagId;
    return this.request<TossTrackingLink>("links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
}
