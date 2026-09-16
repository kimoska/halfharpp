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

function slideContent(brief: EditorialBrief, slide: CardSlide): string {
  const source = sourceLine(brief, slide);
  if (slide.role === "hook") return `
    ${textLines(slide.headline, 13, 3, 120, 320, 72, 92, 800, "#49372A")}
    <rect x="120" y="610" width="600" height="268" rx="34" fill="#EAF2D9"/>
    ${textLines(slide.body, 17, 5, 164, 676, 35, 54, 600, "#3F5333")}
    <circle cx="850" cy="700" r="126" fill="#F6DFA8" opacity=".72"/>
    <text x="850" y="741" text-anchor="middle" font-family="Malgun Gothic, sans-serif" font-size="108" font-weight="900" fill="#C98B52">?</text>`;
  if (slide.role === "evidence") return `
    ${textLines(slide.headline, 15, 2, 120, 292, 60, 78, 800, "#49372A")}
    <rect x="120" y="440" width="840" height="300" rx="36" fill="#F5F0E8"/>
    ${textLines(slide.body, 21, 5, 164, 515, 34, 55, 500, "#514B43")}
    <rect x="120" y="790" width="840" height="138" rx="28" fill="#EAF2D9" stroke="#A9BE86" stroke-width="3"/>
    <text x="154" y="836" font-family="Malgun Gothic, sans-serif" font-size="22" font-weight="800" fill="#55733F">확인한 원문</text>
    ${textLines(source || "등록된 근거 자료", 44, 2, 154, 878, 23, 32, 500, "#675E55")}`;
  if (["calculation", "action", "product"].includes(slide.role)) return `
    ${textLines(slide.headline, 15, 2, 120, 292, 60, 78, 800, "#49372A")}
    <rect x="120" y="455" width="548" height="410" rx="38" fill="#FFF7E6" stroke="#E8D7BD" stroke-width="3"/>
    ${textLines(slide.body, 14, 7, 164, 530, 34, 53, 500, "#514B43")}
    ${roleGraphic(slide.role)}`;
  if (slide.role === "question") return `
    ${textLines(slide.headline, 14, 3, 120, 310, 66, 84, 800, "#49372A")}
    <path d="M120 570h650a34 34 0 0 1 34 34v205a34 34 0 0 1-34 34H360l-88 76 18-76H154a34 34 0 0 1-34-34z" fill="#EAF2D9" stroke="#A9BE86" stroke-width="4"/>
    ${textLines(slide.body, 17, 5, 166, 644, 34, 54, 600, "#3F5333")}
    <circle cx="878" cy="690" r="86" fill="#F6DFA8"/>
    <text x="878" y="728" text-anchor="middle" font-family="Malgun Gothic, sans-serif" font-size="102" font-weight="900" fill="#C98B52">?</text>`;
  return `
    ${textLines(slide.headline, 14, 3, 120, 285, 64, 82, 800, "#49372A")}
    <line x1="120" y1="525" x2="960" y2="525" stroke="#E8D7BD" stroke-width="3"/>
    ${textLines(slide.body, 24, 6, 120, 610, 37, 59, 500, "#514B43")}
    ${roleGraphic(slide.role)}`;
}

function slideSvg(brief: EditorialBrief, slide: CardSlide): Buffer {
  const progress = `${slide.order} / ${brief.slides.length}`;
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1350" fill="#FFF9EB"/>
    <circle cx="965" cy="110" r="130" fill="#F6DFA8" opacity=".52"/>
    <circle cx="72" cy="1240" r="150" fill="#DCE9C7" opacity=".7"/>
    <rect x="70" y="72" width="940" height="1206" rx="46" fill="#FFFDF7" stroke="#C98B52" stroke-width="5"/>
    <rect x="118" y="128" width="${Math.max(210, roleLabels[slide.role].length * 30)}" height="58" rx="29" fill="#EAF2D9"/>
    <text x="145" y="168" font-family="Malgun Gothic, Noto Sans KR, sans-serif" font-size="27" font-weight="700" fill="#55733F">${escapeXml(roleLabels[slide.role])}</text>
    <text x="914" y="168" text-anchor="end" font-family="Malgun Gothic, sans-serif" font-size="25" font-weight="700" fill="#9B7A5E">${progress}</text>
    ${slideContent(brief, slide)}
    <text x="120" y="1208" font-family="Malgun Gothic, sans-serif" font-size="27" font-weight="800" fill="#55733F">하프하프 모하프</text>
    <text x="120" y="1244" font-family="Malgun Gothic, sans-serif" font-size="20" font-weight="500" fill="#9B7A5E">모으고 아끼는 생활비 연구소</text>
  </svg>`;
  return Buffer.from(svg);
}

function whiskers(size: number): Buffer { return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg">
  <path d="M48 132 Q63 128 79 132 M51 146 Q66 140 81 143 M181 132 Q197 128 212 132 M179 143 Q194 140 209 146" fill="none" stroke="#9A633D" stroke-width="3.5" stroke-linecap="round"/>
</svg>`); }

function posePlacement(role: CardSlide["role"]): { size: number; left: number; top: number } {
  if (role === "hook") return { size: 330, left: 680, top: 900 };
  if (role === "question") return { size: 300, left: 704, top: 922 };
  if (role === "evidence") return { size: 236, left: 774, top: 1000 };
  return { size: 260, left: 744, top: 1020 };
}

export async function renderEditorialBrief(brief: EditorialBrief): Promise<string[]> {
  const outputDir = path.join(paths.generated, "briefs", brief.id);
  await fs.mkdir(outputDir, { recursive: true });
  const outputs: string[] = [];
  for (const slide of brief.slides) {
    const posePath = path.join(paths.assets, "poses-v1", poseByRole[slide.role]);
    const placement = posePlacement(slide.role);
    const resizedPose = await sharp(posePath).resize({ width: placement.size, height: placement.size, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const pose = await sharp(resizedPose).composite([{ input: whiskers(placement.size) }]).png().toBuffer();
    const output = path.join(outputDir, `${String(slide.order).padStart(2, "0")}.png`);
    await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: "#FFF9EB" } })
      .composite([{ input: slideSvg(brief, slide) }, { input: pose, left: placement.left, top: placement.top }])
      .png({ compressionLevel: 9, quality: 95 })
      .toFile(output);
    outputs.push(output);
  }
  return outputs;
}
