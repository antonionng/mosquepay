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
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
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
import { ProvisionLodgeClient } from "./provision-client";
import { FeatureFlagsClient } from "./feature-flags-client";
import { PlatformConsoleManager } from "@/components/admin/platform-console-manager";

export const dynamic = "force-dynamic";

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export default async function PlatformOverviewPage() {
  if (!isSupabaseConfigured()) redirect("/admin");
  const scope = await getCurrentAdminScope();
  if (!isPlatformScope(scope)) {
    redirect("/admin");
  }

  const [stats, provinces, lodges, platformAdmins, tenantAdmins] = await Promise.all([
    db.getPlatformLodgeStats(),
    db.listProvinces(),
    db.listLodges(),
    db.listPlatformAdminUsers(),
    db.listTenantAdminUsers(),
  ]);

  const provinceById = new Map(provinces.map((p) => [p.id, p]));

  const totals = stats.reduce(
    (acc, s) => {
      acc.lodges += 1;
      acc.members += s.members;
      acc.activeMembers += s.active_members;
      acc.upcomingEvents += s.upcoming_events;
      acc.outstandingDues += s.outstanding_dues;
      acc.paidDuesAmount += s.paid_dues_amount;
      acc.donationsAmount += s.donations_amount;
      return acc;
    },
    {
      lodges: 0,
      members: 0,
      activeMembers: 0,
      upcomingEvents: 0,
      outstandingDues: 0,
      paidDuesAmount: 0,
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
            Cross-lodge overview
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            One dashboard to see the health of every lodge on the platform.
            Operators only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/provinces">
            <Button variant="outline">Provinces</Button>
          </Link>
          <Link href="/admin/onboarding">
            <Button variant="outline">Onboard a lodge</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProvisionLodgeClient
          provinces={provinces.map((p) => ({ id: p.id, name: p.name }))}
        />
        <FeatureFlagsClient
          lodges={stats.map((s) => ({ id: s.lodge_id, name: s.lodge_name }))}
        />
      </div>

      <PlatformConsoleManager
        lodges={lodges.map((lodge) => ({
          id: lodge.id,
          name: lodge.name,
          slug: lodge.slug,
          lodge_number: lodge.lodge_number,
          province_id: lodge.province_id,
        }))}
        provinces={provinces.map((province) => ({
          id: province.id,
          name: province.name,
        }))}
        tenantAdmins={JSON.parse(JSON.stringify(tenantAdmins))}
        platformAdmins={JSON.parse(JSON.stringify(platformAdmins))}
        isOwner={isPlatformOwnerScope(scope)}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Building2} label="Lodges" value={String(totals.lodges)} />
        <Stat
          icon={Users}
          label="Members"
          value={`${totals.activeMembers.toLocaleString("en-GB")} active`}
          hint={`of ${totals.members.toLocaleString("en-GB")} on roll`}
        />
        <Stat
          icon={Calendar}
          label="Upcoming meetings"
          value={String(totals.upcomingEvents)}
          hint={`${totals.outstandingDues.toLocaleString("en-GB")} dues outstanding`}
        />
        <Stat
          icon={HeartHandshake}
          label="Donations YTD"
          value={GBP.format(totals.donationsAmount)}
          hint={`${GBP.format(totals.paidDuesAmount)} dues collected`}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Per-lodge breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lodge</TableHead>
                <TableHead>Province</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Upcoming</TableHead>
                <TableHead className="text-right">Outstanding dues</TableHead>
                <TableHead className="text-right">Dues collected</TableHead>
                <TableHead className="text-right">Donations</TableHead>
                <TableHead>Last meeting</TableHead>
                <TableHead aria-label="Open" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-sm text-slate-500">
                    No lodges yet. Use Provinces or Onboarding to add the first one.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((row) => (
                  <TableRow key={row.lodge_id}>
                    <TableCell className="text-sm font-medium text-slate-900">
                      {row.lodge_name}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {row.province_id
                        ? provinceById.get(row.province_id)?.name ?? "-"
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.active_members}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.upcoming_events}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.outstanding_dues}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {GBP.format(row.paid_dues_amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {GBP.format(row.donations_amount)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {row.last_meeting_at
                        ? new Date(row.last_meeting_at).toLocaleDateString("en-GB")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/api/admin/lodge-context?slug=${row.lodge_slug}`}
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
