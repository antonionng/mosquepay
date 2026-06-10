"use client";

// Admin-facing paper Gift Aid declaration upload.
//
// Used from two surfaces today:
//
//   1. take-payment success screen (cash + charge): the treasurer just
//      logged a charity payment for a Member with no declaration on file.
//      We capture the slip AND retroactively project a Gift Aid donation
//      row against the just-logged payment (`paymentId` provided).
//
//   2. admin member profile (post-service tidy-up): the Charity Steward
//      sits down with the stack of forms collected at the fellowship meal,
//      opens each Member's profile and uploads the slip. No payment to
//      attach to (`paymentId` omitted) -- the declaration just gets filed
//      against the member and will cover all future donations.
//
// Server endpoints:
//   POST /api/admin/gift-aid/declarations            -> creates the row
//   POST /api/admin/take-payment/<id>/gift-aid-attach -> backfill donation
//                                                       (skipped when no
//                                                        paymentId)

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";

type Payer = {
  kind: "member" | "guest" | "anonymous";
  memberId?: string | null;
  payerName?: string | null;
  payerEmail?: string | null;
};

export type GiftAidDefaultAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postcode?: string | null;
};

export function GiftAidPaperUploadDialog({
  open,
  onOpenChange,
  paymentId,
  payer,
  defaultAddress,
  title,
  description,
  onCaptured,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When present, the declaration is also retroactively attached to this
   *  LP payment id (public.payments.id) so the next claim batch picks the
   *  donation up. Omit for "just file the declaration" flows like the
   *  admin member profile. */
  paymentId?: string | null;
  payer: Payer;
  /** Prefilled address fields. Particularly useful from the admin member
   *  profile where we already have the Member's address on file. */
  defaultAddress?: GiftAidDefaultAddress;
  title?: string;
  description?: string;
  onCaptured: (result: { declarationId: string }) => void;
}) {
  const [donorName, setDonorName] = useState(payer.payerName ?? "");
  const [donorEmail, setDonorEmail] = useState(payer.payerEmail ?? "");
  const [line1, setLine1] = useState(defaultAddress?.line1 ?? "");
  const [line2, setLine2] = useState(defaultAddress?.line2 ?? "");
  const [city, setCity] = useState(defaultAddress?.city ?? "");
  const [postcode, setPostcode] = useState(defaultAddress?.postcode ?? "");
  const [filingReference, setFilingReference] = useState("");
  const [holdingOriginal, setHoldingOriginal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDonorName(payer.payerName ?? "");
      setDonorEmail(payer.payerEmail ?? "");
      setLine1(defaultAddress?.line1 ?? "");
      setLine2(defaultAddress?.line2 ?? "");
      setCity(defaultAddress?.city ?? "");
      setPostcode(defaultAddress?.postcode ?? "");
      setFile(null);
      setHoldingOriginal(false);
      setFilingReference("");
      setError(null);
    }
  }, [open, payer, defaultAddress]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Please upload a photo or scan of the signed declaration.");
      return;
    }
    if (!holdingOriginal) {
      setError("Tick the box to confirm you are holding the paper original.");
      return;
    }
    if (
      !donorName.trim() ||
      !donorEmail.trim() ||
      !line1.trim() ||
      !city.trim() ||
      !postcode.trim()
    ) {
      setError("Name, email, address line 1, town, and postcode are required.");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("donor_name", donorName.trim());
      form.append("donor_email", donorEmail.trim());
      form.append("donor_address_line_1", line1.trim());
      if (line2.trim()) form.append("donor_address_line_2", line2.trim());
      form.append("donor_city", city.trim());
      form.append("donor_postcode", postcode.trim());
      if (payer.memberId) form.append("member_id", payer.memberId);
      if (filingReference.trim()) {
        form.append("paper_filing_reference", filingReference.trim());
      }
      form.append("paper_received_date", new Date().toISOString().slice(0, 10));
      form.append("confirmed_holding_original", "true");
      form.append("evidence_file", file);

      const declRes = await fetch("/api/admin/gift-aid/declarations", {
        method: "POST",
        body: form,
      });
      const declBody = await declRes.json().catch(() => ({}));
      if (!declRes.ok) {
        throw new Error(declBody.error ?? "Could not record declaration.");
      }
      const declarationId = declBody.declaration?.id;
      if (!declarationId) {
        throw new Error("Declaration created but no id returned.");
      }

      if (paymentId) {
        // Backfill the donation row for the just-logged payment so the next
        // claim batch picks it up. Server enforces church + amount sanity.
        const attachRes = await fetch(
          `/api/admin/take-payment/${encodeURIComponent(paymentId)}/gift-aid-attach`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ declaration_id: declarationId }),
          },
        );
        const attachBody = await attachRes.json().catch(() => ({}));
        if (!attachRes.ok) {
          throw new Error(
            attachBody.error ??
              "Declaration saved but could not attach to the payment.",
          );
        }
      }
      onCaptured({ declarationId });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? "Add paper Gift Aid declaration"}</DialogTitle>
          <DialogDescription>
            {description ??
              "Photograph the signed slip and capture the donor address so the church can reclaim 25 percent."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ga-cap-name">Full name</Label>
              <Input
                id="ga-cap-name"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ga-cap-email">Email</Label>
              <Input
                id="ga-cap-email"
                type="email"
                value={donorEmail}
                onChange={(e) => setDonorEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ga-cap-line1">Address line 1</Label>
              <Input
                id="ga-cap-line1"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                autoComplete="address-line1"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ga-cap-line2">Address line 2 (optional)</Label>
              <Input
                id="ga-cap-line2"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                autoComplete="address-line2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ga-cap-city">Town / city</Label>
              <Input
                id="ga-cap-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                autoComplete="address-level2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ga-cap-postcode">Postcode</Label>
              <Input
                id="ga-cap-postcode"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                autoComplete="postal-code"
                autoCapitalize="characters"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ga-cap-ref">
                Paper filing reference (optional)
              </Label>
              <Input
                id="ga-cap-ref"
                value={filingReference}
                onChange={(e) => setFilingReference(e.target.value)}
                placeholder="e.g. 2026-A-014"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ga-cap-file">Photo or scan of signed slip</Label>
              <label
                htmlFor="ga-cap-file"
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600 hover:bg-slate-100"
              >
                <Upload className="h-4 w-4 text-slate-500" />
                <span className="flex-1 truncate">
                  {file ? file.name : "Tap to choose a photo or PDF"}
                </span>
                {file ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : null}
              </label>
              <input
                id="ga-cap-file"
                type="file"
                accept="application/pdf,image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={holdingOriginal}
              onChange={(e) => setHoldingOriginal(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input text-blue-600"
            />
            <span>
              I confirm I am holding the original signed paper declaration
              and will file it with the church records.
            </span>
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !holdingOriginal || !file}
            >
              {submitting ? "Saving..." : "Save declaration"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
