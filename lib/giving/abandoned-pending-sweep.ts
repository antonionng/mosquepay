/**
 * Abandoned-pending sweep.
 *
 * The giving subscription enrolment flow mints a `giving_schedules` row at
 * status='pending' BEFORE redirecting the member to Mooov's hosted
 * checkout (`/v1/subscription_checkouts`). When the member abandons
 * the page, no `subscription.activated` webhook ever arrives and the
 * row is left at `pending` forever. Without intervention these rows:
 *
 *   - inflate the treasurer dashboard "pending" count
 *   - become a regression risk if any "active" filter changes shape
 *   - clutter the per-member subscription history panel
 *
 * `app/api/giving/pay/route.ts` already abandons them at the START of a
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
 *
 * IMPORTANT — this blind timer is the FALLBACK, not the primary abandon
 * mechanism. The authoritative signal is Mooov's `payment.failed` /
 * `failure_code: checkout_abandoned` event, handled in the connect
 * webhook, which cancels the pending schedule the moment the hosted
 * checkout session actually expires. The timer only exists to mop up
 * schedules where that event never arrives.
 *
 * The window is deliberately LONGER than a Stripe Checkout session can
 * live (max 24h) plus webhook latency. The 2026-06-02 incident proved
 * why a short window is dangerous: a 30-minute sweep cancelled a
 * schedule whose £24 first charge had actually captured on Stripe,
 * because Mooov's (then-broken) activation webhook hadn't arrived yet.
 * Even with the longer window, the webhook handler's resurrection guard
 * is the ultimate safety net — a `subscription.activated` for a
 * soft-cancelled schedule un-cancels it.
 */
import * as db from "@/lib/db";

// 26h: comfortably past the 24h max lifetime of a Stripe Checkout
// session, so a real charge's (possibly delayed) activation webhook
// is never pre-empted by this timer.
const DEFAULT_STALE_AFTER_MS = 26 * 60 * 60 * 1000; // 26 hours

/**
 * Cancel `pending` schedules for a mosque that are older than
 * `staleAfterMs` and have no payment method id or successful charge.
 *
 * Returns the number of rows cancelled. Best-effort: any per-row
 * failure is logged and the sweep continues with the next row.
 */
export async function sweepAbandonedPendingSchedules(
  mosqueId: string,
  opts: { staleAfterMs?: number } = {},
): Promise<number> {
  const staleAfterMs = opts.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const cutoff = new Date(Date.now() - staleAfterMs).toISOString();

  let pending: Awaited<ReturnType<typeof db.listGivingSchedules>>;
  try {
    pending = await db.listGivingSchedules(mosqueId, { status: "pending" });
  } catch (err) {
    console.error("sweepAbandonedPendingSchedules: list failed", {
      mosque_id: mosqueId,
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
      await db.updateGivingSchedule(row.id, mosqueId, {
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
      mosque_id: mosqueId,
      count: cancelled,
      stale_after_ms: staleAfterMs,
    });
  }

  return cancelled;
}
