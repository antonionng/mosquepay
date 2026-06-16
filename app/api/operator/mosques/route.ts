import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import { listMosques, getMosqueSubscription } from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import type { Mosque, MosqueSubscription } from "@/lib/db/types";
import { requireOperatorApiAuth } from "@/lib/auth/api";

export async function GET() {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireOperatorApiAuth();
    if (unauthorized) return unauthorized;

    let mosques: Mosque[] = [];

    if (isSupabaseConfigured()) {
      mosques = await listMosques();
    } else {
      mosques = mockDb.listMosques();
    }

    const result = await Promise.all(
      mosques.map(async (mosque) => {
        let subscription: MosqueSubscription | null = null;
        if (isSupabaseConfigured()) {
          subscription = await getMosqueSubscription(mosque.id).catch(() => null);
        }
        return { ...mosque, subscription };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Operator mosques error:", error);
    return NextResponse.json(
      { error: "Failed to fetch mosques" },
      { status: 500 }
    );
  }
}
