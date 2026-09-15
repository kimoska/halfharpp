import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { paths } from "./paths.js";

const poseNames = ["neutral", "confused", "surprised", "excited", "thinking", "sad", "calculator", "shopping", "greeting", "startled", "sleeping", "back"];

function isBackground(data: Buffer, offset: number): boolean {
  const r = data[offset]!;
  const g = data[offset + 1]!;
  const b = data[offset + 2]!;
  return Math.max(r, g, b) - Math.min(r, g, b) <= 9 && Math.min(r, g, b) >= 165;
}

function clearConnectedCheckerboard(data: Buffer, width: number, height: number): void {
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const add = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (seen[index]) return;
    if (!isBackground(data, index * 4)) return;
    seen[index] = 1;
    stack.push(index);
  };
  for (let x = 0; x < width; x += 1) { add(x, 0); add(x, height - 1); }
  for (let y = 0; y < height; y += 1) { add(0, y); add(width - 1, y); }
  while (stack.length) {
    const index = stack.pop()!;
    const x = index % width;
    const y = Math.floor(index / width);
    data[index * 4 + 3] = 0;
    add(x - 1, y); add(x + 1, y); add(x, y - 1); add(x, y + 1);
    add(x - 1, y - 1); add(x + 1, y - 1); add(x - 1, y + 1); add(x + 1, y + 1);
  }
}

function clearSmallArtifacts(data: Buffer, width: number, height: number): void {
  const seen = new Uint8Array(width * height);
  const neighbors = [-1, 1, -width, width, -width - 1, -width + 1, width - 1, width + 1];
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] || data[start * 4 + 3] === 0) continue;
    const stack = [start];
    const pixels: number[] = [];
    seen[start] = 1;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    while (stack.length) {
      const index = stack.pop()!;
      pixels.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const delta of neighbors) {
        const next = index + delta;
        if (next < 0 || next >= width * height || seen[next] || data[next * 4 + 3] === 0) continue;
        const nextX = next % width;
        if (Math.abs(nextX - x) > 1) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    if (pixels.length < 8 || (pixels.length < 400 && boxHeight <= 6 && boxWidth >= 12)) {
      for (const index of pixels) data[index * 4 + 3] = 0;
    }
  }
}

export async function extractPosePack(): Promise<void> {
  const source = path.join(paths.assets, "moharp-pose-sheet-v3.png");
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) throw new Error("포즈 시트 크기를 읽지 못했습니다.");
  const cellWidth = Math.floor(metadata.width / 4);
  const rowBounds = [
    { top: 0, height: 380 },
    { top: 380, height: 335 },
    { top: 715, height: metadata.height - 715 }
  ];
  const outputDirectory = path.join(paths.assets, "poses-v1");
  await fs.mkdir(outputDirectory, { recursive: true });
  const outputs: string[] = [];
  for (let index = 0; index < poseNames.length; index += 1) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const rowBound = rowBounds[row]!;
    const { data, info } = await sharp(source)
      .extract({ left: column * cellWidth, top: rowBound.top, width: cellWidth, height: rowBound.height })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    clearConnectedCheckerboard(data, info.width, info.height);
    clearSmallArtifacts(data, info.width, info.height);
    const output = path.join(outputDirectory, `${String(index + 1).padStart(2, "0")}-${poseNames[index]}.png`);
    await sharp(data, { raw: info }).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).extend({ top: 18, bottom: 18, left: 18, right: 18, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(output);
    outputs.push(output);
  }

  const thumbs = await Promise.all(outputs.map(async (file) => ({ input: await sharp(file).resize({ width: 250, height: 250, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer() })));
  const preview = path.join(paths.assets, "moharp-pose-pack-preview-v1.png");
  await sharp({ create: { width: 1000, height: 750, channels: 4, background: { r: 245, g: 250, b: 239, alpha: 1 } } })
    .composite(thumbs.map((thumb, index) => ({ ...thumb, left: (index % 4) * 250, top: Math.floor(index / 4) * 250 })))
    .png()
    .toFile(preview);
  console.log(`✓ 개별 투명 포즈 ${outputs.length}개와 미리보기를 생성했습니다.`);
}
