import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { requireAdminApiAuth } from "@/lib/auth/api";
import { getCurrentAdminScope } from "@/lib/auth/permissions";

function escapeCsv(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const scope = await getCurrentAdminScope();
  if (scope.kind !== "platform" && scope.kind !== "dummy") {
    return NextResponse.json(
      { error: "Platform-level access required." },
      { status: 403 }
    );
  }
  const { id } = await params;
  const network = await db.getNetworkById(id);
  if (!network) {
    return NextResponse.json({ error: "Network not found." }, { status: 404 });
  }
  const rows = await db.listMosqueAnnualReturns(id);
  const headers = [
    "mosque_name",
    "mosque_number",
    "active_members",
    "resigned_members",
    "excluded_members",
    "memberships_ytd",
    "passings_ytd",
    "raisings_ytd",
  ];
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.mosque_name,
        r.mosque_number,
        r.active_members,
        r.resigned_members,
        r.excluded_members,
        r.memberships_ytd,
        r.passings_ytd,
        r.raisings_ytd,
      ]
        .map(escapeCsv)
        .join(",")
    ),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="annual-returns-${network.slug}.csv"`,
    },
  });
}
