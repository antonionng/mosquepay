import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

export const MOOOV_CONNECT_STATE_COOKIE = "mooov_connect_state";

type StatePayload = {
  lodgeId: string;
  lodgeSlug: string;
  nonce: string;
  iat: number;
};

function stateSecret() {
  return process.env.SESSION_SECRET ?? "covenant-dummy-secret-change-in-production";
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
  lodgeId: string;
  lodgeSlug: string;
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
  if (!parsed.lodgeId || !parsed.lodgeSlug || Date.now() - parsed.iat > STATE_TTL_MS) {
    return null;
  }
  return parsed;
}
