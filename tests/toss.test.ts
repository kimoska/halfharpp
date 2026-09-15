import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TossApiError, TossSharelinkClient } from "../src/toss/client.js";

const tempFiles: string[] = [];
function tokenFile(): string {
  const file = path.join(os.tmpdir(), `moharp-toss-token-${crypto.randomUUID()}.json`);
  tempFiles.push(file);
  return file;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempFiles.splice(0).map((file) => fs.unlink(file).catch(() => undefined)));
});

describe("TossSharelinkClient", () => {
  const env = {
    TOSS_SHARELINK_ACCESS_KEY: "access",
    TOSS_SHARELINK_SECRET_KEY: "secret",
    TOSS_SHARELINK_PUBLISHER_ID: "550e8400-e29b-41d4-a716-446655440000",
    TOSS_SHARELINK_SUBTAG_ID: "threads_halfharpp"
  };

  it("reuses one token and sends the publisher and subTag when issuing a link", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "bearer", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ resultType: "SUCCESS", success: { status: "ok" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ resultType: "SUCCESS", success: { tacaItemId: 123, publisherId: env.TOSS_SHARELINK_PUBLISHER_ID, shortUrl: "https://toss.im/_m/a", originUrl: "https://toss.shopping/t/1?k=x" } }), { status: 200 }));
    const client = new TossSharelinkClient(fetchMock, env, tokenFile());
    expect((await client.health()).status).toBe("ok");
    const link = await client.issueLink(123);
    expect(link.shortUrl).toContain("toss.im/_m/");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const linkRequest = fetchMock.mock.calls[2]![1] as RequestInit;
    expect(JSON.parse(String(linkRequest.body))).toMatchObject({ tacaItemId: 123, publisherId: env.TOSS_SHARELINK_PUBLISHER_ID, subTagId: "threads_halfharpp" });
  });

  it("treats HTTP 200 quota failure as a non-retryable error", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "bearer", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ resultType: "FAIL", error: { errorCode: "SHARELINK_OPENAPI_QUOTA_EXCEEDED", reason: "오늘 한도 소진" } }), { status: 200 }));
    const client = new TossSharelinkClient(fetchMock, env, tokenFile());
    let error: TossApiError | undefined;
    try { await client.bestSelling(5); } catch (caught) { error = caught as TossApiError; }
    expect(error).toBeInstanceOf(TossApiError);
    expect(error?.code).toBe("SHARELINK_OPENAPI_QUOTA_EXCEEDED");
    expect(error?.retryable).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
