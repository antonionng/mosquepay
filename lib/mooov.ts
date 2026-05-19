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

import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

export interface MooovKey {
  keyId: string;
  // 48 hex chars. Used as a UTF-8 string in HMAC. DO NOT hex-decode.
  secret: string;
}

export type MooovErrorCategory =
  | "auth"
  | "grant_required"
  | "scope_denied"
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

export type MooovMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface MooovConnectConfig {
  platformSlug: string;
  platformId: string;
  connectBaseUrl: string;
  apiBaseUrl: string;
  redirectUri?: string;
  key: MooovKey;
  webhookSecret: string;
}

export function getMooovConnectConfig(): MooovConnectConfig {
  const apiBaseUrl =
    process.env.MOOOV_GATEWAY_BASE_URL ??
    process.env.MOOOV_API_BASE ??
    process.env.MOOOV_BASE_URL;
  const keyId = process.env.MOOOV_KEY_ID ?? process.env.MOOOV_PLATFORM_KEY_ID;
  const keySecret =
    process.env.MOOOV_KEY_SECRET ?? process.env.MOOOV_PLATFORM_KEY_SECRET;
  const webhookSecret =
    process.env.MOOOV_WEBHOOK_SIGNING_SECRET ??
    process.env.MOOOV_WEBHOOK_SECRET ??
    process.env.MOOOV_PLATFORM_WEBHOOK_SECRET;

  if (!apiBaseUrl || !keyId || !keySecret || !webhookSecret) {
    throw new Error(
      "Missing Mooov Connect env: MOOOV_GATEWAY_BASE_URL, MOOOV_PLATFORM_KEY_ID, MOOOV_PLATFORM_KEY_SECRET, MOOOV_WEBHOOK_SIGNING_SECRET"
    );
  }

  return {
    platformSlug: process.env.MOOOV_PLATFORM_SLUG ?? "lodgepay",
    platformId: process.env.MOOOV_PLATFORM_ID ?? "plat_lodgepay",
    connectBaseUrl:
      process.env.MOOOV_CONNECT_BASE ?? "https://staging.connect.mooov.money",
    apiBaseUrl,
    redirectUri: process.env.MOOOV_REDIRECT_URI,
    key: { keyId, secret: keySecret },
    webhookSecret,
  };
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
  merchant?: string,
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
  if (merchant) {
    headers["Mooov-Merchant"] = merchant;
  }
  return headers;
}

function categorise(status: number): MooovErrorCategory {
  if (status === 401) return "auth";
  if (status === 403) return "grant_required";
  if (status === 409) return "idempotency_conflict";
  if (status === 422) return "unprocessable";
  if (status === 429) return "rate_limited";
  if (status >= 400 && status < 500) return "invalid_request";
  return "server";
}

export async function callMooov<T>(
  baseUrl: string,
  key: MooovKey,
  method: MooovMethod,
  path: string,
  body?: unknown,
  idempotencyKey?: string,
  merchant?: string,
): Promise<T> {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const idem = idempotencyKey ?? `idem_${randomUUID()}`;
  const headers = authHeaders(key, method, path, raw, idem, merchant);
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
    const category =
      res.status === 403 && text.includes("SCOPE_DENIED")
        ? "scope_denied"
        : categorise(res.status);
    throw new MooovApiError(res.status, category, text, method, path);
  }
  return text.length === 0 ? (undefined as T) : (JSON.parse(text) as T);
}

export async function callMooovConnect<T>(
  method: MooovMethod,
  path: string,
  opts: {
    body?: unknown;
    merchant?: string;
    idempotencyKey?: string;
  } = {}
): Promise<T> {
  const config = getMooovConnectConfig();
  return callMooov<T>(
    config.apiBaseUrl,
    config.key,
    method,
    path,
    opts.body,
    opts.idempotencyKey,
    opts.merchant
  );
}

export function verifyMooovWebhook(
  rawBody: string | Uint8Array,
  sigHeader: string,
  secret: string,
  toleranceSec = 300
): boolean {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((part) => part.split("=") as [string, string])
  );
  const timestamp = Number(parts.t);
  if (
    !Number.isFinite(timestamp) ||
    Math.abs(Date.now() / 1000 - timestamp) > toleranceSec ||
    !parts.v1
  ) {
    return false;
  }

  const bodyBytes =
    typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  const expected = createHmac("sha256", secret)
    .update(`${parts.t}.`)
    .update(bodyBytes)
    .digest("hex");
  const got = parts.v1;
  const expectedBuffer = Buffer.from(expected, "hex");
  const gotBuffer = Buffer.from(got, "hex");

  return (
    expectedBuffer.length === gotBuffer.length &&
    timingSafeEqual(expectedBuffer, gotBuffer)
  );
}
