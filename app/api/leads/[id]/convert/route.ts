import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { calculateProRataDues } from "@/lib/dues/pro-rata";
import { isRank, RANK_CODES } from "@/lib/members/rank";

/**
 * Convert an approved/initiated lead into a member record.
 * Carries lead first/last/email/phone/location into the member.
 * Optional fields in body: address_line_1, address_line_2, city, county,
 * postcode, country, dietary_requirements, date_of_initiation, office_title,
 * rank, set_initiated (default true).
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

    const lodgeSlug = getLodgeSlugFromRequest(request);
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
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("members:write", lodgeId);
      if (forbidden) return forbidden;

      const lead = await db.getLeadById(id, lodgeId);
      if (!lead) {
        return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      }
      if (lead.converted_member_id) {
        return NextResponse.json(
          { error: "Lead already converted to a member.", member_id: lead.converted_member_id },
          { status: 409 }
        );
      }

      const email = (body.email ?? lead.email).trim().toLowerCase();
      const existing = await db.getMemberByEmail(email, lodgeId);
      if (existing) {
        await db.updateLead(id, lodgeId, {
          converted_member_id: existing.id,
          converted_at: new Date().toISOString(),
          stage: "initiated",
        });
        return NextResponse.json(
          { error: "A member with this email already exists.", member: existing },
          { status: 409 }
        );
      }

      const fullName = body.full_name ?? `${lead.first_name} ${lead.last_name}`.trim();
      const member = await db.createMember(lodgeId, {
        auth_user_id: null,
        email,
        full_name: fullName,
        phone: body.phone ?? lead.phone ?? null,
        address_line_1: body.address_line_1 ?? null,
        address_line_2: body.address_line_2 ?? null,
        city: body.city ?? lead.location ?? null,
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
        date_of_initiation: body.date_of_initiation ?? null,
        initiation_email_sent: false,
        membership_status: "active",
        stripe_customer_id: null,
        archived_at: null,
        archived_reason: null,
      });

      // Create initial dues record (pro rata when masonic year is configured)
      const billFullYear = body.bill_full_year === true;
      const waiveDues = body.waive_dues === true;
      const annualDuesWaived = body.annual_dues_waived === true;
      const annualDuesWaiverReason =
        typeof body.annual_dues_waiver_reason === "string"
          ? body.annual_dues_waiver_reason.trim().slice(0, 500) || null
          : null;
      if (annualDuesWaived) {
        await db.updateMember(member.id, lodgeId, {
          annual_dues_waived: true,
          annual_dues_waiver_reason: annualDuesWaiverReason,
        });
      }

      if (!waiveDues && !annualDuesWaived) {
        const [activeDues, masonicYear] = await Promise.all([
          db.getLodgeDues(lodgeId),
          db.getCurrentMasonicYear(lodgeId),
        ]);

        const duesTemplate = activeDues[0] ?? null;
        const fullAmount =
          masonicYear?.annual_dues_amount ?? duesTemplate?.amount ?? null;

        if (fullAmount != null && fullAmount > 0) {
          const initiationDate =
            body.date_of_initiation ?? new Date().toISOString().split("T")[0];

          let amount = fullAmount;
          let periodStart = initiationDate;
          let periodEnd: string;
          let isProRata = false;

          if (masonicYear && !billFullYear) {
            const proRata = calculateProRataDues({
              fullYearAmount: fullAmount,
              yearStartDate: masonicYear.start_date,
              yearEndDate: masonicYear.end_date,
              joinDate: initiationDate,
            });
            amount = proRata.amount;
            periodStart = proRata.periodStart;
            periodEnd = proRata.periodEnd;
            isProRata = amount < fullAmount;
          } else if (masonicYear) {
            periodStart = masonicYear.start_date;
            periodEnd = masonicYear.end_date;
          } else {
            periodEnd = new Date(
              new Date(periodStart).getTime() + 365 * 86400000
            )
              .toISOString()
              .split("T")[0];
          }

          await db.createMemberDues(lodgeId, {
            member_email: member.email,
            member_name: member.full_name,
            member_id: member.id,
            dues_id: duesTemplate?.id ?? null,
            amount,
            currency: duesTemplate?.currency ?? "gbp",
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

      const updatedLead = await db.updateLead(id, lodgeId, {
        converted_member_id: member.id,
        converted_at: new Date().toISOString(),
        stage: body.set_initiated === false ? lead.stage : "initiated",
      });

      // Carry lead notes / interactions over as a member-creation breadcrumb
      await db.addLeadActivity(lodgeId, {
        lead_id: id,
        activity_type: "note",
        title: "Converted to member",
        description: `Lead converted to member ${member.full_name} (${member.email}).`,
        meeting_date: null,
        attendees: null,
        due_date: null,
        completed: true,
        created_by: null,
      });

      await writeAuditLog({
        lodgeId,
        action: "lead_converted",
        entityType: "lead",
        entityId: id,
        summary: `Lead ${lead.first_name} ${lead.last_name} converted to member ${member.full_name}`,
        metadata: { member_id: member.id, email: member.email },
      });
      await writeAuditLog({
        lodgeId,
        action: "created",
        entityType: "member",
        entityId: member.id,
        summary: `Member ${member.full_name} created via lead conversion`,
        metadata: { lead_id: id },
      });

      return NextResponse.json({ member, lead: updatedLead }, { status: 201 });
    }

    // Mock-db path
    const lead = mockDb.getLeadById(id, { lodge_slug: lodgeSlug });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }
    if (lead.converted_member_id) {
      return NextResponse.json(
        { error: "Lead already converted to a member.", member_id: lead.converted_member_id },
        { status: 409 }
      );
    }
    const email = (body.email ?? lead.email).trim().toLowerCase();
    const existing = mockDb.getMemberByEmail(email, { lodge_slug: lodgeSlug });
    if (existing) {
      mockDb.updateLead(
        id,
        {
          converted_member_id: existing.id,
          converted_at: new Date().toISOString(),
          stage: "initiated",
        },
        { lodge_slug: lodgeSlug }
      );
      return NextResponse.json(
        { error: "A member with this email already exists.", member: existing },
        { status: 409 }
      );
    }
    const fullName = body.full_name ?? `${lead.first_name} ${lead.last_name}`.trim();
    const member = mockDb.createMember({
      lodge_slug: lodgeSlug,
      auth_user_id: null,
      email,
      full_name: fullName,
      phone: body.phone ?? lead.phone ?? null,
      address_line_1: body.address_line_1 ?? null,
      address_line_2: body.address_line_2 ?? null,
      city: body.city ?? lead.location ?? null,
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
      date_of_initiation: body.date_of_initiation ?? null,
      initiation_email_sent: false,
      membership_status: "active",
      stripe_customer_id: null,
    });
    const updatedLead = mockDb.updateLead(
      id,
      {
        converted_member_id: member.id,
        converted_at: new Date().toISOString(),
        stage: body.set_initiated === false ? lead.stage : "initiated",
      },
      { lodge_slug: lodgeSlug }
    );
    mockDb.addLeadActivity({
      lodge_slug: lodgeSlug,
      lead_id: id,
      activity_type: "note",
      title: "Converted to member",
      description: `Lead converted to member ${member.full_name} (${member.email}).`,
      meeting_date: null,
      attendees: null,
      due_date: null,
      completed: true,
      created_by: null,
    });
    return NextResponse.json({ member, lead: updatedLead }, { status: 201 });
  } catch (e) {
    console.error("Lead convert error:", e);
    return NextResponse.json(
      { error: "Failed to convert lead." },
      { status: 500 }
    );
  }
}
