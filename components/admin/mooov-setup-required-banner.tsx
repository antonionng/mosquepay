// Surfaces Mooov's typed `merchant_not_charge_capable` 422 to the mosque admin:
// a single-use, ~1h-TTL setup link that drops the admin onto step 2 of Mooov's
// PSP-connect wizard without a Mooov login. Persisted into
// payment_attempts.metadata.merchant_setup by app/api/giving/start; the latest
// unexpired hint is fetched in app/admin/integrations/page.tsx.
//
// Render guidance per https://docs.mooov.money/errors/merchant_not_charge_capable:
// surface as a button, never auto-redirect.

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface MooovSetupHintProvider {
  id: string;
  display_name: string;
  status: string;
}

export interface MooovSetupHint {
  setup_url: string;
  setup_url_expires_at: string;
  providers?: MooovSetupHintProvider[];
  message?: string;
  docs_url?: string;
}

function formatExpiry(expiresAt: string): string {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return "soon";
  const diffMs = expiry.getTime() - Date.now();
  if (diffMs <= 0) return "now";
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "in <1 min";
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? "in 1 hour" : `in ${hours} hours`;
}

function providersLabel(providers: MooovSetupHintProvider[] | undefined): string | null {
  if (!providers || providers.length === 0) return null;
  const names = providers.map((p) => p.display_name).filter(Boolean);
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
}

export function MooovSetupRequiredBanner({ hint }: { hint: MooovSetupHint }) {
  const providers = providersLabel(hint.providers);
  const expiryLabel = formatExpiry(hint.setup_url_expires_at);
  const bodyMessage =
    hint.message ??
    "We tried to charge through this mosque's Mooov merchant, but the merchant has not finished connecting a payment provider yet.";

  return (
    <Card className="border-amber-300 bg-amber-50 shadow-none">
      <div className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:gap-6">
        <div className="flex-1 space-y-2">
          <h3 className="text-base font-semibold text-amber-900">
            Mooov needs payment provider setup
          </h3>
          <p className="text-sm leading-relaxed text-amber-800">{bodyMessage}</p>
          {providers ? (
            <p className="text-xs text-amber-700">
              Mooov supports {providers}. The button below skips the Mooov login
              and drops you straight on the connect screen.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <Button asChild variant="primary" size="sm">
            <a
              href={hint.setup_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Finish setup on Mooov
            </a>
          </Button>
          <p className="text-xs text-amber-700">
            Single-use link, expires {expiryLabel}.
          </p>
          {hint.docs_url ? (
            <p className="text-xs">
              <a
                href={hint.docs_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-700 underline underline-offset-2 hover:text-amber-900"
              >
                Why am I seeing this?
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
