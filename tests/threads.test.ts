import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadsClient } from "../src/threads.js";
import type { AutomationConfig, QueuePost } from "../src/types.js";

const automation: AutomationConfig = { autoApproveNonAffiliate: true, affiliateRequiresApproval: true, defaultReplyControl: "everyone", renderWidth: 1080, renderQuality: 92, maxAttempts: 3, publishOnePerRun: true, dryRunByDefault: false };
const post: QueuePost = {
  id: "p1", pillar: "info", scheduledAt: "2026-09-12T08:10:00+09:00", status: "rendered", hook: "제목", body: "본문", cta: "질문", text: "제목\n본문",
  template: "template-checklist-v1.png", requiresApproval: false, publicImageUrl: "https://example.com/card.png", attempts: 0,
  createdAt: "2026-09-11T00:00:00Z", updatedAt: "2026-09-11T00:00:00Z"
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.THREADS_ACCESS_TOKEN;
  delete process.env.LIVE_PUBLISH_ENABLED;
});

describe("ThreadsClient", () => {
  it("keeps live publishing locked without both switches", () => {
    process.env.THREADS_ACCESS_TOKEN = "token";
    expect(() => new ThreadsClient().assertConfigured()).toThrow("실게시 잠금");
  });

  it("creates, waits for, publishes and retrieves an image post", async () => {
    process.env.THREADS_ACCESS_TOKEN = "token";
    process.env.LIVE_PUBLISH_ENABLED = "true";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "container-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "container-1", status: "FINISHED" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "post-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "post-1", permalink: "https://threads.net/p/1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ThreadsClient().publish(post, automation);
    expect(result.id).toBe("post-1");
    expect(result.permalink).toBe("https://threads.net/p/1");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const createBody = fetchMock.mock.calls[0]![1]!.body as URLSearchParams;
    expect(createBody.get("media_type")).toBe("IMAGE");
    expect(createBody.get("image_url")).toBe(post.publicImageUrl);
  });

  it("creates child containers and publishes a carousel", async () => {
    process.env.THREADS_ACCESS_TOKEN = "token";
    process.env.LIVE_PUBLISH_ENABLED = "true";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "child-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "child-1", status: "FINISHED" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "child-2" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "child-2", status: "FINISHED" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "parent" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "parent", status: "FINISHED" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "post-carousel" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "post-carousel", permalink: "https://threads.net/p/carousel" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ThreadsClient().publish({ ...post, publicImageUrl: undefined, publicImageUrls: ["https://example.com/1.png", "https://example.com/2.png"] }, automation);
    expect(result.id).toBe("post-carousel");
    expect(fetchMock).toHaveBeenCalledTimes(8);
    const firstChild = fetchMock.mock.calls[0]![1]!.body as URLSearchParams;
    const parent = fetchMock.mock.calls[4]![1]!.body as URLSearchParams;
    expect(firstChild.get("is_carousel_item")).toBe("true");
    expect(parent.get("media_type")).toBe("CAROUSEL");
    expect(parent.get("children")).toBe("child-1,child-2");
  });
});
