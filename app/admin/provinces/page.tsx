import Link from "next/link";
import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { ProvincesClient } from "./provinces-client";

export const dynamic = "force-dynamic";

export default async function ProvincesPage() {
  if (!isSupabaseConfigured()) redirect("/admin");
  const scope = await getCurrentAdminScope();
  if (scope.kind !== "platform" && scope.kind !== "dummy") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold">Platform-level access only.</p>
        <p className="mt-1">
          The provincial layer manages tenants across lodges and is restricted to
          platform owners. Ask the platform owner to grant you super_admin or
          operator access.
        </p>
        <Link
          href="/admin"
          className="mt-3 inline-block text-sm font-medium underline"
        >
          Back to admin
        </Link>
      </div>
    );
  }
  const [provinces, allLodges] = await Promise.all([
    db.listProvinces(),
    db.listLodges(),
  ]);
  return (
    <ProvincesClient
      provinces={JSON.parse(JSON.stringify(provinces))}
      lodges={allLodges.map((l) => ({
        id: l.id,
        name: l.name,
        slug: l.slug,
        lodge_number: l.lodge_number,
        province_id: l.province_id ?? null,
      }))}
    />
  );
}
