import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth } from "@/lib/auth/api";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.completed === "boolean") updates.completed = body.completed;
    if (typeof body.title === "string") updates.title = body.title;
    if (typeof body.description === "string")
      updates.description = body.description;
    if (typeof body.due_date === "string" || body.due_date === null)
      updates.due_date = body.due_date;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update." },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const activity = await db.updateLeadActivity(id, lodgeId, updates);
      if (!activity) {
        return NextResponse.json({ error: "Activity not found." }, { status: 404 });
      }
      return NextResponse.json({ activity });
    }

    const activity = mockDb.updateLeadActivity(id, updates, {
      lodge_slug: lodgeSlug,
    });
    if (!activity) {
      return NextResponse.json({ error: "Activity not found." }, { status: 404 });
    }
    return NextResponse.json({ activity });
  } catch (e) {
    console.error("Lead activities PATCH error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
