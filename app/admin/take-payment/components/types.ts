// Types shared between the take-payment tabs.
//
// Kept in one file so the per-component files stay focused on UI. The
// HistoryItem mirrors the API response from /api/admin/take-payment/history.

export type MemberOption = {
  id: string;
  full_name: string;
  email: string | null;
};

// Light-weight event option for the optional "Link to service" picker.
// Loaded by the take-payment page (eu90d horizon, small list) so the
// charge/cash forms can attribute the payment to a specific service.
export type EventOption = {
  id: string;
  title: string;
  event_date: string;
};

export type GuestOption = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  mother_mosque_name: string | null;
  mother_mosque_number: string | null;
};

export type GuestInlineDraft = {
  full_name: string;
  email: string | null;
  phone: string | null;
  mother_mosque_name: string | null;
  mother_mosque_number: string | null;
};

// Discriminated union for the payer selection. The take-payment shell owns
// the active selection and passes it down to both Charge and Cash tabs; each
// tab posts the correct payload shape to its respective endpoint.
//   - "anonymous": no attribution (default).
//   - "member": existing Mosquepay member from the members list.
//   - "guest": existing guest from the guest directory.
//   - "guest_inline": a brand-new guest typed inline; the server will find-
//                     or-create on the guests table when the payment lands.
export type PayerSelection =
  | { kind: "anonymous" }
  | { kind: "member"; member: MemberOption }
  | { kind: "guest"; guest: GuestOption }
  | { kind: "guest_inline"; draft: GuestInlineDraft };

export type StatusPhase = "pending" | "awaiting_payment" | "succeeded" | "failed";

export type StatusResponse = {
  payment_id: string;
  phase: StatusPhase;
  raw_status: string;
  amount_minor: number;
  currency: string;
  failure_reason: string | null;
  projected: {
    /** LP-side payments.id (NOT the mooov payment_id). Used for downstream
     *  calls like /api/admin/take-payment/[id]/gift-aid-attach. */
    id: string;
    total: number;
    refunded_total: number;
    completed_at: string | null;
    charity_amount: number;
    category: string | null;
    user_name: string | null;
    user_email: string | null;
    user_id: string | null;
  } | null;
  /** True when a donation row exists with a non-null gift_aid_declaration_id. */
  gift_aid_eligible: boolean;
  gift_aid_declaration_id: string | null;
};

export type MintResponse =
  | {
      url: string;
      payment_id: string;
      amount: number;
      currency: string;
      gift_aid_eligible?: boolean;
      gift_aid_declaration_id?: string | null;
    }
  | { error: string; code?: string };

export type CashResponse =
  | {
      payment_id: string;
      ledger_payment_id: string;
      donation_id: string | null;
      amount: number;
      currency: string;
      payer_name?: string | null;
      payer_email?: string | null;
      member_name?: string | null;
      gift_aid_eligible: boolean;
      idempotent?: boolean;
    }
  | { error: string };

export type HistoryDerived =
  | "paid"
  | "open"
  | "expired"
  | "cancelled"
  | "failed"
  | "voided";

export type HistoryMethod = "card_qr" | "cash";

export type HistoryItem = {
  payment_id: string;
  amount_minor: number;
  currency: string;
  raw_status: string;
  derived_status: HistoryDerived;
  method: HistoryMethod;
  voided: boolean;
  voided_reason: string | null;
  failure_reason: string | null;
  created_at: string;
  captured_at: string | null;
  refunded_at: string | null;
  category: string | null;
  reference: string | null;
  description: string | null;
  note: string | null;
  hosted_url: string | null;
  created_by_email: string | null;
  member_id: string | null;
  member_name: string | null;
  member_email: string | null;
  guest_id: string | null;
  gift_aid_eligible: boolean;
  gift_aid_declaration_id: string | null;
  paid_by_name: string | null;
  paid_by_email: string | null;
  paid_total: number | null;
  paid_at: string | null;
  payment_method: string | null;
};

/**
 * Categories shown in the take-payment "Extras" picker.
 *
 * `giftAidable` marks the lines HMRC will accept as donations under the
 * Gift Aid scheme. Dining and raffle tickets are explicitly NOT eligible
 * (they're "benefits in return" under HMRC rules); service fees and
 * subscriptions are member giving, not donations. `explainer` is the
 * one-line note shown under the dropdown so the treasurer sees why.
 */
export const CATEGORIES = [
  {
    id: "general",
    label: "General mosque payment",
    giftAidable: false,
    explainer:
      "General mosque income (admin, miscellaneous). Not a charitable donation.",
  },
  {
    id: "service_fee",
    label: "Service fee",
    giftAidable: false,
    explainer: "Per-service giving. Member receives a benefit, not Gift Aid eligible.",
  },
  {
    id: "guest_ticket",
    label: "Guest ticket",
    giftAidable: false,
    explainer: "Guest pays for attendance/dining. Not a donation under HMRC rules.",
  },
  {
    id: "dining",
    label: "Dining / community meal",
    giftAidable: false,
    explainer: "Dining is a benefit in return, so not eligible for Gift Aid.",
  },
  {
    id: "charity",
    label: "Charity collection",
    giftAidable: true,
    explainer:
      "Voluntary donation to a registered Mosque charity. Eligible for Gift Aid with a declaration.",
  },
  {
    id: "raffle",
    label: "Raffle ticket strips",
    giftAidable: false,
    explainer:
      "Raffle entries are a payment for a chance to win, so HMRC excludes them from Gift Aid.",
  },
  {
    id: "subscriptions",
    label: "Subscriptions / giving top-up",
    giftAidable: false,
    explainer: "Subscriptions are member giving, not donations.",
  },
  {
    id: "other",
    label: "Other",
    giftAidable: false,
    explainer: "Use a more specific category if you want this to count towards Gift Aid.",
  },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

// One row in the optional "split across categories" basket. `amount` is held
// as the raw string the operator typed (pounds) so the input stays controlled
// and we don't fight the keyboard; it's coerced to a number at submit time.
export type LineItemDraft = {
  id: string;
  category: CategoryId;
  amount: string;
};

// Sum of the valid (amount > 0) line items, in pounds.
export function lineItemsTotalMajor(items: LineItemDraft[]): number {
  const total = items.reduce((sum, it) => {
    const n = Number(it.amount);
    return Number.isFinite(n) && n > 0 ? sum + n : sum;
  }, 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

// Items that carry a usable amount. Used for validation + payload building so
// a half-typed blank row never blocks the submit or reaches the server.
export function validLineItems(items: LineItemDraft[]): LineItemDraft[] {
  return items.filter((it) => {
    const n = Number(it.amount);
    return Number.isFinite(n) && n > 0;
  });
}

// Serialise the basket for the take-payment / cash endpoints.
export function buildLineItemsPayload(
  items: LineItemDraft[],
): { category: CategoryId; amount: number }[] {
  return validLineItems(items).map((it) => ({
    category: it.category,
    amount: Math.round(Number(it.amount) * 100) / 100,
  }));
}

// Whether a payment should be treated as Gift-Aidable for the on-screen nudge:
// either the single category is giftAidable, or the basket has a charity line.
export function selectionIsGiftAidable(
  category: CategoryId | "mixed",
  lineItems?: ReadonlyArray<{ category: string }> | null,
): boolean {
  if (lineItems && lineItems.length > 0) {
    return lineItems.some((li) => li.category === "charity");
  }
  return Boolean(CATEGORY_BY_ID[category as CategoryId]?.giftAidable);
}

export function newLineItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export const CATEGORY_BY_ID: Record<
  CategoryId,
  (typeof CATEGORIES)[number]
> = CATEGORIES.reduce(
  (acc, cat) => {
    acc[cat.id] = cat;
    return acc;
  },
  {} as Record<CategoryId, (typeof CATEGORIES)[number]>,
);

export const PRESET_AMOUNTS = [1, 2, 5, 10, 20, 50, 100] as const;

export type TabId = "charge" | "cash" | "history";
