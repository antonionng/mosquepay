// LodgePay helper for Mooov Connect.
//
// Outbound API calls use the single platform credential, plus Mooov-Merchant
// for per-lodge on-behalf-of routing. Lodge admins never see per-lodge API keys.
//
// Inbound webhooks are still HMAC verified with the platform webhook signing
// secret using Mooov-Signature: t=<unix>,v1=<hex>.

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
  | "merchant_setup_required"
  | "rate_limited"
  | "server"
  | "network";

export interface MooovMerchantSetupProvider {
  id: string;
  displayName: string;
  status: string;
}

// Parsed payload of Mooov's typed 422 `merchant_not_charge_capable` response.
// setupUrl is single-use and TTL-bounded (~1h); render as a button per
// https://docs.mooov.money/errors/merchant_not_charge_capable, never auto-redirect.
export interface MooovMerchantSetupHint {
  setupUrl: string;
  setupUrlExpiresAt: string;
  providers: MooovMerchantSetupProvider[];
  message?: string;
  docsUrl?: string;
}

export class MooovApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly category: MooovErrorCategory,
    public readonly body: string,
    public readonly method: string,
    public readonly path: string,
    public readonly setupHint?: MooovMerchantSetupHint,
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

function firstNonEmptyEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function getMooovConnectConfig(): MooovConnectConfig {
  const apiBaseUrl =
    firstNonEmptyEnv("MOOOV_API_BASE", "MOOOV_BASE_URL") ??
    "https://staging.api.mooov.money";
  const keyId = firstNonEmptyEnv(
    "MOOOV_PLATFORM_API_KEY_ID",
    "MOOOV_KEY_ID",
    "MOOOV_PLATFORM_KEY_ID"
  );
  const keySecret = firstNonEmptyEnv(
    "MOOOV_PLATFORM_API_KEY_SECRET",
    "MOOOV_KEY_SECRET",
    "MOOOV_PLATFORM_KEY_SECRET"
  );
  const webhookSecret = firstNonEmptyEnv(
    "MOOOV_PLATFORM_WEBHOOK_SIGNING_SECRET",
    "MOOOV_WEBHOOK_SIGNING_SECRET",
    "MOOOV_WEBHOOK_SECRET",
    "MOOOV_PLATFORM_WEBHOOK_SECRET"
  );

  if (!apiBaseUrl || !keyId || !keySecret || !webhookSecret) {
    throw new Error(
      "Missing Mooov Connect env: MOOOV_PLATFORM_API_KEY_ID, MOOOV_PLATFORM_API_KEY_SECRET, MOOOV_PLATFORM_WEBHOOK_SIGNING_SECRET"
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
  _method: string,
  _path: string,
  _body: string,
  idempotencyKey: string,
  merchant?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key.secret}`,
    "Mooov-Key-Id": key.keyId,
    "Content-Type": "application/json",
  };
  headers["Idempotency-Key"] = idempotencyKey;
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

function parseMerchantSetupHint(text: string): MooovMerchantSetupHint | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { error?: unknown }).error !== "merchant_not_charge_capable"
  ) {
    return undefined;
  }
  const obj = parsed as Record<string, unknown>;
  const setupUrl = typeof obj.setup_url === "string" ? obj.setup_url : null;
  const setupUrlExpiresAt =
    typeof obj.setup_url_expires_at === "string" ? obj.setup_url_expires_at : null;
  // Both fields are load-bearing for the "Finish setup on Mooov" CTA; without
  // either, fall back to the generic unprocessable category so callers don't
  // surface a half-formed hint.
  if (!setupUrl || !setupUrlExpiresAt) return undefined;

  const providers: MooovMerchantSetupProvider[] = Array.isArray(obj.providers)
    ? obj.providers
        .map((p): MooovMerchantSetupProvider | null => {
          if (!p || typeof p !== "object") return null;
          const pObj = p as Record<string, unknown>;
          if (typeof pObj.id !== "string") return null;
          return {
            id: pObj.id,
            displayName:
              typeof pObj.display_name === "string" ? pObj.display_name : pObj.id,
            status: typeof pObj.status === "string" ? pObj.status : "unknown",
          };
        })
        .filter((p): p is MooovMerchantSetupProvider => p !== null)
    : [];

  return {
    setupUrl,
    setupUrlExpiresAt,
    providers,
    message: typeof obj.message === "string" ? obj.message : undefined,
    docsUrl: typeof obj.docs_url === "string" ? obj.docs_url : undefined,
  };
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
    let category: MooovErrorCategory =
      res.status === 403 && text.includes("MERCHANT_GRANT_REVOKED")
        ? "grant_required"
        : res.status === 403 && text.includes("SCOPE_DENIED")
        ? "scope_denied"
        : categorise(res.status);
    let setupHint: MooovMerchantSetupHint | undefined;
    if (res.status === 422) {
      setupHint = parseMerchantSetupHint(text);
      if (setupHint) category = "merchant_setup_required";
    }
    throw new MooovApiError(res.status, category, text, method, path, setupHint);
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
