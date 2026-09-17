import type { AutomationConfig, QueuePost } from "./types.js";

interface ApiResult { id: string; permalink?: string; status?: string; error_message?: string; }
interface DeleteResult { success: boolean; }
export interface InsightResult { data: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value: number } }>; }

export class ThreadsClient {
  private readonly base: string;
  private readonly token: string;
  private readonly userId: string;
  constructor() {
    this.base = (process.env.THREADS_API_BASE || "https://graph.threads.net").replace(/\/$/, "");
    this.token = process.env.THREADS_ACCESS_TOKEN || "";
    this.userId = process.env.THREADS_USER_ID || "me";
  }

  assertConfigured(explicitLiveApproval = false): void {
    this.assertToken();
    if (!explicitLiveApproval && process.env.LIVE_PUBLISH_ENABLED !== "true") throw new Error("실게시 잠금 상태입니다. LIVE_PUBLISH_ENABLED=true 또는 명시적인 --live 승인이 필요합니다.");
  }

  private assertToken(): void {
    if (!this.token) throw new Error("THREADS_ACCESS_TOKEN이 없습니다.");
  }

  private async request<T = ApiResult>(pathname: string, method: "GET" | "POST" | "DELETE", params: URLSearchParams): Promise<T> {
    params.set("access_token", this.token);
    const url = `${this.base}/${pathname.replace(/^\//, "")}`;
    const queryMethod = method === "GET" || method === "DELETE";
    const response = await fetch(queryMethod ? `${url}?${params}` : url, {
      method,
      headers: method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
      body: method === "POST" ? params : undefined
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Threads API 실패(${response.status}): ${body}`);
    return JSON.parse(body) as T;
  }

  async getPostInsights(postId: string): Promise<InsightResult> {
    this.assertToken();
    return this.request<InsightResult>(`${postId}/insights`, "GET", new URLSearchParams({ metric: "views,likes,replies,reposts,quotes,shares" }));
  }

  async deletePost(postId: string): Promise<void> {
    this.assertToken();
    const result = await this.request<DeleteResult>(postId, "DELETE", new URLSearchParams());
    if (!result.success) throw new Error("Threads 게시물 삭제 응답을 확인하지 못했습니다.");
  }

  async publish(post: QueuePost, automation: AutomationConfig, explicitLiveApproval = false): Promise<ApiResult> {
    this.assertConfigured(explicitLiveApproval);
    if ((post.publicImageUrls?.length ?? 0) > 1) return this.publishCarousel(post, automation);
    const create = new URLSearchParams({ text: post.text, reply_control: automation.defaultReplyControl });
    const singleImage = post.publicImageUrl ?? post.publicImageUrls?.[0];
    if (singleImage) {
      create.set("media_type", "IMAGE");
      create.set("image_url", singleImage);
      create.set("alt_text", `${post.hook}. 하프물범 모하프 카드뉴스 이미지.`);
    } else {
      create.set("media_type", "TEXT");
      if (post.affiliateUrl) create.set("link_attachment", post.affiliateUrl);
    }
    const container = await this.request(`${this.userId}/threads`, "POST", create);
    if (!container.id) throw new Error("Threads 컨테이너 ID가 없습니다.");
    if (post.publicImageUrl) await this.waitUntilReady(container.id);
    const published = await this.request(`${this.userId}/threads_publish`, "POST", new URLSearchParams({ creation_id: container.id }));
    const details = await this.request(`${published.id}`, "GET", new URLSearchParams({ fields: "id,permalink,timestamp" }));
    return { ...published, ...details };
  }

  /**
   * Uploads and processes a Threads container without publishing it.
   * This intentionally never calls /threads_publish, so nothing appears in the feed.
   */
  async prepareUnpublished(post: QueuePost, automation: AutomationConfig): Promise<ApiResult> {
    this.assertToken();
    if ((post.publicImageUrls?.length ?? 0) > 1) return this.createCarouselContainer(post, automation);
    const create = new URLSearchParams({ text: post.text, reply_control: automation.defaultReplyControl });
    const singleImage = post.publicImageUrl ?? post.publicImageUrls?.[0];
    if (singleImage) {
      create.set("media_type", "IMAGE");
      create.set("image_url", singleImage);
      create.set("alt_text", `${post.hook}. 하프물범 모하프 카드뉴스 이미지.`);
    } else {
      create.set("media_type", "TEXT");
      if (post.affiliateUrl) create.set("link_attachment", post.affiliateUrl);
    }
    const container = await this.request(`${this.userId}/threads`, "POST", create);
    if (!container.id) throw new Error("Threads 컨테이너 ID가 없습니다.");
    if (singleImage) await this.waitUntilReady(container.id);
    return { ...container, status: singleImage ? "FINISHED" : container.status };
  }

  private async publishCarousel(post: QueuePost, automation: AutomationConfig): Promise<ApiResult> {
    const parent = await this.createCarouselContainer(post, automation);
    const published = await this.request(`${this.userId}/threads_publish`, "POST", new URLSearchParams({ creation_id: parent.id }));
    const details = await this.request(`${published.id}`, "GET", new URLSearchParams({ fields: "id,permalink,timestamp" }));
    return { ...published, ...details };
  }

  private async createCarouselContainer(post: QueuePost, automation: AutomationConfig): Promise<ApiResult> {
    const childIds: string[] = [];
    for (const [index, imageUrl] of post.publicImageUrls!.entries()) {
      const child = await this.request(`${this.userId}/threads`, "POST", new URLSearchParams({
        media_type: "IMAGE",
        image_url: imageUrl,
        is_carousel_item: "true",
        alt_text: `${post.hook} 카드뉴스 ${index + 1}장`
      }));
      if (!child.id) throw new Error(`Threads 캐러셀 ${index + 1}번 이미지 컨테이너 ID가 없습니다.`);
      await this.waitUntilReady(child.id);
      childIds.push(child.id);
    }
    const parent = await this.request(`${this.userId}/threads`, "POST", new URLSearchParams({
      media_type: "CAROUSEL",
      children: childIds.join(","),
      text: post.text,
      reply_control: automation.defaultReplyControl
    }));
    if (!parent.id) throw new Error("Threads 캐러셀 컨테이너 ID가 없습니다.");
    await this.waitUntilReady(parent.id);
    return { ...parent, status: "FINISHED" };
  }

  private async waitUntilReady(containerId: string): Promise<void> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const result = await this.request(containerId, "GET", new URLSearchParams({ fields: "status,error_message" }));
      if (["FINISHED", "PUBLISHED"].includes(result.status ?? "")) return;
      if (["ERROR", "EXPIRED"].includes(result.status ?? "")) throw new Error(result.error_message || `미디어 처리 실패: ${result.status}`);
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    throw new Error("Threads 미디어 처리 시간이 초과됐습니다.");
  }
}
