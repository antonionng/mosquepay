import { NextRequest, NextResponse } from "next/server";
import { processQueue } from "@/lib/jobs/queue";

/**
 * Cron-friendly endpoint. Authenticate via either:
 *  - Vercel cron header `x-vercel-cron`
 *  - Bearer token from `CRON_SECRET` env var
 *
 * Trigger periodically (every 1-5 minutes is fine) to drain the queue.
 */
export async function POST(request: NextRequest) {
  const cronHeader = request.headers.get("x-vercel-cron");
  const auth = request.headers.get("authorization");
  const token = auth?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;

  if (!expected && !cronHeader) {
    return NextResponse.json(
      { error: "Queue processing is not configured." },
      { status: 503 }
    );
  }

  if (!cronHeader && expected && token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const max = Number(request.nextUrl.searchParams.get("max") ?? 10);
  const result = await processQueue(Math.min(Math.max(1, max), 50));
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  return POST(request);
}
