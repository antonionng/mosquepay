import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import type { AdminUser } from "@/lib/db/types";

function profileFromMemberships(email: string, memberships: AdminUser[]) {
  const primary =
    memberships.find((membership) => membership.lodge_id) ?? memberships[0];

  return {
    email,
    full_name: primary?.full_name ?? "",
    role: primary?.role ?? "secretary",
    memberships,
  };
}

export async function GET() {
  const scope = await getCurrentAdminScope();
  if (scope.kind === "none") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      profile: {
        email: scope.email,
        full_name: scope.email,
        role: scope.role,
        memberships: [],
      },
    });
  }

  const memberships = await db.listAdminUsersByEmail(scope.email);
  return NextResponse.json({
    profile: profileFromMemberships(scope.email, memberships),
  });
}

export async function PATCH(request: NextRequest) {
  const scope = await getCurrentAdminScope();
  if (scope.kind === "none") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  if (!fullName) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }

  const memberships = await db.listAdminUsersByEmail(scope.email);
  if (memberships.length === 0) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  await Promise.all(
    memberships.map((membership) =>
      db.updateAdminUser(membership.id, { full_name: fullName })
    )
  );

  const updated = await db.listAdminUsersByEmail(scope.email);
  return NextResponse.json({
    profile: profileFromMemberships(scope.email, updated),
  });
}
