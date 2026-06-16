// crud-audit:ignore
// Job queue surface. Jobs enqueue via POST and progress automatically; they
// are not mutated by hand through this API.
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) return NextResponse.json({ jobs: [] });
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("admin:all", mosqueId);
  if (forbidden) return forbidden;
  return NextResponse.json({
    jobs: await db.listJobs({ mosqueId, limit: 50 }),
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
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("admin:all", mosqueId);
  if (forbidden) return forbidden;
  const body = await request.json();
  const job = await db.enqueueJob({
    mosque_id: mosqueId,
    job_type: body.job_type,
    payload: body.payload ?? {},
    scheduled_at: body.scheduled_at ?? new Date().toISOString(),
    max_attempts: body.max_attempts ?? 3,
    created_by_admin_user_id: null,
  });
  return NextResponse.json({ job }, { status: 201 });
}
