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
  | "meeting_fee"
  | "guest_ticket"
  | "subscriptions"
  | "other";

export type Splits = {
  dining_amount: number;
  charity_amount: number;
  raffle_amount: number;
  meeting_fee_amount: number;
  guest_ticket_amount: number;
};

const ZERO: Splits = {
  dining_amount: 0,
  charity_amount: 0,
  raffle_amount: 0,
  meeting_fee_amount: 0,
  guest_ticket_amount: 0,
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
    case "meeting_fee":
      return { ...ZERO, meeting_fee_amount: amountMajor };
    case "guest_ticket":
      return { ...ZERO, guest_ticket_amount: amountMajor };
    // general / subscriptions / other / unknown all stay in total_amount only;
    // the projected row is still created with sub-amounts=0 so the
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

// A single line on an itemised take-payment (e.g. "raffle £5", "charity £10").
// amount is in major units (pounds) to match splitAmountByCategory.
export type LineItemInput = {
  category: string | null | undefined;
  amount: number;
};

// Aggregate a basket of line items into the public.payments sub-amount split.
// Each item is classified independently via splitAmountByCategory and summed,
// so one payment can credit raffle + charity + dining at once. Items with a
// non-positive or non-finite amount are skipped. This is the multi-line
// equivalent of splitAmountByCategory and the single source of truth for how
// an itemised payment lands on the ledger.
export function splitAmountByLineItems(items: LineItemInput[]): Splits {
  const out: Splits = { ...ZERO };
  for (const item of items) {
    const part = splitAmountByCategory(item.amount, item.category);
    out.dining_amount += part.dining_amount;
    out.charity_amount += part.charity_amount;
    out.raffle_amount += part.raffle_amount;
    out.meeting_fee_amount += part.meeting_fee_amount;
    out.guest_ticket_amount += part.guest_ticket_amount;
  }
  // Guard against floating point drift from repeated addition (e.g.
  // 0.1 + 0.2) so the projected sub-totals stay clean to the penny.
  return {
    dining_amount: round2(out.dining_amount),
    charity_amount: round2(out.charity_amount),
    raffle_amount: round2(out.raffle_amount),
    meeting_fee_amount: round2(out.meeting_fee_amount),
    guest_ticket_amount: round2(out.guest_ticket_amount),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
