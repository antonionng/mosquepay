import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { resolveLodgeSlug } from "@/lib/tenant";

export async function GET() {
  if (isSupabaseConfigured()) {
    const lodges = await db.listLodges();
    return NextResponse.json(lodges);
  }
  return NextResponse.json(mockDb.listLodges());
}

export async function POST(request: NextRequest) {
  try {
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
