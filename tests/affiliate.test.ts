import { describe, expect, it } from "vitest";
import { selectAffiliateProduct } from "../src/research/affiliate.js";
import type { BrandConfig, Product, QueuePost } from "../src/types.js";

const now = new Date("2026-09-15T12:00:00Z");
const brand: BrandConfig = {
  name: "하프하프 모하프", voice: "", characterRules: [], contentRatio: { info: 0.35, relatable: 0.25, community: 0.2, affiliate: 0.2 },
  postingTimes: ["08:10"], timezone: "Asia/Seoul", maxPostsPerDay: 3, minNonAffiliateBetweenAffiliate: 3,
  priceMaxAgeHours: 24, disclosure: "[광고] 수수료를 제공받을 수 있습니다.", hashtags: []
};
const product: Product = {
  id: "toss-1", name: "수납함", category: "생활", affiliateUrl: "https://toss.im/_m/a", price: 9900,
  priceCheckedAt: "2026-09-15T00:00:00Z", active: true, notes: ""
};
function post(id: string, pillar: QueuePost["pillar"], day: number): QueuePost {
  return { id, pillar, scheduledAt: `2026-09-${String(day).padStart(2, "0")}T00:00:00Z`, status: "draft", hook: "h", body: "b", cta: "c", text: id, template: "t", requiresApproval: true, attempts: 0, createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

describe("affiliate editorial selection", () => {
  it("selects only after four non-affiliate posts so the next post is exactly 20%", () => {
    expect(selectAffiliateProduct([product], [post("1", "info", 1), post("2", "community", 2), post("3", "relatable", 3)], brand, now)).toBeUndefined();
    expect(selectAffiliateProduct([product], [post("1", "info", 1), post("2", "community", 2), post("3", "relatable", 3), post("4", "info", 4)], brand, now)?.id).toBe("toss-1");
  });

  it("rejects a stale product or insufficient spacing after an affiliate post", () => {
    expect(selectAffiliateProduct([{ ...product, priceCheckedAt: "2026-09-13T00:00:00Z" }], Array.from({ length: 4 }, (_, index) => post(String(index), "info", index + 1)), brand, now)).toBeUndefined();
    const queue = [post("a", "affiliate", 1), post("b", "info", 2), post("c", "community", 3)];
    expect(selectAffiliateProduct([product], queue, brand, now)).toBeUndefined();
  });
});
