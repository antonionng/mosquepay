import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { GiftAidClient } from "./gift-aid-client";
import { isSuccessfulPaymentStatus } from "@/lib/reports";

export default async function GiftAidPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;

  const declarations = useMock
    ? mockDb.getGiftAidDeclarations()
    : lodgeId
      ? await db.getGiftAidDeclarations(lodgeId)
      : [];
  const donations = useMock || !lodgeId ? [] : await db.getDonations(lodgeId);
  const donationsByDeclaration = new Map<
    string,
    { total: number; reclaimable: number }
  >();
  for (const donation of donations) {
    if (!donation.gift_aid_declaration_id) continue;
    if (!isSuccessfulPaymentStatus(donation.status)) continue;
    const current =
      donationsByDeclaration.get(donation.gift_aid_declaration_id) ?? {
        total: 0,
        reclaimable: 0,
      };
    current.total += donation.amount;
    if (donation.gift_aid_status !== "declined") {
      current.reclaimable += donation.amount * 0.25;
    }
    donationsByDeclaration.set(donation.gift_aid_declaration_id, current);
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
            (d as db.GiftAidDeclaration).donor_address_line_1,
            (d as db.GiftAidDeclaration).donor_city,
            (d as db.GiftAidDeclaration).donor_postcode,
          ]
            .filter(Boolean)
            .join(", "),
      declaration_date: isMock
        ? (d as unknown as { declaration_date: string }).declaration_date
        : d.created_at,
      status: (isMock
        ? (d as unknown as { status: string }).status
        : (d as db.GiftAidDeclaration).revoked_at
          ? "revoked"
          : "active") as "active" | "expired" | "revoked",
      total_donations: isMock
        ? (d as unknown as { total_donations: number }).total_donations
        : (donationsByDeclaration.get(d.id)?.total ?? 0),
      reclaimable_amount: isMock
        ? (d as unknown as { reclaimable_amount: number }).reclaimable_amount
        : (d as db.GiftAidDeclaration).revoked_at
          ? 0
          : (donationsByDeclaration.get(d.id)?.reclaimable ?? 0),
      created_at: d.created_at,
    };
  });

  return <GiftAidClient declarations={JSON.parse(JSON.stringify(serialized))} />;
}
