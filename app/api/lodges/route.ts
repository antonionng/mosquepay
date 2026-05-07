import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { resolveLodgeSlug } from "@/lib/tenant";
import { requireOperatorApiAuth } from "@/lib/auth/api";

export async function GET() {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireOperatorApiAuth();
  if (unauthorized) return unauthorized;

  if (isSupabaseConfigured()) {
    const lodges = await db.listLodges();
    return NextResponse.json(lodges);
  }
  return NextResponse.json(mockDb.listLodges());
}

export async function POST(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireOperatorApiAuth();
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const slug = resolveLodgeSlug(body.slug);
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Lodge name is required." }, { status: 400 });
    }

    const input = {
      slug,
      name,
      city: body.city?.trim() ?? null,
      country: body.country?.trim() ?? null,
      tagline: body.tagline?.trim() ?? null,
      logo_url: body.logo_url?.trim() ?? null,
      lodge_number: body.lodge_number?.trim() ?? null,
      consecrated_at: body.consecrated_at?.trim() ?? null,
      governing_body: body.governing_body?.trim() ?? null,
      meeting_schedule: body.meeting_schedule?.trim() ?? null,
      secretary_name: body.secretary_name?.trim() ?? null,
      secretary_address: body.secretary_address?.trim() ?? null,
      secretary_phone: body.secretary_phone?.trim() ?? null,
      data_protection_notice: body.data_protection_notice?.trim() ?? null,
      visiting_notice: body.visiting_notice?.trim() ?? null,
      loi_contact: body.loi_contact?.trim() ?? null,
      primary_color: body.primary_color?.trim() ?? null,
      secondary_color: body.secondary_color?.trim() ?? null,
      support_email: body.support_email?.trim() ?? null,
      support_phone: body.support_phone?.trim() ?? null,
      is_active: body.is_active !== false,
    };

    if (isSupabaseConfigured()) {
      const lodge = await db.upsertLodge(input);
      return NextResponse.json({ success: true, lodge });
    }

    const lodge = mockDb.upsertLodge(input);
    return NextResponse.json({ success: true, lodge });
  } catch (error) {
    console.error("Lodges API error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
