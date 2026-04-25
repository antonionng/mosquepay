import {
  HeadphonesIcon,
  Building2,
  CreditCard,
  Users,
  Clock,
  FileText,
  Shield,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { listLodges, getPayments, getLeads } from "@/lib/db";
import type { Lodge, Payment, Lead } from "@/lib/db/types";
import { formatDateTime } from "@/lib/utils";

type AuditEntry = {
  id: string;
  type: "payment" | "lead" | "lodge";
  lodge_name: string;
  lodge_slug: string;
  description: string;
  timestamp: string;
};

async function getSupportData() {
  if (!isSupabaseConfigured()) {
    return { lodges: [] as Lodge[], recentPayments: [] as Payment[], recentLeads: [] as Lead[], audit: [] as AuditEntry[] };
  }

  try {
    const lodges = await listLodges();
    const paymentsByLodge = await Promise.all(
      lodges.map(async (l) => {
        const payments = await getPayments(l.id).catch(() => []);
        return payments.map((p) => ({ ...p, lodge_name: l.name, lodge_slug: l.slug }));
      })
    );
    const allPayments = paymentsByLodge
      .flat()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    const leadsByLodge = await Promise.all(
      lodges.map(async (l) => {
        const leads = await getLeads(l.id).catch(() => []);
        return leads.map((ld) => ({ ...ld, lodge_name: l.name, lodge_slug: l.slug }));
      })
    );
    const allLeads = leadsByLodge
      .flat()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    const audit: AuditEntry[] = [
      ...allPayments.map((p) => ({
        id: p.id,
        type: "payment" as const,
        lodge_name: (p as Payment & { lodge_name: string }).lodge_name,
        lodge_slug: (p as Payment & { lodge_slug: string }).lodge_slug,
        description: `Payment of £${(p.total_amount / 100).toFixed(2)} — ${p.status}`,
        timestamp: p.created_at,
      })),
      ...allLeads.map((l) => ({
        id: l.id,
        type: "lead" as const,
        lodge_name: (l as Lead & { lodge_name: string }).lodge_name,
        lodge_slug: (l as Lead & { lodge_slug: string }).lodge_slug,
        description: `New lead: ${l.first_name} ${l.last_name} — ${l.stage}`,
        timestamp: l.created_at,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { lodges, recentPayments: allPayments, recentLeads: allLeads, audit };
  } catch {
    return { lodges: [] as Lodge[], recentPayments: [] as Payment[], recentLeads: [] as Lead[], audit: [] as AuditEntry[] };
  }
}

function auditIcon(type: string) {
  switch (type) {
    case "payment":
      return <CreditCard className="h-4 w-4 text-blue-400" />;
    case "lead":
      return <Users className="h-4 w-4 text-emerald-400" />;
    default:
      return <Building2 className="h-4 w-4 text-slate-400" />;
  }
}

export default async function SupportPage() {
  const { lodges, audit } = await getSupportData();

  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Support & Audit</h1>
          <p className="admin-page-copy">
            Cross-lodge activity log and support tools
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="admin-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Building2 className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-semibold text-white">
                {lodges.length}
              </p>
              <p className="text-xs text-slate-400">Total Lodges</p>
            </div>
          </div>
        </div>
        <div className="admin-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-semibold text-white">
                {audit.length}
              </p>
              <p className="text-xs text-slate-400">Recent Activities</p>
            </div>
          </div>
        </div>
        <div className="admin-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <HeadphonesIcon className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-semibold text-white">0</p>
              <p className="text-xs text-slate-400">Open Tickets</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="admin-surface">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">
              Activity Log
            </h2>
            <Clock className="h-5 w-5 text-slate-400" />
          </div>
          {audit.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 text-sm text-slate-500">
                No recent activity across lodges
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {audit.slice(0, 15).map((entry) => (
                <div
                  key={`${entry.type}-${entry.id}`}
                  className="flex items-start gap-3 px-6 py-3"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                    {auditIcon(entry.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {entry.description}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-blue-400">
                        {entry.lodge_name}
                      </span>
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs text-slate-500">
                        {formatDateTime(entry.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="admin-surface p-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-4">
              Support Tickets
            </h2>
            <div className="mt-4 text-center py-8">
              <HeadphonesIcon className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 text-sm text-slate-500">
                Support ticket system coming soon
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Lodge admins will be able to submit requests from their
                dashboards
              </p>
            </div>
          </div>

          <div className="admin-surface p-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-4">
              Quick Lodge Selector
            </h2>
            {lodges.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 text-center py-4">
                No lodges available
              </p>
            ) : (
              <div className="mt-4 space-y-1">
                {lodges.slice(0, 8).map((lodge) => (
                  <a
                    key={lodge.id}
                    href={`/operator/lodges/${lodge.slug}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/5"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[10px] font-semibold text-white">
                      {lodge.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm text-slate-300 truncate">
                      {lodge.name}
                    </span>
                    <span
                      className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        lodge.is_active
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {lodge.is_active ? "active" : "inactive"}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
