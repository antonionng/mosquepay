"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Copy,
  HeartHandshake,
  Loader2,
  ScanLine,
  User,
  UserPlus,
  UserX,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DerivedStatusPill } from "./derived-status-pill";
import { formatMoney, humanizeFailureReason } from "./helpers";
import type { HistoryItem } from "./types";

// One row of the history feed. Renders QR + cash entries with the right
// action affordances:
//   * Open QR  -> Show / Copy link / Cancel
//   * Paid QR  -> Copy link (still useful for receipts)
//   * Cash     -> Void (in window)
//   * Voided   -> show reason, no actions

export function HistoryRow({
  item,
  onReopen,
  onCancel,
  cancelling,
  focused,
}: {
  item: HistoryItem;
  onReopen: () => void;
  onCancel: () => void;
  cancelling: boolean;
  focused?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!item.hosted_url) return;
    try {
      await navigator.clipboard.writeText(item.hosted_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [item.hosted_url]);

  const amountLabel = formatMoney(item.amount_minor, item.currency);
  const created = new Date(item.created_at);
  const isCash = item.method === "cash";
  const MethodIcon = isCash ? Banknote : ScanLine;
  const methodLabel = isCash ? "Cash" : "QR";

  return (
    <li
      data-payment-id={item.payment_id}
      className={cn(
        "grid gap-3 px-4 py-4 transition-colors sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4 sm:px-5",
        focused && "bg-blue-50/60",
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold tabular-nums text-slate-900">
            {amountLabel}
          </span>
          <Badge
            variant={isCash ? "secondary" : "outline"}
            className="gap-1 border-slate-300"
          >
            <MethodIcon className="h-3 w-3" />
            {methodLabel}
          </Badge>
          <DerivedStatusPill status={item.derived_status} />
          {item.category && item.category !== "general" ? (
            <Badge variant="outline" className="border-slate-300 capitalize">
              {item.category.replace(/_/g, " ")}
            </Badge>
          ) : null}
          {item.gift_aid_eligible && !item.voided ? (
            <Badge variant="success" className="gap-1">
              <HeartHandshake className="h-3 w-3" />
              Gift Aid
            </Badge>
          ) : null}
        </div>
        {(item.description || item.reference) && (
          <p className="truncate text-sm text-slate-600">
            {item.description || item.reference}
          </p>
        )}
        {item.note ? (
          <p className="truncate text-xs italic text-slate-500">{item.note}</p>
        ) : null}
        <p className="text-xs text-slate-500">
          {created.toLocaleString("en-GB")}
          {item.created_by_email ? ` · by ${item.created_by_email}` : ""}
        </p>
        {item.member_name ? (
          // Guest deep-link if we attributed to a guest record; member deep
          // link otherwise. The detail page exists at /admin/guests/<id>
          // and /admin/members/<id>; both pages are payments:read-safe so
          // the treasurer can drill in without leaving their session.
          item.guest_id ? (
            <Link
              href={`/admin/guests/${item.guest_id}`}
              className="flex items-center gap-1 text-xs text-sky-700 hover:text-sky-900 hover:underline"
            >
              <UserPlus className="h-3 w-3" />
              {item.member_name}
              {item.member_email ? ` (${item.member_email})` : ""}
            </Link>
          ) : item.member_id ? (
            <Link
              href={`/admin/members/${item.member_id}`}
              className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 hover:underline"
            >
              <User className="h-3 w-3" />
              {item.member_name}
              {item.member_email ? ` (${item.member_email})` : ""}
            </Link>
          ) : (
            <p className="flex items-center gap-1 text-xs text-slate-700">
              <User className="h-3 w-3" />
              For {item.member_name}
              {item.member_email ? ` (${item.member_email})` : ""}
            </p>
          )
        ) : (
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <UserX className="h-3 w-3" />
            Guest payment
          </p>
        )}
        {item.derived_status === "paid" &&
        (item.paid_by_name || item.paid_by_email) &&
        !item.member_name ? (
          <p className="text-xs text-emerald-700">
            Paid by {item.paid_by_name ?? item.paid_by_email}
            {item.paid_at
              ? ` · ${new Date(item.paid_at).toLocaleString("en-GB")}`
              : ""}
          </p>
        ) : null}
        {item.derived_status === "paid" && item.paid_at ? (
          <p className="text-xs text-emerald-700">
            Captured {new Date(item.paid_at).toLocaleString("en-GB")}
          </p>
        ) : null}
        {item.derived_status === "voided" ? (
          <p className="text-xs text-slate-600">
            {item.voided_reason
              ? `Voided · ${humanizeFailureReason(item.voided_reason.replace(/^cash_voided_by_admin:?\s*/, "") || "cash_voided_by_admin")}`
              : "Voided by admin."}
          </p>
        ) : null}
        {item.derived_status === "failed" && item.failure_reason ? (
          <p className="text-xs text-red-700">
            {humanizeFailureReason(item.failure_reason)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
        {item.derived_status === "open" && item.hosted_url ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onReopen}
          >
            Show QR
          </Button>
        ) : null}
        {item.hosted_url ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            aria-label="Copy link"
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            {copied ? "Copied" : "Link"}
          </Button>
        ) : null}
        {(item.derived_status === "open" ||
          (isCash && item.derived_status === "paid")) ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={cancelling}
            aria-label={isCash ? "Void this cash entry" : "Cancel this QR"}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            {cancelling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <XCircle className="mr-1 h-3.5 w-3.5" />
                {isCash ? "Void" : "Cancel"}
              </>
            )}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
