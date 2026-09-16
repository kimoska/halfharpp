import { describe, expect, it } from "vitest";
import { composeText, validateDuplicates, validatePost, validateSpacing } from "../src/policy.js";
import type { BrandConfig, QueuePost } from "../src/types.js";

const brand: BrandConfig = {
  name: "하프하프 모하프", voice: "", characterRules: [], contentRatio: { info: 0.35, relatable: 0.25, community: 0.2, affiliate: 0.2 },
  postingTimes: ["08:10"], timezone: "Asia/Seoul", maxPostsPerDay: 2, minNonAffiliateBetweenAffiliate: 3,
  priceMaxAgeHours: 24, disclosure: "[광고] 링크 구매 시 수수료를 제공받을 수 있습니다.", hashtags: []
};

function post(overrides: Partial<QueuePost> = {}): QueuePost {
  const base: QueuePost = {
    id: "p1", pillar: "info", scheduledAt: "2026-09-12T08:10:00+09:00", status: "approved", hook: "제목", body: "본문", cta: "질문",
    text: "제목\n\n본문\n\n질문", template: "template-checklist-v1.png", requiresApproval: false, attempts: 0,
    createdAt: "2026-09-11T00:00:00Z", updatedAt: "2026-09-11T00:00:00Z"
  };
  return { ...base, ...overrides };
}

describe("affiliate safeguards", () => {
  it("adds disclosure before affiliate copy", () => {
    const text = composeText({ pillar: "affiliate", hook: "제목", body: "본문", cta: "질문", affiliateUrl: "https://toss.im/link" }, brand);
    expect(text.startsWith("[광고]")).toBe(true);
    expect(text).toContain("수수료");
    expect(text).toContain("https://toss.im/link");
  });

  it("blocks missing disclosure and stale prices", () => {
    const issues = validatePost(post({ pillar: "affiliate", affiliateUrl: "https://toss.im/link", priceCheckedAt: "2020-01-01T00:00:00Z" }), brand, new Date("2026-09-11T00:00:00Z"));
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["DISCLOSURE_MISSING", "PRICE_STALE"]));
  });

  it("blocks affiliate posts placed too close together", () => {
    const queue = [
      post({ id: "a", pillar: "affiliate", scheduledAt: "2026-09-12T00:00:00Z" }),
      post({ id: "b", pillar: "info", scheduledAt: "2026-09-13T00:00:00Z" }),
      post({ id: "c", pillar: "affiliate", scheduledAt: "2026-09-14T00:00:00Z" })
    ];
    expect(validateSpacing(queue, brand).some((issue) => issue.code === "AFFILIATE_TOO_FREQUENT")).toBe(true);
  });

  it("detects duplicate copy", () => {
    expect(validateDuplicates([post({ id: "a" }), post({ id: "b" })])[0]?.code).toBe("DUPLICATE_COPY");
  });

  it("allows a single image post and up to ten carousel cards", () => {
    expect(validatePost(post({ imagePaths: ["one.png"] }), brand)).toHaveLength(0);
    expect(validatePost(post({ imagePaths: Array.from({ length: 10 }, (_, index) => `${index + 1}.png`) }), brand)).toHaveLength(0);
    expect(validatePost(post({ imagePaths: Array.from({ length: 11 }, (_, index) => `${index + 1}.png`) }), brand).some((issue) => issue.code === "MEDIA_COUNT")).toBe(true);
  });
});
