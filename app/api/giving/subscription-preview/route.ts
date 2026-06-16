// POST /api/giving/subscription-preview
//
// Returns the per-cycle plan that POST /api/giving/pay (mode: "subscription")
// WOULD create, without writing anything or contacting Mooov. Drives the
// "Set Up Instalments" confirmation dialog on /member/giving so the member
// sees their full schedule (cycles, amounts, dates, total, autoRenew)
// before being redirected to Mooov hosted Checkout — which only knows
// about cycle 1 and saved-card setup.
//
// Auth: same shape as /api/member/dashboard. The giving_id UUID is
// unguessable and we additionally check that the requester's member
// row owns it; rejecting otherwise returns 404 to avoid leaking
// giving_id existence to a different member.
//
// Body:
//   { giving_id: string, split_strategy?: GivingSplitStrategy, auto_renew?: boolean }
//
// Response (200):
//   { plan: { ... see EnrolmentPlanResponse below } }
//
// Errors map directly from EnrolmentPlanError; HTTP status mirrors the
// helper's `error.status`.

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { createServiceClient } from "@/lib/supabase/server";
import {
  computeEnrolmentPlan,
  describeStrategy,
} from "@/lib/giving/enrolment-plan";
import type { GivingCadence } from "@/lib/giving/strategies";
import { givingSubscriptionEnabled } from "@/lib/giving/feature-flags";
import type { GivingSplitStrategy, MemberGiving } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 },
    );
  }

  if (!givingSubscriptionEnabled()) {
    return NextResponse.json(
      {
        error:
          "Monthly instalments are coming soon. Please pay in full or contact your mosque secretary.",
        code: "subscription_not_enabled",
      },
      { status: 503 },
    );
  }

  let body: {
    giving_id?: string;
    member_email?: string;
    split_strategy?: GivingSplitStrategy;
    auto_renew?: boolean;
    cadence?: GivingCadence;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const givingId = body.giving_id;
  const memberEmail = body.member_email;
  if (!givingId || !memberEmail) {
    return NextResponse.json(
      { error: "giving_id and member_email are required." },
      { status: 400 },
    );
  }

  // Same row-derived tenant resolution we use on /api/giving/pay so the
  // preview cannot disagree about the mosque.
  let supa: ReturnType<typeof createServiceClient>;
  try {
    supa = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Payments are not configured." },
      { status: 503 },
    );
  }

  const { data: givingRecordRaw, error: givingErr } = await supa
    .from("member_giving")
    .select("*")
    .eq("id", givingId)
    .maybeSingle();
  if (givingErr) {
    console.error("giving/subscription-preview: giving lookup failed", {
      giving_id: givingId,
      message: givingErr.message,
    });
    return NextResponse.json(
      { error: "Could not look up giving record." },
      { status: 500 },
    );
  }
  if (!givingRecordRaw) {
    return NextResponse.json(
      { error: "Giving record not found." },
      { status: 404 },
    );
  }
  const givingRecord = givingRecordRaw as MemberGiving;
  if (
    (givingRecord.member_email ?? "").trim().toLowerCase() !==
    memberEmail.trim().toLowerCase()
  ) {
    return NextResponse.json(
      { error: "Giving record not found." },
      { status: 404 },
    );
  }
  if (givingRecord.status === "paid") {
    return NextResponse.json(
      { error: "Giving already paid.", code: "already_paid" },
      { status: 409 },
    );
  }

  const planResult = await computeEnrolmentPlan({
    mosqueId: givingRecord.mosque_id,
    givingRecord,
    memberEmail,
    strategy: body.split_strategy,
    autoRenew: body.auto_renew,
    cadence:
      body.cadence === "monthly" || body.cadence === "quarterly"
        ? body.cadence
        : undefined,
  });
  if (!planResult.ok) {
    return NextResponse.json(
      {
        error: planResult.error.message,
        code: planResult.error.code,
        ...(planResult.error.details ?? {}),
      },
      { status: planResult.error.status },
    );
  }
  const plan = planResult.plan;

  return NextResponse.json({
    plan: {
      memberEmail: plan.member.email,
      memberName: plan.member.full_name,
      currency: plan.currency,
      annualAmount: plan.annualAmount,
      cadence: plan.cadence,
      cadenceOptions: plan.cadenceOptions,
      strategy: plan.strategy,
      strategyDescription: describeStrategy(plan.strategy, plan.yearPosition),
      autoRenew: plan.autoRenew,
      yearLabel: plan.mosqueYear.label,
      yearStartDate: plan.mosqueYear.start_date,
      yearEndDate: plan.mosqueYear.end_date,
      cycleCount: plan.schedule.cycleCount,
      firstCycleAmount: plan.schedule.firstCycleAmount,
      total: plan.schedule.total,
      cycles: plan.schedule.rows.map((row) => ({
        sequence: row.sequence,
        dueDate: row.due_date,
        amount: row.amount,
      })),
      // Which Mooov surface this enrolment will use. Drives the
      // confirmation copy on /member/giving so members know whether
      // their plan is fixed-term or renews indefinitely until they
      // cancel.
      mooovFlow: plan.mooovFlow,
      monthlyAmount: plan.monthlyAmount,
    },
  });
}
