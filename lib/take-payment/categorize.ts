// Category → public.payments sub-amount split.
//
// The take-payment flow lets the treasurer tag a QR or cash entry with a
// category (charity / dining / raffle / …). The projected public.payments
// row keeps the full amount in `total_amount` AND promotes one of the
// dining_amount / charity_amount / raffle_amount sub-totals so existing
// dashboards (treasurer reports, charity rollups, GA reclaims) classify the
// row correctly without needing a join on the attempt's metadata.
//
// This module is the single source of truth for that mapping. It's pure and
// trivially testable, called by both the Mooov webhook projector (card_qr)
// and the cash endpoint (cash). Keep new categories in lockstep with the
// CATEGORIES list in the take-payment-client and the charity_name lookup
// below; everything else should rely on these helpers.

export type TakePaymentCategory =
  | "general"
  | "charity"
  | "raffle"
  | "dining"
  | "subscriptions"
  | "other";

export type Splits = {
  dining_amount: number;
  charity_amount: number;
  raffle_amount: number;
};

const ZERO: Splits = {
  dining_amount: 0,
  charity_amount: 0,
  raffle_amount: 0,
};

export function splitAmountByCategory(
  amountMajor: number,
  category: string | null | undefined,
): Splits {
  if (!Number.isFinite(amountMajor) || amountMajor <= 0) return { ...ZERO };
  switch (category) {
    case "charity":
      return { ...ZERO, charity_amount: amountMajor };
    case "dining":
      return { ...ZERO, dining_amount: amountMajor };
    case "raffle":
      return { ...ZERO, raffle_amount: amountMajor };
    // general / subscriptions / other / unknown all stay in total_amount only;
    // the projected row is still created with charity/dining/raffle=0 so the
    // treasurer ledger shows the row by description without misclassifying it.
    default:
      return { ...ZERO };
  }
}

export function isCharityCategory(
  category: string | null | undefined,
): boolean {
  return category === "charity";
}
