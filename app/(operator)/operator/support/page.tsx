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
import { listMosques, getPayments, getNewcomers } from "@/lib/db";
import type { Mosque, Payment, Newcomer } from "@/lib/db/types";
import { formatDateTime } from "@/lib/utils";
import { requireOperatorPageAccess } from "@/lib/auth/operator-page";

type AuditEntry = {
  id: string;
  type: "payment" | "newcomer" | "mosque";
  mosque_name: string;
  mosque_slug: string;
  description: string;
  timestamp: string;
};

async function getSupportData() {
  if (!isSupabaseConfigured()) {
    return { mosques: [] as Mosque[], recentPayments: [] as Payment[], recentNewcomers: [] as Newcomer[], audit: [] as AuditEntry[] };
  }

  try {
    const mosques = await listMosques();
    const paymentsByMosque = await Promise.all(
      mosques.map(async (l) => {
        const payments = await getPayments(l.id).catch(() => []);
        return payments.map((p) => ({ ...p, mosque_name: l.name, mosque_slug: l.slug }));
      })
    );
    const allPayments = paymentsByMosque
      .flat()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    const newcomersByMosque = await Promise.all(
      mosques.map(async (l) => {
        const newcomers = await getNewcomers(l.id).catch(() => []);
        return newcomers.map((ld) => ({ ...ld, mosque_name: l.name, mosque_slug: l.slug }));
      })
    );
    const allNewcomers = newcomersByMosque
      .flat()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    const audit: AuditEntry[] = [
      ...allPayments.map((p) => ({
        id: p.id,
        type: "payment" as const,
        mosque_name: (p as Payment & { mosque_name: string }).mosque_name,
        mosque_slug: (p as Payment & { mosque_slug: string }).mosque_slug,
        description: `Payment of £${(p.total_amount / 100).toFixed(2)}: ${p.status}`,
        timestamp: p.created_at,
      })),
      ...allNewcomers.map((l) => ({
        id: l.id,
        type: "newcomer" as const,
        mosque_name: (l as Newcomer & { mosque_name: string }).mosque_name,
        mosque_slug: (l as Newcomer & { mosque_slug: string }).mosque_slug,
        description: `New newcomer: ${l.first_name} ${l.last_name}: ${l.stage}`,
        timestamp: l.created_at,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { mosques, recentPayments: allPayments, recentNewcomers: allNewcomers, audit };
  } catch {
    return { mosques: [] as Mosque[], recentPayments: [] as Payment[], recentNewcomers: [] as Newcomer[], audit: [] as AuditEntry[] };
  }
}

function auditIcon(type: string) {
  switch (type) {
    case "payment":
      return <CreditCard className="h-4 w-4 text-blue-400" />;
    case "newcomer":
      return <Users className="h-4 w-4 text-emerald-400" />;
    default:
      return <Building2 className="h-4 w-4 text-slate-400" />;
  }
}

export default async function SupportPage() {
  await requireOperatorPageAccess();

  const { mosques, audit } = await getSupportData();

  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Support & Audit</h1>
          <p className="admin-page-copy">
            Cross-mosque activity log and support tools
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
                {mosques.length}
              </p>
              <p className="text-xs text-slate-400">Total Mosques</p>
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
                No recent activity across mosques
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
                        {entry.mosque_name}
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
                Mosque admins will be able to submit requests from their
                dashboards
              </p>
            </div>
          </div>

          <div className="admin-surface p-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-4">
              Quick Mosque Selector
            </h2>
            {mosques.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 text-center py-4">
                No mosques available
              </p>
            ) : (
              <div className="mt-4 space-y-1">
                {mosques.slice(0, 8).map((mosque) => (
                  <a
                    key={mosque.id}
                    href={`/operator/mosques/${mosque.slug}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/5"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[10px] font-semibold text-white">
                      {mosque.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm text-slate-300 truncate">
                      {mosque.name}
                    </span>
                    <span
                      className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        mosque.is_active
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {mosque.is_active ? "active" : "inactive"}
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
