import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyMooovWebhook } from "@/lib/mooov";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MooovConnectEvent = {
  id: string;
  type: string;
  created: string;
  merchant: {
    id: string;
    entity_id?: string;
  };
  data?: {
    payment_id?: string;
    amount?: number;
    currency?: string;
    failure_reason?: string;
    [key: string]: unknown;
  };
};

async function findLodgeIdForMerchant(
  supa: ReturnType<typeof createServiceClient>,
  merchantId: string
): Promise<string | null> {
  const { data, error } = await supa
    .schema("mooov")
    .from("lodges")
    .select("id")
    .eq("merchant_id", merchantId)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (data?.id) return data.id;

  const demoMerchant =
    process.env.MOOOV_DEMO_MERCHANT_ID ??
    process.env.MOOOV_DEMO_LODGE_ID ??
    process.env.MOOOV_LODGE_PILOT_MERCHANT_ID;
  if (merchantId !== demoMerchant) return null;

  const demoLodgeId = process.env.MOOOV_DEMO_LODGE_ID ?? "merch_lodgepay_demo";
  const { error: upsertError } = await supa.schema("mooov").from("lodges").upsert(
    {
      id: demoLodgeId,
      merchant_id: merchantId,
      display_name: "LodgePay demo merchant",
      currency: "GBP",
      status: "active",
      metadata: { source: "mooov_connect_staging_webhook" },
    },
    { onConflict: "id" }
  );
  if (upsertError) throw upsertError;
  return demoLodgeId;
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-mooov-signature");
  const deliveryId = request.headers.get("x-mooov-delivery") ?? "";
  const webhookSecret =
    process.env.MOOOV_WEBHOOK_SIGNING_SECRET ??
    process.env.MOOOV_WEBHOOK_SECRET ??
    process.env.MOOOV_PLATFORM_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook signature is not configured." },
      { status: 400 }
    );
  }

  if (!verifyMooovWebhook(raw, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: MooovConnectEvent;
  try {
    event = JSON.parse(raw) as MooovConnectEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!event.id || !event.type || !event.merchant?.id) {
    return NextResponse.json(
      { error: "Missing event id, type, or merchant." },
      { status: 400 }
    );
  }

  const supa = createServiceClient();
  const lodgeId = await findLodgeIdForMerchant(supa, event.merchant.id);
  if (!lodgeId) {
    console.warn("Mooov webhook for unknown merchant", {
      event_id: event.id,
      event_type: event.type,
      merchant_id: event.merchant.id,
    });
    return NextResponse.json({ ok: true, ignored: true });
  }

  const paymentId = event.data?.payment_id ?? null;
  const { error: insertError } = await supa
    .schema("mooov")
    .from("mooov_webhook_events")
    .insert({
      lodge_id: lodgeId,
      event_id: event.id,
      event_type: event.type,
      payment_id: paymentId,
      raw_body: raw,
      delivery_id: deliveryId,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, replay: true });
    }
    console.error("Mooov Connect webhook persist failed", {
      code: insertError.code,
      event_id: event.id,
    });
    return NextResponse.json({ error: "Persist failed." }, { status: 500 });
  }

  await projectConnectEvent(supa, lodgeId, event);
  return NextResponse.json({ ok: true });
}

async function projectConnectEvent(
  supa: ReturnType<typeof createServiceClient>,
  lodgeId: string,
  event: MooovConnectEvent
) {
  const paymentId = event.data?.payment_id;
  switch (event.type) {
    case "payment.succeeded":
      if (!paymentId) return;
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "captured",
          captured_at: new Date().toISOString(),
        })
        .eq("lodge_id", lodgeId)
        .eq("payment_id", paymentId);
      return;
    case "payment.failed":
      if (!paymentId) return;
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "failed",
          failure_reason:
            typeof event.data?.failure_reason === "string"
              ? event.data.failure_reason
              : null,
        })
        .eq("lodge_id", lodgeId)
        .eq("payment_id", paymentId);
      return;
    case "payment.refunded":
      if (!paymentId) return;
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "refunded",
          refunded_at: new Date().toISOString(),
        })
        .eq("lodge_id", lodgeId)
        .eq("payment_id", paymentId);
      return;
    case "payment.disputed":
      if (!paymentId) return;
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "disputed",
        })
        .eq("lodge_id", lodgeId)
        .eq("payment_id", paymentId);
      return;
    case "grant.revoked":
      await supa
        .schema("mooov")
        .from("lodges")
        .update({
          status: "revoked",
          metadata: {
            revoked_at: new Date().toISOString(),
            revoked_event_id: event.id,
          },
        })
        .eq("id", lodgeId);
      return;
  }
}
