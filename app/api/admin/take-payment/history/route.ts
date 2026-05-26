// GET /api/admin/take-payment/history
//
// Returns recent in-person take-payment entries — both card QRs
// (intent='take_payment') and treasurer-recorded cash entries
// (intent='take_payment_cash') — for the active lodge.
//
// Source of truth is mooov.payment_attempts so every entry (including open
// QRs that have not been paid yet) appears the moment it's created. For
// captured entries we left-join public.payments via mooov_payment_id to
// surface the projected total, payer name/email, and completion timestamp,
// plus the new payment_method / refund_amount / refund_reason fields that
// distinguish a voided cash entry from a paid one.
//
// Query params:
//   * limit  — max 100, default 30
//   * method — 'qr' | 'cash' (optional)
//   * status — 'open' | 'paid' | 'expired' | 'cancelled' | 'failed' | 'voided'

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
  | "failed"
  | "voided";

type Method = "card_qr" | "cash";

type AttemptRow = {
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
  intent: string;
  failure_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  captured_at: string | null;
  refunded_at: string | null;
};

type ProjectedRow = {
  id: string;
  status: string;
  total_amount: number;
  refund_amount: number | null;
  refund_reason: string | null;
  user_name: string | null;
  user_email: string | null;
  completed_at: string | null;
  payment_method: string | null;
  mooov_payment_id: string;
};

function methodFromIntent(intent: string): Method {
  return intent === "take_payment_cash" ? "cash" : "card_qr";
}

function deriveStatus(row: AttemptRow, projected: ProjectedRow | null): Derived {
  // Voided cash: the cancel endpoint flips both the attempt (status=refunded,
  // refunded_at set) and the projected payments row (status=refunded). We
  // treat a refunded projected row as the canonical "voided" indicator
  // because cash never has the partial-refund semantics that card payments
  // do — it's all-or-nothing.
  if (projected && projected.status === "refunded") {
    return row.intent === "take_payment_cash" ? "voided" : "paid";
  }
  if (row.refunded_at && row.intent === "take_payment_cash") return "voided";

  if (projected) {
    const s = projected.status;
    if (s === "succeeded" || s === "completed" || s === "paid") return "paid";
    if (s === "partially_refunded") return "paid";
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
  const methodFilter = url.searchParams.get("method"); // 'qr' | 'cash' | null
  const statusFilter = url.searchParams.get("status"); // 'open' | 'paid' | ...

  let supa: ReturnType<typeof createServiceClient>;
  try {
    supa = createServiceClient();
  } catch (err) {
    console.error("Take payment history: supabase service client unavailable", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ items: [] });
  }

  let query = supa
    .schema("mooov")
    .from("payment_attempts")
    .select(
      "payment_id, amount, currency, status, intent, failure_reason, metadata, created_at, captured_at, refunded_at",
    )
    .eq("lodge_id", lodgeId)
    .in("intent", ["take_payment", "take_payment_cash"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (methodFilter === "qr") {
    query = query.eq("intent", "take_payment");
  } else if (methodFilter === "cash") {
    query = query.eq("intent", "take_payment_cash");
  }

  const { data: attempts, error: attemptsErr } = await query.returns<AttemptRow[]>();

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

  const projectedById = new Map<string, ProjectedRow>();
  if (ids.length > 0) {
    const { data: projected } = await supa
      .from("payments")
      .select(
        "id, status, total_amount, refund_amount, refund_reason, user_name, user_email, completed_at, payment_method, mooov_payment_id",
      )
      .in("mooov_payment_id", ids)
      .returns<ProjectedRow[]>();
    for (const p of projected ?? []) {
      projectedById.set(p.mooov_payment_id, p);
    }
  }

  let items = rows.map((row) => {
    const projected = projectedById.get(row.payment_id) ?? null;
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const derived = deriveStatus(row, projected);
    const method = methodFromIntent(row.intent);
    return {
      payment_id: row.payment_id,
      amount_minor: row.amount,
      currency: row.currency,
      raw_status: row.status,
      derived_status: derived,
      method,
      voided: derived === "voided",
      voided_reason:
        derived === "voided"
          ? projected?.refund_reason ?? row.failure_reason ?? null
          : null,
      failure_reason: row.failure_reason,
      created_at: row.created_at,
      captured_at: row.captured_at,
      refunded_at: row.refunded_at,
      category: typeof meta.category === "string" ? meta.category : null,
      reference: typeof meta.reference === "string" ? meta.reference : null,
      description:
        typeof meta.description === "string" ? meta.description : null,
      note: typeof meta.note === "string" ? meta.note : null,
      hosted_url:
        typeof meta.hosted_url === "string" ? meta.hosted_url : null,
      created_by_email:
        typeof meta.created_by_email === "string"
          ? meta.created_by_email
          : null,
      member_id:
        typeof meta.member_id === "string" ? meta.member_id : null,
      member_name:
        typeof meta.payer_name === "string"
          ? meta.payer_name
          : typeof meta.member_name === "string"
            ? meta.member_name
            : null,
      member_email:
        typeof meta.payer_email === "string"
          ? meta.payer_email
          : typeof meta.member_email === "string"
            ? meta.member_email
            : null,
      // The take-payment shell deep-links guest names in Recent to
      // /admin/guests/<id>. We always emit guest_id when known so the
      // client doesn't have to guess.
      guest_id:
        typeof meta.guest_id === "string" ? meta.guest_id : null,
      gift_aid_eligible: meta.gift_aid_eligible === true,
      gift_aid_declaration_id:
        typeof meta.gift_aid_declaration_id === "string"
          ? meta.gift_aid_declaration_id
          : null,
      paid_by_name: projected?.user_name ?? null,
      paid_by_email: projected?.user_email ?? null,
      paid_total: projected?.total_amount ?? null,
      paid_at: projected?.completed_at ?? null,
      payment_method: projected?.payment_method ?? null,
    };
  });

  if (statusFilter) {
    items = items.filter((item) => item.derived_status === statusFilter);
  }

  return NextResponse.json({ items });
}
