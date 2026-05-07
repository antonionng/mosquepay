import { NextResponse } from "next/server";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";

const MESSAGE =
  "Supabase is not configured and in-memory mock is disabled (ALLOW_IN_MEMORY_MOCK=false). " +
  "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.";

/**
 * After a branch that handles `isSupabaseConfigured()`, call this before any `mockDb` usage.
 * Returns a 503 when neither Postgres nor mock demo mode is available.
 */
export function rejectIfMockDisabled(): NextResponse | null {
  if (isSupabaseConfigured()) return null;
  if (shouldUseInMemoryMock()) return null;
  return NextResponse.json({ error: MESSAGE }, { status: 503 });
}
