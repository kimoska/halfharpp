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
    <rect x="88" y="80" width="190" height="44" rx="22" fill="${pale}"/>
    <text x="183" y="110" text-anchor="middle" font-family="Malgun Gothic" font-size="20" font-weight="800" fill="${sage}">${escapeXml(label)}</text>
    <text x="965" y="110" text-anchor="end" font-family="Malgun Gothic" font-size="20" font-weight="700" fill="#9B8776">${order} / 7</text>
    ${inner}
    <line x1="92" y1="1218" x2="988" y2="1218" stroke="#E5DDD2" stroke-width="2"/>
    <text x="94" y="1261" font-family="Malgun Gothic" font-size="24" font-weight="800" fill="${sage}">하프하프 모하프</text>
    <text x="985" y="1261" text-anchor="end" font-family="Malgun Gothic" font-size="18" font-weight="600" fill="#9B8776">계약 전에 저장해 두세요</text>
  </svg>`);
}

function cardSvg(order: number): Buffer {
  if (order === 1) return shell(1, "생활비 계산", `
    <rect x="86" y="156" width="650" height="772" rx="36" fill="#FBF7EF" fill-opacity=".96"/>
    <text x="118" y="225" font-family="Malgun Gothic" font-size="23" font-weight="800" fill="${apricot}">WEDDING FOOD BUDGET</text>
    <text x="116" y="347" font-family="Malgun Gothic" font-size="61" font-weight="900" fill="${cocoa}">식대 1만원 할인보다</text>
    <text x="116" y="438" font-family="Malgun Gothic" font-size="61" font-weight="900" fill="${cocoa}">보증인원 30명이</text>
    <text x="116" y="529" font-family="Malgun Gothic" font-size="61" font-weight="900" fill="${sage}">더 클 수 있어요</text>
    <rect x="116" y="594" width="520" height="5" rx="2" fill="${apricot}"/>
    ${lines("같은 식대라도 최소보증인원을 어떻게 잡느냐에 따라 식비가 뒤집힙니다.", 18, 118, 674, 32, 51, 680)}
    <rect x="116" y="846" width="394" height="58" rx="29" fill="${sage}"/>
    <text x="313" y="884" text-anchor="middle" font-family="Malgun Gothic" font-size="22" font-weight="800" fill="#FFFFFF">가상 조건으로 직접 계산했어요</text>`);

  if (order === 2) return shell(2, "숫자로 보면", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="56" font-weight="900" fill="${cocoa}">결혼비용의 61.4%가 식비</text>
    <text x="92" y="270" font-family="Malgun Gothic" font-size="25" font-weight="600" fill="#75675D">한국소비자원 참가격 현재 공개 자료 · 전국 평균</text>
    <rect x="92" y="350" width="895" height="230" rx="36" fill="${pale}"/>
    <text x="142" y="427" font-family="Malgun Gothic" font-size="27" font-weight="800" fill="${sage}">결혼서비스 평균</text><text x="142" y="520" font-family="Malgun Gothic" font-size="72" font-weight="900" fill="${cocoa}">2,200만원</text>
    <rect x="92" y="620" width="895" height="274" rx="36" fill="#3E5140"/>
    <text x="142" y="698" font-family="Malgun Gothic" font-size="27" font-weight="800" fill="#DCE7D2">그중 식비</text><text x="142" y="795" font-family="Malgun Gothic" font-size="78" font-weight="900" fill="#FFFFFF">1,350만원</text><text x="775" y="795" font-family="Malgun Gothic" font-size="53" font-weight="900" fill="#F3C89F">61.4%</text>
    ${lines("식대 단가만 볼 게 아니라 ‘몇 명분을 무조건 내는지’까지 같이 봐야 해요.", 29, 92, 985, 29, 46, 760)}`);

  if (order === 3) return shell(3, "둘 중 뭐가 클까", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="56" font-weight="900" fill="${cocoa}">식대 8만원·예상 하객 170명</text>
    <text x="92" y="270" font-family="Malgun Gothic" font-size="22" font-weight="700" fill="#9B8776">※ 계산을 위한 가상 조건입니다</text>
    <rect x="92" y="342" width="430" height="548" rx="34" fill="${pale}"/><rect x="558" y="342" width="430" height="548" rx="34" fill="#F8EFE5"/>
    <text x="132" y="414" font-family="Malgun Gothic" font-size="30" font-weight="900" fill="${sage}">A. 식대 1만원 할인</text>
    <text x="132" y="500" font-family="Malgun Gothic" font-size="27" font-weight="700" fill="${cocoa}">7만원 × 보증 200명</text><text x="132" y="620" font-family="Malgun Gothic" font-size="61" font-weight="900" fill="${sage}">1,400만원</text><text x="132" y="696" font-family="Malgun Gothic" font-size="25" font-weight="700" fill="#75675D">기존 1,600만원보다</text><text x="132" y="748" font-family="Malgun Gothic" font-size="34" font-weight="900" fill="${sage}">200만원 감소</text>
    <text x="598" y="414" font-family="Malgun Gothic" font-size="30" font-weight="900" fill="#A76B3F">B. 보증 30명 낮춤</text>
    <text x="598" y="500" font-family="Malgun Gothic" font-size="27" font-weight="700" fill="${cocoa}">8만원 × 보증 170명</text><text x="598" y="620" font-family="Malgun Gothic" font-size="61" font-weight="900" fill="#A76B3F">1,360만원</text><text x="598" y="696" font-family="Malgun Gothic" font-size="25" font-weight="700" fill="#75675D">기존 1,600만원보다</text><text x="598" y="748" font-family="Malgun Gothic" font-size="34" font-weight="900" fill="#A76B3F">240만원 감소</text>
    <rect x="92" y="936" width="895" height="154" rx="30" fill="#3E5140"/>${lines("이 조건에서는 보증인원을 낮춘 쪽이 40만원 더 큽니다.", 27, 132, 1002, 32, 49, 850, "#FFFFFF")}`);

  if (order === 4) return shell(4, "여기서 중요한 점", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="54" font-weight="900" fill="${cocoa}">240만원이 무조건 절약되는 건</text><text x="92" y="284" font-family="Malgun Gothic" font-size="54" font-weight="900" fill="${sage}">아닙니다</text>
    <rect x="92" y="360" width="895" height="234" rx="34" fill="${pale}"/>${lines("실제 식사 인원이 200명이라면, 계약 방식에 따라 결국 200명분을 낼 수 있어요.", 29, 138, 438, 31, 51, 750)}
    <rect x="92" y="632" width="895" height="234" rx="34" fill="#F8EFE5"/>${lines("보증인원을 낮추는 건 하객이 예상보다 적을 때 생기는 ‘빈 식대’를 줄이는 방법입니다.", 29, 138, 710, 31, 51, 750)}
    <rect x="92" y="914" width="895" height="156" rx="30" fill="#3E5140"/>${lines("결국 ‘못 온 하객 몫을 누가 내느냐’의 문제예요.", 28, 132, 978, 31, 48, 850, "#FFFFFF")}`);

  if (order === 5) return shell(5, "계약서에 물을 것", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="55" font-weight="900" fill="${cocoa}">‘몇 명’보다 먼저 물어볼 4가지</text>
    <text x="92" y="270" font-family="Malgun Gothic" font-size="24" font-weight="600" fill="#75675D">정답은 예식장마다 다르니 문서로 받아두기</text>
    ${["보증인원을 최종 확정하는 날짜","계약 뒤 보증인원을 낮출 수 있는지","정산 기준이 식권 사용 수인지 실제 식사 수인지","아동·업체 스태프 식사가 보증인원에 들어가는지"].map((t,i)=>`<rect x="92" y="${340+i*172}" width="895" height="132" rx="28" fill="${i%2?pale:"#F8EFE5"}"/><circle cx="154" cy="${406+i*172}" r="31" fill="${i%2?sage:apricot}"/><text x="154" y="${417+i*172}" text-anchor="middle" font-family="Malgun Gothic" font-size="25" font-weight="900" fill="#fff">${i+1}</text><text x="210" y="${418+i*172}" font-family="Malgun Gothic" font-size="27" font-weight="800" fill="${cocoa}">${t}</text>`).join("")}`);

  if (order === 6) return shell(6, "상담할 때", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="55" font-weight="900" fill="${cocoa}">“식대 얼마까지 돼요?”보다</text>
    <text x="92" y="284" font-family="Malgun Gothic" font-size="55" font-weight="900" fill="${sage}">이렇게 물어보세요</text>
    <rect x="92" y="352" width="895" height="610" rx="38" fill="#F2F4ED" stroke="#AEBDA5" stroke-width="3"/>
    ${lines("예상 식사 인원은 170명입니다. 최소보증을 170명으로 잡을 수 있는 날짜와 시간대를 먼저 보여주세요.", 26, 142, 460, 33, 56, 760)}
    ${lines("같은 요일·시간대 기준으로 식대 할인안과 보증인원 조정안을 각각 총식비로 적어주세요.", 26, 142, 690, 33, 56, 760)}
    <rect x="142" y="864" width="358" height="54" rx="27" fill="${sage}"/><text x="321" y="899" text-anchor="middle" font-family="Malgun Gothic" font-size="21" font-weight="800" fill="#fff">답변은 견적서·문자·메일로</text>`);

  return shell(7, "내 견적 계산식", `
    <text x="92" y="218" font-family="Malgun Gothic" font-size="56" font-weight="900" fill="${cocoa}">식대 견적은 이 식으로 끝</text>
    <text x="92" y="270" font-family="Malgun Gothic" font-size="24" font-weight="600" fill="#75675D">계약서의 실제 정산 방식이 다르면 그 기준을 우선합니다</text>
    <rect x="92" y="350" width="895" height="246" rx="36" fill="#3E5140"/>
    <text x="540" y="420" text-anchor="middle" font-family="Malgun Gothic" font-size="25" font-weight="800" fill="#DCE7D2">예상 식비</text><text x="540" y="493" text-anchor="middle" font-family="Malgun Gothic" font-size="42" font-weight="900" fill="#FFFFFF">1인 식대 × 둘 중 큰 인원</text><text x="540" y="548" text-anchor="middle" font-family="Malgun Gothic" font-size="24" font-weight="700" fill="#DCE7D2">보증인원  vs  예상 식사인원</text>
    <text x="92" y="684" font-family="Malgun Gothic" font-size="31" font-weight="900" fill="${sage}">낮게 · 보통 · 높게, 세 번 계산</text>
    ${["하객이 적게 오는 날", "내가 예상한 보통 날", "생각보다 많이 오는 날"].map((t,i)=>`<rect x="92" y="${728+i*116}" width="895" height="84" rx="22" fill="${i%2?pale:"#F8EFE5"}"/><text x="132" y="${782+i*116}" font-family="Malgun Gothic" font-size="25" font-weight="800" fill="${cocoa}">${t}</text><text x="930" y="${782+i*116}" text-anchor="end" font-family="Malgun Gothic" font-size="24" font-weight="800" fill="#9B8776">________ 만원</text>`).join("")}
    <text x="92" y="1110" font-family="Malgun Gothic" font-size="26" font-weight="900" fill="#A76B3F">싼 식대보다, 최악의 경우에도 감당되는 계약이 먼저예요.</text>`);
}

const poses = ["07-calculator.png", "05-thinking.png", "02-confused.png", "07-calculator.png", "05-thinking.png", "09-greeting.png", "04-excited.png"];

function whiskers(size: number): Buffer {
  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg"><path d="M48 132 Q63 128 79 132 M51 146 Q66 140 81 143 M181 132 Q197 128 212 132 M179 143 Q194 140 209 146" fill="none" stroke="#9A633D" stroke-width="3.5" stroke-linecap="round"/></svg>`);
}

export async function renderWeddingEditorial(brief: EditorialBrief): Promise<string[]> {
  const outputDir = path.join(paths.generated, "briefs", brief.id);
  await fs.mkdir(outputDir, { recursive: true });
  const backgroundPath = path.join(paths.assets, "editorial", "wedding-desk-v1.png");
  const outputs: string[] = [];
  for (let order = 1; order <= 7; order += 1) {
    const poseSize = order === 1 ? 270 : 190;
    const pose = await sharp(path.join(paths.assets, "poses-v1", poses[order - 1]!)).resize({ width: poseSize, height: poseSize, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).composite([{ input: whiskers(poseSize) }]).png().toBuffer();
    const layers: Array<{ input: Buffer; left: number; top: number }> = [];
    if (order === 1) layers.push({ input: await sharp(backgroundPath).resize(W, H, { fit: "cover" }).png().toBuffer(), left: 0, top: 0 });
    layers.push({ input: cardSvg(order), left: 0, top: 0 });
    if (order !== 7) layers.push({ input: pose, left: order === 1 ? 742 : 810, top: order === 1 ? 920 : 1010 });
    const output = path.join(outputDir, `${String(order).padStart(2, "0")}.png`);
    await sharp({ create: { width: W, height: H, channels: 4, background: cream } }).composite(layers).png({ compressionLevel: 9 }).toFile(output);
    outputs.push(output);
  }
  return outputs;
}
