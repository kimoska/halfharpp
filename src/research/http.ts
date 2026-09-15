export type FetchLike = typeof fetch;

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly body: string, message: string) {
    super(message);
  }
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const name of ["access_token", "key", "client_secret"]) if (url.searchParams.has(name)) url.searchParams.set(name, "[REDACTED]");
    return url.toString();
  } catch {
    return "[invalid URL]";
  }
}

function safeErrorDetail(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; type?: string; code?: number; error_subcode?: number } };
    const error = parsed.error;
    if (!error) return "";
    return [error.type, error.code, error.error_subcode, error.message]
      .filter((value) => value !== undefined && value !== "")
      .join(" / ")
      .slice(0, 500);
  } catch {
    return body.replace(/[A-Za-z0-9_-]{80,}/g, "[REDACTED]").replace(/\s+/g, " ").trim().slice(0, 300);
  }
}

function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  fetcher: FetchLike = fetch,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(15_000) });
      const body = await response.text();
      if (!response.ok) {
        const detail = safeErrorDetail(body);
        const error = new HttpError(response.status, body, `HTTP ${response.status}: ${safeUrl(url)}${detail ? ` · ${detail}` : ""}`);
        if (!retryable(response.status) || attempt === attempts - 1) throw error;
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 5_000)));
        continue;
      }
      return JSON.parse(body) as T;
    } catch (error) {
      lastError = error;
      if (error instanceof HttpError || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}
