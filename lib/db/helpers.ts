import { createServiceClient } from "@/lib/supabase/server";

export async function resolveChurchId(slug: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("churches")
    .select("id")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function getDefaultChurchId(): Promise<string | null> {
  return resolveChurchId("st-marys-demo");
}
