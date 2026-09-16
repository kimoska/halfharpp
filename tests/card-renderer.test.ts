import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import type { EditorialBrief } from "../src/research-types.js";
import { renderEditorialBrief } from "../src/research/card-renderer.js";
import { paths } from "../src/paths.js";

const briefId = "test-variable-two-card-brief";

afterEach(async () => {
  await fs.rm(path.join(paths.generated, "briefs", briefId), { recursive: true, force: true });
});

describe("variable card rendering", () => {
  it("renders exactly the number of cards selected by the brief", async () => {
    const brief: EditorialBrief = {
      id: briefId,
      pillar: "info",
      topic: "무료배송 추가 구매액",
      angle: "질문과 실행 답만 짧게 전달",
      audienceProblem: "배송비를 피하려고 필요하지 않은 상품을 장바구니에 추가한다.",
      oneLineValue: "배송비와 추가 구매액을 비교해 더 적게 쓰는 쪽을 고른다.",
      leadIds: [],
      evidence: [],
      calculations: [],
      cardCountReason: "질문과 실행 답만 있으면 메시지가 완결되어 두 장이면 충분하다.",
      slides: [
        { order: 1, role: "hook", headline: "무료배송까지 얼마 남았나요?", body: "더 담기 전에 추가 구매액부터 확인해요.", visualDirection: "장바구니를 보는 모하프" },
        { order: 2, role: "action", headline: "두 금액만 비교해요", body: "추가 구매액이 배송비보다 크다면 배송비를 내는 선택도 검토해요.", visualDirection: "두 금액 비교표" }
      ],
      caption: "무료배송 조건보다 실제 추가 지출을 먼저 확인해요.",
      cta: "무료배송 때문에 더 담은 적 있나요?",
      risks: [],
      status: "draft",
      createdAt: "2026-09-16T00:00:00Z",
      updatedAt: "2026-09-16T00:00:00Z"
    };

    const outputs = await renderEditorialBrief(brief);
    expect(outputs).toHaveLength(2);
    await expect(Promise.all(outputs.map(async (output) => {
      const metadata = await sharp(output).metadata();
      return [metadata.width, metadata.height];
    }))).resolves.toEqual([[1080, 1350], [1080, 1350]]);
  });
});
