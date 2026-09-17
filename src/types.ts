export type Pillar = "info" | "relatable" | "community" | "affiliate";
export type PostStatus = "draft" | "approved" | "rendered" | "published" | "deleted" | "failed" | "skipped";

export interface BrandConfig {
  name: string;
  voice: string;
  characterRules: string[];
  contentRatio: Record<Pillar, number>;
  postingTimes: string[];
  timezone: string;
  maxPostsPerDay: number;
  minNonAffiliateBetweenAffiliate: number;
  priceMaxAgeHours: number;
  disclosure: string;
  hashtags: string[];
}

export interface AutomationConfig {
  autoApproveNonAffiliate: boolean;
  affiliateRequiresApproval: boolean;
  defaultReplyControl: "everyone" | "accounts_you_follow" | "mentioned_only" | "followers_only";
  renderWidth: number;
  renderQuality: number;
  maxAttempts: number;
  publishOnePerRun: boolean;
  dryRunByDefault: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  affiliateUrl: string;
  price: number;
  priceCheckedAt: string;
  active: boolean;
  notes: string;
  tacaItemId?: number;
  originalPrice?: number;
  discountRate?: number;
  reviewScore?: number;
  reviewCount?: number;
  rank?: number;
}

export interface ContentSeed {
  pillar: Pillar;
  hook: string;
  body: string;
  cta: string;
}

export interface QueuePost {
  id: string;
  pillar: Pillar;
  scheduledAt: string;
  status: PostStatus;
  hook: string;
  body: string;
  cta: string;
  text: string;
  template: string;
  productId?: string;
  affiliateUrl?: string;
  priceCheckedAt?: string;
  requiresApproval: boolean;
  imagePath?: string;
  imagePaths?: string[];
  publicImageUrl?: string;
  publicImageUrls?: string[];
  briefId?: string;
  threadsPostId?: string;
  permalink?: string;
  deletedAt?: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  postId?: string;
}
