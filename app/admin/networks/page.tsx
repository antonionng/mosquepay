import Link from "next/link";
import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import * as mockDb from "@/lib/mock-db";
import { NetworksClient } from "./networks-client";

export const dynamic = "force-dynamic";

export default async function NetworksPage() {
  if (!isSupabaseConfigured() && !shouldUseInMemoryMock()) redirect("/admin");
  const scope = await getCurrentAdminScope();
  if (scope.kind !== "platform" && scope.kind !== "dummy") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold">Platform-level access only.</p>
        <p className="mt-1">
          The network layer manages tenants across mosques and is restricted to
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
  const [networks, allMosques] = shouldUseInMemoryMock()
    ? [mockDb.listNetworks(), mockDb.listMosques()]
    : await Promise.all([db.listNetworks(), db.listMosques()]);
  return (
    <NetworksClient
      networks={JSON.parse(JSON.stringify(networks))}
      mosques={allMosques.map((l) => ({
        id: l.id,
        name: l.name,
        slug: l.slug,
        mosque_number: l.mosque_number,
        network_id: l.network_id ?? null,
      }))}
    />
  );
}
