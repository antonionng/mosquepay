// Shared "what's eligible for Gift Aid right now" computation. Pulled out
// of `app/api/gift-aid/claims/route.ts` so the per-service close endpoint
// can apply the same join + status rules.

import type { Donation, GiftAidDeclaration } from "@/lib/db/types";
import { isSuccessfulPaymentStatus } from "@/lib/reports";

export type EligibleDonationRow = Donation & {
  eligible_amount: number;
};

export function eligibleDonationRows(
  donations: Donation[],
  declarations: GiftAidDeclaration[],
): EligibleDonationRow[] {
  // Index declarations by lowercased email so a donation can match a
  // declaration that was filed under a slightly differently cased address.
  // Only include declarations that are confirmed, HMRC-eligible, and not
  // revoked at lookup time.
  const declarationByEmail = new Map(
    declarations
      .filter(
        (declaration) =>
          !declaration.revoked_at &&
          declaration.declaration_confirmed &&
          declaration.hmrc_eligible,
      )
      .map((declaration) => [
        declaration.donor_email.toLowerCase(),
        declaration,
      ]),
  );

  return donations
    .filter((donation) => isSuccessfulPaymentStatus(donation.status))
    .filter((donation) => donation.gift_aid_status !== "declined")
    .filter((donation) => !donation.gift_aid_claim_batch_id)
    .map((donation) => {
      // Prefer the explicit declaration linkage, fall back to email match.
      // This is how we pick up the case where a paper declaration was
      // captured AFTER the donation row was projected.
      const declaration = donation.gift_aid_declaration_id
        ? declarations.find(
            (item) => item.id === donation.gift_aid_declaration_id,
          )
        : declarationByEmail.get(donation.donor_email.toLowerCase());
      const declared =
        donation.gift_aid_status === "declared" ||
        Boolean(declaration && !declaration.revoked_at);
      const eligibleAmount =
        donation.gift_aid_eligible_amount &&
        donation.gift_aid_eligible_amount > 0
          ? donation.gift_aid_eligible_amount
          : declared
            ? donation.amount
            : 0;
      return {
        ...donation,
        gift_aid_declaration_id:
          declaration?.id ?? donation.gift_aid_declaration_id,
        eligible_amount: eligibleAmount,
      };
    })
    .filter((donation) => donation.eligible_amount > 0);
}
