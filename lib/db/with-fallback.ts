export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * When false (set in .env.local), the in-memory store in lib/mock-db.ts is never used.
 * Use with a full Supabase triple so all reads/writes go through lib/db.
 */
export function isInMemoryMockAllowed(): boolean {
  const v = process.env.ALLOW_IN_MEMORY_MOCK?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}

/** True only for the offline demo path: no Supabase keys and mock not explicitly disabled. */
export function shouldUseInMemoryMock(): boolean {
  if (isSupabaseConfigured()) return false;
  return isInMemoryMockAllowed();
}
