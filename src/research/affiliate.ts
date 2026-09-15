import type { BrandConfig, Product, QueuePost } from "../types.js";
import { validateProduct } from "../policy.js";

export function selectAffiliateProduct(products: Product[], queue: QueuePost[], brand: BrandConfig, now = new Date()): Product | undefined {
  const chronological = [...queue].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const lastAffiliate = chronological.map((post) => post.pillar).lastIndexOf("affiliate");
  const nonAffiliateSince = lastAffiliate < 0 ? chronological.length : chronological.length - lastAffiliate - 1;
  const affiliateCount = chronological.filter((post) => post.pillar === "affiliate").length;
  const eligible = products.filter((product) => product.active && !validateProduct(product, brand, now).some((issue) => issue.level === "error"));
  const isDue = eligible.length > 0
    && nonAffiliateSince >= brand.minNonAffiliateBetweenAffiliate
    && (affiliateCount + 1) / (chronological.length + 1) <= brand.contentRatio.affiliate;
  if (!isDue) return undefined;
  return eligible.find((product) => !chronological.some((post) => post.productId === product.id)) ?? eligible[0];
}
