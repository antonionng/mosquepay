import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// First-time Mooov merchant signup can take longer than a quick OAuth consent.
// Keep this comfortably above the manual bridge flow while still bounded.
export const MOOOV_CONNECT_STATE_TTL_SECONDS = 30 * 60;
const STATE_TTL_MS = MOOOV_CONNECT_STATE_TTL_SECONDS * 1000;

export const MOOOV_CONNECT_STATE_COOKIE = "mooov_connect_state";

type StatePayload = {
  mosqueId: string;
  mosqueSlug: string;
  nonce: string;
  iat: number;
};

function stateSecret() {
  return process.env.SESSION_SECRET ?? "mosquepay-dummy-secret-change-in-production";
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function sign(payload: string) {
  return createHmac("sha256", stateSecret()).update(payload).digest("base64url");
}

export function createMooovConnectState(input: {
  mosqueId: string;
  mosqueSlug: string;
}) {
  const payload = encode({
    ...input,
    nonce: randomUUID(),
    iat: Date.now(),
  } satisfies StatePayload);
  return `${payload}.${sign(payload)}`;
}

export function verifyMooovConnectState(
  state: string,
  expectedState: string | undefined
): StatePayload | null {
  if (!expectedState || state !== expectedState) return null;

  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  const parsed = decode<StatePayload>(payload);
  if (!parsed.mosqueId || !parsed.mosqueSlug || Date.now() - parsed.iat > STATE_TTL_MS) {
    return null;
  }
  return parsed;
}
