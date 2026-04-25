import { createServiceClient } from "@/lib/supabase/server";

export async function resolveLodgeId(slug: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("lodges")
    .select("id")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function getDefaultLodgeId(): Promise<string | null> {
  return resolveLodgeId("covenant-4344");
}
