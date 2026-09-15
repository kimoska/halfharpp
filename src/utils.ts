import crypto from "node:crypto";
import type { Pillar } from "./types.js";

export function idFor(date: string, pillar: Pillar, ordinal: number): string {
  return `${date.slice(0, 10).replaceAll("-", "")}-${pillar}-${String(ordinal).padStart(2, "0")}`;
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hasHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!);
}

export function wrapKorean(value: string, maxUnits: number): string[] {
  const lines: string[] = [];
  let current = "";
  let units = 0;
  for (const char of value.trim()) {
    const size = /[\u0000-\u00ff]/.test(char) ? 0.55 : 1;
    if (units + size > maxUnits && current) {
      lines.push(current);
      current = "";
      units = 0;
    }
    current += char;
    units += size;
  }
  if (current) lines.push(current);
  return lines;
}

export function parseArg(args: string[], name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}
