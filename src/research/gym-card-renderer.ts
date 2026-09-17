import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { EditorialBrief } from "../research-types.js";
import { paths } from "../paths.js";
import { escapeXml, wrapKorean } from "../utils.js";

const W = 1080;
const H = 1350;
const cocoa = "#382A22";
const sage = "#587252";
const pale = "#EDF1E6";
const apricot = "#E7A56E";
const cream = "#FBF7EF";

function lines(text: string, max: number, x: number, y: number, size: number, lineHeight: number, weight = 600, color = cocoa): string {
  return wrapKorean(text, max).map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" font-family="Malgun Gothic, Noto Sans KR, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(line.trimEnd())}</text>`).join("");
}

function shell(order: number, label: string, inner: string): Buffer {
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1350" fill="${order === 1 ? "#FFFDF9" : cream}" fill-opacity="${order === 1 ? ".14" : "1"}"/>
    <rect x="56" y="48" width="968" height="1254" rx="42" fill="#FFFDF9" fill-opacity="${order === 1 ? ".82" : "1"}" stroke="#D8CABB" stroke-width="2"/>
    <rect x="88" y="80" width="190" height="44" rx="22" fill="${pale}"/>
    <text x="183" y="110" text-anchor="middle" font-family="Malgun Gothic" font-size="20" font-weight="800" fill="${sage}">${escapeXml(label)}</text>
    <text x="965" y="110" text-anchor="end" font-family="Malgun Gothic" font-size="20" font-weight="700" fill="#9B8776">${order} / 6</text>
    ${inner}
    <line x1="92" y1="1218" x2="988" y2="1218" stroke="#E5DDD2" stroke-width="2"/>
    <text x="94" y="1261" font-family="Malgun Gothic" font-size="24" font-weight="800" fill="${sage}">하프하프 모하프</text>
    <text x="985" y="1261" text-anchor="end" font-family="Malgun Gothic" font-size="18" font-weight="600" fill="#9B8776">계약서와 함께 저장해 두세요</text>
  </svg>`);
}

function cardSvg(order: number): Buffer {
  if (order === 1) return shell(1, "환불 계산", `
    <rect x="86" y="156" width="690" height="760" rx="36" fill="#FBF7EF" fill-opacity=".96"/>
    <text x="118" y="225" font-family="Malgun Gothic" font-size="23" font-weight="800" fill="${apricot}">GYM REFUND CHECK</text>
    <text x="116" y="350" font-family="Malgun Gothic" font-size="62" font-weight="900" fill="${cocoa}">헬스장 환불,</text>
    <text x="116" y="442" font-family="Malgun Gothic" font-size="59" font-weight="900" fill="${cocoa}">정상가로 계산한다면</text>
    <text x="116" y="534" font-family="Malgun Gothic" font-size="59" font-weight="900" fill="${sage}">이것부터 확인하세요</text>
    <rect x="116" y="598" width="530" height="5" rx="2" fill="${apricot}"/>
    ${lines("할인 회원권을 중간에 해지할 때, 사용한 기간을 정말 정상가로 계산하는지부터 따져봐야 합니다.", 19, 118, 676, 31, 50, 680)}
    <rect x="116" y="846" width="370" height="58" rx="29" fill="${sage}"/><text x="301" y="884" text-anchor="middle" font-family="Malgun Gothic" font-size="22" font-weight="800" fill="#FFFFFF">가상 금액으로 직접 계산</text>`);

  if (order === 2) return shell(2, "먼저 기준", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="55" font-weight="900" fill="${cocoa}">환불 계산의 출발점은 실제 결제액</text>
    <text x="92" y="270" font-family="Malgun Gothic" font-size="24" font-weight="600" fill="#75675D">이용을 시작한 뒤 내 사정으로 해지하는 경우</text>
    <rect x="92" y="350" width="895" height="286" rx="36" fill="#3E5140"/>
    <text x="540" y="425" text-anchor="middle" font-family="Malgun Gothic" font-size="25" font-weight="800" fill="#DCE7D2">소비자분쟁해결기준 안내</text>
    <text x="540" y="510" text-anchor="middle" font-family="Malgun Gothic" font-size="36" font-weight="900" fill="#FFFFFF">실제 결제액 − 사용한 부분 − 결제액의 10%</text>
    <text x="540" y="570" text-anchor="middle" font-family="Malgun Gothic" font-size="23" font-weight="700" fill="#F3C89F">= 남은 환불금</text>
    <rect x="92" y="684" width="895" height="222" rx="34" fill="${pale}"/>${lines("헬스장이 안내한 ‘월 정상가’가 아니라 내가 실제로 낸 금액으로 계산했는지 확인해야 합니다.", 30, 136, 760, 30, 49, 740)}
    ${lines("※ 별도 특약·사업자 귀책 여부에 따라 달라질 수 있습니다.", 38, 92, 995, 23, 38, 650, "#9B8776")}`);

  if (order === 3) return shell(3, "직접 계산", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="55" font-weight="900" fill="${cocoa}">72만원·12개월, 3개월 썼다면</text>
    <text x="92" y="270" font-family="Malgun Gothic" font-size="23" font-weight="700" fill="#9B8776">※ 계산을 위한 가상 조건입니다</text>
    <rect x="92" y="344" width="895" height="160" rx="30" fill="${pale}"/><text x="132" y="408" font-family="Malgun Gothic" font-size="26" font-weight="800" fill="${sage}">사용한 부분</text><text x="940" y="442" text-anchor="end" font-family="Malgun Gothic" font-size="47" font-weight="900" fill="${cocoa}">72만원 ÷ 12 × 3 = 18만원</text>
    <rect x="92" y="536" width="895" height="160" rx="30" fill="#F8EFE5"/><text x="132" y="600" font-family="Malgun Gothic" font-size="26" font-weight="800" fill="#A76B3F">위약금 10%</text><text x="940" y="634" text-anchor="end" font-family="Malgun Gothic" font-size="47" font-weight="900" fill="${cocoa}">72만원 × 10% = 7만2천원</text>
    <rect x="92" y="742" width="895" height="242" rx="36" fill="#3E5140"/><text x="132" y="820" font-family="Malgun Gothic" font-size="26" font-weight="800" fill="#DCE7D2">가상 환불금</text><text x="132" y="920" font-family="Malgun Gothic" font-size="67" font-weight="900" fill="#FFFFFF">46만8천원</text>
    <text x="92" y="1075" font-family="Malgun Gothic" font-size="26" font-weight="800" fill="#75675D">72만원 − 18만원 − 7만2천원</text>`);

  if (order === 4) return shell(4, "왜 차이 날까", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="53" font-weight="900" fill="${cocoa}">월 정상가를 15만원으로 계산하면</text>
    <text x="92" y="270" font-family="Malgun Gothic" font-size="23" font-weight="700" fill="#9B8776">※ 업체 계산을 설명하기 위한 가상 예시입니다</text>
    <rect x="92" y="346" width="430" height="444" rx="34" fill="${pale}"/><rect x="558" y="346" width="430" height="444" rx="34" fill="#F8EFE5"/>
    <text x="132" y="418" font-family="Malgun Gothic" font-size="27" font-weight="900" fill="${sage}">실제 결제액 기준</text><text x="132" y="510" font-family="Malgun Gothic" font-size="25" font-weight="700" fill="${cocoa}">사용분 18만원</text><text x="132" y="558" font-family="Malgun Gothic" font-size="25" font-weight="700" fill="${cocoa}">위약금 7만2천원</text><text x="132" y="676" font-family="Malgun Gothic" font-size="54" font-weight="900" fill="${sage}">46만8천원</text>
    <text x="598" y="418" font-family="Malgun Gothic" font-size="27" font-weight="900" fill="#A76B3F">월 정상가 기준</text><text x="598" y="510" font-family="Malgun Gothic" font-size="25" font-weight="700" fill="${cocoa}">사용분 45만원</text><text x="598" y="558" font-family="Malgun Gothic" font-size="25" font-weight="700" fill="${cocoa}">위약금 7만2천원</text><text x="598" y="676" font-family="Malgun Gothic" font-size="54" font-weight="900" fill="#A76B3F">19만8천원</text>
    <rect x="92" y="838" width="895" height="180" rx="32" fill="#3E5140"/><text x="540" y="910" text-anchor="middle" font-family="Malgun Gothic" font-size="26" font-weight="800" fill="#DCE7D2">같은 계약·같은 사용기간인데</text><text x="540" y="978" text-anchor="middle" font-family="Malgun Gothic" font-size="45" font-weight="900" fill="#FFFFFF">환불금 차이 27만원</text>`);

  if (order === 5) return shell(5, "계약 전에", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="53" font-weight="900" fill="${cocoa}">계약하기 전에 이 4가지는 확인하세요</text>
    <text x="92" y="270" font-family="Malgun Gothic" font-size="24" font-weight="600" fill="#75675D">말로 들었다면 계약서에도 적어 달라고 하세요</text>
    ${["중도해지 때 사용분을 어떤 금액으로 계산하는지","무료 기간도 전체 계약기간에 포함하는지","PT 횟수와 이용할 수 있는 기간","휴회·해지는 어디로, 어떻게 신청하는지"].map((t,i)=>`<rect x="92" y="${340+i*172}" width="895" height="132" rx="28" fill="${i%2?pale:"#F8EFE5"}"/><circle cx="154" cy="${406+i*172}" r="31" fill="${i%2?sage:apricot}"/><text x="154" y="${417+i*172}" text-anchor="middle" font-family="Malgun Gothic" font-size="25" font-weight="900" fill="#fff">${i+1}</text><text x="210" y="${418+i*172}" font-family="Malgun Gothic" font-size="26" font-weight="800" fill="${cocoa}">${t}</text>`).join("")}`);

  return shell(6, "그대로 보내기", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="52" font-weight="900" fill="${cocoa}">“환불금 계산 내역을</text><text x="92" y="284" font-family="Malgun Gothic" font-size="52" font-weight="900" fill="${sage}">보내주세요”라고 말하세요</text>
    <rect x="92" y="350" width="895" height="540" rx="38" fill="#F2F4ED" stroke="#AEBDA5" stroke-width="3"/>
    ${lines("제가 낸 금액을 기준으로 사용한 금액, 위약금, 최종 환불금을 각각 적어서 보내주세요.", 27, 142, 458, 32, 54, 760)}
    ${lines("사용한 금액을 계산할 때 적용한 1개월 가격과 계약 조항도 알려주세요.", 27, 142, 680, 32, 54, 760)}
    <rect x="142" y="806" width="374" height="54" rx="27" fill="${sage}"/><text x="329" y="841" text-anchor="middle" font-family="Malgun Gothic" font-size="21" font-weight="800" fill="#fff">문자·메일로 답변 남기기</text>
    <rect x="92" y="936" width="895" height="146" rx="30" fill="#3E5140"/>${lines("계산 근거를 받지 못하거나 합의가 어렵다면 계약서와 결제 내역을 준비해 1372에 상담할 수 있습니다.", 31, 132, 996, 27, 43, 780, "#FFFFFF")}`);
}

const poses = ["07-calculator.png", "05-thinking.png", "07-calculator.png", "02-confused.png", "05-thinking.png", "09-greeting.png"];

function whiskers(size: number): Buffer {
  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg"><path d="M48 132 Q63 128 79 132 M51 146 Q66 140 81 143 M181 132 Q197 128 212 132 M179 143 Q194 140 209 146" fill="none" stroke="#9A633D" stroke-width="3.5" stroke-linecap="round"/></svg>`);
}

export async function renderGymRefundEditorial(brief: EditorialBrief): Promise<string[]> {
  const outputDir = path.join(paths.generated, "briefs", brief.id);
  await fs.mkdir(outputDir, { recursive: true });
  const backgroundPath = path.join(paths.assets, "editorial", "gym-refund-desk-v1.png");
  const outputs: string[] = [];
  for (let order = 1; order <= 6; order += 1) {
    const poseSize = order === 1 ? 270 : 185;
    const pose = await sharp(path.join(paths.assets, "poses-v1", poses[order - 1]!)).resize({ width: poseSize, height: poseSize, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).composite([{ input: whiskers(poseSize) }]).png().toBuffer();
    const layers: Array<{ input: Buffer; left: number; top: number }> = [];
    if (order === 1) layers.push({ input: await sharp(backgroundPath).resize(W, H, { fit: "cover" }).png().toBuffer(), left: 0, top: 0 });
    layers.push({ input: cardSvg(order), left: 0, top: 0 });
    if (order !== 6) layers.push({ input: pose, left: order === 1 ? 742 : 806, top: order === 1 ? 920 : 1018 });
    const output = path.join(outputDir, `${String(order).padStart(2, "0")}.png`);
    await sharp({ create: { width: W, height: H, channels: 4, background: cream } }).composite(layers).png({ compressionLevel: 9 }).toFile(output);
    outputs.push(output);
  }
  return outputs;
}
