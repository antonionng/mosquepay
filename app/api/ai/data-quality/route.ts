import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

type Issue = {
  member_id: string;
  full_name: string;
  fields: string[];
};

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) return NextResponse.json({ issues: [] });
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:read", mosqueId);
  if (forbidden) return forbidden;

  const members = await db.getMembers(mosqueId, { status: "active" });
  const issues: Issue[] = [];
  for (const m of members) {
    const fields: string[] = [];
    if (!m.email) fields.push("email");
    if (!m.phone) fields.push("phone");
    if (!m.address_line_1 && !m.postcode) fields.push("address");
    if (!m.date_of_birth) fields.push("date of birth");
    if (!m.date_of_membership) fields.push("date of membership");
    if (m.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email)) {
      fields.push("invalid email format");
    }
    if (m.phone && m.phone.replace(/\D/g, "").length < 7) {
      fields.push("invalid phone format");
    }
    if (fields.length > 0) {
      issues.push({ member_id: m.id, full_name: m.full_name, fields });
    }
  }

  return NextResponse.json({
    issues: issues.sort((a, b) => b.fields.length - a.fields.length),
    counts: {
      total_members: members.length,
      members_with_issues: issues.length,
    },
  });
}
