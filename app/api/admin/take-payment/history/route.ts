// GET /api/admin/take-payment/history
//
// Returns the most recent in-person "take payment" QR codes for the active
// lodge so admins can see, at a glance, which QRs are still open, which were
// paid, who they were for, and who generated them. Drives the "Recent QR
// codes" panel on /admin/take-payment.
//
// We read mooov.payment_attempts (intent='take_payment') as the source of
// truth — the row exists from the moment the QR is minted, before any
// webhook fires. For paid attempts we left-join to public.payments via
// mooov_payment_id to surface the projected total, payer name/email, and
// completion timestamp.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPIRY_MS = 24 * 60 * 60 * 1000;

type Derived =
  | "paid"
  | "open"
  | "expired"
  | "cancelled"
  | "failed";

type AttemptRow = {
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
  failure_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  captured_at: string | null;
};

type ProjectedRow = {
  id: string;
  status: string;
  total_amount: number;
  refund_amount: number | null;
  user_name: string | null;
  user_email: string | null;
  completed_at: string | null;
  mooov_payment_id: string;
};

function deriveStatus(row: AttemptRow, projected: ProjectedRow | null): Derived {
  if (projected) {
    const s = projected.status;
    if (s === "succeeded" || s === "completed" || s === "paid") return "paid";
    if (s === "refunded" || s === "partially_refunded") return "paid";
  }
  if (row.captured_at) return "paid";
  if (row.status === "cancelled" || row.status === "canceled") return "cancelled";
  if (row.status === "failed" || row.status === "expired") {
    return row.status === "expired" ? "expired" : "failed";
  }
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs > EXPIRY_MS) return "expired";
  return "open";
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ items: [] });
  }

  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, 100)
    : 30;

  let supa: ReturnType<typeof createServiceClient>;
  try {
    supa = createServiceClient();
  } catch (err) {
    console.error("Take payment history: supabase service client unavailable", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ items: [] });
  }

  const { data: attempts, error: attemptsErr } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .select(
      "payment_id, amount, currency, status, failure_reason, metadata, created_at, captured_at",
    )
    .eq("lodge_id", lodgeId)
    .eq("intent", "take_payment")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AttemptRow[]>();

  if (attemptsErr) {
    console.error("Take payment history: attempts lookup failed", {
      lodge_id: lodgeId,
      code: attemptsErr.code,
      message: attemptsErr.message,
    });
    return NextResponse.json(
      { error: "Could not load history." },
      { status: 500 },
    );
  }

  const rows = attempts ?? [];
  const ids = rows.map((r) => r.payment_id);

  // Lookup projected payments in one round-trip when there are any attempts.
  const projectedById = new Map<string, ProjectedRow>();
  if (ids.length > 0) {
    const { data: projected } = await supa
      .from("payments")
      .select(
        "id, status, total_amount, refund_amount, user_name, user_email, completed_at, mooov_payment_id",
      )
      .in("mooov_payment_id", ids)
      .returns<ProjectedRow[]>();
    for (const p of projected ?? []) {
      projectedById.set(p.mooov_payment_id, p);
    }
  }

  const items = rows.map((row) => {
    const projected = projectedById.get(row.payment_id) ?? null;
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      payment_id: row.payment_id,
      amount_minor: row.amount,
      currency: row.currency,
      raw_status: row.status,
      derived_status: deriveStatus(row, projected),
      failure_reason: row.failure_reason,
      created_at: row.created_at,
      captured_at: row.captured_at,
      category: typeof meta.category === "string" ? meta.category : null,
      reference: typeof meta.reference === "string" ? meta.reference : null,
      description:
        typeof meta.description === "string" ? meta.description : null,
      hosted_url:
        typeof meta.hosted_url === "string" ? meta.hosted_url : null,
      created_by_email:
        typeof meta.created_by_email === "string"
          ? meta.created_by_email
          : null,
      // Member attribution snapshot (resolved at mint time so it survives
      // even if the member record is later edited or archived).
      member_id:
        typeof meta.member_id === "string" ? meta.member_id : null,
      member_name:
        typeof meta.member_name === "string" ? meta.member_name : null,
      member_email:
        typeof meta.member_email === "string" ? meta.member_email : null,
      gift_aid_eligible: meta.gift_aid_eligible === true,
      gift_aid_declaration_id:
        typeof meta.gift_aid_declaration_id === "string"
          ? meta.gift_aid_declaration_id
          : null,
      paid_by_name: projected?.user_name ?? null,
      paid_by_email: projected?.user_email ?? null,
      paid_total: projected?.total_amount ?? null,
      paid_at: projected?.completed_at ?? null,
    };
  });

  return NextResponse.json({ items });
}
