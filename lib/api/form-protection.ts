import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function rejectHoneypot(body: Record<string, unknown>) {
  const value = body.website;
  if (typeof value === "string" && value.trim()) {
    return NextResponse.json({ success: true });
  }
  return null;
}

export function rejectRateLimited(request: NextRequest, scope: string, email?: string | null) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const key = `${scope}:${ip}:${email?.toLowerCase() ?? "anonymous"}`;
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  if (current.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 }
    );
  }
  current.count += 1;
  attempts.set(key, current);
  return null;
}

export function parseRecipientList(value?: string | null) {
  if (!value) return null;
  const recipients = value
    .split(/[,\n;]/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))
    .slice(0, 5);
  return recipients.length > 0 ? recipients : null;
}
