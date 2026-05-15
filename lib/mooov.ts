// LodgePay HMAC helper for signing Mooov gateway requests. Mirrors the
// canonical signing scheme spec'd in
// mooov3:docs/integrations/lodgepay-mooov-dev-quickstart.md (Section 5)
// and the canonical reference (Section 4 of the integration doc).
//
// Outbound (LodgePay -> Mooov) signature: HMAC-SHA256 over
//   `${METHOD}\n${PATH}\n${TIMESTAMP}\n${SHA256_HEX(body)}`
// Header: X-Mooov-Signature: <hex>; X-Mooov-Key-Id, X-Mooov-Timestamp,
// Idempotency-Key sit alongside it.
//
// IMPORTANT INVARIANTS (the four likeliest 401 causes if violated):
//   a. Sign the exact bytes you are about to send. Do not re-stringify
//      the body between sign() and fetch(). callMooov() handles this.
//   b. The timestamp is RFC3339 UTC without milliseconds. The .replace()
//      below strips the .000Z suffix produced by Date#toISOString().
//   c. The 48-char hex secret is fed into HMAC AS A UTF-8 STRING. Do not
//      hex-decode it first. createHmac("sha256", secret) is correct.
//   d. PATH is the bare URL path; do NOT append the query string when
//      computing the canonical request.

import { createHash, createHmac, randomUUID } from "node:crypto";

export interface MooovKey {
  keyId: string;
  // 48 hex chars. Used as a UTF-8 string in HMAC. DO NOT hex-decode.
  secret: string;
}

export type MooovErrorCategory =
  | "auth"
  | "idempotency_conflict"
  | "invalid_request"
  | "unprocessable"
  | "rate_limited"
  | "server"
  | "network";

export class MooovApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly category: MooovErrorCategory,
    public readonly body: string,
    public readonly method: string,
    public readonly path: string,
  ) {
    super(`mooov ${method} ${path} -> ${status} ${category}`);
    this.name = "MooovApiError";
  }
}

export function canonicalRequest(
  method: string,
  path: string,
  timestamp: string,
  body: string | Uint8Array,
): string {
  const bodyBytes = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  const bodyHash = createHash("sha256").update(bodyBytes).digest("hex");
  return `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
}

export function sign(secret: string, canonical: string): string {
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

export function authHeaders(
  key: MooovKey,
  method: string,
  path: string,
  body: string,
  idempotencyKey: string,
): Record<string, string> {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const headers: Record<string, string> = {
    "X-Mooov-Key-Id": key.keyId,
    "X-Mooov-Timestamp": timestamp,
    "X-Mooov-Signature": sign(
      key.secret,
      canonicalRequest(method, path, timestamp, body),
    ),
    "Content-Type": "application/json",
  };
  if (method.toUpperCase() !== "GET") {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  return headers;
}

function categorise(status: number): MooovErrorCategory {
  if (status === 401) return "auth";
  if (status === 409) return "idempotency_conflict";
  if (status === 422) return "unprocessable";
  if (status === 429) return "rate_limited";
  if (status >= 400 && status < 500) return "invalid_request";
  return "server";
}

export async function callMooov<T>(
  baseUrl: string,
  key: MooovKey,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const idem = idempotencyKey ?? `idem_${randomUUID()}`;
  const headers = authHeaders(key, method, path, raw, idem);
  let res: Response;
  try {
    res = await fetch(baseUrl + path, {
      method,
      headers,
      body: method === "GET" ? undefined : raw,
    });
  } catch (err) {
    throw new MooovApiError(
      0,
      "network",
      err instanceof Error ? err.message : String(err),
      method,
      path,
    );
  }
  const text = await res.text();
  if (!res.ok) {
    throw new MooovApiError(res.status, categorise(res.status), text, method, path);
  }
  return text.length === 0 ? (undefined as T) : (JSON.parse(text) as T);
}
