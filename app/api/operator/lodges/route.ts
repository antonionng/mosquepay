import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import { listLodges, getLodgeSubscription } from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import type { Lodge, LodgeSubscription } from "@/lib/db/types";
import { requireOperatorApiAuth } from "@/lib/auth/api";

export async function GET() {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireOperatorApiAuth();
    if (unauthorized) return unauthorized;

    let lodges: Lodge[] = [];

    if (isSupabaseConfigured()) {
      lodges = await listLodges();
    } else {
      lodges = mockDb.listLodges();
    }

    const result = await Promise.all(
      lodges.map(async (lodge) => {
        let subscription: LodgeSubscription | null = null;
        if (isSupabaseConfigured()) {
          subscription = await getLodgeSubscription(lodge.id).catch(() => null);
        }
        return { ...lodge, subscription };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Operator lodges error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lodges" },
      { status: 500 }
    );
  }
}
