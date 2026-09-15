import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { paths } from "./paths.js";

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

export async function makePublic(imagePath: string): Promise<string> {
  const base = process.env.PUBLIC_MEDIA_BASE_URL?.replace(/\/$/, "");
  const relative = path.relative(paths.generated, imagePath);
  if (base) {
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("공개할 이미지는 public/generated 안에 있어야 합니다.");
    return `${base}/${relative.split(path.sep).map(encodeURIComponent).join("/")}`;
  }

  const repo = process.env.GITHUB_MEDIA_REPO;
  if (!repo) throw new Error("PUBLIC_MEDIA_BASE_URL 또는 GITHUB_MEDIA_REPO를 설정해야 이미지 게시가 가능합니다.");
  const token = required(process.env.GITHUB_MEDIA_TOKEN, "GITHUB_MEDIA_TOKEN");
  const branch = process.env.GITHUB_MEDIA_BRANCH || "main";
  const prefix = (process.env.GITHUB_MEDIA_PREFIX || "moharp/generated").replace(/^\/+|\/+$/g, "");
  const fileName = path.basename(imagePath);
  const bytes = await fs.readFile(imagePath);
  const digest = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const target = `${prefix}/${digest}-${fileName}`;
  const content = bytes.toString("base64");
  const api = `https://api.github.com/repos/${repo}/contents/${target.split("/").map(encodeURIComponent).join("/")}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const existing = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
  if (existing.ok) return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${target.split("/").map(encodeURIComponent).join("/")}`;
  if (existing.status !== 404) throw new Error(`GitHub 이미지 확인 실패(${existing.status})`);
  const response = await fetch(api, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ message: `Add rendered Moharp post ${fileName}`, content, branch })
  });
  if (!response.ok) throw new Error(`GitHub 이미지 업로드 실패(${response.status}): ${await response.text()}`);
  return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${target.split("/").map(encodeURIComponent).join("/")}`;
}
