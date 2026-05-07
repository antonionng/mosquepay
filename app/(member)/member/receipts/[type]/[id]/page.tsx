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
    (await db.getMemberByEmailAcrossLodges(user.email));
  if (!member) redirect("/member");

  const { type, id } = await params;
  if (type !== "payment" && type !== "donation" && type !== "dues") {
    notFound();
  }

  const lodge = await db.getLodgeById(member.lodge_id);

  if (type === "payment") {
    const payment = await db.getPaymentById(id, member.lodge_id);
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
            { label: "Meeting fee", amount: payment.meeting_fee_amount },
            { label: "Charity collection", amount: payment.charity_amount },
            { label: "Raffle", amount: payment.raffle_amount },
            { label: "Guest ticket", amount: payment.guest_ticket_amount },
          ].filter((line) => line.amount > 0),
          notes: payment.charity_name ? `Charity: ${payment.charity_name}` : null,
          reference: payment.stripe_payment_intent_id ?? payment.id,
        }}
        member={{ full_name: member.full_name, email: member.email }}
        lodge={lodge ? { name: lodge.name, lodge_number: lodge.lodge_number, support_email: lodge.support_email } : null}
      />
    );
  }

  if (type === "donation") {
    const donation = await db.getDonationById(id, member.lodge_id);
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
        lodge={lodge ? { name: lodge.name, lodge_number: lodge.lodge_number, support_email: lodge.support_email } : null}
      />
    );
  }

  // dues
  const duesRecords = await db.getMemberDues(member.lodge_id, {
    memberEmail: member.email,
  });
  const dues = duesRecords.find((d) => d.id === id);
  if (!dues) notFound();
  return (
    <ReceiptClient
      kind="dues"
      receipt={{
        id: dues.id,
        date: dues.paid_at ?? dues.updated_at,
        status: dues.status,
        currency: dues.currency,
        total: dues.amount,
        lines: [{ label: "Annual dues", amount: dues.amount }],
        notes: `Period ${dues.period_start} to ${dues.period_end}`,
        reference: dues.id,
      }}
      member={{ full_name: member.full_name, email: member.email }}
      lodge={lodge ? { name: lodge.name, lodge_number: lodge.lodge_number, support_email: lodge.support_email } : null}
    />
  );
}
