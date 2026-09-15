import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { QueuePost } from "./types.js";
import { paths } from "./paths.js";
import { escapeXml, wrapKorean } from "./utils.js";

interface TextBlock { x: number; y: number; width: number; size: number; maxUnits: number; lineHeight: number; maxLines: number; color: string; align?: "start" | "middle"; }

const layoutByTemplate: Record<string, { title: TextBlock; body: TextBlock; cta?: TextBlock }> = {
  "template-question-poll-v1.png": {
    title: { x: 627, y: 155, width: 920, size: 50, maxUnits: 17, lineHeight: 64, maxLines: 2, color: "#553b29", align: "middle" },
    body: { x: 627, y: 305, width: 900, size: 31, maxUnits: 26, lineHeight: 45, maxLines: 5, color: "#4d463d", align: "middle" },
    cta: { x: 900, y: 690, width: 510, size: 28, maxUnits: 17, lineHeight: 39, maxLines: 2, color: "#4d463d", align: "middle" }
  },
  "template-checklist-v1.png": {
    title: { x: 627, y: 135, width: 880, size: 46, maxUnits: 17, lineHeight: 58, maxLines: 2, color: "#553b29", align: "middle" },
    body: { x: 245, y: 325, width: 760, size: 29, maxUnits: 22, lineHeight: 155, maxLines: 4, color: "#4d463d" }
  },
  "template-myth-fact-v1.png": {
    title: { x: 627, y: 100, width: 1020, size: 44, maxUnits: 21, lineHeight: 56, maxLines: 2, color: "#553b29", align: "middle" },
    body: { x: 315, y: 310, width: 480, size: 29, maxUnits: 15, lineHeight: 42, maxLines: 7, color: "#4d463d", align: "middle" },
    cta: { x: 940, y: 330, width: 470, size: 29, maxUnits: 15, lineHeight: 42, maxLines: 5, color: "#4d463d", align: "middle" }
  },
  "template-single-product-review-v1.png": {
    title: { x: 627, y: 110, width: 940, size: 46, maxUnits: 19, lineHeight: 59, maxLines: 2, color: "#553b29", align: "middle" },
    body: { x: 627, y: 330, width: 880, size: 30, maxUnits: 26, lineHeight: 43, maxLines: 6, color: "#4d463d", align: "middle" },
    cta: { x: 820, y: 930, width: 500, size: 27, maxUnits: 17, lineHeight: 38, maxLines: 3, color: "#4d463d", align: "middle" }
  },
  "template-relatable-comic-v2.png": {
    title: { x: 470, y: 140, width: 740, size: 40, maxUnits: 17, lineHeight: 52, maxLines: 2, color: "#553b29", align: "middle" },
    body: { x: 470, y: 300, width: 720, size: 28, maxUnits: 22, lineHeight: 40, maxLines: 6, color: "#4d463d", align: "middle" },
    cta: { x: 265, y: 1185, width: 400, size: 23, maxUnits: 16, lineHeight: 33, maxLines: 3, color: "#4d463d", align: "middle" }
  },
  "template-info-3step-v2.png": {
    title: { x: 561, y: 190, width: 850, size: 40, maxUnits: 21, lineHeight: 52, maxLines: 2, color: "#553b29", align: "middle" },
    body: { x: 561, y: 465, width: 760, size: 29, maxUnits: 23, lineHeight: 52, maxLines: 6, color: "#4d463d", align: "middle" }
  },
  "template-product-compare-v2.png": {
    title: { x: 561, y: 150, width: 860, size: 43, maxUnits: 18, lineHeight: 56, maxLines: 2, color: "#553b29", align: "middle" },
    body: { x: 561, y: 880, width: 760, size: 28, maxUnits: 24, lineHeight: 40, maxLines: 5, color: "#4d463d", align: "middle" }
  }
};

function tspans(value: string, block: TextBlock): string {
  const lines = wrapKorean(value, block.maxUnits).slice(0, block.maxLines);
  const anchor = block.align === "middle" ? "middle" : "start";
  return lines.map((line, index) => `<text x="${block.x}" y="${block.y + index * block.lineHeight}" text-anchor="${anchor}" font-family="Malgun Gothic, Noto Sans KR, sans-serif" font-size="${block.size}" font-weight="${index === 0 ? 700 : 500}" fill="${block.color}">${escapeXml(line)}</text>`).join("");
}

export async function renderPost(post: QueuePost): Promise<string> {
  const templatePath = path.join(paths.assets, post.template);
  const layout = layoutByTemplate[post.template];
  if (!layout) throw new Error(`지원하지 않는 템플릿: ${post.template}`);
  const metadata = await sharp(templatePath).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`템플릿 크기를 읽지 못했습니다: ${post.template}`);
  const svg = `<svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg">${tspans(post.hook, layout.title)}${tspans(post.body, layout.body)}${layout.cta ? tspans(post.cta, layout.cta) : ""}</svg>`;
  await fs.mkdir(paths.generated, { recursive: true });
  const output = path.join(paths.generated, `${post.id}.png`);
  await sharp(templatePath).composite([{ input: Buffer.from(svg) }]).png({ quality: 92, compressionLevel: 9 }).toFile(output);
  return output;
}
