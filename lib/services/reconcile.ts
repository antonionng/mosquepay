// Shared service financial reconciliation. One source of truth so the
// service page, the reconcile panel, the printable treasurer report, and any
// export all show identical figures.
//
// Rules that matter for reconciliation:
//   - Only "collected" money counts as income (succeeded / completed / paid).
//     Pending (in-flight QR / unsettled) is surfaced separately, never added
//     to the headline. Refunded / reversed never counts as income.
//   - Amounts are net of refunds at the row level for the collected total,
//     while per-bucket figures are gross (clamped so a refund can't push a
//     bucket negative).
//   - Raffle is reported in *strips* (a £10 payment at £5/strip = 2 strips).

// Structural input so both the full `Payment` row (server) and the narrower
// client-side payment entry satisfy it without coupling to the DB type.
export type ReconcilePaymentInput = {
  id: string;
  user_email?: string | null;
  user_name?: string | null;
  status: string;
  payment_method?: string | null;
  total_amount: number;
  refund_amount?: number | null;
  service_fee_amount?: number | null;
  dining_amount?: number | null;
  guest_ticket_amount?: number | null;
  charity_amount?: number | null;
  raffle_amount?: number | null;
  mooov_payment_id?: string | null;
  stripe_payment_intent_id?: string | null;
  recorded_by_email?: string | null;
  created_at: string;
};

export type PaymentMethodGroup = "cash" | "churchpay" | "other";

export function isCollectedStatus(status: string): boolean {
  return status === "succeeded" || status === "completed" || status === "paid";
}

export function isReversedStatus(status: string): boolean {
  return (
    status === "refunded" ||
    status === "partially_refunded" ||
    status === "voided" ||
    status === "cancelled" ||
    status === "canceled"
  );
}

// Map a raw payment_method onto the three buckets a treasurer reconciles:
// physical cash, ChurchPay (Mooov card / QR / online), and everything else
// (cheque, BACS, legacy). A null method is historically an online card row.
export function methodGroup(
  method: string | null | undefined,
): PaymentMethodGroup {
  if (method === "cash") return "cash";
  if (method === "card_qr" || method === "card_online" || method == null)
    return "churchpay";
  return "other";
}

export const METHOD_GROUP_LABEL: Record<PaymentMethodGroup, string> = {
  cash: "Cash",
  churchpay: "ChurchPay (card)",
  other: "Cheque / BACS",
};

export type CategoryKey =
  | "service_fee"
  | "dining"
  | "guest_ticket"
  | "charity"
  | "raffle"
  | "general";

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  service_fee: "Service fee",
  dining: "Dining",
  guest_ticket: "Guest tickets",
  charity: "Charity",
  raffle: "Raffle",
  general: "General / other",
};

export type MethodTotal = { amount: number; count: number };

export type ReconciledPayer = {
  id: string;
  name: string;
  email: string;
  method: PaymentMethodGroup;
  methodRaw: string | null;
  total: number;
  service_fee: number;
  dining: number;
  guest_ticket: number;
  charity: number;
  raffle: number;
  general: number;
  raffleStrips: number;
  reference: string | null;
  created_at: string;
  recorded_by: string | null;
};

export type ServiceReconciliation = {
  rafflePrice: number;
  // Income actually collected (net of refunds), and how it split by method.
  collectedTotal: number;
  collectedCount: number;
  byMethod: Record<PaymentMethodGroup, MethodTotal>;
  // Gross per-category income (collected only).
  byCategory: Record<CategoryKey, number>;
  raffleStrips: number;
  raffleBuyers: number;
  charityTotal: number;
  // 25% of charity is the rough Gift Aid headline; the authoritative figure
  // comes from declared donations, but this is a useful at-a-glance estimate.
  charityCashTotal: number;
  // Pending and refunded, reported alongside but never in the headline.
  pendingTotal: number;
  pendingCount: number;
  refundedTotal: number;
  refundedCount: number;
  payers: ReconciledPayer[];
};

export function stripsFor(amount: number, rafflePrice: number): number {
  return rafflePrice > 0 ? Math.round((amount ?? 0) / rafflePrice) : 0;
}

function emptyMethodTotals(): Record<PaymentMethodGroup, MethodTotal> {
  return {
    cash: { amount: 0, count: 0 },
    churchpay: { amount: 0, count: 0 },
    other: { amount: 0, count: 0 },
  };
}

function emptyCategoryTotals(): Record<CategoryKey, number> {
  return {
    service_fee: 0,
    dining: 0,
    guest_ticket: 0,
    charity: 0,
    raffle: 0,
    general: 0,
  };
}

export function reconcileService(
  payments: ReconcilePaymentInput[],
  options?: { rafflePrice?: number },
): ServiceReconciliation {
  const rafflePrice = options?.rafflePrice ?? 5;
  const byMethod = emptyMethodTotals();
  const byCategory = emptyCategoryTotals();
  const payers: ReconciledPayer[] = [];

  let collectedTotal = 0;
  let collectedCount = 0;
  let raffleStrips = 0;
  let raffleBuyers = 0;
  let charityTotal = 0;
  let charityCashTotal = 0;
  let pendingTotal = 0;
  let pendingCount = 0;
  let refundedTotal = 0;
  let refundedCount = 0;

  for (const p of payments) {
    const status = p.status;
    if (isReversedStatus(status)) {
      refundedTotal += Number(p.refund_amount ?? 0) || Number(p.total_amount ?? 0);
      refundedCount += 1;
      continue;
    }
    if (status === "pending") {
      pendingTotal += Number(p.total_amount ?? 0);
      pendingCount += 1;
      continue;
    }
    if (!isCollectedStatus(status)) continue;

    const serviceFee = Number(p.service_fee_amount ?? 0);
    const dining = Number(p.dining_amount ?? 0);
    const guestTicket = Number(p.guest_ticket_amount ?? 0);
    const charity = Number(p.charity_amount ?? 0);
    const raffle = Number(p.raffle_amount ?? 0);
    const net = Math.max(0, Number(p.total_amount ?? 0) - Number(p.refund_amount ?? 0));
    const general = Math.max(
      0,
      net - serviceFee - dining - guestTicket - charity - raffle,
    );
    const group = methodGroup(p.payment_method);
    const strips = raffle > 0 ? stripsFor(raffle, rafflePrice) : 0;

    collectedTotal += net;
    collectedCount += 1;
    byMethod[group].amount += net;
    byMethod[group].count += 1;
    byCategory.service_fee += serviceFee;
    byCategory.dining += dining;
    byCategory.guest_ticket += guestTicket;
    byCategory.charity += charity;
    byCategory.raffle += raffle;
    byCategory.general += general;
    charityTotal += charity;
    if (charity > 0 && group === "cash") charityCashTotal += charity;
    if (raffle > 0) {
      raffleStrips += strips;
      raffleBuyers += 1;
    }

    payers.push({
      id: p.id,
      name: p.user_name ?? "",
      email: p.user_email ?? "",
      method: group,
      methodRaw: p.payment_method ?? null,
      total: net,
      service_fee: serviceFee,
      dining,
      guest_ticket: guestTicket,
      charity,
      raffle,
      general,
      raffleStrips: strips,
      reference: p.mooov_payment_id ?? p.stripe_payment_intent_id ?? null,
      created_at: p.created_at,
      recorded_by: p.recorded_by_email ?? null,
    });
  }

  payers.sort((a, b) => a.created_at.localeCompare(b.created_at));

  return {
    rafflePrice,
    collectedTotal,
    collectedCount,
    byMethod,
    byCategory,
    raffleStrips,
    raffleBuyers,
    charityTotal,
    charityCashTotal,
    pendingTotal,
    pendingCount,
    refundedTotal,
    refundedCount,
    payers,
  };
}
