import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { CardSlide, EditorialBrief } from "../research-types.js";
import { paths } from "../paths.js";
import { escapeXml, wrapKorean } from "../utils.js";

const WIDTH = 1080;
const HEIGHT = 1350;
const roleLabels: Record<CardSlide["role"], string> = {
  hook: "오늘의 생활비 질문",
  problem: "왜 새는지 찾기",
  evidence: "근거 확인",
  calculation: "직접 계산",
  action: "오늘 해볼 일",
  question: "같이 이야기해요",
  product: "구매 판단표"
};

const poseByRole: Record<CardSlide["role"], string> = {
  hook: "03-surprised.png",
  problem: "02-confused.png",
  evidence: "05-thinking.png",
  calculation: "07-calculator.png",
  action: "09-greeting.png",
  question: "04-excited.png",
  product: "08-shopping.png"
};

function roleGraphic(role: CardSlide["role"]): string {
  const common = `<circle cx="820" cy="825" r="142" fill="#EEF3E4" stroke="#A9BE86" stroke-width="4"/>`;
  if (role === "evidence") return `${common}<rect x="755" y="742" width="130" height="166" rx="14" fill="#FFFDF7" stroke="#6E8A50" stroke-width="7"/><line x1="780" y1="790" x2="860" y2="790" stroke="#C98B52" stroke-width="8"/><line x1="780" y1="830" x2="860" y2="830" stroke="#A9BE86" stroke-width="8"/><line x1="780" y1="870" x2="840" y2="870" stroke="#A9BE86" stroke-width="8"/>`;
  if (role === "calculation") return `${common}<rect x="746" y="746" width="148" height="164" rx="22" fill="#FFFDF7" stroke="#6E8A50" stroke-width="7"/><rect x="770" y="772" width="100" height="34" rx="8" fill="#F6DFA8"/><text x="790" y="866" font-family="Malgun Gothic, sans-serif" font-size="62" font-weight="800" fill="#C98B52">+ −</text>`;
  if (role === "action") return `${common}<rect x="748" y="748" width="150" height="160" rx="22" fill="#FFFDF7" stroke="#6E8A50" stroke-width="7"/><path d="M770 790l12 12 24-29M770 835l12 12 24-29M770 880l12 12 24-29" fill="none" stroke="#C98B52" stroke-width="9" stroke-linecap="round"/><path d="M820 790h54M820 835h54M820 880h54" stroke="#A9BE86" stroke-width="8" stroke-linecap="round"/>`;
  if (role === "question") return `${common}<path d="M749 770h143v92H820l-34 30v-30h-37z" fill="#FFFDF7" stroke="#6E8A50" stroke-width="7" stroke-linejoin="round"/><text x="820" y="838" text-anchor="middle" font-family="Malgun Gothic, sans-serif" font-size="70" font-weight="800" fill="#C98B52">?</text>`;
  if (role === "problem") return `${common}<circle cx="820" cy="820" r="74" fill="#FFFDF7" stroke="#C98B52" stroke-width="8"/><text x="820" y="852" text-anchor="middle" font-family="Malgun Gothic, sans-serif" font-size="92" font-weight="800" fill="#C98B52">!</text>`;
  if (role === "product") return `${common}<path d="M756 781h128l-16 104H774z" fill="#FFFDF7" stroke="#6E8A50" stroke-width="7"/><path d="M785 782c0-50 70-50 70 0" fill="none" stroke="#C98B52" stroke-width="8"/>`;
  return `${common}<text x="820" y="862" text-anchor="middle" font-family="Malgun Gothic, sans-serif" font-size="112" font-weight="800" fill="#C98B52">₩</text>`;
}

function textLines(value: string, maxUnits: number, maxLines: number, x: number, y: number, size: number, lineHeight: number, weight: number, color: string): string {
  return wrapKorean(value, maxUnits).slice(0, maxLines).map((line, index) =>
    `<text x="${x}" y="${y + index * lineHeight}" font-family="Malgun Gothic, Noto Sans KR, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(line)}</text>`
  ).join("");
}

function sourceLine(brief: EditorialBrief, slide: CardSlide): string {
  if (slide.role !== "evidence" || brief.evidence.length === 0) return "";
  const evidence = brief.evidence[0]!;
  return `출처 · ${evidence.publisher} · ${evidence.title}`;
}

function slideSvg(brief: EditorialBrief, slide: CardSlide): Buffer {
  const source = sourceLine(brief, slide);
  const progress = `${slide.order} / ${brief.slides.length}`;
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1350" fill="#FFF9EB"/>
    <circle cx="965" cy="110" r="130" fill="#F6DFA8" opacity=".52"/>
    <circle cx="72" cy="1240" r="150" fill="#DCE9C7" opacity=".7"/>
    <rect x="70" y="72" width="940" height="1206" rx="46" fill="#FFFDF7" stroke="#C98B52" stroke-width="5"/>
    <rect x="118" y="128" width="${Math.max(210, roleLabels[slide.role].length * 30)}" height="58" rx="29" fill="#EAF2D9"/>
    <text x="145" y="168" font-family="Malgun Gothic, Noto Sans KR, sans-serif" font-size="27" font-weight="700" fill="#55733F">${escapeXml(roleLabels[slide.role])}</text>
    <text x="914" y="168" text-anchor="end" font-family="Malgun Gothic, sans-serif" font-size="25" font-weight="700" fill="#9B7A5E">${progress}</text>
    ${textLines(slide.headline, 14, 3, 120, 285, 64, 82, 800, "#49372A")}
    <line x1="120" y1="525" x2="960" y2="525" stroke="#E8D7BD" stroke-width="3"/>
    ${textLines(slide.body, 24, 6, 120, 610, 37, 59, 500, "#514B43")}
    ${roleGraphic(slide.role)}
    ${source ? `<rect x="120" y="1008" width="840" height="88" rx="22" fill="#F5F0E8"/>${textLines(source, 42, 2, 148, 1046, 22, 31, 500, "#786A5D")}` : ""}
    <text x="120" y="1208" font-family="Malgun Gothic, sans-serif" font-size="27" font-weight="800" fill="#55733F">하프하프 모하프</text>
    <text x="120" y="1244" font-family="Malgun Gothic, sans-serif" font-size="20" font-weight="500" fill="#9B7A5E">모으고 아끼는 생활비 연구소</text>
  </svg>`;
  return Buffer.from(svg);
}

const whiskers = Buffer.from(`<svg width="260" height="260" xmlns="http://www.w3.org/2000/svg">
  <path d="M48 132 Q63 128 79 132 M51 146 Q66 140 81 143 M181 132 Q197 128 212 132 M179 143 Q194 140 209 146" fill="none" stroke="#9A633D" stroke-width="3.5" stroke-linecap="round"/>
</svg>`);

export async function renderEditorialBrief(brief: EditorialBrief): Promise<string[]> {
  const outputDir = path.join(paths.generated, "briefs", brief.id);
  await fs.mkdir(outputDir, { recursive: true });
  const outputs: string[] = [];
  for (const slide of brief.slides) {
    const posePath = path.join(paths.assets, "poses-v1", poseByRole[slide.role]);
    const resizedPose = await sharp(posePath).resize({ width: 260, height: 260, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const pose = await sharp(resizedPose).composite([{ input: whiskers }]).png().toBuffer();
    const output = path.join(outputDir, `${String(slide.order).padStart(2, "0")}.png`);
    await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: "#FFF9EB" } })
      .composite([{ input: slideSvg(brief, slide) }, { input: pose, left: 744, top: 1020 }])
      .png({ compressionLevel: 9, quality: 95 })
      .toFile(output);
    outputs.push(output);
  }
  return outputs;
}
