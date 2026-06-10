import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import * as db from "@/lib/db";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
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
import { BulkChurchesClient } from "./bulk-churches-client";

export const dynamic = "force-dynamic";

export default async function NetworkDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isSupabaseConfigured()) redirect("/admin");
  const scope = await getCurrentAdminScope();
  if (scope.kind !== "platform" && scope.kind !== "dummy") {
    redirect("/admin");
  }
  const { slug } = await params;
  const network = await db.getNetworkBySlug(slug);
  if (!network) notFound();

  const [churches, officers, returns] = await Promise.all([
    db.listChurchesByNetwork(network.id),
    db.listNetworkOfficers(network.id),
    db.listChurchAnnualReturns(network.id),
  ]);

  const totals = returns.reduce(
    (acc, row) => {
      acc.active += row.active_members;
      acc.memberships += row.memberships_ytd;
      acc.passings += row.passings_ytd;
      acc.raisings += row.raisings_ytd;
      return acc;
    },
    { active: 0, memberships: 0, passings: 0, raisings: 0 }
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Link
          href="/admin/networks"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="mr-1 h-3 w-3" /> Networks
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{network.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {network.jurisdiction ?? "Network tenant"}
            </p>
          </div>
          <Link href={`/api/networks/${network.id}/annual-returns.csv`}>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" /> Annual returns CSV
            </Button>
          </Link>
        </div>
      </div>

      <BulkChurchesClient networkId={network.id} networkName={network.name} />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Churches" value={churches.length} />
        <Stat label="Active members" value={totals.active} />
        <Stat label="Initiations YTD" value={totals.memberships} />
        <Stat
          label="Passings / Raisings YTD"
          value={`${totals.passings} / ${totals.raisings}`}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Annual returns ({new Date().getFullYear()})
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Church</TableHead>
              <TableHead>No.</TableHead>
              <TableHead className="text-right">Active</TableHead>
              <TableHead className="text-right">Resigned</TableHead>
              <TableHead className="text-right">Init.</TableHead>
              <TableHead className="text-right">Pass.</TableHead>
              <TableHead className="text-right">Rais.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-slate-500">
                  No churches in this network yet.
                </TableCell>
              </TableRow>
            ) : (
              returns.map((row) => (
                <TableRow key={row.church_id}>
                  <TableCell className="text-sm font-medium text-slate-900">
                    {row.church_name}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {row.church_number ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">{row.active_members}</TableCell>
                  <TableCell className="text-right">{row.resigned_members}</TableCell>
                  <TableCell className="text-right">{row.memberships_ytd}</TableCell>
                  <TableCell className="text-right">{row.passings_ytd}</TableCell>
                  <TableCell className="text-right">{row.raisings_ytd}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Cross-church officer directory
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Office</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Church</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {officers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-slate-500">
                  No officers recorded across these churches yet.
                </TableCell>
              </TableRow>
            ) : (
              officers.map((officer) => (
                <TableRow key={officer.member_id}>
                  <TableCell className="text-sm font-medium text-slate-900">
                    {officer.office_title}
                  </TableCell>
                  <TableCell className="text-sm">{officer.full_name}</TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {officer.church_name}
                    {officer.church_number && (
                      <span className="ml-1">#{officer.church_number}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-blue-600">
                    <a href={`mailto:${officer.email}`} className="hover:underline">
                      {officer.email}
                    </a>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
