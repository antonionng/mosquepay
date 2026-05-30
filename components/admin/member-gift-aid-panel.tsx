"use client";

// Gift Aid panel on the admin member profile.
//
// Designed for the post-meeting workflow described by the user: at the
// festive board the Charity Steward collects a stack of signed paper
// declarations, then sits down later and walks down the list, opening
// each Brother's profile and uploading the slip on their behalf.
//
// Two states:
//
//   1. No declaration on file -> "Upload paper declaration" CTA opens the
//      reusable GiftAidPaperUploadDialog with member-id prefilled and
//      member.address_* dropped into the address fields so the Steward
//      only has to type the date / filing reference and snap the photo.
//
//   2. Declaration on file -> shows source (paper vs digital), date,
//      filer / signer email, evidence hash; offers "Download evidence"
//      (signed URL, 5 min) and "Revoke" with a typed confirmation.

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileWarning,
  HeartHandshake,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GiftAidPaperUploadDialog } from "@/components/admin/gift-aid-paper-upload-dialog";

type ActiveDeclaration = {
  id: string;
  donor_name: string;
  donor_email: string;
  donor_address_line_1: string | null;
  donor_postcode: string | null;
  created_at: string;
  evidence_source: "digital" | "paper" | "verbal" | "import_legacy" | null;
  evidence_sha256: string | null;
  evidence_uploaded_at: string | null;
  evidence_uploaded_by_email: string | null;
  paper_received_date: string | null;
  paper_filing_reference: string | null;
  revoked_at: string | null;
};

export function MemberGiftAidPanel({
  member,
  declaration: initialDeclaration,
}: {
  member: {
    id: string;
    full_name: string;
    email: string;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    postcode: string | null;
  };
  declaration: ActiveDeclaration | null;
}) {
  const [declaration, setDeclaration] = useState<ActiveDeclaration | null>(
    initialDeclaration,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Pull the freshest declaration when the panel mounts in case another
  // tab uploaded one since the server render. Cheap GET, cache-busted.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/members/${encodeURIComponent(member.id)}/gift-aid`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const body = (await res.json()) as {
          declaration: ActiveDeclaration | null;
        };
        setDeclaration(body.declaration);
      }
    } catch {
      /* non-fatal: stale state is fine */
    }
  }, [member.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function downloadEvidence() {
    if (!declaration) return;
    setFeedback(null);
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/admin/gift-aid/declarations/${declaration.id}/evidence`,
        { cache: "no-store" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? "Could not generate download link.");
      }
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Download failed.",
      });
    } finally {
      setDownloading(false);
    }
  }

  async function revoke() {
    if (!declaration) return;
    const reason = window.prompt(
      "Confirm revocation. The declaration row stays on file for audit but will not be used for future claims. Optional reason:",
      "",
    );
    if (reason === null) return; // user hit Cancel
    setRevoking(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/gift-aid/${declaration.id}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? "Could not revoke declaration.");
      }
      setFeedback({
        type: "success",
        text: "Declaration revoked.",
      });
      await refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Revocation failed.",
      });
    } finally {
      setRevoking(false);
    }
  }

  const isActive = declaration && !declaration.revoked_at;
  // A paper declaration without stored evidence is a yellow flag -- it
  // shouldn't happen in normal flow (admin POST inserts the row only
  // after the upload succeeds, then revokes on upload failure) but we
  // surface it loudly if it ever does so the Steward can re-upload.
  const evidenceMissing =
    isActive && declaration.evidence_source !== "digital" &&
    !declaration.evidence_sha256;

  return (
    <div className="rounded-2xl border border-dash-border bg-dash-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
        <h3 className="text-base font-semibold text-dash-text flex items-center gap-2">
          <HeartHandshake className="h-4 w-4 text-dash-muted" />
          Gift Aid declaration
        </h3>
        {!isActive ? (
          <Button
            size="sm"
            variant="primary"
            onClick={() => setDialogOpen(true)}
            className="gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Upload paper declaration
          </Button>
        ) : null}
      </div>

      <div className="px-6 py-5">
        {feedback ? (
          <div
            className={
              feedback.type === "success"
                ? "mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                : "mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            }
          >
            {feedback.text}
          </div>
        ) : null}

        {isActive ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-emerald-900">
                  Active{" "}
                  {declaration.evidence_source === "paper"
                    ? "paper"
                    : declaration.evidence_source === "digital"
                      ? "digital"
                      : declaration.evidence_source ?? ""}{" "}
                  declaration on file
                </p>
                <p className="mt-0.5 text-xs text-emerald-800">
                  Filed{" "}
                  {new Date(declaration.created_at).toLocaleDateString(
                    "en-GB",
                    { day: "numeric", month: "short", year: "numeric" },
                  )}
                  {declaration.evidence_uploaded_by_email
                    ? ` by ${declaration.evidence_uploaded_by_email}`
                    : ""}
                  .
                </p>
              </div>
            </div>

            {evidenceMissing ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">No evidence file stored</p>
                  <p className="mt-0.5 text-xs text-amber-800">
                    The declaration row exists but no scan / HTML snapshot is
                    on file. Revoke and re-upload to restore the audit chain
                    before the next claim pack.
                  </p>
                </div>
              </div>
            ) : null}

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Row label="Donor name" value={declaration.donor_name} />
              <Row label="Donor email" value={declaration.donor_email} />
              <Row
                label="Postal address"
                value={
                  [
                    declaration.donor_address_line_1,
                    declaration.donor_postcode,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
              {declaration.paper_received_date ? (
                <Row
                  label="Paper received"
                  value={new Date(
                    declaration.paper_received_date,
                  ).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                />
              ) : null}
              {declaration.paper_filing_reference ? (
                <Row
                  label="Filing reference"
                  value={declaration.paper_filing_reference}
                />
              ) : null}
              {declaration.evidence_sha256 ? (
                <Row
                  label="Evidence SHA-256"
                  value={
                    <code className="font-mono text-xs">
                      {declaration.evidence_sha256.slice(0, 16)}…
                    </code>
                  }
                />
              ) : null}
            </dl>

            <div className="flex flex-wrap items-center gap-2 border-t border-dash-border pt-4">
              <Button
                size="sm"
                variant="secondary"
                onClick={downloadEvidence}
                disabled={downloading || !declaration.evidence_sha256}
                className="gap-2"
                title={
                  declaration.evidence_sha256
                    ? "Open the stored declaration evidence in a new tab (signed URL, 5 minutes)."
                    : "No evidence file on record."
                }
              >
                {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download evidence
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDialogOpen(true)}
                className="gap-2"
                title="File a new paper declaration. The previous declaration will stay on file for audit but will be replaced for future claims."
              >
                <Plus className="h-3.5 w-3.5" />
                Upload replacement
              </Button>
              <a
                href={`/admin/gift-aid/${declaration.id}`}
                className="rounded-md border border-dash-border bg-dash-surface px-2.5 py-1.5 text-xs font-medium text-dash-text hover:bg-dash-surface-subtle"
              >
                Open audit log
              </a>
              <div className="grow" />
              <Button
                size="sm"
                variant="ghost"
                onClick={revoke}
                disabled={revoking}
                className="gap-2 text-red-700 hover:bg-red-50 hover:text-red-800"
              >
                {revoking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Revoke
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <div>
              <p className="font-medium text-slate-800">
                No Gift Aid declaration on file
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Use &quot;Upload paper declaration&quot; to file a slip on
                behalf of {member.full_name}. {" "}
                The address on file will be prefilled into the form so you
                only need to confirm the slip date, snap a photo and tick the
                holding-original attestation.
              </p>
            </div>
          </div>
        )}
      </div>

      <GiftAidPaperUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        payer={{
          kind: "member",
          memberId: member.id,
          payerName: member.full_name,
          payerEmail: member.email,
        }}
        defaultAddress={{
          line1: member.address_line_1,
          line2: member.address_line_2,
          city: member.city,
          postcode: member.postcode,
        }}
        title={`File a paper Gift Aid declaration for ${member.full_name}`}
        description="Snap a photo of the signed slip. The address on file is prefilled; correct it if the donor has moved."
        onCaptured={() => {
          void refresh();
        }}
      />
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.12em] text-dash-faint">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-dash-text">{value}</dd>
    </div>
  );
}
