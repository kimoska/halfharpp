import type { BrandConfig, Product, QueuePost, ValidationIssue } from "./types.js";
import { hasHttpUrl } from "./utils.js";

export function composeText(post: Pick<QueuePost, "pillar" | "hook" | "body" | "cta" | "affiliateUrl">, brand: BrandConfig): string {
  const core = [post.hook, "", post.body, "", post.cta].filter((part) => part !== undefined).join("\n");
  if (post.pillar !== "affiliate") return core;
  return `${brand.disclosure}\n\n${core}\n\n${post.affiliateUrl ?? ""}`.trim();
}

export function validateProduct(product: Product, brand: BrandConfig, now = new Date()): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!product.active) return issues;
  if (!hasHttpUrl(product.affiliateUrl) || product.affiliateUrl.includes("example.com")) {
    issues.push({ level: "error", code: "PRODUCT_LINK_INVALID", message: `${product.name}: 실제 제휴 링크가 아닙니다.` });
  }
  const checked = Date.parse(product.priceCheckedAt);
  if (!Number.isFinite(checked)) {
    issues.push({ level: "error", code: "PRICE_DATE_INVALID", message: `${product.name}: 가격 확인 시각이 없습니다.` });
  } else if ((now.getTime() - checked) / 3_600_000 > brand.priceMaxAgeHours) {
    issues.push({ level: "error", code: "PRICE_STALE", message: `${product.name}: 가격 확인 후 ${brand.priceMaxAgeHours}시간이 지났습니다.` });
  }
  return issues;
}

export function validatePost(post: QueuePost, brand: BrandConfig, now = new Date()): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!post.text.trim()) issues.push({ level: "error", code: "EMPTY_TEXT", message: "본문이 비어 있습니다.", postId: post.id });
  if (post.text.length > 500) issues.push({ level: "error", code: "TEXT_TOO_LONG", message: `본문이 500자를 넘습니다(${post.text.length}자).`, postId: post.id });
  if (!Number.isFinite(Date.parse(post.scheduledAt))) issues.push({ level: "error", code: "DATE_INVALID", message: "예약 시각이 올바르지 않습니다.", postId: post.id });
  if (post.imagePaths && (post.imagePaths.length < 1 || post.imagePaths.length > 10)) issues.push({ level: "error", code: "MEDIA_COUNT", message: "게시 이미지는 1~10장이어야 합니다.", postId: post.id });
  if (post.pillar === "affiliate") {
    if (!post.text.includes("[광고]") || !post.text.includes("수수료")) issues.push({ level: "error", code: "DISCLOSURE_MISSING", message: "광고·수수료 고지가 없습니다.", postId: post.id });
    if (!hasHttpUrl(post.affiliateUrl) || post.affiliateUrl?.includes("example.com")) issues.push({ level: "error", code: "AFFILIATE_LINK_INVALID", message: "실제 제휴 링크가 없습니다.", postId: post.id });
    const checked = Date.parse(post.priceCheckedAt ?? "");
    if (!Number.isFinite(checked) || (now.getTime() - checked) / 3_600_000 > brand.priceMaxAgeHours) issues.push({ level: "error", code: "PRICE_STALE", message: "가격 확인 시각이 만료됐습니다.", postId: post.id });
    if (post.requiresApproval && !["approved", "rendered", "published"].includes(post.status)) issues.push({ level: "warning", code: "APPROVAL_REQUIRED", message: "제휴 글은 승인 전 게시되지 않습니다.", postId: post.id });
  }
  return issues;
}

export function validateSpacing(queue: QueuePost[], brand: BrandConfig): ValidationIssue[] {
  const sorted = [...queue].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const issues: ValidationIssue[] = [];
  let nonAffiliateSince = brand.minNonAffiliateBetweenAffiliate;
  for (const post of sorted) {
    if (post.pillar === "affiliate") {
      if (nonAffiliateSince < brand.minNonAffiliateBetweenAffiliate) issues.push({ level: "error", code: "AFFILIATE_TOO_FREQUENT", message: `제휴 글 사이에 일반 글이 ${brand.minNonAffiliateBetweenAffiliate}개 미만입니다.`, postId: post.id });
      nonAffiliateSince = 0;
    } else {
      nonAffiliateSince += 1;
    }
  }
  return issues;
}

export function validateDuplicates(queue: QueuePost[]): ValidationIssue[] {
  const seen = new Map<string, string>();
  const issues: ValidationIssue[] = [];
  for (const post of queue) {
    const normalized = post.text.replace(/\s+/g, " ").trim().toLowerCase();
    const previous = seen.get(normalized);
    if (previous) issues.push({ level: "error", code: "DUPLICATE_COPY", message: `문안이 ${previous}와 중복됩니다.`, postId: post.id });
    else seen.set(normalized, post.id);
  }
  return issues;
}
