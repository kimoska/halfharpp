import type { AutomationConfig, BrandConfig, ContentSeed, Pillar, Product, QueuePost } from "./types.js";
import { composeText } from "./policy.js";
import { idFor } from "./utils.js";

const cycle: Pillar[] = ["info", "relatable", "community", "info", "relatable", "info", "affiliate", "community", "info", "relatable"];

const templates: Record<Pillar, string[]> = {
  info: ["template-checklist-v1.png", "template-info-3step-v2.png", "template-myth-fact-v1.png"],
  relatable: ["template-relatable-comic-v2.png", "template-question-poll-v1.png"],
  community: ["template-question-poll-v1.png", "template-myth-fact-v1.png"],
  affiliate: ["template-single-product-review-v1.png", "template-product-compare-v2.png"]
};

function kstDate(base: Date, dayOffset: number, time: string): string {
  const kst = new Date(base.getTime() + 9 * 3_600_000);
  kst.setUTCDate(kst.getUTCDate() + dayOffset);
  const date = kst.toISOString().slice(0, 10);
  return `${date}T${time}:00+09:00`;
}

export function buildQueue(
  days: number,
  brand: BrandConfig,
  automation: AutomationConfig,
  seeds: ContentSeed[],
  products: Product[],
  now = new Date()
): QueuePost[] {
  const activeProducts = products.filter((product) => product.active);
  const byPillar = new Map<Pillar, ContentSeed[]>();
  for (const pillar of cycle) byPillar.set(pillar, seeds.filter((seed) => seed.pillar === pillar));
  const counters = new Map<Pillar, number>();
  const posts: QueuePost[] = [];
  let ordinal = 0;
  for (let day = 1; day <= days; day += 1) {
    const postsToday = day % 3 === 0 ? Math.min(2, brand.maxPostsPerDay) : 1;
    for (let slot = 0; slot < postsToday; slot += 1) {
      let pillar = cycle[ordinal % cycle.length]!;
      if (pillar === "affiliate" && activeProducts.length === 0) pillar = "info";
      const available = byPillar.get(pillar) ?? [];
      if (available.length === 0) continue;
      const count = counters.get(pillar) ?? 0;
      const seed = available[count % available.length]!;
      counters.set(pillar, count + 1);
      const product = pillar === "affiliate" ? activeProducts[count % activeProducts.length] : undefined;
      const scheduledAt = kstDate(now, day, brand.postingTimes[slot % brand.postingTimes.length]!);
      const templatePool = templates[pillar];
      const post: QueuePost = {
        id: idFor(scheduledAt, pillar, ordinal + 1),
        pillar,
        scheduledAt,
        status: pillar === "affiliate" && automation.affiliateRequiresApproval ? "draft" : automation.autoApproveNonAffiliate ? "approved" : "draft",
        hook: product ? `${product.name}, 모하프가 먼저 살펴봤어요` : seed.hook,
        body: product ? `${seed.body} 현재 표시 가격은 ${product.price.toLocaleString("ko-KR")}원이며 구매 전 옵션과 최종 결제 금액을 다시 확인해주세요.` : seed.body,
        cta: seed.cta,
        text: "",
        template: templatePool[ordinal % templatePool.length]!,
        productId: product?.id,
        affiliateUrl: product?.affiliateUrl,
        priceCheckedAt: product?.priceCheckedAt,
        requiresApproval: pillar === "affiliate" && automation.affiliateRequiresApproval,
        attempts: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      post.text = composeText(post, brand);
      posts.push(post);
      ordinal += 1;
    }
  }
  return posts;
}
