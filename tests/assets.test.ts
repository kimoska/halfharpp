import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { paths } from "../src/paths.js";

describe("character asset pack", () => {
  it("contains 12 real-alpha PNG pose files", async () => {
    const directory = path.join(paths.assets, "poses-v1");
    const files = (await fs.readdir(directory)).filter((file) => file.endsWith(".png"));
    expect(files).toHaveLength(12);
    for (const file of files) {
      const metadata = await sharp(path.join(directory, file)).metadata();
      expect(metadata.hasAlpha).toBe(true);
      expect(metadata.width).toBeGreaterThan(200);
      expect(metadata.height).toBeGreaterThan(200);
    }
  });
});
