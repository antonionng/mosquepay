/**
 * Abandoned-pending sweep.
 *
 * The dues subscription enrolment flow mints a `dues_schedules` row at
 * status='pending' BEFORE redirecting the member to Mooov's hosted
 * checkout (`/v1/subscription_checkouts`). When the member abandons
 * the page, no `subscription.activated` webhook ever arrives and the
 * row is left at `pending` forever. Without intervention these rows:
 *
 *   - inflate the treasurer dashboard "pending" count
 *   - become a regression risk if any "active" filter changes shape
 *   - clutter the per-member subscription history panel
 *
 * `app/api/dues/pay/route.ts` already abandons them at the START of a
 * fresh enrolment attempt (so the next attempt by the same member gets
 * a clean slate). This helper covers the OTHER path: any code that
 * READS schedules can call it first to guarantee the read view is
 * never polluted by abandoned-checkout phantoms older than the
 * `staleAfterMs` window (default: 30 minutes).
 *
 * It is safe to call on every page render — if there are no stale
 * rows it short-circuits with a single SELECT. We never touch a row
 * that has a `mooov_payment_method_id` or `last_charged_at` set, so
 * a successful checkout that's still mid-webhook can't be rolled
 * back by mistake.
 */
import * as db from "@/lib/db";

const DEFAULT_STALE_AFTER_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Cancel `pending` schedules for a lodge that are older than
 * `staleAfterMs` and have no payment method id or successful charge.
 *
 * Returns the number of rows cancelled. Best-effort: any per-row
 * failure is logged and the sweep continues with the next row.
 */
export async function sweepAbandonedPendingSchedules(
  lodgeId: string,
  opts: { staleAfterMs?: number } = {},
): Promise<number> {
  const staleAfterMs = opts.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const cutoff = new Date(Date.now() - staleAfterMs).toISOString();

  let pending: Awaited<ReturnType<typeof db.listDuesSchedules>>;
  try {
    pending = await db.listDuesSchedules(lodgeId, { status: "pending" });
  } catch (err) {
    console.error("sweepAbandonedPendingSchedules: list failed", {
      lodge_id: lodgeId,
      message: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }

  const stale = pending.filter(
    (s) =>
      s.cancelled_at == null &&
      s.mooov_payment_method_id == null &&
      s.last_charged_at == null &&
      s.created_at < cutoff,
  );
  if (stale.length === 0) return 0;

  let cancelled = 0;
  for (const row of stale) {
    try {
      await db.updateDuesSchedule(row.id, lodgeId, {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by_actor: "system_abandoned_checkout",
        next_charge_at: null,
        metadata: {
          ...(row.metadata ?? {}),
          cancellation_reason: "abandoned_checkout_sweep",
          swept_at: new Date().toISOString(),
        },
      });
      cancelled += 1;
    } catch (err) {
      console.error("sweepAbandonedPendingSchedules: cancel failed", {
        schedule_id: row.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (cancelled > 0) {
    console.log("sweepAbandonedPendingSchedules: cancelled stale rows", {
      lodge_id: lodgeId,
      count: cancelled,
      stale_after_ms: staleAfterMs,
    });
  }

  return cancelled;
}
