import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { sweepAbandonedPendingSchedules } from "@/lib/giving/abandoned-pending-sweep";
import { AdminMembersClient } from "./members-client";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const mosqueId = ctx.mode === "database" ? ctx.mosqueId : null;

  const members = useMock
    ? mockDb.getMembers()
    : mosqueId
      ? await db.getMembers(mosqueId)
      : [];

  const offices = mosqueId ? await db.listOfficerLadder(mosqueId) : [];

  // Drive the "missing Gift Aid" / "has declaration" quick filters.
  // One query for the mosque's declarations, then we build a member-side
  // lookup from member_id + lowercased email so we hit both linkage
  // paths (member_id is the primary, email is the historical fallback
  // for pre-link rows). Cheap relative to looping per-member.
  let giftAidDeclaredIds: string[] = [];
  if (mosqueId) {
    try {
      const declarations = await db.getGiftAidDeclarations(mosqueId);
      const activeByMember = new Map<string, true>();
      const activeByEmail = new Map<string, true>();
      for (const d of declarations) {
        if (d.revoked_at || !d.declaration_confirmed) continue;
        if (d.member_id) activeByMember.set(d.member_id, true);
        if (d.donor_email) {
          activeByEmail.set(d.donor_email.toLowerCase(), true);
        }
      }
      giftAidDeclaredIds = members
        .filter(
          (m) =>
            activeByMember.has(m.id) ||
            activeByEmail.has(m.email.toLowerCase()),
        )
        .map((m) => m.id);
    } catch {
      /* non-fatal: the filter will just show 0 declared */
    }
  }

  // Build a member-id -> giving payment method map so the list can
  // surface a per-row "Giving" pill. We pull the active giving year and
  // every member_giving row for the mosque once, match by member_id (or
  // by email as fallback), and emit the most recent in-year row's
  // giving_payment_method. Live subscription rows take precedence even
  // when the giving_payment_method tag hasn't been set yet, so the
  // dashboard never falsely shows "Not tagged" for someone we know is
  // actively paying.
  const givingMethodByMemberId: Record<
    string,
    {
      method:
        | "online_subscription"
        | "bacs"
        | "paid_in_full"
        | "fee_waived"
        | null;
      bacsMonthlyAmount: number | null;
    }
  > = {};
  if (mosqueId && members.length > 0) {
    try {
      // Self-heal: cancel any `pending` schedules left over from
      // abandoned Mooov checkouts before we read. This guarantees the
      // members-list view never shows a phantom "Online" pill from a
      // stale pending row even if the per-checkout abandon path didn't
      // fire (e.g. the member never came back to retry).
      await sweepAbandonedPendingSchedules(mosqueId).catch(() => 0);
      const [allGiving, currentYear, schedules] = await Promise.all([
        db.getMemberGiving(mosqueId),
        db.getCurrentMosqueYear(mosqueId).catch(() => null),
        db.listGivingSchedules(mosqueId).catch(() => []),
      ]);
      const ys = currentYear?.start_date.slice(0, 10) ?? null;
      const ye = currentYear?.end_date.slice(0, 10) ?? null;
      const inYear = allGiving.filter((d) => {
        if (d.is_advance) return false;
        if (!ys || !ye) return true;
        return (
          d.period_start.slice(0, 10) <= ye &&
          d.period_end.slice(0, 10) >= ys
        );
      });
      const ACTIVE_SCHEDULE_STATUSES = new Set([
        "active",
        "active_stripe",
        "action_required",
        "past_due",
        "paused",
      ]);
      // `cancelled_at` is the source of truth for "this schedule is
      // dead". A late Mooov webhook used to be able to clobber a
      // cancelled row's `status` back to `past_due`, which lit the
      // members-list "Online" pill back up. We now ignore status if
      // cancelled_at is set (defence-in-depth alongside the webhook
      // terminal-state guard).
      const activeScheduleEmails = new Set(
        schedules
          .filter(
            (s) =>
              s.cancelled_at == null && ACTIVE_SCHEDULE_STATUSES.has(s.status),
          )
          .map((s) => s.member_email.toLowerCase()),
      );
      const byMember = new Map<string, (typeof inYear)[number]>();
      const byEmail = new Map<string, (typeof inYear)[number]>();
      for (const row of inYear) {
        if (row.member_id) {
          const existing = byMember.get(row.member_id);
          if (
            !existing ||
            row.created_at.localeCompare(existing.created_at) > 0
          ) {
            byMember.set(row.member_id, row);
          }
        }
        if (row.member_email) {
          const k = row.member_email.toLowerCase();
          const existing = byEmail.get(k);
          if (
            !existing ||
            row.created_at.localeCompare(existing.created_at) > 0
          ) {
            byEmail.set(k, row);
          }
        }
      }
      for (const m of members) {
        const row =
          byMember.get(m.id) ?? byEmail.get(m.email.toLowerCase()) ?? null;
        const hasActiveSchedule = activeScheduleEmails.has(
          m.email.toLowerCase(),
        );
        const tagged = row?.giving_payment_method ?? null;
        const method = tagged ?? (hasActiveSchedule ? "online_subscription" : null);
        givingMethodByMemberId[m.id] = {
          method,
          bacsMonthlyAmount:
            tagged === "bacs" && row?.bacs_monthly_amount != null
              ? Number(row.bacs_monthly_amount)
              : null,
        };
      }
    } catch {
      // Non-fatal — the column will just render "Not tagged" for everyone.
    }
  }

  return (
    <AdminMembersClient
      members={JSON.parse(JSON.stringify(members))}
      offices={JSON.parse(JSON.stringify(offices))}
      giftAidDeclaredMemberIds={giftAidDeclaredIds}
      givingMethodByMemberId={givingMethodByMemberId}
    />
  );
}
