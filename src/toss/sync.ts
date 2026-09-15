import fs from "node:fs/promises";
import type { Product } from "../types.js";
import { paths } from "../paths.js";
import { readJson, writeJsonAtomic } from "../storage.js";
import { TossSharelinkClient, type TossProductItem, type TossTrackingLink } from "./client.js";

interface CatalogCache { fetchedAt: string; items: TossProductItem[]; }
type LinkCache = Record<string, TossTrackingLink>;

function csv(value: string | number | boolean): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function cachedCatalog(client: TossSharelinkClient, maxAgeMs = 3_600_000): Promise<CatalogCache> {
  const saved = await readJson<CatalogCache>(paths.tossProducts).catch(() => undefined);
  if (saved && Date.now() - Date.parse(saved.fetchedAt) < maxAgeMs) return saved;
  const fresh = { fetchedAt: new Date().toISOString(), items: await client.bestSelling(20) };
  await writeJsonAtomic(paths.tossProducts, fresh);
  return fresh;
}

export async function syncTossProducts(client = new TossSharelinkClient(), maxProducts = 10): Promise<Product[]> {
  const catalog = await cachedCatalog(client);
  const links = await readJson<LinkCache>(paths.tossLinks).catch(() => ({} as LinkCache));
  const products: Product[] = [];
  for (const item of catalog.items.filter((candidate) => !candidate.isSoldOut).slice(0, maxProducts)) {
    let link = links[String(item.tacaItemId)];
    if (!link) {
      try {
        link = await client.issueLink(item.tacaItemId);
        links[String(item.tacaItemId)] = link;
      } catch (error) {
        console.warn(`- 링크 발급 제외 ${item.tacaItemId}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }
    products.push({
      id: `toss-${item.tacaItemId}`,
      tacaItemId: item.tacaItemId,
      name: item.displayName,
      category: item.categoryIds.at(-1)?.toString() ?? "기타",
      affiliateUrl: link.shortUrl || link.originUrl,
      price: item.displayPrice,
      originalPrice: item.originalPrice,
      discountRate: item.discountRate,
      reviewScore: item.reviewScore,
      reviewCount: item.reviewCount,
      rank: item.rank,
      priceCheckedAt: catalog.fetchedAt,
      active: true,
      notes: "토스 Open API 베스트 상품 · 이미지는 사용하지 않음"
    });
  }
  await writeJsonAtomic(paths.tossLinks, links);
  const headers = ["id", "name", "category", "affiliate_url", "price", "price_checked_at", "active", "notes"];
  const rows = products.map((product) => [product.id, product.name, product.category, product.affiliateUrl, product.price, product.priceCheckedAt, product.active, product.notes].map(csv).join(","));
  const temp = `${paths.products}.${process.pid}.tmp`;
  await fs.writeFile(temp, `${headers.join(",")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`, "utf8");
  await fs.rename(temp, paths.products);
  return products;
}
