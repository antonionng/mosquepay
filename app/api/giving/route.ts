import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const memberEmail = request.nextUrl.searchParams.get("member_email") ?? undefined;
    if (!memberEmail) {
      const unauthorized = await requireAdminApiAuth();
      if (unauthorized) return unauthorized;
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ giving: [] });
    }

    const mosqueSlug = getMosqueSlugFromRequest(request);
    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }

    const status = request.nextUrl.searchParams.get("status") ?? undefined;

    const giving = await db.getMemberGiving(mosqueId, { memberEmail, status });
    return NextResponse.json({ giving });
  } catch (e) {
    console.error("Giving GET error:", e);
    return NextResponse.json({ error: "Failed to fetch giving." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
    const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
    if (forbidden) return forbidden;

    const body = await request.json();
    if (body.action) {
      const givingId = body.giving_id;
      if (!givingId) {
        return NextResponse.json({ error: "giving_id is required." }, { status: 400 });
      }

      const statusMap: Record<string, "paid" | "waived" | "outstanding"> = {
        mark_paid: "paid",
        waive: "waived",
        mark_outstanding: "outstanding",
      };
      const nextStatus = statusMap[body.action as string];
      if (!nextStatus) {
        return NextResponse.json({ error: "Unsupported giving action." }, { status: 400 });
      }

      const rawNote =
        typeof body.waiver_reason === "string"
          ? body.waiver_reason.trim()
          : typeof body.note === "string"
            ? body.note.trim()
            : "";
      const waiverReason = rawNote ? rawNote.slice(0, 500) : null;

      const updates: Parameters<typeof db.updateMemberGivingStatus>[2] = {
        status: nextStatus,
        paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
      };
      if (nextStatus === "waived") {
        updates.waiver_reason = waiverReason;
      } else if (nextStatus === "outstanding") {
        // Reopening a waived record clears any prior reason so the audit
        // trail does not appear to still apply.
        updates.waiver_reason = null;
      }

      const record = await db.updateMemberGivingStatus(givingId, mosqueId, updates);
      if (!record) {
        return NextResponse.json({ error: "Giving record not found." }, { status: 404 });
      }
      await writeAuditLog({
        mosqueId,
        action: body.action,
        entityType: "giving",
        entityId: record.id,
        summary: `Updated giving for ${record.member_email}`,
        metadata: {
          status: nextStatus,
          ...(nextStatus === "waived" && waiverReason
            ? { waiver_reason: waiverReason }
            : {}),
        },
      });
      return NextResponse.json({ giving: record });
    }

    const {
      member_email,
      member_name,
      giving_id,
      amount,
      currency,
      period_start,
      period_end,
    } = body;

    if (!member_email || !amount || !period_start || !period_end) {
      return NextResponse.json(
        { error: "member_email, amount, period_start, and period_end are required." },
        { status: 400 }
      );
    }

    let charitableAmount = Number(body.charitable_amount ?? 0);
    let giftAidEnabled = Boolean(body.gift_aid_enabled);
    if (giving_id) {
      const templates = await db.getMosqueGiving(mosqueId);
      const template = templates.find((item) => item.id === giving_id);
      if (template) {
        charitableAmount = Math.min(template.charitable_amount ?? 0, Number(amount));
        giftAidEnabled = template.gift_aid_enabled === true;
      }
    }

    const record = await db.createMemberGiving(mosqueId, {
      member_email,
      member_name: member_name ?? null,
      member_id: null,
      giving_id: giving_id ?? null,
      amount: Number(amount),
      currency: currency ?? "gbp",
      period_start,
      period_end,
      status: "outstanding",
      payment_id: null,
      stripe_payment_intent_id: null,
      stripe_subscription_id: null,
      charitable_amount: giftAidEnabled ? charitableAmount : 0,
      gift_aid_declaration_id: null,
      gift_aid_status: giftAidEnabled && charitableAmount > 0 ? "eligible" : "unknown",
      gift_aid_eligible_amount: giftAidEnabled ? charitableAmount : 0,
      paid_at: null,
    });

    await writeAuditLog({
      mosqueId,
      action: "created",
      entityType: "giving",
      entityId: record.id,
      summary: `Created giving for ${record.member_email}`,
      metadata: { amount: record.amount, period_start, period_end },
    });
    return NextResponse.json({ giving: record }, { status: 201 });
  } catch (e) {
    console.error("Giving POST error:", e);
    return NextResponse.json({ error: "Failed to create giving record." }, { status: 500 });
  }
}
