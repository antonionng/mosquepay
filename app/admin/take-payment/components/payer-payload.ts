// Shared serialisation for the payer state.
//
// Both Charge and Cash tabs POST the same payer fields (member_id /
// guest_id / guest_inline). Centralising the mapping keeps the two endpoints
// in lockstep and prevents drift if we add more payer kinds later.

import type { PayerSelection } from "./types";

export type PayerPayload = {
  member_id?: string | null;
  guest_id?: string | null;
  guest_inline?: {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    mother_lodge_name?: string | null;
    mother_lodge_number?: string | null;
  } | null;
};

export function buildPayerPayload(payer: PayerSelection): PayerPayload {
  switch (payer.kind) {
    case "member":
      return { member_id: payer.member.id };
    case "guest":
      return { guest_id: payer.guest.id };
    case "guest_inline":
      return {
        guest_inline: {
          full_name: payer.draft.full_name,
          email: payer.draft.email,
          phone: payer.draft.phone,
          mother_lodge_name: payer.draft.mother_lodge_name,
          mother_lodge_number: payer.draft.mother_lodge_number,
        },
      };
    case "anonymous":
    default:
      return {};
  }
}

// A payer is "selected" when it's attributable: an existing member, an
// existing guest, or an inline guest with at least a name typed in. Anonymous
// (and a blank inline draft) is rejected so every take-payment row lands with
// a name attached instead of showing up as "Not recorded" in the ledger.
export function isPayerSelected(payer: PayerSelection): boolean {
  switch (payer.kind) {
    case "member":
      return true;
    case "guest":
      return true;
    case "guest_inline":
      return payer.draft.full_name.trim().length > 0;
    case "anonymous":
    default:
      return false;
  }
}

export function displayPayerName(payer: PayerSelection): string | null {
  switch (payer.kind) {
    case "member":
      return payer.member.full_name;
    case "guest":
      return payer.guest.full_name;
    case "guest_inline":
      return payer.draft.full_name;
    case "anonymous":
    default:
      return null;
  }
}
