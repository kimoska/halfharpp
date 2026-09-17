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
    <rect width="1080" height="1350" fill="${order === 1 ? "#FFFDF9" : cream}" fill-opacity="${order === 1 ? ".12" : "1"}"/>
    <rect x="56" y="48" width="968" height="1254" rx="42" fill="#FFFDF9" fill-opacity="${order === 1 ? ".78" : "1"}" stroke="#D8CABB" stroke-width="2"/>
    <rect x="88" y="80" width="178" height="44" rx="22" fill="${pale}"/>
    <text x="177" y="110" text-anchor="middle" font-family="Malgun Gothic, sans-serif" font-size="20" font-weight="800" fill="${sage}">${escapeXml(label)}</text>
    <text x="965" y="110" text-anchor="end" font-family="Malgun Gothic, sans-serif" font-size="20" font-weight="700" fill="#9B8776">${order} / 6</text>
    ${inner}
    <line x1="92" y1="1218" x2="988" y2="1218" stroke="#E5DDD2" stroke-width="2"/>
    <text x="94" y="1261" font-family="Malgun Gothic, sans-serif" font-size="24" font-weight="800" fill="${sage}">하프하프 모하프</text>
    <text x="985" y="1261" text-anchor="end" font-family="Malgun Gothic, sans-serif" font-size="18" font-weight="600" fill="#9B8776">저장해 두고 견적 받을 때 꺼내보세요</text>
  </svg>`);
}

function cardSvg(order: number): Buffer {
  if (order === 1) return shell(1, "생활비 가이드", `
    <rect x="86" y="156" width="605" height="772" rx="36" fill="#FBF7EF" fill-opacity=".96"/>
    <text x="118" y="225" font-family="Malgun Gothic, sans-serif" font-size="23" font-weight="800" fill="${apricot}">WEDDING BUDGET CHECK</text>
    <text x="116" y="347" font-family="Malgun Gothic, sans-serif" font-size="72" font-weight="900" fill="${cocoa}">웨딩 견적,</text>
    <text x="116" y="442" font-family="Malgun Gothic, sans-serif" font-size="72" font-weight="900" fill="${cocoa}">시작가 말고</text>
    <text x="116" y="537" font-family="Malgun Gothic, sans-serif" font-size="72" font-weight="900" fill="${sage}">이 5칸을 보세요</text>
    <rect x="116" y="604" width="494" height="5" rx="2" fill="${apricot}"/>
    ${lines("대관료·장식·식대·스드메·필수 선택품목을 같은 조건으로 더해야 진짜 비교가 됩니다.", 17, 118, 680, 32, 51, 650)}
    <rect x="116" y="846" width="398" height="58" rx="29" fill="${sage}"/>
    <text x="315" y="884" text-anchor="middle" font-family="Malgun Gothic, sans-serif" font-size="22" font-weight="800" fill="#FFFFFF">공식 자료 + 계산 예시 + 요청 문구</text>`);

  if (order === 2) return shell(2, "공개 가격 확인", `
    <text x="92" y="218" font-family="Malgun Gothic, sans-serif" font-size="56" font-weight="900" fill="${cocoa}">먼저 공개 가격 4칸</text>
    <text x="92" y="270" font-family="Malgun Gothic, sans-serif" font-size="25" font-weight="600" fill="#75675D">업체 홈페이지 또는 한국소비자원 참가격에서 확인</text>
    ${["01  대관료", "02  기본장식비", "03  1인 식대", "04  스드메"].map((t,i)=>`<rect x="92" y="${330+i*142}" width="600" height="108" rx="26" fill="${i%2?"#F8EFE5":pale}"/><text x="132" y="${398+i*142}" font-family="Malgun Gothic, sans-serif" font-size="34" font-weight="800" fill="${i%2?"#A76B3F":sage}">${t}</text>`).join("")}
    <rect x="92" y="930" width="895" height="188" rx="30" fill="#3E5140"/>
    <text x="130" y="986" font-family="Malgun Gothic, sans-serif" font-size="22" font-weight="800" fill="#DCE7D2">꼭 기억할 한 줄</text>
    ${lines("참가격의 ‘총비용’에는 선택품목이 포함되지 않습니다.", 22, 130, 1036, 31, 47, 800, "#FFFFFF")}`);

  if (order === 3) return shell(3, "견적서 추가 확인", `
    <text x="92" y="218" font-family="Malgun Gothic, sans-serif" font-size="56" font-weight="900" fill="${cocoa}">견적서에서 3칸 더</text>
    <text x="92" y="272" font-family="Malgun Gothic, sans-serif" font-size="25" font-weight="600" fill="#75675D">공개 가격만으로는 실제 계약 총액이 완성되지 않아요</text>
    <rect x="92" y="336" width="895" height="188" rx="32" fill="${pale}"/><circle cx="164" cy="430" r="42" fill="${sage}"/><text x="164" y="443" text-anchor="middle" font-family="Malgun Gothic" font-size="31" font-weight="900" fill="#fff">1</text><text x="232" y="408" font-family="Malgun Gothic" font-size="34" font-weight="900" fill="${cocoa}">필수 선택품목</text><text x="232" y="456" font-family="Malgun Gothic" font-size="24" font-weight="600" fill="#6E635B">선택처럼 보이지만 계약에 꼭 붙는 항목인지</text>
    <rect x="92" y="552" width="895" height="188" rx="32" fill="#F8EFE5"/><circle cx="164" cy="646" r="42" fill="${apricot}"/><text x="164" y="659" text-anchor="middle" font-family="Malgun Gothic" font-size="31" font-weight="900" fill="#fff">2</text><text x="232" y="624" font-family="Malgun Gothic" font-size="34" font-weight="900" fill="${cocoa}">최소보증인원</text><text x="232" y="672" font-family="Malgun Gothic" font-size="24" font-weight="600" fill="#6E635B">실제 하객이 적어도 결제해야 하는 식대 기준</text>
    <rect x="92" y="768" width="895" height="188" rx="32" fill="${pale}"/><circle cx="164" cy="862" r="42" fill="${sage}"/><text x="164" y="875" text-anchor="middle" font-family="Malgun Gothic" font-size="31" font-weight="900" fill="#fff">3</text><text x="232" y="840" font-family="Malgun Gothic" font-size="34" font-weight="900" fill="${cocoa}">취소 위약금·환급기준</text><text x="232" y="888" font-family="Malgun Gothic" font-size="24" font-weight="600" fill="#6E635B">취소 시점별 금액을 계약 전에 문서로 확인</text>
    <text x="92" y="1041" font-family="Malgun Gothic" font-size="23" font-weight="800" fill="#B06D41">가격이 비어 있거나 ‘별도’라면 총액 비교를 잠시 멈추세요.</text>`);

  if (order === 4) return shell(4, "계산 예시", `
    <text x="92" y="213" font-family="Malgun Gothic" font-size="55" font-weight="900" fill="${cocoa}">시작가는 A가 비싸지만</text>
    <text x="92" y="278" font-family="Malgun Gothic" font-size="55" font-weight="900" fill="${sage}">총액은 B가 더 비쌉니다</text>
    <text x="92" y="322" font-family="Malgun Gothic" font-size="20" font-weight="700" fill="#9B8776">※ 이해를 위한 가상 견적 예시 · 단위: 만원 · 하객 200명</text>
    <rect x="92" y="370" width="430" height="570" rx="32" fill="${pale}"/><rect x="558" y="370" width="430" height="570" rx="32" fill="#F8EFE5"/>
    <text x="130" y="430" font-family="Malgun Gothic" font-size="32" font-weight="900" fill="${sage}">A 견적</text><text x="596" y="430" font-family="Malgun Gothic" font-size="32" font-weight="900" fill="#A76B3F">B 견적</text>
    ${["대관료  200","기본장식  150","식대  7.5×200","스드메  250","필수품목  80"].map((t,i)=>`<text x="130" y="${500+i*70}" font-family="Malgun Gothic" font-size="27" font-weight="650" fill="${cocoa}">${t}</text>`).join("")}
    ${["대관료  150","기본장식  200","식대  8.0×200","스드메  220","필수품목  50"].map((t,i)=>`<text x="596" y="${500+i*70}" font-family="Malgun Gothic" font-size="27" font-weight="650" fill="${cocoa}">${t}</text>`).join("")}
    <line x1="130" y1="861" x2="484" y2="861" stroke="#9FB293" stroke-width="3"/><line x1="596" y1="861" x2="950" y2="861" stroke="#D8A77C" stroke-width="3"/>
    <text x="130" y="915" font-family="Malgun Gothic" font-size="35" font-weight="900" fill="${sage}">총 2,180</text><text x="596" y="915" font-family="Malgun Gothic" font-size="35" font-weight="900" fill="#A76B3F">총 2,220</text>
    <rect x="92" y="982" width="896" height="123" rx="28" fill="#3E5140"/>
    <text x="540" y="1035" text-anchor="middle" font-family="Malgun Gothic" font-size="25" font-weight="800" fill="#DCE7D2">비교식</text><text x="540" y="1076" text-anchor="middle" font-family="Malgun Gothic" font-size="27" font-weight="800" fill="#fff">대관 + 장식 + (식대×인원) + 스드메 + 필수품목</text>`);

  if (order === 5) return shell(5, "복사해서 요청", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="56" font-weight="900" fill="${cocoa}">이 문장 그대로 보내세요</text>
    <text x="92" y="270" font-family="Malgun Gothic" font-size="25" font-weight="600" fill="#75675D">상담 뒤 말이 달라지지 않도록 답변은 문서로 받기</text>
    <rect x="92" y="346" width="895" height="620" rx="38" fill="#F2F4ED" stroke="#AEBDA5" stroke-width="3"/>
    <circle cx="146" cy="404" r="12" fill="${apricot}"/><circle cx="184" cy="404" r="12" fill="#E8C7A9"/><circle cx="222" cy="404" r="12" fill="#B8C6AE"/>
    ${lines("최소보증 200명 기준과 예상 하객 230명 기준으로 각각 총액을 부탁드립니다.", 24, 142, 500, 32, 54, 750)}
    ${lines("필수 선택품목의 포함·제외 여부와 취소 시점별 위약금·환급기준도 함께 적어주세요.", 24, 142, 700, 32, 54, 750)}
    <rect x="142" y="878" width="384" height="54" rx="27" fill="${sage}"/><text x="334" y="913" text-anchor="middle" font-family="Malgun Gothic" font-size="21" font-weight="800" fill="#fff">인원 숫자는 내 상황에 맞게 변경</text>
    <text x="92" y="1045" font-family="Malgun Gothic" font-size="25" font-weight="800" fill="#A76B3F">전화 설명만 듣지 말고 견적서·문자·메일로 남겨두세요.</text>`);

  return shell(6, "계약 전 최종 점검", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="56" font-weight="900" fill="${cocoa}">마지막 30초 체크</text>
    <text x="92" y="270" font-family="Malgun Gothic" font-size="25" font-weight="600" fill="#75675D">여섯 칸이 모두 채워져야 같은 조건의 견적입니다</text>
    ${["대관료·기본장식비가 분리돼 있다","1인 식대와 최소보증인원이 적혀 있다","스드메 포함 범위가 같다","필수 선택품목의 가격이 모두 있다","예상 하객 기준 총액도 받았다","취소 시점별 위약금·환급기준을 봤다"].map((t,i)=>`<rect x="92" y="${330+i*119}" width="895" height="90" rx="24" fill="${i%2?pale:"#F8EFE5"}"/><rect x="126" y="${358+i*119}" width="34" height="34" rx="8" fill="#fff" stroke="${i%2?sage:apricot}" stroke-width="3"/><path d="M134 ${374+i*119}l8 8 14-18" fill="none" stroke="${i%2?sage:apricot}" stroke-width="4" stroke-linecap="round"/><text x="188" y="${388+i*119}" font-family="Malgun Gothic" font-size="25" font-weight="750" fill="${cocoa}">${t}</text>`).join("")}
    <text x="92" y="1092" font-family="Malgun Gothic" font-size="26" font-weight="900" fill="${sage}">한 칸이라도 비면 ‘총액 확정 전’입니다.</text>`);
}

const poses = ["07-calculator.png", "05-thinking.png", "02-confused.png", "07-calculator.png", "09-greeting.png", "04-excited.png"];

function whiskers(size: number): Buffer {
  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg"><path d="M48 132 Q63 128 79 132 M51 146 Q66 140 81 143 M181 132 Q197 128 212 132 M179 143 Q194 140 209 146" fill="none" stroke="#9A633D" stroke-width="3.5" stroke-linecap="round"/></svg>`);
}

export async function renderWeddingEditorial(brief: EditorialBrief): Promise<string[]> {
  const outputDir = path.join(paths.generated, "briefs", brief.id);
  await fs.mkdir(outputDir, { recursive: true });
  const backgroundPath = path.join(paths.assets, "editorial", "wedding-desk-v1.png");
  const outputs: string[] = [];
  for (let order = 1; order <= 6; order += 1) {
    const poseSize = order === 1 ? 270 : order === 6 ? 245 : 190;
    const pose = await sharp(path.join(paths.assets, "poses-v1", poses[order - 1]!)).resize({ width: poseSize, height: poseSize, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).composite([{ input: whiskers(poseSize) }]).png().toBuffer();
    const layers: Array<{ input: Buffer; left: number; top: number }> = [];
    if (order === 1) layers.push({ input: await sharp(backgroundPath).resize(W, H, { fit: "cover" }).png().toBuffer(), left: 0, top: 0 });
    layers.push({ input: cardSvg(order), left: 0, top: 0 });
    const left = order === 1 ? 742 : order === 6 ? 742 : 810;
    const top = order === 1 ? 920 : order === 6 ? 945 : 1010;
    layers.push({ input: pose, left, top });
    const output = path.join(outputDir, `${String(order).padStart(2, "0")}.png`);
    await sharp({ create: { width: W, height: H, channels: 4, background: cream } }).composite(layers).png({ compressionLevel: 9 }).toFile(output);
    outputs.push(output);
  }
  return outputs;
}
