// GET /api/donations/gift-aid-status?email=...
//
// Public lookup used by the donate form to detect whether the donor's email
// already has an active Gift Aid declaration on file for this lodge. When it
// does, the donate form can:
//   - automatically apply Gift Aid to the new donation
//   - skip the address fields (we already have a signed declaration on file)
//   - tell the donor that future donations from this email will be
//     Gift Aided automatically
//
// This matches HMRC's enduring-declaration model: once a donor has signed a
// Gift Aid declaration with a charity, it covers all future donations until
// the donor revokes it. We never expose the declaration's PII through this
// endpoint -- only a boolean -- because the donate form is unauthenticated.
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ has_active_declaration: false });
  }

  const email = (request.nextUrl.searchParams.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ has_active_declaration: false });
  }

  try {
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ has_active_declaration: false });
    }
    const declaration = await db.getActiveGiftAidDeclarationByEmail(
      lodgeId,
      email
    );
    return NextResponse.json({
      has_active_declaration: Boolean(declaration),
    });
  } catch (err) {
    console.error("gift-aid-status lookup failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    // Fail open: if the lookup errors we still want the donor to be able to
    // complete a donation. The form will just show the regular Gift Aid form.
    return NextResponse.json({ has_active_declaration: false });
  }
}
