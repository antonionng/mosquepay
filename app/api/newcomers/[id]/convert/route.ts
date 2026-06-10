import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { calculateProRataGiving } from "@/lib/giving/pro-rata";
import { isRank, RANK_CODES } from "@/lib/members/rank";

/**
 * Convert an approved/welcomed newcomer into a member record.
 * Carries newcomer first/last/email/phone/location into the member.
 * Optional fields in body: address_line_1, address_line_2, city, county,
 * postcode, country, dietary_requirements, date_of_membership, office_title,
 * rank, set_welcomed (default true).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const { id } = await params;
  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const churchSlug = getChurchSlugFromRequest(request);
    const body = await request.json().catch(() => ({}));

    if (
      body.rank != null &&
      body.rank !== "" &&
      !isRank(body.rank)
    ) {
      return NextResponse.json(
        {
          error: `Invalid rank "${body.rank}". Must be one of: ${RANK_CODES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const churchId = await db.resolveChurchId(churchSlug);
      if (!churchId) {
        return NextResponse.json({ error: "Church not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("members:write", churchId);
      if (forbidden) return forbidden;

      const newcomer = await db.getNewcomerById(id, churchId);
      if (!newcomer) {
        return NextResponse.json({ error: "Newcomer not found." }, { status: 404 });
      }
      if (newcomer.converted_member_id) {
        return NextResponse.json(
          { error: "Newcomer already converted to a member.", member_id: newcomer.converted_member_id },
          { status: 409 }
        );
      }

      const email = (body.email ?? newcomer.email).trim().toLowerCase();
      const existing = await db.getMemberByEmail(email, churchId);
      if (existing) {
        await db.updateNewcomer(id, churchId, {
          converted_member_id: existing.id,
          converted_at: new Date().toISOString(),
          stage: "welcomed",
        });
        return NextResponse.json(
          { error: "A member with this email already exists.", member: existing },
          { status: 409 }
        );
      }

      const fullName = body.full_name ?? `${newcomer.first_name} ${newcomer.last_name}`.trim();
      const member = await db.createMember(churchId, {
        auth_user_id: null,
        email,
        full_name: fullName,
        phone: body.phone ?? newcomer.phone ?? null,
        address_line_1: body.address_line_1 ?? null,
        address_line_2: body.address_line_2 ?? null,
        city: body.city ?? newcomer.location ?? null,
        county: body.county ?? null,
        postcode: body.postcode ?? null,
        country: body.country ?? "United Kingdom",
        country_list: false,
        royal_arch: false,
        honorary: false,
        office_title: body.office_title ?? null,
        officer_sort_order: null,
        directory_sort_order: null,
        rank: body.rank ?? null,
        dietary_requirements: body.dietary_requirements ?? null,
        date_of_membership: body.date_of_membership ?? null,
        membership_email_sent: false,
        membership_status: "active",
        stripe_customer_id: null,
        archived_at: null,
        archived_reason: null,
      });

      // Create initial giving record (pro rata when giving year is configured)
      const billFullYear = body.bill_full_year === true;
      const waiveGiving = body.waive_giving === true;
      const annualGivingWaived = body.annual_giving_waived === true;
      const annualGivingWaiverReason =
        typeof body.annual_giving_waiver_reason === "string"
          ? body.annual_giving_waiver_reason.trim().slice(0, 500) || null
          : null;
      if (annualGivingWaived) {
        await db.updateMember(member.id, churchId, {
          annual_giving_waived: true,
          annual_giving_waiver_reason: annualGivingWaiverReason,
        });
      }

      if (!waiveGiving && !annualGivingWaived) {
        const [activeGiving, churchYear] = await Promise.all([
          db.getChurchGiving(churchId),
          db.getCurrentChurchYear(churchId),
        ]);

        const givingTemplate = activeGiving[0] ?? null;
        const fullAmount =
          churchYear?.annual_giving_amount ?? givingTemplate?.amount ?? null;

        if (fullAmount != null && fullAmount > 0) {
          const membershipDate =
            body.date_of_membership ?? new Date().toISOString().split("T")[0];

          let amount = fullAmount;
          let periodStart = membershipDate;
          let periodEnd: string;
          let isProRata = false;

          if (churchYear && !billFullYear) {
            const proRata = calculateProRataGiving({
              fullYearAmount: fullAmount,
              yearStartDate: churchYear.start_date,
              yearEndDate: churchYear.end_date,
              joinDate: membershipDate,
            });
            amount = proRata.amount;
            periodStart = proRata.periodStart;
            periodEnd = proRata.periodEnd;
            isProRata = amount < fullAmount;
          } else if (churchYear) {
            periodStart = churchYear.start_date;
            periodEnd = churchYear.end_date;
          } else {
            periodEnd = new Date(
              new Date(periodStart).getTime() + 365 * 86400000
            )
              .toISOString()
              .split("T")[0];
          }

          await db.createMemberGiving(churchId, {
            member_email: member.email,
            member_name: member.full_name,
            member_id: member.id,
            giving_id: givingTemplate?.id ?? null,
            amount,
            currency: givingTemplate?.currency ?? "gbp",
            period_start: periodStart,
            period_end: periodEnd,
            status: "outstanding",
            payment_id: null,
            stripe_payment_intent_id: null,
            stripe_subscription_id: null,
            paid_at: null,
            is_pro_rata: isProRata,
            full_year_amount: isProRata ? fullAmount : null,
            charitable_amount: 0,
            gift_aid_declaration_id: null,
            gift_aid_status: "unknown" as const,
            gift_aid_eligible_amount: 0,
          });
        }
      }

      const updatedNewcomer = await db.updateNewcomer(id, churchId, {
        converted_member_id: member.id,
        converted_at: new Date().toISOString(),
        stage: body.set_welcomed === false ? newcomer.stage : "welcomed",
      });

      // Carry newcomer notes / interactions over as a member-creation breadcrumb
      await db.addNewcomerActivity(churchId, {
        newcomer_id: id,
        activity_type: "note",
        title: "Converted to member",
        description: `Newcomer converted to member ${member.full_name} (${member.email}).`,
        service_date: null,
        attendees: null,
        due_date: null,
        completed: true,
        created_by: null,
      });

      await writeAuditLog({
        churchId,
        action: "newcomer_converted",
        entityType: "newcomer",
        entityId: id,
        summary: `Newcomer ${newcomer.first_name} ${newcomer.last_name} converted to member ${member.full_name}`,
        metadata: { member_id: member.id, email: member.email },
      });
      await writeAuditLog({
        churchId,
        action: "created",
        entityType: "member",
        entityId: member.id,
        summary: `Member ${member.full_name} created via newcomer conversion`,
        metadata: { newcomer_id: id },
      });

      return NextResponse.json({ member, newcomer: updatedNewcomer }, { status: 201 });
    }

    // Mock-db path
    const newcomer = mockDb.getNewcomerById(id, { church_slug: churchSlug });
    if (!newcomer) {
      return NextResponse.json({ error: "Newcomer not found." }, { status: 404 });
    }
    if (newcomer.converted_member_id) {
      return NextResponse.json(
        { error: "Newcomer already converted to a member.", member_id: newcomer.converted_member_id },
        { status: 409 }
      );
    }
    const email = (body.email ?? newcomer.email).trim().toLowerCase();
    const existing = mockDb.getMemberByEmail(email, { church_slug: churchSlug });
    if (existing) {
      mockDb.updateNewcomer(
        id,
        {
          converted_member_id: existing.id,
          converted_at: new Date().toISOString(),
          stage: "welcomed",
        },
        { church_slug: churchSlug }
      );
      return NextResponse.json(
        { error: "A member with this email already exists.", member: existing },
        { status: 409 }
      );
    }
    const fullName = body.full_name ?? `${newcomer.first_name} ${newcomer.last_name}`.trim();
    const member = mockDb.createMember({
      church_slug: churchSlug,
      auth_user_id: null,
      email,
      full_name: fullName,
      phone: body.phone ?? newcomer.phone ?? null,
      address_line_1: body.address_line_1 ?? null,
      address_line_2: body.address_line_2 ?? null,
      city: body.city ?? newcomer.location ?? null,
      county: body.county ?? null,
      postcode: body.postcode ?? null,
      country: body.country ?? "United Kingdom",
      country_list: false,
      royal_arch: false,
      honorary: false,
      office_title: body.office_title ?? null,
      officer_sort_order: null,
      directory_sort_order: null,
      rank: body.rank ?? null,
      dietary_requirements: body.dietary_requirements ?? null,
      date_of_membership: body.date_of_membership ?? null,
      membership_email_sent: false,
      membership_status: "active",
      stripe_customer_id: null,
    });
    const updatedNewcomer = mockDb.updateNewcomer(
      id,
      {
        converted_member_id: member.id,
        converted_at: new Date().toISOString(),
        stage: body.set_welcomed === false ? newcomer.stage : "welcomed",
      },
      { church_slug: churchSlug }
    );
    mockDb.addNewcomerActivity({
      church_slug: churchSlug,
      newcomer_id: id,
      activity_type: "note",
      title: "Converted to member",
      description: `Newcomer converted to member ${member.full_name} (${member.email}).`,
      service_date: null,
      attendees: null,
      due_date: null,
      completed: true,
      created_by: null,
    });
    return NextResponse.json({ member, newcomer: updatedNewcomer }, { status: 201 });
  } catch (e) {
    console.error("Newcomer convert error:", e);
    return NextResponse.json(
      { error: "Failed to convert newcomer." },
      { status: 500 }
    );
  }
}
