// lib/dues/feature-flags.ts
//
// Single feature gate for the dues monthly subscription (saved-charge
// interim) path. Required because Mooov's saved-charge subscription
// contract (Slice 3) ships to staging Wed 3 Jun and prod Fri 5 Jun,
// and Covenant Installation is Tue 2 Jun — three days before Mooov's
// prod cutover.
//
// Until LODGEPAY_DUES_SUBSCRIPTION_ENABLED is set to "true" on the
// deployment's environment scope, the following paths are no-ops or
// return a friendly 503:
//
//   * POST /api/dues/pay with mode: "subscription"
//   * lib/jobs/handlers/dues-schedule-charge (daily cron)
//
// One-off dues, advance-dues, and the existing take-payment flows are
// unaffected because they only use Mooov contracts that have been in
// prod for months.
//
// Flip to "true" in Vercel prod scope on or after 5 Jun, then redeploy.

const TRUTHY = new Set(["true", "1", "yes", "on", "enabled"]);

export function duesSubscriptionEnabled(): boolean {
  const raw =
    process.env.LODGEPAY_DUES_SUBSCRIPTION_ENABLED ??
    process.env.NEXT_PUBLIC_LODGEPAY_DUES_SUBSCRIPTION_ENABLED ??
    "";
  return TRUTHY.has(raw.trim().toLowerCase());
}
