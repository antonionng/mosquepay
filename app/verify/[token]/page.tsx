import { notFound } from "next/navigation";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { rankLabel } from "@/lib/members/rank";

export const dynamic = "force-dynamic";

export default async function VerifyMemberPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!isSupabaseConfigured()) notFound();
  const { token } = await params;
  const member = await db.getMemberByPortalToken(token);

  if (!member) notFound();

  const lodge = await db.getLodgeById(member.lodge_id);
  const isCurrent = member.membership_status === "active";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div
          className="px-6 py-5 text-white"
          style={{ background: isCurrent ? "#059669" : "#b91c1c" }}
        >
          <div className="flex items-center gap-3">
            {isCurrent ? (
              <ShieldCheck className="h-6 w-6" />
            ) : (
              <ShieldAlert className="h-6 w-6" />
            )}
            <p className="text-sm font-semibold uppercase tracking-wider">
              {isCurrent ? "Membership verified" : "Membership not active"}
            </p>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Member</p>
            <p className="text-2xl font-semibold text-slate-900">
              {member.full_name}
            </p>
            {member.office_title && (
              <p className="text-sm text-slate-600">{member.office_title}</p>
            )}
            {member.rank && (
              <p className="text-xs text-slate-500">{rankLabel(member.rank)}</p>
            )}
          </div>
          {lodge && (
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Lodge</p>
              <p className="text-base font-medium text-slate-900">
                {lodge.name}
                {lodge.lodge_number ? ` · No. ${lodge.lodge_number}` : ""}
              </p>
              {lodge.city && (
                <p className="text-xs text-slate-500">{lodge.city}</p>
              )}
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
            <p
              className={`text-sm font-medium ${
                isCurrent ? "text-emerald-700" : "text-red-700"
              } capitalize`}
            >
              {member.membership_status}
            </p>
          </div>
          <p className="border-t border-slate-100 pt-4 text-xs text-slate-400">
            Verified by LodgePay at{" "}
            {new Date().toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            . No personal contact details are shared on this page.
          </p>
        </div>
      </div>
    </div>
  );
}
