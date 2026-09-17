import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { EditorialBrief } from "../research-types.js";
import { paths } from "../paths.js";
import { escapeXml, wrapKorean } from "../utils.js";

const W = 1080;
const H = 1350;
const cocoa = "#382A22";
const sage = "#536F50";
const pale = "#EDF1E6";
const apricot = "#E5A069";
const cream = "#FBF7EF";

function lines(text: string, max: number, x: number, y: number, size: number, lineHeight: number, weight = 650, color = cocoa): string {
  return wrapKorean(text, max).map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" font-family="Malgun Gothic, Noto Sans KR, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(line.trimEnd())}</text>`).join("");
}

function shell(order: number, label: string, inner: string): Buffer {
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1350" fill="${order === 1 ? "#FFFDF9" : cream}" fill-opacity="${order === 1 ? ".12" : "1"}"/>
    <rect x="56" y="48" width="968" height="1254" rx="42" fill="#FFFDF9" fill-opacity="${order === 1 ? ".84" : "1"}" stroke="#D8CABB" stroke-width="2"/>
    <rect x="88" y="80" width="190" height="44" rx="22" fill="${pale}"/>
    <text x="183" y="110" text-anchor="middle" font-family="Malgun Gothic" font-size="20" font-weight="800" fill="${sage}">${escapeXml(label)}</text>
    <text x="965" y="110" text-anchor="end" font-family="Malgun Gothic" font-size="20" font-weight="700" fill="#9B8776">${order} / 6</text>
    ${inner}
    <line x1="92" y1="1218" x2="988" y2="1218" stroke="#E5DDD2" stroke-width="2"/>
    <text x="94" y="1261" font-family="Malgun Gothic" font-size="24" font-weight="800" fill="${sage}">하프하프 모하프</text>
    <text x="985" y="1261" text-anchor="end" font-family="Malgun Gothic" font-size="18" font-weight="600" fill="#9B8776">견적서는 총액보다 빈칸을 보세요</text>
  </svg>`);
}

function cardSvg(order: number): Buffer {
  if (order === 1) return shell(1, "이사 견적", `
    <rect x="86" y="156" width="700" height="770" rx="36" fill="#FBF7EF" fill-opacity=".96"/>
    <text x="118" y="225" font-family="Malgun Gothic" font-size="23" font-weight="800" fill="${apricot}">MOVING QUOTE CHECK</text>
    <text x="116" y="350" font-family="Malgun Gothic" font-size="61" font-weight="900" fill="${cocoa}">32만원 견적이</text>
    <text x="116" y="442" font-family="Malgun Gothic" font-size="61" font-weight="900" fill="${sage}">당일 49만원이 되는</text>
    <text x="116" y="534" font-family="Malgun Gothic" font-size="61" font-weight="900" fill="${cocoa}">이유</text>
    <rect x="116" y="594" width="530" height="5" rx="2" fill="${apricot}"/>
    ${lines("처음 부른 금액보다, 견적서에 빠진 항목이 얼마인지 봐야 합니다.", 19, 118, 676, 32, 52, 700)}
    <rect x="116" y="846" width="390" height="58" rx="29" fill="${sage}"/><text x="311" y="884" text-anchor="middle" font-family="Malgun Gothic" font-size="22" font-weight="800" fill="#FFFFFF">가상 견적으로 직접 비교</text>`);

  if (order === 2) return shell(2, "실제 사례", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="54" font-weight="900" fill="${cocoa}">85만원에 계약했는데</text>
    <text x="92" y="286" font-family="Malgun Gothic" font-size="54" font-weight="900" fill="${sage}">이사 날 50만원을 더 요구</text>
    <rect x="92" y="350" width="895" height="270" rx="36" fill="#3E5140"/>
    <text x="540" y="430" text-anchor="middle" font-family="Malgun Gothic" font-size="25" font-weight="800" fill="#DCE7D2">한국소비자원 피해 사례</text>
    <text x="540" y="522" text-anchor="middle" font-family="Malgun Gothic" font-size="54" font-weight="900" fill="#FFFFFF">추가비 요구 24.9%</text>
    <text x="540" y="573" text-anchor="middle" font-family="Malgun Gothic" font-size="21" font-weight="650" fill="#F3C89F">소규모 이사 피해구제 유형 중 2위</text>
    <rect x="92" y="668" width="895" height="218" rx="34" fill="${pale}"/>${lines("방문 견적 없이 전화나 메시지로 계약하면, 서로 알고 있던 짐의 양과 작업 조건이 달라지기 쉽습니다.", 29, 134, 742, 29, 47, 720)}
    <text x="92" y="978" font-family="Malgun Gothic" font-size="22" font-weight="650" fill="#9B8776">출처: 한국소비자원, 2026. 4. 27.</text>`);

  if (order === 3) return shell(3, "싼 견적의 빈칸", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="53" font-weight="900" fill="${cocoa}">“32만원”만 비교하면 놓치는 것</text>
    <text x="92" y="270" font-family="Malgun Gothic" font-size="24" font-weight="600" fill="#75675D">아래 항목이 포함인지 별도인지 먼저 보세요</text>
    ${["사다리차·엘리베이터 사용료","작업 인원과 추가 인력 비용","가전·가구 분해와 설치 비용","주차 거리·대기 시간 추가비","버릴 짐 운반·폐기 비용"].map((t,i)=>`<rect x="92" y="${332+i*148}" width="895" height="112" rx="26" fill="${i%2?pale:"#F8EFE5"}"/><circle cx="151" cy="${388+i*148}" r="27" fill="${i%2?sage:apricot}"/><text x="151" y="${397+i*148}" text-anchor="middle" font-family="Malgun Gothic" font-size="22" font-weight="900" fill="#fff">${i+1}</text><text x="204" y="${399+i*148}" font-family="Malgun Gothic" font-size="27" font-weight="800" fill="${cocoa}">${t}</text>`).join("")}`);

  if (order === 4) return shell(4, "총액 비교", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="54" font-weight="900" fill="${cocoa}">낮은 견적이 더 비쌀 수 있습니다</text>
    <text x="92" y="270" font-family="Malgun Gothic" font-size="23" font-weight="700" fill="#9B8776">※ 구조를 설명하기 위한 가상 금액입니다</text>
    <rect x="92" y="346" width="430" height="500" rx="34" fill="#F8EFE5"/><rect x="558" y="346" width="430" height="500" rx="34" fill="${pale}"/>
    <text x="132" y="416" font-family="Malgun Gothic" font-size="28" font-weight="900" fill="#A76B3F">A업체 · 처음 32만원</text>
    <text x="132" y="500" font-family="Malgun Gothic" font-size="25" font-weight="700" fill="${cocoa}">사다리차 8만원</text><text x="132" y="552" font-family="Malgun Gothic" font-size="25" font-weight="700" fill="${cocoa}">추가 인력 5만원</text><text x="132" y="604" font-family="Malgun Gothic" font-size="25" font-weight="700" fill="${cocoa}">분해·설치 4만원</text><line x1="132" y1="650" x2="480" y2="650" stroke="#CFAF92" stroke-width="3"/><text x="132" y="738" font-family="Malgun Gothic" font-size="55" font-weight="900" fill="#A76B3F">총 49만원</text>
    <text x="598" y="416" font-family="Malgun Gothic" font-size="28" font-weight="900" fill="${sage}">B업체 · 처음 39만원</text>
    <text x="598" y="500" font-family="Malgun Gothic" font-size="25" font-weight="700" fill="${cocoa}">사다리차 포함</text><text x="598" y="552" font-family="Malgun Gothic" font-size="25" font-weight="700" fill="${cocoa}">작업 인원 확정</text><text x="598" y="604" font-family="Malgun Gothic" font-size="25" font-weight="700" fill="${cocoa}">분해·설치 포함</text><line x1="598" y1="650" x2="946" y2="650" stroke="#AFC2A7" stroke-width="3"/><text x="598" y="738" font-family="Malgun Gothic" font-size="55" font-weight="900" fill="${sage}">총 39만원</text>
    <rect x="92" y="898" width="895" height="142" rx="30" fill="#3E5140"/><text x="540" y="958" text-anchor="middle" font-family="Malgun Gothic" font-size="25" font-weight="800" fill="#DCE7D2">비교할 숫자는 첫 견적이 아니라</text><text x="540" y="1010" text-anchor="middle" font-family="Malgun Gothic" font-size="39" font-weight="900" fill="#FFFFFF">추가비까지 넣은 예상 총액</text>`);

  if (order === 5) return shell(5, "사진으로 견적", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="53" font-weight="900" fill="${cocoa}">방문 견적이 어렵다면 이렇게 보내세요</text>
    <text x="92" y="270" font-family="Malgun Gothic" font-size="24" font-weight="600" fill="#75675D">방을 한 번 훑은 영상보다 빠짐없는 목록이 낫습니다</text>
    ${["큰 가구·가전은 사진과 가로·세로 크기","박스·옷·주방짐은 예상 개수","출발지와 도착지의 층·엘리베이터","주차 위치에서 현관까지 거리","버릴 짐과 분해·설치할 물건"].map((t,i)=>`<rect x="92" y="${332+i*148}" width="895" height="112" rx="26" fill="${i%2?pale:"#F8EFE5"}"/><rect x="124" y="${363+i*148}" width="50" height="50" rx="12" fill="${i%2?sage:apricot}"/><path d="M137 ${388+i*148}l10 10 19-23" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><text x="204" y="${399+i*148}" font-family="Malgun Gothic" font-size="27" font-weight="800" fill="${cocoa}">${t}</text>`).join("")}`);

  return shell(6, "그대로 보내기", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="51" font-weight="900" fill="${cocoa}">예약금 보내기 전에</text><text x="92" y="284" font-family="Malgun Gothic" font-size="51" font-weight="900" fill="${sage}">이 내용은 글로 확인하세요</text>
    <rect x="92" y="350" width="895" height="548" rx="38" fill="#F2F4ED" stroke="#AEBDA5" stroke-width="3"/>
    ${lines("보내드린 짐 목록과 작업 조건을 기준으로, 추가비까지 포함한 최종 금액을 알려주세요.", 27, 142, 444, 31, 52, 760)}
    ${lines("사다리차·엘리베이터, 추가 인력, 분해·설치, 주차 거리 비용이 각각 포함돼 있는지도 적어주세요.", 27, 142, 646, 31, 52, 760)}
    <rect x="142" y="818" width="436" height="54" rx="27" fill="${sage}"/><text x="360" y="853" text-anchor="middle" font-family="Malgun Gothic" font-size="21" font-weight="800" fill="#fff">통화보다 문자·견적서로 받기</text>
    <rect x="92" y="944" width="895" height="138" rx="30" fill="#3E5140"/>${lines("현장에서 조건이 달라지면 어떤 경우에 얼마가 추가되는지도 적어달라고 하세요.", 31, 132, 997, 27, 43, 780, "#FFFFFF")}`);
}

const poses = ["07-calculator.png", "03-surprised.png", "02-confused.png", "07-calculator.png", "05-thinking.png", "09-greeting.png"];

function whiskers(size: number): Buffer {
  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg"><path d="M48 132 Q63 128 79 132 M51 146 Q66 140 81 143 M181 132 Q197 128 212 132 M179 143 Q194 140 209 146" fill="none" stroke="#9A633D" stroke-width="3.5" stroke-linecap="round"/></svg>`);
}

export async function renderMovingQuoteEditorial(brief: EditorialBrief): Promise<string[]> {
  const outputDir = path.join(paths.generated, "briefs", brief.id);
  await fs.mkdir(outputDir, { recursive: true });
  const backgroundPath = path.join(paths.assets, "editorial", "moving-quote-desk-v1.png");
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
