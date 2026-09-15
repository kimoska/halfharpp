import { describe, expect, it } from "vitest";
import { buildQueue } from "../src/scheduler.js";
import type { AutomationConfig, BrandConfig, ContentSeed } from "../src/types.js";

const brand: BrandConfig = {
  name: "하프하프 모하프", voice: "", characterRules: [], contentRatio: { info: 0.35, relatable: 0.25, community: 0.2, affiliate: 0.2 },
  postingTimes: ["08:10", "19:40"], timezone: "Asia/Seoul", maxPostsPerDay: 2, minNonAffiliateBetweenAffiliate: 3,
  priceMaxAgeHours: 24, disclosure: "[광고] 수수료를 제공받을 수 있습니다.", hashtags: []
};
const automation: AutomationConfig = { autoApproveNonAffiliate: true, affiliateRequiresApproval: true, defaultReplyControl: "everyone", renderWidth: 1080, renderQuality: 92, maxAttempts: 3, publishOnePerRun: true, dryRunByDefault: true };
const seeds: ContentSeed[] = [
  { pillar: "info", hook: "정보", body: "내용", cta: "질문" },
  { pillar: "relatable", hook: "공감", body: "내용", cta: "질문" },
  { pillar: "community", hook: "참여", body: "내용", cta: "질문" },
  { pillar: "affiliate", hook: "추천", body: "내용", cta: "질문" }
];

describe("scheduler", () => {
  it("does not create affiliate posts without an active real product", () => {
    const queue = buildQueue(14, brand, automation, seeds, [], new Date("2026-09-11T00:00:00Z"));
    expect(queue.length).toBeGreaterThan(10);
    expect(queue.some((post) => post.pillar === "affiliate")).toBe(false);
    expect(queue.every((post) => post.status === "approved")).toBe(true);
  });

  it("keeps affiliate posts in draft for approval", () => {
    const queue = buildQueue(14, brand, automation, seeds, [{ id: "x", name: "상품", category: "생활", affiliateUrl: "https://toss.im/x", price: 1000, priceCheckedAt: "2026-09-11T00:00:00Z", active: true, notes: "" }], new Date("2026-09-11T00:00:00Z"));
    expect(queue.filter((post) => post.pillar === "affiliate").every((post) => post.status === "draft" && post.requiresApproval)).toBe(true);
  });
});
