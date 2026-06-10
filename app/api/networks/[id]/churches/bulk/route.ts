import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

type ChurchInput = {
  name: string;
  slug?: string | null;
  church_number?: string | null;
  city?: string | null;
  service_schedule?: string | null;
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

  const { id: networkId } = await params;
  const network = await db.getNetworkById(networkId);
  if (!network) {
    return NextResponse.json({ error: "Network not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const rows: ChurchInput[] = Array.isArray(body.churches) ? body.churches : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No church rows supplied." }, { status: 400 });
  }

  const existing = await db.listChurches();
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
    let newcomer = slug;
    let attempt = 2;
    while (existingSlugs.has(newcomer)) {
      newcomer = `${slug}-${attempt++}`;
      if (attempt > 20) break;
    }
    slug = newcomer;

    try {
      const church = await db.createChurch({
        slug,
        name: row.name.trim(),
        network_id: networkId,
        church_number: row.church_number?.trim() || null,
        city: row.city?.trim() || null,
        service_schedule: row.service_schedule?.trim() || null,
        secretary_name: row.secretary_name?.trim() || null,
        support_email: row.support_email?.trim() || null,
      });
      existingSlugs.add(church.slug);
      created.push({ id: church.id, slug: church.slug, name: church.name });
    } catch (err) {
      errors.push({
        row: idx + 1,
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  await writeAuditLog({
    churchId: null,
    action: "network_bulk_churches_created",
    entityType: "network",
    entityId: networkId,
    summary: `Created ${created.length} churches in ${network.name}`,
    metadata: { created: created.length, errors: errors.length },
  });

  return NextResponse.json({ ok: true, network_id: networkId, created, errors });
}
