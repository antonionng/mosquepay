import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

type LodgeInput = {
  name: string;
  slug?: string | null;
  lodge_number?: string | null;
  city?: string | null;
  meeting_schedule?: string | null;
  secretary_name?: string | null;
  support_email?: string | null;
};

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const forbidden = await requireAdminApiPermission("admin:all");
  if (forbidden) return forbidden;

  const { id: provinceId } = await params;
  const province = await db.getProvinceById(provinceId);
  if (!province) {
    return NextResponse.json({ error: "Province not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const rows: LodgeInput[] = Array.isArray(body.lodges) ? body.lodges : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No lodge rows supplied." }, { status: 400 });
  }

  const existing = await db.listLodges();
  const existingSlugs = new Set(existing.map((l) => l.slug));

  const created: Array<{ id: string; slug: string; name: string }> = [];
  const errors: Array<{ row: number; reason: string }> = [];

  rows.forEach((_, idx) => {
    const r = rows[idx];
    if (!r?.name?.trim()) {
      errors.push({ row: idx + 1, reason: "Missing name" });
    }
  });

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (!row?.name?.trim()) continue;

    let slug = (row.slug?.trim() || slugify(row.name)).toLowerCase();
    if (!slug) {
      errors.push({ row: idx + 1, reason: "Could not derive slug" });
      continue;
    }
    let candidate = slug;
    let attempt = 2;
    while (existingSlugs.has(candidate)) {
      candidate = `${slug}-${attempt++}`;
      if (attempt > 20) break;
    }
    slug = candidate;

    try {
      const lodge = await db.createLodge({
        slug,
        name: row.name.trim(),
        province_id: provinceId,
        lodge_number: row.lodge_number?.trim() || null,
        city: row.city?.trim() || null,
        meeting_schedule: row.meeting_schedule?.trim() || null,
        secretary_name: row.secretary_name?.trim() || null,
        support_email: row.support_email?.trim() || null,
      });
      existingSlugs.add(lodge.slug);
      created.push({ id: lodge.id, slug: lodge.slug, name: lodge.name });
    } catch (err) {
      errors.push({
        row: idx + 1,
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  await writeAuditLog({
    lodgeId: null,
    action: "province_bulk_lodges_created",
    entityType: "province",
    entityId: provinceId,
    summary: `Created ${created.length} lodges in ${province.name}`,
    metadata: { created: created.length, errors: errors.length },
  });

  return NextResponse.json({ ok: true, province_id: provinceId, created, errors });
}
