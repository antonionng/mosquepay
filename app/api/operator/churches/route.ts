import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import { listChurches, getChurchSubscription } from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import type { Church, ChurchSubscription } from "@/lib/db/types";
import { requireOperatorApiAuth } from "@/lib/auth/api";

export async function GET() {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireOperatorApiAuth();
    if (unauthorized) return unauthorized;

    let churches: Church[] = [];

    if (isSupabaseConfigured()) {
      churches = await listChurches();
    } else {
      churches = mockDb.listChurches();
    }

    const result = await Promise.all(
      churches.map(async (church) => {
        let subscription: ChurchSubscription | null = null;
        if (isSupabaseConfigured()) {
          subscription = await getChurchSubscription(church.id).catch(() => null);
        }
        return { ...church, subscription };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Operator churches error:", error);
    return NextResponse.json(
      { error: "Failed to fetch churches" },
      { status: 500 }
    );
  }
}
