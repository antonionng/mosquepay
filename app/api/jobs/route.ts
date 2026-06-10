// crud-audit:ignore
// Job queue surface. Jobs enqueue via POST and progress automatically; they
// are not mutated by hand through this API.
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) return NextResponse.json({ jobs: [] });
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("admin:all", churchId);
  if (forbidden) return forbidden;
  return NextResponse.json({
    jobs: await db.listJobs({ churchId, limit: 50 }),
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("admin:all", churchId);
  if (forbidden) return forbidden;
  const body = await request.json();
  const job = await db.enqueueJob({
    church_id: churchId,
    job_type: body.job_type,
    payload: body.payload ?? {},
    scheduled_at: body.scheduled_at ?? new Date().toISOString(),
    max_attempts: body.max_attempts ?? 3,
    created_by_admin_user_id: null,
  });
  return NextResponse.json({ job }, { status: 201 });
}
