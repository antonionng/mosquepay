"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Shield,
  Trash2,
} from "lucide-react";

type Declaration = {
  id: string;
  donor_name: string;
  donor_email: string;
  donor_address_line_1: string | null;
  donor_address_line_2: string | null;
  donor_city: string | null;
  donor_postcode: string | null;
  donor_country: string | null;
  declaration_text: string;
  declaration_confirmed: boolean;
  confirmation_method: string;
  hmrc_eligible: boolean;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

type Donation = {
  id: string;
  amount: number;
  status: string;
  source: string;
  created_at: string;
};

type AuditLog = {
  id: string;
  action: string;
  actor_email: string | null;
  summary: string | null;
  created_at: string;
};

export function GiftAidDetailClient({
  declaration: initial,
  donations,
  auditLogs,
}: {
  declaration: Declaration;
  donations: Donation[];
  auditLogs: AuditLog[];
}) {
  const router = useRouter();
  const [declaration, setDeclaration] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);

  const totalDonated = donations
    .filter((d) => d.status === "completed" || d.status === "succeeded")
    .reduce((s, d) => s + d.amount, 0);
  const reclaimable = totalDonated * 0.25;
  const isRevoked = Boolean(declaration.revoked_at);

  async function patch(updates: Partial<Declaration> & { revoke?: boolean }) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/gift-aid/${declaration.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save.");
      setDeclaration(body.declaration);
      setFeedback("Saved.");
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    await patch({ revoke: true });
  }

  return (
    <div className="space-y-6">
      <div className="admin-page-head">
        <div className="min-w-0 flex-1">
          <h1 className="admin-page-title flex items-center gap-3">
            <Shield className="h-6 w-6 text-emerald-600" /> {declaration.donor_name}
          </h1>
          <p className="admin-page-copy">{declaration.donor_email}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/gift-aid" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> All declarations
          </Link>
        </Button>
      </div>

      {feedback ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card variant="panel" className="space-y-4 p-5">
            <h2 className="text-base font-semibold text-dash-text">Donor</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  className={INPUT_CLASS}
                  defaultValue={declaration.donor_name}
                  onBlur={(e) =>
                    e.target.value !== declaration.donor_name &&
                    patch({ donor_name: e.target.value })
                  }
                  disabled={busy}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className={INPUT_CLASS}
                  defaultValue={declaration.donor_email}
                  onBlur={(e) =>
                    e.target.value !== declaration.donor_email &&
                    patch({ donor_email: e.target.value })
                  }
                  disabled={busy}
                />
              </Field>
              <Field label="Address line 1">
                <input
                  className={INPUT_CLASS}
                  defaultValue={declaration.donor_address_line_1 ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (declaration.donor_address_line_1 ?? "") &&
                    patch({ donor_address_line_1: e.target.value || null })
                  }
                  disabled={busy}
                />
              </Field>
              <Field label="Address line 2">
                <input
                  className={INPUT_CLASS}
                  defaultValue={declaration.donor_address_line_2 ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (declaration.donor_address_line_2 ?? "") &&
                    patch({ donor_address_line_2: e.target.value || null })
                  }
                  disabled={busy}
                />
              </Field>
              <Field label="City">
                <input
                  className={INPUT_CLASS}
                  defaultValue={declaration.donor_city ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (declaration.donor_city ?? "") &&
                    patch({ donor_city: e.target.value || null })
                  }
                  disabled={busy}
                />
              </Field>
              <Field label="Postcode">
                <input
                  className={INPUT_CLASS}
                  defaultValue={declaration.donor_postcode ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (declaration.donor_postcode ?? "") &&
                    patch({ donor_postcode: e.target.value || null })
                  }
                  disabled={busy}
                />
              </Field>
              <Field label="Country">
                <input
                  className={INPUT_CLASS}
                  defaultValue={declaration.donor_country ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (declaration.donor_country ?? "") &&
                    patch({ donor_country: e.target.value || null })
                  }
                  disabled={busy}
                />
              </Field>
              <Field label="Confirmation method">
                <input
                  className={INPUT_CLASS}
                  defaultValue={declaration.confirmation_method}
                  onBlur={(e) =>
                    e.target.value !== declaration.confirmation_method &&
                    patch({ confirmation_method: e.target.value })
                  }
                  disabled={busy}
                />
              </Field>
            </div>
          </Card>

          <Card variant="panel" className="space-y-3 p-5">
            <h2 className="text-base font-semibold text-dash-text">Declaration text</h2>
            <textarea
              className="min-h-[120px] w-full rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-sm text-dash-text"
              defaultValue={declaration.declaration_text}
              onBlur={(e) =>
                e.target.value !== declaration.declaration_text &&
                patch({ declaration_text: e.target.value })
              }
              disabled={busy}
            />
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="inline-flex items-center gap-2 text-dash-text">
                <input
                  type="checkbox"
                  checked={declaration.declaration_confirmed}
                  onChange={(e) => patch({ declaration_confirmed: e.target.checked })}
                  disabled={busy}
                />
                Donor has confirmed declaration
              </label>
              <label className="inline-flex items-center gap-2 text-dash-text">
                <input
                  type="checkbox"
                  checked={declaration.hmrc_eligible}
                  onChange={(e) => patch({ hmrc_eligible: e.target.checked })}
                  disabled={busy}
                />
                Eligible for HMRC reclaim
              </label>
            </div>
          </Card>

          <Card variant="panel" className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
              <Banknote className="h-4 w-4 text-emerald-600" /> Linked donations
            </h2>
            {donations.length === 0 ? (
              <p className="text-sm text-dash-text-muted">
                No donations are linked to this declaration yet.
              </p>
            ) : (
              <ul className="divide-y divide-dash-border">
                {donations.map((d) => (
                  <li key={d.id} className="py-2">
                    <Link
                      href={`/admin/donations/${d.id}`}
                      className="flex items-center justify-between gap-3 text-sm hover:text-dash-ring"
                    >
                      <span className="text-dash-text">
                        £{d.amount.toFixed(2)} · {d.source.replaceAll("_", " ")}
                      </span>
                      <span className="text-xs text-dash-text-muted">
                        {formatDate(d.created_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card variant="panel" className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
              <Clock className="h-4 w-4 text-dash-muted" /> History
            </h2>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-dash-text-muted">No audit events recorded.</p>
            ) : (
              <ul className="divide-y divide-dash-border">
                {auditLogs.map((log) => (
                  <li key={log.id} className="py-2 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-dash-text">
                        {log.action.replaceAll("_", " ")}
                      </span>
                      <span className="text-xs text-dash-text-muted">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-dash-text-muted">
                      {log.actor_email ?? "system"}
                      {log.summary ? ` · ${log.summary}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card variant="panel" className="space-y-3 p-5">
            <h2 className="text-base font-semibold text-dash-text">Status</h2>
            <Badge
              variant={isRevoked ? "destructive" : "success"}
              className="capitalize"
            >
              {isRevoked ? "Revoked" : "Active"}
            </Badge>
            {isRevoked ? (
              <p className="text-xs text-dash-text-muted">
                Revoked on {formatDate(declaration.revoked_at!)}
              </p>
            ) : null}
            <p className="text-xs text-dash-text-muted">
              Created {formatDate(declaration.created_at)}
            </p>
          </Card>

          <Card variant="panel" className="space-y-2 p-5">
            <h2 className="text-base font-semibold text-dash-text">Reclaim</h2>
            <p className="text-3xl font-semibold text-emerald-700">
              £{reclaimable.toFixed(2)}
            </p>
            <p className="text-xs text-dash-text-muted">
              Based on £{totalDonated.toFixed(2)} of completed linked donations.
            </p>
          </Card>

          <Card variant="panel" className="space-y-2 p-5">
            <h2 className="text-base font-semibold text-dash-text">Actions</h2>
            {isRevoked ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={busy}
                onClick={() => patch({ revoke: false })}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Restore declaration
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={busy}
                onClick={() => setConfirmRevokeOpen(true)}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Revoke declaration
              </Button>
            )}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="w-full"
            >
              <Link href={`/admin/donations?donor=${encodeURIComponent(declaration.donor_email)}`}>
                <ExternalLink className="mr-2 h-4 w-4" /> See donor donations
              </Link>
            </Button>
          </Card>
        </aside>
      </div>
      <ConfirmActionDialog
        open={confirmRevokeOpen}
        onOpenChange={setConfirmRevokeOpen}
        title="Revoke Gift Aid declaration?"
        description="This declaration will stop being included in reclaim totals. You can restore it later."
        confirmLabel="Revoke declaration"
        tone="danger"
        loading={busy}
        onConfirm={async () => {
          await revoke();
          setConfirmRevokeOpen(false);
        }}
      />
    </div>
  );
}

const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text placeholder:text-dash-faint focus:border-dash-ring focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-dash-text-muted">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
