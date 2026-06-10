import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { GiftAidClient } from "./gift-aid-client";
import { isSuccessfulPaymentStatus } from "@/lib/reports";
import type { GiftAidDeclaration } from "@/lib/db/types";
import { eligibleDonationRows } from "@/lib/gift-aid/eligible";

export const dynamic = "force-dynamic";

export default async function GiftAidPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const churchId = ctx.mode === "database" ? ctx.churchId : null;

  const declarations = useMock
    ? mockDb.getGiftAidDeclarations()
    : churchId
      ? await db.getGiftAidDeclarations(churchId)
      : [];
  const donations = useMock || !churchId ? [] : await db.getDonations(churchId);
  const claims = useMock || !churchId
    ? []
    : await db.getGiftAidClaimBatches(churchId).catch(() => []);
  const declarationsByEmail = new Map(
    declarations
      .filter((d) => !("donor_address" in d))
      .map((d) => [d.donor_email.toLowerCase(), d as GiftAidDeclaration])
  );
  const declarationById = new Map(
    declarations
      .filter((d) => !("donor_address" in d))
      .map((d) => [d.id, d as GiftAidDeclaration])
  );
  // Roll donations up to a declaration by its explicit link OR by an email
  // match. Charity taken via take-payment / QR / cash (and rows backfilled
  // from historical charity payments) carry only the donor email -- the
  // declaration is matched at claim time -- so an id-only join would show
  // £0 against a donor who has in fact given. This mirrors the email match
  // the claim batcher and per-service close use, so the per-donor totals
  // agree with what is actually reclaimable.
  const donationsByDeclaration = new Map<
    string,
    { total: number; reclaimable: number }
  >();
  for (const donation of donations) {
    if (!isSuccessfulPaymentStatus(donation.status)) continue;
    const declaration = donation.gift_aid_declaration_id
      ? declarationById.get(donation.gift_aid_declaration_id)
      : declarationsByEmail.get(donation.donor_email.toLowerCase());
    if (!declaration) continue;
    const current = donationsByDeclaration.get(declaration.id) ?? {
      total: 0,
      reclaimable: 0,
    };
    current.total += donation.amount;
    if (donation.gift_aid_status !== "declined") {
      current.reclaimable += donation.amount * 0.25;
    }
    donationsByDeclaration.set(declaration.id, current);
  }

  const serialized = declarations.map((d) => {
    const isMock = "donor_address" in d;
    return {
      id: d.id,
      donor_name: d.donor_name,
      donor_email: d.donor_email,
      donor_address: isMock
        ? (d as unknown as { donor_address: string }).donor_address
        : [
            (d as GiftAidDeclaration).donor_address_line_1,
            (d as GiftAidDeclaration).donor_city,
            (d as GiftAidDeclaration).donor_postcode,
          ]
            .filter(Boolean)
            .join(", "),
      declaration_date: isMock
        ? (d as unknown as { declaration_date: string }).declaration_date
        : d.created_at,
      status: (isMock
        ? (d as unknown as { status: string }).status
        : (d as GiftAidDeclaration).revoked_at
          ? "revoked"
          : "active") as "active" | "expired" | "revoked",
      total_donations: isMock
        ? (d as unknown as { total_donations: number }).total_donations
        : (donationsByDeclaration.get(d.id)?.total ?? 0),
      reclaimable_amount: isMock
        ? (d as unknown as { reclaimable_amount: number }).reclaimable_amount
        : (d as GiftAidDeclaration).revoked_at
          ? 0
          : (donationsByDeclaration.get(d.id)?.reclaimable ?? 0),
      created_at: d.created_at,
    };
  });

  const eligibleRows = eligibleDonationRows(
    donations,
    declarations.filter((d) => !("donor_address" in d)) as GiftAidDeclaration[],
  ).map((donation) => {
      const declaration = donation.gift_aid_declaration_id
        ? declarationById.get(donation.gift_aid_declaration_id)
        : declarationsByEmail.get(donation.donor_email.toLowerCase());
      return {
        id: donation.id,
        donor_name: donation.donor_name ?? "Anonymous",
        donor_email: donation.donor_email,
        donor_address_line_1: declaration?.donor_address_line_1 ?? "",
        donor_postcode: declaration?.donor_postcode ?? "",
        declaration_date: declaration?.created_at ?? "",
        donation_date: donation.created_at,
        source: donation.source,
        amount: donation.amount,
        eligible_amount: donation.eligible_amount,
        reclaimable_amount: donation.eligible_amount * 0.25,
      };
    });

  return (
    <GiftAidClient
      declarations={JSON.parse(JSON.stringify(serialized))}
      eligibleRows={JSON.parse(JSON.stringify(eligibleRows))}
      claims={JSON.parse(JSON.stringify(claims))}
    />
  );
}
