import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makePublic } from "../src/media.js";
import { paths } from "../src/paths.js";

const created: string[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  delete process.env.PUBLIC_MEDIA_BASE_URL;
  delete process.env.GITHUB_MEDIA_REPO;
  delete process.env.GITHUB_MEDIA_TOKEN;
  await Promise.all(created.splice(0).map((file) => fs.unlink(file).catch(() => undefined)));
});

describe("public media", () => {
  it("preserves nested generated paths for a static media base", async () => {
    process.env.PUBLIC_MEDIA_BASE_URL = "https://cdn.example.com/generated";
    const file = path.join(paths.generated, "briefs", "b1", "01.png");
    expect(await makePublic(file)).toBe("https://cdn.example.com/generated/briefs/b1/01.png");
  });

  it("uses a content hash and reuses an existing GitHub object", async () => {
    process.env.GITHUB_MEDIA_REPO = "owner/repo";
    process.env.GITHUB_MEDIA_TOKEN = "token";
    const file = path.join(paths.generated, `media-test-${crypto.randomUUID()}.png`);
    created.push(file);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, Buffer.from("image bytes"));
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const url = await makePublic(file);
    expect(url).toMatch(/moharp\/generated\/[a-f0-9]{16}-media-test-/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toContain("?ref=main");
  });

  it("retries a GitHub branch-head conflict once", async () => {
    process.env.GITHUB_MEDIA_REPO = "owner/repo";
    process.env.GITHUB_MEDIA_TOKEN = "token";
    const file = path.join(paths.generated, `media-conflict-${crypto.randomUUID()}.png`);
    created.push(file);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, Buffer.from("image bytes"));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(new Response("conflict", { status: 409 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(makePublic(file)).resolves.toContain("raw.githubusercontent.com/owner/repo/main/");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
