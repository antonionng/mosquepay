import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

function escape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Accounting export. Supports two formats friendly to common tools:
 *   ?format=xero       - Xero bank import format
 *   ?format=quickbooks - QuickBooks 3-column CSV
 *   default             - generic ledger CSV
 */
export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
  if (forbidden) return forbidden;

  const format = request.nextUrl.searchParams.get("format") ?? "generic";
  const ledger = await db.getTreasurerLedger(mosqueId);

  let csv = "";
  if (format === "xero") {
    csv = ["Date,Amount,Payee,Description,Reference"]
      .concat(
        ledger.map((row) =>
          [
            new Date(row.occurred_at).toISOString().slice(0, 10),
            row.amount,
            row.contact_name ?? "",
            `${row.source_type}: ${row.category}`,
            row.source_id,
          ]
            .map(escape)
            .join(",")
        )
      )
      .join("\n");
  } else if (format === "quickbooks") {
    csv = ["Date,Description,Amount"]
      .concat(
        ledger.map((row) =>
          [
            new Date(row.occurred_at).toISOString().slice(0, 10),
            `${row.contact_name ?? ""} - ${row.source_type}`,
            row.amount,
          ]
            .map(escape)
            .join(",")
        )
      )
      .join("\n");
  } else {
    csv = [
      "occurred_at,source_type,category,contact,amount,refund,currency,status,reference",
    ]
      .concat(
        ledger.map((row) =>
          [
            row.occurred_at,
            row.source_type,
            row.category,
            row.contact_name ?? row.contact_email ?? "",
            row.amount,
            row.refund_amount,
            row.currency,
            row.status,
            row.source_id,
          ]
            .map(escape)
            .join(",")
        )
      )
      .join("\n");
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="accounting-${format}.csv"`,
    },
  });
}
