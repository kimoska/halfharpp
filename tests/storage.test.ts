import { describe, expect, it } from "vitest";
import { parseProductsCsv } from "../src/storage.js";

describe("product CSV storage", () => {
  it("preserves Toss identifiers and editorial product facts", () => {
    const [product] = parseProductsCsv([
      "id,taca_item_id,name,category,affiliate_url,price,original_price,discount_rate,review_score,review_count,rank,price_checked_at,active,notes",
      "toss-123,123,수납함,생활,https://toss.im/_m/a,9900,15000,34,4.7,982,3,2026-09-15T00:00:00Z,true,API"
    ].join("\n"));
    expect(product).toMatchObject({
      id: "toss-123", tacaItemId: 123, price: 9900, originalPrice: 15000,
      discountRate: 34, reviewScore: 4.7, reviewCount: 982, rank: 3, active: true
    });
  });
});
