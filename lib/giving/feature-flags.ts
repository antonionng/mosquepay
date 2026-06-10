// lib/giving/feature-flags.ts
//
// Single feature gate for the giving monthly subscription (saved-charge
// interim) path. Required because Mooov's saved-charge subscription
// contract (Slice 3) ships to staging Wed 3 Jun and prod Fri 5 Jun,
// and Covenant Special service is Tue 2 Jun — three days before Mooov's
// prod cutover.
//
// Until CHURCHPAY_GIVING_SUBSCRIPTION_ENABLED is set to "true" on the
// deployment's environment scope, the following paths are no-ops or
// return a friendly 503:
//
//   * POST /api/giving/pay with mode: "subscription"
//   * lib/jobs/handlers/giving-schedule-charge (daily cron)
//
// One-off giving, advance-giving, and the existing take-payment flows are
// unaffected because they only use Mooov contracts that have been in
// prod for months.
//
// Flip to "true" in Vercel prod scope on or after 5 Jun, then redeploy.

const TRUTHY = new Set(["true", "1", "yes", "on", "enabled"]);

export function givingSubscriptionEnabled(): boolean {
  const raw =
    process.env.CHURCHPAY_GIVING_SUBSCRIPTION_ENABLED ??
    process.env.NEXT_PUBLIC_CHURCHPAY_GIVING_SUBSCRIPTION_ENABLED ??
    "";
  return TRUTHY.has(raw.trim().toLowerCase());
}
