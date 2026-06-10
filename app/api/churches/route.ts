import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { resolveChurchSlug } from "@/lib/tenant";
import { requireOperatorApiAuth } from "@/lib/auth/api";

export async function GET() {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireOperatorApiAuth();
  if (unauthorized) return unauthorized;

  if (isSupabaseConfigured()) {
    const churches = await db.listChurches();
    return NextResponse.json(churches);
  }
  return NextResponse.json(mockDb.listChurches());
}

export async function POST(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireOperatorApiAuth();
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const slug = resolveChurchSlug(body.slug);
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Church name is required." }, { status: 400 });
    }

    const input = {
      slug,
      name,
      city: body.city?.trim() ?? null,
      country: body.country?.trim() ?? null,
      tagline: body.tagline?.trim() ?? null,
      logo_url: body.logo_url?.trim() ?? null,
      church_number: body.church_number?.trim() ?? null,
      consecrated_at: body.consecrated_at?.trim() ?? null,
      governing_body: body.governing_body?.trim() ?? null,
      service_schedule: body.service_schedule?.trim() ?? null,
      secretary_name: body.secretary_name?.trim() ?? null,
      secretary_address: body.secretary_address?.trim() ?? null,
      secretary_phone: body.secretary_phone?.trim() ?? null,
      data_protection_notice: body.data_protection_notice?.trim() ?? null,
      newcomer_notice: body.newcomer_notice?.trim() ?? null,
      loi_contact: body.loi_contact?.trim() ?? null,
      service_location: body.service_location?.trim() ?? null,
      service_location_url: body.service_location_url?.trim() ?? null,
      accessibility_notes: body.accessibility_notes?.trim() ?? null,
      default_dress_code: body.default_dress_code?.trim() ?? null,
      primary_color: body.primary_color?.trim() ?? null,
      secondary_color: body.secondary_color?.trim() ?? null,
      support_email: body.support_email?.trim() ?? null,
      support_phone: body.support_phone?.trim() ?? null,
      is_active: body.is_active !== false,
      // Gift Aid / Gift Aid pack (migration 059). All optional on the
      // wire so older API clients keep working; defaults match the DB.
      gift_aid_default_mode:
        body.gift_aid_default_mode === "digital" ||
        body.gift_aid_default_mode === "paper" ||
        body.gift_aid_default_mode === "both"
          ? body.gift_aid_default_mode
          : "both",
      gift_aid_pack_name: body.gift_aid_pack_name?.trim() ?? null,
      gift_aid_pack_email: body.gift_aid_pack_email?.trim() ?? null,
      gift_aid_pack_charity_number:
        body.gift_aid_pack_charity_number?.trim() ?? null,
      hmrc_charity_reference: body.hmrc_charity_reference?.trim() ?? null,
    };

    if (isSupabaseConfigured()) {
      const church = await db.upsertChurch(input);
      return NextResponse.json({ success: true, church });
    }

    const church = mockDb.upsertChurch(input);
    return NextResponse.json({ success: true, church });
  } catch (error) {
    console.error("Churches API error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
