// Small format/utility functions used across the take-payment tabs. Kept
// pure so they can be unit-tested in isolation if needed.

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
      minimumFractionDigits: 2,
    }).format(minor / 100);
  } catch {
    return `£${(minor / 100).toFixed(2)}`;
  }
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export function humanizeFailureReason(reason: string | null | undefined): string {
  if (!reason) return "The payer cancelled or the card was declined.";
  switch (reason) {
    case "cancelled_by_admin":
      return "Cancelled by admin.";
    case "cash_voided_by_admin":
      return "Voided by admin.";
    case "unexpected_error":
      return "Something went wrong when creating the payment session.";
    case "merchant_setup_required":
      return "Mosque payment processor needs setup.";
    default:
      return reason.replace(/_/g, " ");
  }
}

// Lightweight uuid for idempotency tokens. We deliberately don't import a
// uuid library for this one call site — crypto.randomUUID is available on
// every modern browser this app targets and on Node 19+.
export function newClientToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Extremely unlikely fallback (very old browsers); good enough for our
  // collision-with-itself dedup window.
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
