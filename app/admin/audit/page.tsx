import { getAdminReadContext } from "@/lib/admin/read-context";
import * as db from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ENTITY_PATHS: Record<string, (id: string) => string> = {
  donation: (id) => `/admin/donations/${id}`,
  gift_aid_declaration: (id) => `/admin/gift-aid/${id}`,
  pastoral_case: (id) => `/admin/pastoral_care/cases/${id}`,
  pastoral_register: () => `/admin/pastoral_care`,
  pastoral_alert: () => `/admin/pastoral_care`,
  member: (id) => `/admin/members/${id}`,
  newcomer: (id) => `/admin/newcomers/mosque/${id}`,
  event: (id) => `/admin/events/${id}`,
  blog_post: (id) => `/admin/blog/${id}`,
  charity_campaign: (id) => `/admin/charity/${id}`,
  payment: (id) => `/admin/payments/${id}`,
  network: (id) => `/admin/networks/${id}`,
};

function entityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  const fn = ENTITY_PATHS[entityType];
  return fn ? fn(entityId) : null;
}

export default async function AdminAuditPage() {
  const ctx = await getAdminReadContext();
  const logs =
    ctx.mode === "database" && ctx.mosqueId ? await db.listAuditLogs(ctx.mosqueId, 150) : [];

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Audit Trail</h1>
          <p className="admin-page-copy">
            A timestamped history of key secretary, treasurer, charity, and website actions.
          </p>
        </div>
      </div>

      <div className="admin-surface overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ShieldCheck}
              title="No audit events yet"
              description="Member, service, giving, notice, website, charity, and payment actions will appear here as admins use the platform."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-dash-surface-subtle">
                    <td className="whitespace-nowrap px-4 py-3 text-dash-muted">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-dash-text">
                        {log.actor_email ?? "System"}
                      </p>
                      <p className="text-xs capitalize text-dash-muted">
                        {log.actor_role?.replaceAll("_", " ") ?? "unknown"}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-medium capitalize text-dash-text">
                      {log.action.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-dash-muted">
                      {(() => {
                        const href = entityHref(log.entity_type, log.entity_id);
                        return href ? (
                          <Link
                            href={href}
                            className="font-medium text-dash-text hover:text-dash-ring"
                          >
                            {log.entity_type}
                            {log.entity_id ? (
                              <span className="block max-w-[12rem] truncate text-xs text-dash-faint">
                                {log.entity_id}
                              </span>
                            ) : null}
                          </Link>
                        ) : (
                          <>
                            {log.entity_type}
                            {log.entity_id ? (
                              <span className="block max-w-[12rem] truncate text-xs text-dash-faint">
                                {log.entity_id}
                              </span>
                            ) : null}
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-dash-text">
                      {log.summary ?? "No summary"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
