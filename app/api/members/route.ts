import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const search = request.nextUrl.searchParams.get("search") ?? undefined;
    const status = request.nextUrl.searchParams.get("status") ?? undefined;

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("members:read", lodgeId);
      if (forbidden) return forbidden;
      const members = await db.getMembers(lodgeId, { search, status });
      return NextResponse.json({ members });
    }

    const members = mockDb.getMembers({ lodge_slug: lodgeSlug, search, status });
    return NextResponse.json({ members });
  } catch (e) {
    console.error("Members GET error:", e);
    return NextResponse.json({ error: "Failed to fetch members." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const body = await request.json();
    const {
      email,
      full_name,
      phone,
      address_line_1,
      address_line_2,
      city,
      county,
      postcode,
      country,
      country_list,
      royal_arch,
      honorary,
      office_title,
      officer_sort_order,
      directory_sort_order,
      rank,
      dietary_requirements,
      date_of_initiation,
      membership_status,
    } = body;

    if (!email || !full_name) {
      return NextResponse.json(
        { error: "email and full_name are required." },
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

      const existing = await db.getMemberByEmail(email, lodgeId);
      if (existing) {
        return NextResponse.json({ error: "A member with this email already exists." }, { status: 409 });
      }

      const member = await db.createMember(lodgeId, {
        auth_user_id: null,
        email: email.trim().toLowerCase(),
        full_name,
        phone: phone ?? null,
        address_line_1: address_line_1 ?? null,
        address_line_2: address_line_2 ?? null,
        city: city ?? null,
        county: county ?? null,
        postcode: postcode ?? null,
        country: country ?? "United Kingdom",
        country_list: country_list === true,
        royal_arch: royal_arch === true,
        honorary: honorary === true,
        office_title: office_title ?? null,
        officer_sort_order: officer_sort_order ?? null,
        directory_sort_order: directory_sort_order ?? null,
        rank: rank ?? null,
        dietary_requirements: dietary_requirements ?? null,
        date_of_initiation: date_of_initiation ?? null,
        initiation_email_sent: false,
        membership_status: membership_status ?? "active",
        stripe_customer_id: null,
      });

      const activeDues = await db.getLodgeDues(lodgeId);
      if (activeDues.length > 0) {
        const dues = activeDues[0];
        const now = new Date();
        const periodStart = date_of_initiation ?? now.toISOString().split("T")[0];
        const periodEnd = new Date(new Date(periodStart).getTime() + 365 * 86400000)
          .toISOString()
          .split("T")[0];

        await db.createMemberDues(lodgeId, {
          member_email: member.email,
          member_name: member.full_name,
          member_id: member.id,
          dues_id: dues.id,
          amount: dues.amount,
          currency: dues.currency,
          period_start: periodStart,
          period_end: periodEnd,
          status: "outstanding",
          payment_id: null,
          stripe_payment_intent_id: null,
          stripe_subscription_id: null,
          paid_at: null,
        });
      }

      await writeAuditLog({
        lodgeId,
        action: "created",
        entityType: "member",
        entityId: member.id,
        summary: `Created member ${member.full_name}`,
      });
      return NextResponse.json({ member }, { status: 201 });
    }

    const existing = mockDb.getMemberByEmail(email, { lodge_slug: lodgeSlug });
    if (existing) {
      return NextResponse.json({ error: "A member with this email already exists." }, { status: 409 });
    }

    const member = mockDb.createMember({
      auth_user_id: null,
      email: email.trim().toLowerCase(),
      full_name,
      phone: phone ?? null,
      address_line_1: address_line_1 ?? null,
      address_line_2: address_line_2 ?? null,
      city: city ?? null,
      county: county ?? null,
      postcode: postcode ?? null,
      country: country ?? "United Kingdom",
      country_list: country_list === true,
      royal_arch: royal_arch === true,
      honorary: honorary === true,
      office_title: office_title ?? null,
      officer_sort_order: officer_sort_order ?? null,
      directory_sort_order: directory_sort_order ?? null,
      rank: rank ?? null,
      dietary_requirements: dietary_requirements ?? null,
      date_of_initiation: date_of_initiation ?? null,
      initiation_email_sent: false,
      membership_status: membership_status ?? "active",
      stripe_customer_id: null,
      lodge_slug: lodgeSlug,
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (e) {
    console.error("Members POST error:", e);
    return NextResponse.json({ error: "Failed to create member." }, { status: 500 });
  }
}
