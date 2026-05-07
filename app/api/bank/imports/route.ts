import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { parseBankCsv } from "@/lib/bank/csv-parser";
import { proposeMatch } from "@/lib/bank/matcher";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ imports: [] });
  }
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;
  const imports = await db.listBankImports(lodgeId);
  return NextResponse.json({ imports });
}

export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Database not configured." },
        { status: 503 }
      );
    }

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission(
      "payments:write",
      lodgeId
    );
    if (forbidden) return forbidden;

    const body = await request.json();
    const csvText: string = body.csv ?? "";
    const filename: string = body.filename ?? "statement.csv";
    const accountLabel: string | null = body.account_label ?? null;

    if (!csvText || csvText.length < 10) {
      return NextResponse.json(
        { error: "CSV content is required." },
        { status: 400 }
      );
    }

    const parsed = parseBankCsv(csvText);
    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "No usable rows in CSV.", parse_errors: parsed.errors },
        { status: 400 }
      );
    }

    const earliest = parsed.rows.reduce(
      (min, row) => (row.posted_date < min ? row.posted_date : min),
      parsed.rows[0].posted_date
    );
    const since = new Date(earliest);
    since.setDate(since.getDate() - 30);
    const ledger = await db.getTreasurerLedger(lodgeId, {
      from: since.toISOString(),
    });

    const importRecord = await db.createBankImport(lodgeId, {
      filename,
      account_label: accountLabel,
      imported_by_admin_user_id: null,
      notes: null,
      total_rows: parsed.rows.length,
      matched_rows: 0,
    });

    const txRows = parsed.rows.map((row) => {
      const proposal = proposeMatch(row, ledger);
      return {
        import_id: importRecord.id,
        posted_date: row.posted_date,
        description: row.description,
        amount: row.amount,
        direction: row.direction,
        balance: row.balance,
        reference: row.reference,
        status: proposal ? ("matched" as const) : ("unmatched" as const),
        matched_source_type: proposal?.source_type ?? null,
        matched_source_id: proposal?.source_id ?? null,
        matched_confidence: proposal?.confidence ?? null,
        matched_at: proposal ? new Date().toISOString() : null,
      };
    });

    await db.insertBankTransactions(lodgeId, txRows);

    const matchedCount = txRows.filter((r) => r.status === "matched").length;
    await db.updateBankImport(importRecord.id, lodgeId, {
      matched_rows: matchedCount,
    });

    await writeAuditLog({
      lodgeId,
      action: "bank_statement_imported",
      entityType: "bank_import",
      entityId: importRecord.id,
      summary: `Imported ${parsed.rows.length} transactions, matched ${matchedCount}`,
      metadata: {
        filename,
        total_rows: parsed.rows.length,
        matched_rows: matchedCount,
        parse_errors: parsed.errors.length,
      },
    });

    return NextResponse.json({
      import_id: importRecord.id,
      total_rows: parsed.rows.length,
      matched_rows: matchedCount,
      parse_errors: parsed.errors,
    });
  } catch (error) {
    console.error("Bank import error:", error);
    return NextResponse.json(
      { error: "Failed to import statement." },
      { status: 500 }
    );
  }
}
