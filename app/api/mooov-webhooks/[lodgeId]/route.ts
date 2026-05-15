// POST /api/mooov-webhooks/[lodgeId]
//
// Inbound Mooov outbound-webhook receiver. Implements Section 7 of
// mooov3:docs/integrations/lodgepay-mooov-dev-quickstart.md.
//
// Inbound signature scheme (different from the outbound LodgePay->Mooov
// scheme in lib/mooov.ts):
//
//   X-Mooov-Signature: t=<unix>,v1=<hex>
//   v1 = HMAC-SHA256(outbound_signing_secret, `${t}.${raw_body_bytes}`)
//
// IMPORTANT: read the raw request body BEFORE JSON.parse. The signature
// is computed over the bytes Mooov sent; re-stringifying after a parse
// will mangle whitespace and key ordering and produce a 401.

import { type NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MooovEvent {
  event_id: string;
  event_type: string;
  payment_id?: string;
  amount?: number;
  currency?: string;
  state?: string;
  occurred_at?: string;
  metadata?: Record<string, string>;
}

type VerifyOk = { ok: true };
type VerifyFail = { ok: false; error: string; status: number };

function verifySignature(
  raw: string,
  header: string,
  secret: string,
  nowSec: number,
): VerifyOk | VerifyFail {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""] as [string, string];
    }),
  );
  const ts = Number(parts["t"]);
  const sigHex = parts["v1"];
  if (!ts || !sigHex) {
    return { ok: false, error: "malformed signature", status: 400 };
  }
  if (Math.abs(nowSec - ts) > 300) {
    return { ok: false, error: "signature timestamp out of range", status: 401 };
  }
  const expected = createHmac("sha256", secret).update(`${ts}.${raw}`).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sigHex, "hex");
  } catch {
    return { ok: false, error: "signature not hex", status: 401 };
  }
  if (provided.length !== expected.length) {
    return { ok: false, error: "signature length mismatch", status: 401 };
  }
  if (!timingSafeEqual(provided, expected)) {
    return { ok: false, error: "signature mismatch", status: 401 };
  }
  return { ok: true };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ lodgeId: string }> },
) {
  const { lodgeId } = await params;
  const raw = await req.text();
  const sig = req.headers.get("x-mooov-signature");
  const delivery = req.headers.get("x-mooov-delivery") ?? "";
  if (!sig) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let supa: ReturnType<typeof createServiceClient>;
  try {
    supa = createServiceClient();
  } catch (err) {
    console.error("supabase service client unavailable", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 });
  }

  const { data: secretRow, error: secretErr } = await supa
    .schema("mooov")
    .rpc("get_lodge_outbound_secret", { p_lodge_id: lodgeId })
    .single<{ outbound_signing_secret: string }>();
  if (secretErr || !secretRow?.outbound_signing_secret) {
    return NextResponse.json({ error: "unknown lodge" }, { status: 404 });
  }

  const verdict = verifySignature(
    raw,
    sig,
    secretRow.outbound_signing_secret,
    Math.floor(Date.now() / 1000),
  );
  if (!verdict.ok) {
    console.warn("mooov webhook rejected", {
      lodge_id: lodgeId,
      reason: verdict.error,
      status: verdict.status,
    });
    return NextResponse.json({ error: verdict.error }, { status: verdict.status });
  }

  let evt: MooovEvent;
  try {
    evt = JSON.parse(raw) as MooovEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!evt.event_id || !evt.event_type) {
    return NextResponse.json({ error: "missing event fields" }, { status: 400 });
  }

  // Idempotency: PK (lodge_id, event_id). 23505 = unique violation = replay.
  const { error: insertErr } = await supa
    .schema("mooov")
    .from("mooov_webhook_events")
    .insert({
      lodge_id: lodgeId,
      event_id: evt.event_id,
      event_type: evt.event_type,
      payment_id: evt.payment_id ?? null,
      raw_body: raw,
      delivery_id: delivery,
    });
  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ ok: true, replay: true });
    }
    console.error("mooov webhook persist failed", {
      lodge_id: lodgeId,
      code: insertErr.code,
    });
    return NextResponse.json({ error: "persist failed" }, { status: 500 });
  }

  await projectEvent(supa, evt);
  return NextResponse.json({ ok: true });
}

async function projectEvent(
  supa: ReturnType<typeof createServiceClient>,
  evt: MooovEvent,
): Promise<void> {
  if (!evt.payment_id) return;
  switch (evt.event_type) {
    case "payment.authorized":
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "authorized",
          authorized_at: new Date().toISOString(),
        })
        .eq("payment_id", evt.payment_id);
      return;
    case "payment.captured":
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "captured",
          captured_at: new Date().toISOString(),
        })
        .eq("payment_id", evt.payment_id);
      return;
    case "payment.failed":
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "failed",
          failure_reason: evt.metadata?.failure_reason ?? null,
        })
        .eq("payment_id", evt.payment_id);
      return;
  }
}
