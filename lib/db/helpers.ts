import { createServiceClient } from "@/lib/supabase/server";

export async function resolveMosqueId(slug: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("mosques")
    .select("id")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function getDefaultMosqueId(): Promise<string | null> {
  return resolveMosqueId("central-jamia-demo");
}
