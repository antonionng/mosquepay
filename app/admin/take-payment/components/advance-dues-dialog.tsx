"use client";

// Advance-dues capture dialog for the take-payment surface.
//
// One-button entry point on the take-payment shell. The treasurer picks
// a member, sees the auto-computed next-year amount (with discount), and
// either:
//   * "Show QR" — mints a Mooov hosted Checkout against the resolved
//     advance member_dues row. Dialog hands back the URL + payment_id
//     to the shell, which renders the QR using the existing active
//     session card.
//   * "Record cash" — server-records cash + flips the dues row paid in
//     a single round-trip. Dialog closes and the shell shows a green
//     confirmation toast.
//
// Backed by GET/POST /api/admin/take-payment/advance-dues. All "next
// year + discount + create-if-absent" logic lives in lib/dues/advance.ts.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Loader2,
  PercentIcon,
  QrCode,
} from "lucide-react";
import { newClientToken } from "./helpers";
import type { MemberOption } from "./types";

type Preview = {
  eligible: boolean;
  code?: string;
  message?: string;
  member?: {
    id: string;
    full_name: string;
    email: string | null;
  };
  next_year_label?: string;
  base_amount?: number;
  discount_percent?: number;
  charged_amount?: number;
  currency?: string;
  already_prepaid?: boolean;
  existing_dues_id?: string | null;
};

export type AdvanceDuesQrResult = {
  url: string;
  payment_id: string;
  dues_id: string;
  amount: number;
  currency: string;
};

export type AdvanceDuesCashResult = {
  payment_id: string;
  ledger_payment_id: string;
  dues_id: string;
  amount: number;
  currency: string;
  payer_name: string | null;
  payer_email: string | null;
  next_year_label: string;
  gift_aid_eligible: boolean;
};

export function AdvanceDuesDialog({
  open,
  onOpenChange,
  members,
  initialMemberId,
  onQrReady,
  onCashRecorded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  members: MemberOption[];
  initialMemberId?: string | null;
  onQrReady: (result: AdvanceDuesQrResult, member: MemberOption) => void;
  onCashRecorded: (result: AdvanceDuesCashResult) => void;
}) {
  const [memberId, setMemberId] = useState<string | null>(
    initialMemberId ?? null
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState<"cash" | "qr" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setError(null);
      setSubmitting(null);
      setMemberId(initialMemberId ?? null);
    }
  }, [open, initialMemberId]);

  useEffect(() => {
    if (!open || !memberId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/take-payment/advance-dues?member_id=${encodeURIComponent(memberId)}`,
          { cache: "no-store" }
        );
        const body = (await res.json()) as Preview;
        if (!cancelled) setPreview(body);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load preview."
          );
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, memberId]);

  async function submit(method: "cash" | "card_qr") {
    if (!memberId || !preview?.eligible) return;
    setSubmitting(method === "cash" ? "cash" : "qr");
    setError(null);
    try {
      const res = await fetch("/api/admin/take-payment/advance-dues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          method,
          client_token: newClientToken(),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not start advance payment.");
        return;
      }
      const member = members.find((m) => m.id === memberId);
      if (method === "card_qr") {
        if (member && body.url && body.payment_id) {
          onQrReady(body as AdvanceDuesQrResult, member);
          onOpenChange(false);
        } else {
          setError("Missing checkout URL in response.");
        }
      } else {
        onCashRecorded(body as AdvanceDuesCashResult);
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSubmitting(null);
    }
  }

  const ineligible = preview && preview.eligible === false;
  const alreadyPrepaid = preview?.already_prepaid === true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Charge advance dues</DialogTitle>
          <DialogDescription>
            Take next year&apos;s dues from a member at the desk. Any
            advance discount your lodge has set will be applied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="advance-member">Member</Label>
            <Select
              value={memberId ?? ""}
              onValueChange={(v) => setMemberId(v || null)}
            >
              <SelectTrigger id="advance-member">
                <SelectValue placeholder="Pick a member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {previewLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Computing next-year amount&hellip;
            </div>
          ) : null}

          {ineligible ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-none" />
              <div>{preview?.message ?? "Member is not eligible."}</div>
            </div>
          ) : null}

          {alreadyPrepaid ? (
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-none" />
              <div>
                This member has already prepaid for {preview?.next_year_label}.
              </div>
            </div>
          ) : null}

          {preview?.eligible && !alreadyPrepaid ? (
            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <CalendarDays className="h-4 w-4" />
                {preview.next_year_label}
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Annual amount</dt>
                <dd className="text-right tabular-nums">
                  {(preview.base_amount ?? 0).toFixed(2)}{" "}
                  {(preview.currency ?? "GBP").toUpperCase()}
                </dd>
                {preview.discount_percent ? (
                  <>
                    <dt className="flex items-center gap-1 text-muted-foreground">
                      <PercentIcon className="h-3 w-3" />
                      Advance discount
                    </dt>
                    <dd className="text-right tabular-nums">
                      −{preview.discount_percent}%
                    </dd>
                  </>
                ) : null}
                <dt className="font-semibold text-foreground">Charge today</dt>
                <dd className="text-right text-base font-semibold tabular-nums">
                  £{(preview.charged_amount ?? 0).toFixed(2)}
                </dd>
              </dl>
              <div className="mt-1 text-[11px] text-muted-foreground">
                The member&apos;s next-year dues record will be created and
                marked paid as soon as the charge captures.
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="advance-amount-override">
              Override amount (optional)
            </Label>
            <Input
              id="advance-amount-override"
              type="number"
              min={0}
              step="0.01"
              placeholder="Leave blank to use the discounted amount above"
              disabled
            />
            <p className="text-[11px] text-muted-foreground">
              Coming soon — for now we always use the discounted amount.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => submit("cash")}
            disabled={
              !preview?.eligible ||
              alreadyPrepaid ||
              submitting !== null
            }
          >
            {submitting === "cash" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Banknote className="mr-2 h-4 w-4" />
            )}
            Record cash
          </Button>
          <Button
            onClick={() => submit("card_qr")}
            disabled={
              !preview?.eligible ||
              alreadyPrepaid ||
              submitting !== null
            }
          >
            {submitting === "qr" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <QrCode className="mr-2 h-4 w-4" />
            )}
            Show QR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
