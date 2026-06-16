import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { ReceiptClient } from "./receipt-client";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  if (!isSupabaseConfigured()) redirect("/member/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/member/login");

  const member =
    (await db.getMemberByAuthUserId(user.id)) ??
    (await db.getMemberByEmailAcrossMosques(user.email));
  if (!member) redirect("/member");

  const { type, id } = await params;
  if (type !== "payment" && type !== "donation" && type !== "giving") {
    notFound();
  }

  const mosque = await db.getMosqueById(member.mosque_id);

  if (type === "payment") {
    const payment = await db.getPaymentById(id, member.mosque_id);
    if (!payment || payment.user_email.toLowerCase() !== member.email.toLowerCase()) {
      notFound();
    }
    return (
      <ReceiptClient
        kind="payment"
        receipt={{
          id: payment.id,
          date: payment.completed_at ?? payment.created_at,
          status: payment.status,
          currency: payment.currency,
          total: payment.total_amount,
          lines: [
            { label: "Dining", amount: payment.dining_amount },
            { label: "Service fee", amount: payment.service_fee_amount },
            { label: "Charity collection", amount: payment.charity_amount },
            { label: "Raffle", amount: payment.raffle_amount },
            { label: "Guest ticket", amount: payment.guest_ticket_amount },
          ].filter((line) => line.amount > 0),
          notes: payment.charity_name ? `Charity: ${payment.charity_name}` : null,
          reference: payment.stripe_payment_intent_id ?? payment.id,
        }}
        member={{ full_name: member.full_name, email: member.email }}
        mosque={mosque ? { name: mosque.name, mosque_number: mosque.mosque_number, support_email: mosque.support_email } : null}
      />
    );
  }

  if (type === "donation") {
    const donation = await db.getDonationById(id, member.mosque_id);
    if (!donation || donation.donor_email.toLowerCase() !== member.email.toLowerCase()) {
      notFound();
    }
    return (
      <ReceiptClient
        kind="donation"
        receipt={{
          id: donation.id,
          date: donation.created_at,
          status: donation.status,
          currency: donation.currency,
          total: donation.amount,
          lines: [{ label: "Donation", amount: donation.amount }],
          notes:
            donation.gift_aid_status === "declared"
              ? "Gift Aid declaration on file."
              : null,
          reference: donation.id,
        }}
        member={{ full_name: member.full_name, email: member.email }}
        mosque={mosque ? { name: mosque.name, mosque_number: mosque.mosque_number, support_email: mosque.support_email } : null}
      />
    );
  }

  // giving
  const givingRecords = await db.getMemberGiving(member.mosque_id, {
    memberEmail: member.email,
  });
  const giving = givingRecords.find((d) => d.id === id);
  if (!giving) notFound();
  return (
    <ReceiptClient
      kind="giving"
      receipt={{
        id: giving.id,
        date: giving.paid_at ?? giving.updated_at,
        status: giving.status,
        currency: giving.currency,
        total: giving.amount,
        lines: [{ label: "Annual giving", amount: giving.amount }],
        notes: `Period ${giving.period_start} to ${giving.period_end}`,
        reference: giving.id,
      }}
      member={{ full_name: member.full_name, email: member.email }}
      mosque={mosque ? { name: mosque.name, mosque_number: mosque.mosque_number, support_email: mosque.support_email } : null}
    />
  );
}
