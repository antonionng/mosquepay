// Surfaces Mooov's `account_invalid` payment.failed signal to the mosque admin:
// the mosque's underlying PSP connection got severed (typically the mosque
// clicked Disconnect from inside their Stripe Connect dashboard, or Stripe's
// risk team paused the connection). Mooov can't fix this server-side -- the
// mosque admin has to walk through Mooov's portal repair flow.
//
// Persisted into mooov.mosques.status='needs_repair' by
// app/api/mooov-webhooks/connect/route.ts when payment.failed arrives with
// failure_code:"account_invalid".
//
// Render guidance: surface as a button, never auto-redirect (the deep-link
// destination opens in a new tab so the admin can verify they're on
// mooov3.mooov.money before completing the flow).

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface MooovRepairRequiredHint {
  // Hostname for Mooov's repair deep-link. Overridable for staging.
  portalBaseUrl?: string;
  // Full https URL the admin should land on after Mooov auto-bounces them
  // back. Must be on Mooov's return_url allowlist (today: mosque-pay.com,
  // www.mosque-pay.com, *.vercel.app).
  returnUrl: string;
  // Human-readable timestamp of the latest payment.failed:account_invalid
  // event we received, so the admin can correlate with what they saw.
  lastFailureAt?: string;
  // The verbatim Stripe error message ant's gateway forwards. Useful for the
  // admin to copy/paste into a support email.
  lastFailureReason?: string;
}

function formatWhen(iso: string | undefined): string | null {
  if (!iso) return null;
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime())) return null;
  return ts.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function MooovRepairRequiredBanner({
  hint,
}: {
  hint: MooovRepairRequiredHint;
}) {
  const portalBase = hint.portalBaseUrl ?? "https://mooov3.mooov.money";
  const repairUrl = new URL(`${portalBase}/connections`);
  repairUrl.searchParams.set("from", "mosquepay");
  // action=stripe_reconnect is Mooov's URL contract for the PSP-repair flow.
  // The admin sees Mooov branding on landing; we never expose this param
  // value in user-facing copy.
  repairUrl.searchParams.set("action", "stripe_reconnect");
  repairUrl.searchParams.set("return_url", hint.returnUrl);

  const failedAtLabel = formatWhen(hint.lastFailureAt);

  return (
    <Card className="border-amber-300 bg-amber-50 shadow-none">
      <div className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:gap-6">
        <div className="flex-1 space-y-2">
          <h3 className="text-base font-semibold text-amber-900">
            Mooov payment connection needs repair
          </h3>
          <p className="text-sm leading-relaxed text-amber-800">
            We tried to take a payment through this mosque&rsquo;s Mooov merchant
            and the underlying payment account rejected the request. New giving,
            donations, and event payments will continue to fail until the
            connection is repaired.
          </p>
          {failedAtLabel ? (
            <p className="text-xs text-amber-700">
              Last detected: {failedAtLabel}.
            </p>
          ) : null}
          {hint.lastFailureReason ? (
            <details className="text-xs text-amber-700">
              <summary className="cursor-pointer underline underline-offset-2">
                Technical detail
              </summary>
              <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-amber-900">
                {hint.lastFailureReason}
              </p>
            </details>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <Button asChild variant="primary" size="sm">
            <a
              href={repairUrl.toString()}
              target="_blank"
              rel="noopener noreferrer"
            >
              Repair connection on Mooov
            </a>
          </Button>
          <p className="text-xs text-amber-700">
            Opens Mooov in a new tab. You&rsquo;ll be sent back here once the
            connection is healthy.
          </p>
        </div>
      </div>
    </Card>
  );
}
