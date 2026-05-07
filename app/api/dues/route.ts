import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
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
      return NextResponse.json({ dues: [] });
    }

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }

    const status = request.nextUrl.searchParams.get("status") ?? undefined;

    const dues = await db.getMemberDues(lodgeId, { memberEmail, status });
    return NextResponse.json({ dues });
  } catch (e) {
    console.error("Dues GET error:", e);
    return NextResponse.json({ error: "Failed to fetch dues." }, { status: 500 });
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

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
    if (forbidden) return forbidden;

    const body = await request.json();
    if (body.action) {
      const duesId = body.dues_id;
      if (!duesId) {
        return NextResponse.json({ error: "dues_id is required." }, { status: 400 });
      }

      const statusMap: Record<string, "paid" | "waived" | "outstanding"> = {
        mark_paid: "paid",
        waive: "waived",
        mark_outstanding: "outstanding",
      };
      const nextStatus = statusMap[body.action as string];
      if (!nextStatus) {
        return NextResponse.json({ error: "Unsupported dues action." }, { status: 400 });
      }

      const record = await db.updateMemberDuesStatus(duesId, lodgeId, {
        status: nextStatus,
        paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
      });
      if (!record) {
        return NextResponse.json({ error: "Dues record not found." }, { status: 404 });
      }
      await writeAuditLog({
        lodgeId,
        action: body.action,
        entityType: "dues",
        entityId: record.id,
        summary: `Updated dues for ${record.member_email}`,
        metadata: { status: nextStatus },
      });
      return NextResponse.json({ dues: record });
    }

    const {
      member_email,
      member_name,
      dues_id,
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

    const record = await db.createMemberDues(lodgeId, {
      member_email,
      member_name: member_name ?? null,
      member_id: null,
      dues_id: dues_id ?? null,
      amount: Number(amount),
      currency: currency ?? "gbp",
      period_start,
      period_end,
      status: "outstanding",
      payment_id: null,
      stripe_payment_intent_id: null,
      stripe_subscription_id: null,
      paid_at: null,
    });

    await writeAuditLog({
      lodgeId,
      action: "created",
      entityType: "dues",
      entityId: record.id,
      summary: `Created dues for ${record.member_email}`,
      metadata: { amount: record.amount, period_start, period_end },
    });
    return NextResponse.json({ dues: record }, { status: 201 });
  } catch (e) {
    console.error("Dues POST error:", e);
    return NextResponse.json({ error: "Failed to create dues record." }, { status: 500 });
  }
}
