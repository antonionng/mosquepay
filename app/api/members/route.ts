import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { isRank, RANK_CODES } from "@/lib/members/rank";

export async function GET(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const mosqueSlug = getMosqueSlugFromRequest(request);
    const search = request.nextUrl.searchParams.get("search") ?? undefined;
    const status = request.nextUrl.searchParams.get("status") ?? undefined;

    if (isSupabaseConfigured()) {
      const mosqueId = await db.resolveMosqueId(mosqueSlug);
      if (!mosqueId) {
        return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("members:read", mosqueId);
      if (forbidden) return forbidden;
      const members = await db.getMembers(mosqueId, { search, status });
      return NextResponse.json({ members });
    }

    const members = mockDb.getMembers({ mosque_slug: mosqueSlug, search, status });
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

    const mosqueSlug = getMosqueSlugFromRequest(request);
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
      date_of_membership,
      membership_status,
    } = body;

    if (!email || !full_name) {
      return NextResponse.json(
        { error: "email and full_name are required." },
        { status: 400 }
      );
    }

    if (rank != null && rank !== "" && !isRank(rank)) {
      return NextResponse.json(
        {
          error: `Invalid rank "${rank}". Must be one of: ${RANK_CODES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const mosqueId = await db.resolveMosqueId(mosqueSlug);
      if (!mosqueId) {
        return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("members:write", mosqueId);
      if (forbidden) return forbidden;

      const existing = await db.getMemberByEmail(email, mosqueId);
      if (existing) {
        return NextResponse.json({ error: "A member with this email already exists." }, { status: 409 });
      }

      const member = await db.createMember(mosqueId, {
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
        date_of_membership: date_of_membership ?? null,
        membership_email_sent: false,
        membership_status: membership_status ?? "active",
        stripe_customer_id: null,
      });

      const activeGiving = await db.getMosqueGiving(mosqueId);
      if (activeGiving.length > 0) {
        const giving = activeGiving[0];
        const now = new Date();
        const periodStart = date_of_membership ?? now.toISOString().split("T")[0];
        const periodEnd = new Date(new Date(periodStart).getTime() + 365 * 86400000)
          .toISOString()
          .split("T")[0];

        await db.createMemberGiving(mosqueId, {
          member_email: member.email,
          member_name: member.full_name,
          member_id: member.id,
          giving_id: giving.id,
          amount: giving.amount,
          currency: giving.currency,
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
        mosqueId,
        action: "created",
        entityType: "member",
        entityId: member.id,
        summary: `Created member ${member.full_name}`,
      });
      return NextResponse.json({ member }, { status: 201 });
    }

    const existing = mockDb.getMemberByEmail(email, { mosque_slug: mosqueSlug });
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
      date_of_membership: date_of_membership ?? null,
      membership_email_sent: false,
      membership_status: membership_status ?? "active",
      stripe_customer_id: null,
      mosque_slug: mosqueSlug,
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (e) {
    console.error("Members POST error:", e);
    return NextResponse.json({ error: "Failed to create member." }, { status: 500 });
  }
}
