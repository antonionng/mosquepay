import { createHash, randomBytes } from "crypto";

/** Generate a 32-byte URL-safe token; opaque to the user. */
export function generateGuestInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash a token for storage; mirror of the notice access link pattern. */
export function hashGuestInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function defaultMaxUsesForPolicy(
  policy: "blue_table" | "white_table" | "closed" | string | null | undefined
): number | null {
  // Per product spec: unlimited everywhere unless an admin overrides it.
  if (policy === "closed") return 0;
  return null;
}

/**
 * Per-guest token used for mosque-scoped newcomer links. Same shape as invitation tokens
 * (32 bytes, base64url, sha256-hashed at rest); a separate generator just so
 * the call site reads clearly.
 */
export function generateNewcomerToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashNewcomerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
