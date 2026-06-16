import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

type Frequency = "monthly" | "quarterly" | "annually";

function buildInstalmentSchedule({
  count,
  frequency,
  totalAmount,
  startDate,
}: {
  count: number;
  frequency: Frequency;
  totalAmount: number;
  startDate: Date;
}): Array<{ sequence: number; due_date: string; amount: number }> {
  if (count <= 1) {
    return [
      {
        sequence: 1,
        due_date: startDate.toISOString().slice(0, 10),
        amount: Number(totalAmount.toFixed(2)),
      },
    ];
  }

  const monthsPerInstalment =
    frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;

  const baseAmount = Math.floor((totalAmount / count) * 100) / 100;
  const remainder = Number((totalAmount - baseAmount * count).toFixed(2));

  const rows: Array<{ sequence: number; due_date: string; amount: number }> = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i * monthsPerInstalment);
    const amount = i === count - 1 ? Number((baseAmount + remainder).toFixed(2)) : baseAmount;
    rows.push({
      sequence: i + 1,
      due_date: date.toISOString().slice(0, 10),
      amount,
    });
  }
  return rows;
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
    const forbidden = await requireAdminApiPermission(
      "payments:write",
      mosqueId
    );
    if (forbidden) return forbidden;

    const body = await request.json();
    const givingId: string | null = body.giving_id ?? null;
    const periodStart: string = body.period_start;
    const periodEnd: string = body.period_end;
    const memberIds: string[] | undefined = Array.isArray(body.member_ids)
      ? body.member_ids
      : undefined;
    const instalmentCount = Math.max(1, Math.min(24, Number(body.instalment_count ?? 1)));
    const frequencyInput: Frequency =
      body.instalment_frequency === "monthly" ||
      body.instalment_frequency === "quarterly" ||
      body.instalment_frequency === "annually"
        ? body.instalment_frequency
        : "monthly";

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "period_start and period_end are required." },
        { status: 400 }
      );
    }

    let amount: number | null = body.amount != null ? Number(body.amount) : null;
    let currency = body.currency ?? "gbp";
    let charitableAmount = 0;
    let giftAidEnabled = false;

    if (givingId) {
      const mosqueGivingList = await db.getMosqueGiving(mosqueId);
      const template = mosqueGivingList.find((d) => d.id === givingId);
      if (!template) {
        return NextResponse.json(
          { error: "Mosque giving template not found." },
          { status: 404 }
        );
      }
      amount = amount ?? template.amount;
      currency = template.currency;
      charitableAmount = Math.min(template.charitable_amount ?? 0, amount ?? 0);
      giftAidEnabled = template.gift_aid_enabled === true;
    }

    if (amount == null || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "A positive amount is required." },
        { status: 400 }
      );
    }

    const allMembers = await db.getMembers(mosqueId, { status: "active" });
    const targets = memberIds
      ? allMembers.filter((m) => memberIds.includes(m.id))
      : allMembers;

    if (targets.length === 0) {
      return NextResponse.json(
        { error: "No matching active members." },
        { status: 400 }
      );
    }

    const existing = await db.getMemberGiving(mosqueId);
    const existingKeys = new Set(
      existing.map(
        (d) => `${d.member_email}|${d.period_start}|${d.period_end}`
      )
    );

    const created: { giving_id: string; member_email: string; instalments: number }[] = [];
    const skipped: { member_email: string; reason: string }[] = [];

    for (const member of targets) {
      if (member.annual_giving_waived === true) {
        skipped.push({
          member_email: member.email,
          reason: "Annual giving waived on profile",
        });
        continue;
      }
      const key = `${member.email}|${periodStart}|${periodEnd}`;
      if (existingKeys.has(key)) {
        skipped.push({ member_email: member.email, reason: "Already billed for this period" });
        continue;
      }

      const giving = await db.createMemberGiving(mosqueId, {
        member_email: member.email,
        member_name: member.full_name,
        member_id: member.id,
        giving_id: givingId,
        amount,
        currency,
        period_start: periodStart,
        period_end: periodEnd,
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

      const schedule = buildInstalmentSchedule({
        count: instalmentCount,
        frequency: frequencyInput,
        totalAmount: amount,
        startDate: new Date(periodStart),
      });

      await db.createMemberGivingInstalments(
        mosqueId,
        schedule.map((row) => ({
          member_giving_id: giving.id,
          sequence: row.sequence,
          due_date: row.due_date,
          amount: row.amount,
          currency,
          status: "outstanding",
          paid_at: null,
          reminder_sent_at: null,
          payment_reference: null,
        }))
      );

      created.push({
        giving_id: giving.id,
        member_email: member.email,
        instalments: schedule.length,
      });
    }

    await writeAuditLog({
      mosqueId,
      action: "bulk_giving_run",
      entityType: "giving",
      entityId: mosqueId,
      summary: `Bulk giving run created ${created.length} giving records`,
      metadata: {
        period_start: periodStart,
        period_end: periodEnd,
        amount,
        instalment_count: instalmentCount,
        instalment_frequency: frequencyInput,
        created_count: created.length,
        skipped_count: skipped.length,
      },
    });

    return NextResponse.json({ created, skipped });
  } catch (e) {
    console.error("Bulk giving run error:", e);
    return NextResponse.json(
      { error: "Failed to run bulk giving." },
      { status: 500 }
    );
  }
}
