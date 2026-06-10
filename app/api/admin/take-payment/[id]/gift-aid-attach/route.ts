// Retroactively attach a Gift Aid declaration to a just-logged take-payment
// and create the donation row that would have been auto-projected if the
// declaration had been on file at capture time.
//
// Triggered from the on-the-day capture dialog: treasurer logs £20 cash for
// Member Smith (no declaration), then snaps the paper slip and uploads it,
// which creates the declaration; this endpoint then closes the loop by
// inserting the GA donation row so the per-service claim batch includes it.
//
// Idempotent: if a donation row already exists for this payment_id + the
// supplied declaration_id, we return ok without inserting a duplicate.

import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { getCurrentAdminContextAny } from "@/lib/auth/permissions";
import { isCharityCategory } from "@/lib/take-payment/categorize";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id: paymentId } = await params;
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("charity:write", churchId);
  if (forbidden) return forbidden;

  const body = (await request.json().catch(() => ({}))) as {
    declaration_id?: string;
  };
  const declarationId = body.declaration_id;
  if (!declarationId || typeof declarationId !== "string") {
    return NextResponse.json(
      { error: "declaration_id is required." },
      { status: 400 }
    );
  }

  const payment = await db.getPaymentById(paymentId, churchId);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  const declaration = await db.getGiftAidDeclarationById(declarationId, churchId);
  if (!declaration) {
    return NextResponse.json(
      { error: "Declaration not found in this church." },
      { status: 404 }
    );
  }
  if (declaration.revoked_at) {
    return NextResponse.json(
      { error: "Declaration has been revoked." },
      { status: 400 }
    );
  }

  // Only useful for charity-categorised income. If the original payment was
  // logged as raffle or dining, attaching GA would be incorrect (HMRC).
  // Mirror the projector's category check.
  const charityAmount = Number(payment.charity_amount ?? 0);
  if (charityAmount <= 0 || !isCharityCategory("charity")) {
    return NextResponse.json(
      {
        error:
          "This payment had no charity portion. Re-categorise the payment first.",
      },
      { status: 400 }
    );
  }
  // Email must match -- HMRC declarations are donor-scoped. We trust the
  // payment row's user_email which the treasurer set at capture time.
  const expectedEmail = payment.user_email?.toLowerCase()?.trim() ?? "";
  const declarationEmail = declaration.donor_email.toLowerCase().trim();
  if (
    expectedEmail &&
    declarationEmail &&
    expectedEmail !== declarationEmail
  ) {
    return NextResponse.json(
      {
        error:
          "Declaration donor email does not match the payment donor email.",
      },
      { status: 400 }
    );
  }

  // Idempotency: skip if the donation row already exists for this payment
  // pointing at this declaration. We look up donations by email, which is
  // already the projector's path of record.
  try {
    const donations = await db.getDonationsByEmail(
      payment.user_email ?? "",
      churchId
    );
    const existing = donations.find(
      (d) =>
        d.payment_id === payment.id &&
        d.gift_aid_declaration_id === declarationId
    );
    if (existing) {
      return NextResponse.json({ donation_id: existing.id, idempotent: true });
    }
  } catch {
    /* non-fatal */
  }

  let donationId: string | null = null;
  try {
    const donation = await db.addDonation(churchId, {
      event_id: payment.event_id,
      payment_id: payment.id,
      donor_name: payment.user_name,
      donor_email: payment.user_email,
      amount: charityAmount,
      currency: (payment.currency ?? "GBP").toLowerCase(),
      source: "in_person_take_payment_cash_giftaid_attach",
      status: "completed",
      gift_aid_declaration_id: declarationId,
    });
    donationId = donation?.id ?? null;
  } catch (err) {
    console.error("gift-aid-attach: donation insert failed", {
      payment_id: payment.id,
      declaration_id: declarationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not backfill Gift Aid donation." },
      { status: 500 }
    );
  }

  let actorEmail: string | null = null;
  try {
    const admin = await getCurrentAdminContextAny(churchId);
    actorEmail = admin?.email ?? null;
  } catch {
    /* non-fatal */
  }
  try {
    await db.insertGiftAidDeclarationEvent(churchId, {
      declaration_id: declarationId,
      event_type: "address_updated",
      actor_kind: "admin",
      actor_email: actorEmail,
      actor_ip: null,
      actor_user_agent: request.headers.get("user-agent"),
      before_state: null,
      after_state: { backfilled_payment_id: payment.id, donation_id: donationId },
      evidence_sha256: declaration.evidence_sha256,
      notes: `On-the-day Gift Aid attached to payment ${payment.id}.`,
    });
  } catch (err) {
    console.warn("gift-aid-attach: event insert failed", {
      payment_id: payment.id,
      declaration_id: declarationId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  await writeAuditLog({
    churchId,
    action: "gift_aid_attached_to_payment",
    entityType: "payment",
    entityId: payment.id,
    summary: `Attached Gift Aid declaration to in-person payment for ${payment.user_name ?? payment.user_email ?? "anonymous"}.`,
    metadata: {
      declaration_id: declarationId,
      donation_id: donationId,
      amount: charityAmount,
    },
  });

  return NextResponse.json({ donation_id: donationId, idempotent: false });
}
