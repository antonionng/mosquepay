// Types shared between the take-payment tabs.
//
// Kept in one file so the per-component files stay focused on UI. The
// HistoryItem mirrors the API response from /api/admin/take-payment/history.

export type MemberOption = {
  id: string;
  full_name: string;
  email: string | null;
};

// Light-weight event option for the optional "Link to meeting" picker.
// Loaded by the take-payment page (eu90d horizon, small list) so the
// charge/cash forms can attribute the payment to a specific meeting.
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
  mother_lodge_name: string | null;
  mother_lodge_number: string | null;
};

export type GuestInlineDraft = {
  full_name: string;
  email: string | null;
  phone: string | null;
  mother_lodge_name: string | null;
  mother_lodge_number: string | null;
};

// Discriminated union for the payer selection. The take-payment shell owns
// the active selection and passes it down to both Charge and Cash tabs; each
// tab posts the correct payload shape to its respective endpoint.
//   - "anonymous": no attribution (default).
//   - "member": existing Lodgepay member from the members list.
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
    id: string;
    total: number;
    refunded_total: number;
    completed_at: string | null;
  } | null;
};

export type MintResponse =
  | {
      url: string;
      payment_id: string;
      amount: number;
      currency: string;
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

export const CATEGORIES = [
  { id: "general", label: "General lodge payment" },
  { id: "meeting_fee", label: "Meeting fee" },
  { id: "guest_ticket", label: "Guest ticket" },
  { id: "dining", label: "Dining / festive board" },
  { id: "charity", label: "Charity collection" },
  { id: "raffle", label: "Raffle ticket strips" },
  { id: "subscriptions", label: "Subscriptions / dues top-up" },
  { id: "other", label: "Other" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const PRESET_AMOUNTS = [1, 2, 5, 10, 20, 50, 100] as const;

export type TabId = "charge" | "cash" | "history";
