import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  Calendar,
  HeartHandshake,
  Users,
  Wallet,
} from "lucide-react";
import * as db from "@/lib/db";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { isPlatformOwnerScope, isPlatformScope } from "@/lib/auth/platform";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import * as mockDb from "@/lib/mock-db";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LucideIcon } from "lucide-react";
import { ProvisionMosqueClient } from "./provision-client";
import { FeatureFlagsClient } from "./feature-flags-client";
import { PlatformConsoleManager } from "@/components/admin/platform-console-manager";

export const dynamic = "force-dynamic";

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export default async function PlatformOverviewPage() {
  if (!isSupabaseConfigured() && !shouldUseInMemoryMock()) redirect("/admin");
  const scope = await getCurrentAdminScope();
  if (!isPlatformScope(scope)) {
    redirect("/admin");
  }

  const overview = shouldUseInMemoryMock()
    ? mockDb.getPlatformOverviewData()
    : null;
  const [stats, networks, mosques, platformAdmins, tenantAdmins] = overview
    ? [
        overview.stats,
        overview.networks,
        overview.mosques,
        overview.platformAdmins,
        overview.tenantAdmins,
      ]
    : await Promise.all([
        db.getPlatformMosqueStats(),
        db.listNetworks(),
        db.listMosques(),
        db.listPlatformAdminUsers(),
        db.listTenantAdminUsers(),
      ]);

  const networkById = new Map(networks.map((p) => [p.id, p]));

  const totals = stats.reduce(
    (acc, s) => {
      acc.mosques += 1;
      acc.members += s.members;
      acc.activeMembers += s.active_members;
      acc.upcomingEvents += s.upcoming_events;
      acc.outstandingGiving += s.outstanding_giving;
      acc.paidGivingAmount += s.paid_giving_amount;
      acc.donationsAmount += s.donations_amount;
      return acc;
    },
    {
      mosques: 0,
      members: 0,
      activeMembers: 0,
      upcomingEvents: 0,
      outstandingGiving: 0,
      paidGivingAmount: 0,
      donationsAmount: 0,
    }
  );

  const sorted = [...stats].sort((a, b) => b.active_members - a.active_members);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Platform console
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Cross-mosque overview
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            One dashboard to see the health of every mosque on the platform.
            Operators only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/networks">
            <Button variant="outline">Networks</Button>
          </Link>
          <Link href="/admin/onboarding">
            <Button variant="outline">Onboard a mosque</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProvisionMosqueClient
          networks={networks.map((p) => ({ id: p.id, name: p.name }))}
        />
        <FeatureFlagsClient
          mosques={stats.map((s) => ({ id: s.mosque_id, name: s.mosque_name }))}
        />
      </div>

      <PlatformConsoleManager
        mosques={mosques.map((mosque) => ({
          id: mosque.id,
          name: mosque.name,
          slug: mosque.slug,
          mosque_number: mosque.mosque_number,
          network_id: mosque.network_id,
        }))}
        networks={networks.map((network) => ({
          id: network.id,
          name: network.name,
        }))}
        tenantAdmins={JSON.parse(JSON.stringify(tenantAdmins))}
        platformAdmins={JSON.parse(JSON.stringify(platformAdmins))}
        isOwner={isPlatformOwnerScope(scope)}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Building2} label="Mosques" value={String(totals.mosques)} />
        <Stat
          icon={Users}
          label="Members"
          value={`${totals.activeMembers.toLocaleString("en-GB")} active`}
          hint={`of ${totals.members.toLocaleString("en-GB")} on roll`}
        />
        <Stat
          icon={Calendar}
          label="Upcoming services"
          value={String(totals.upcomingEvents)}
          hint={`${totals.outstandingGiving.toLocaleString("en-GB")} giving outstanding`}
        />
        <Stat
          icon={HeartHandshake}
          label="Donations YTD"
          value={GBP.format(totals.donationsAmount)}
          hint={`${GBP.format(totals.paidGivingAmount)} giving collected`}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Per-mosque breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mosque</TableHead>
                <TableHead>Network</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Upcoming</TableHead>
                <TableHead className="text-right">Outstanding giving</TableHead>
                <TableHead className="text-right">Giving collected</TableHead>
                <TableHead className="text-right">Donations</TableHead>
                <TableHead>Last service</TableHead>
                <TableHead aria-label="Open" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-sm text-slate-500">
                    No mosques yet. Use Networks or Onboarding to add the first one.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((row) => (
                  <TableRow key={row.mosque_id}>
                    <TableCell className="text-sm font-medium text-slate-900">
                      {row.mosque_name}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {row.network_id
                        ? networkById.get(row.network_id)?.name ?? "-"
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.active_members}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.upcoming_events}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.outstanding_giving}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {GBP.format(row.paid_giving_amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {GBP.format(row.donations_amount)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {row.last_service_at
                        ? new Date(row.last_service_at).toLocaleDateString("en-GB")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/api/admin/mosque-context?slug=${row.mosque_slug}`}
                        prefetch={false}
                        className="inline-flex items-center text-xs text-blue-600 hover:underline"
                      >
                        Switch <ArrowUpRight className="ml-1 h-3 w-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-slate-400" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <Wallet className="hidden" aria-hidden />
    </div>
  );
}
