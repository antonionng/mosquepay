import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mooov/disconnect
// Revoke this church's Mooov grant. Per Mooov Connect contract
// (gateway-prod-00028-c4l, 2026-05-22):
//   POST https://api.mooov.money/v1/grants/{grant_id}/revoke
// HMAC-signed with the platform key. 204 = revoked, 404 = grant not
// found (treated as idempotent success; could already be revoked, or
// could belong to a different integrator -- Mooov deliberately doesn't
// distinguish). 401 = signer bug, surface clearly.
//
// We do NOT receive a grant.revoked webhook back from Mooov when we
// welcomed the revoke ourselves (ant confirmed) -- so this handler is
// the only place that writes status='revoked' on the church row for the
// admin-welcomed disconnect path.
//
// Underlying Stripe Connect account on Mooov's side is preserved across
// revoke, so a future Reconnect via /api/mooov/connect/start rebinds to
// the same merchant_id + same Stripe account. No re-onboarding needed
// unless the Stripe account itself was severed on Stripe's side.
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  // Mooov disconnect is a payment-ops action: the treasurer is the natural
  // owner of the payments rail and is the one who'd flip Mooov off if it
  // misbehaves. Match the sidebar visibility gate
  // (components/layout/admin-sidebar.tsx) and the integration credentials
  // API so treasurer can actually use the Disconnect button shown to them.
  const forbidden = await requireAdminApiPermission("payments:write", churchId);
  if (forbidden) return forbidden;

  const supa = createServiceClient();
  const { data: row, error: readErr } = await supa
    .schema("mooov")
    .from("churches")
    .select("merchant_id, status, metadata")
    .eq("id", churchId)
    .maybeSingle<{
      merchant_id: string;
      status: string;
      metadata: Record<string, unknown> | null;
    }>();

  if (readErr) {
    console.error("mooov/disconnect: church read failed", {
      church_id: churchId,
      message: readErr.message,
    });
    return NextResponse.json(
      { error: "Could not read Mooov connection." },
      { status: 500 }
    );
  }
  if (!row) {
    return NextResponse.json(
      { error: "Mooov is not connected for this church." },
      { status: 400 }
    );
  }

  const grantId =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>).grant_id
      : undefined;
  if (typeof grantId !== "string" || !grantId) {
    // No grant_id persisted: nothing to revoke server-side, but still
    // clean up our local row so the UI flips to disconnected.
    await applyLocalRevoke(supa, churchId, row.metadata, {
      reason: "no_grant_id_persisted",
    });
    await writeAuditLog({
      churchId,
      action: "mooov_disconnected",
      entityType: "mooov_grant",
      entityId: row.merchant_id,
      summary:
        "Mooov disconnected locally (no grant_id persisted; nothing to revoke remotely).",
    });
    return NextResponse.json({
      ok: true,
      revoked_remotely: false,
      reason: "no_grant_id_persisted",
    });
  }

  try {
    await callMooovConnect<void>(
      "POST",
      `/v1/grants/${encodeURIComponent(grantId)}/revoke`,
      {
        body: { reason: "merchant_clicked_disconnect_in_lp_admin" },
        idempotencyKey: `disconnect_${grantId}_${randomUUID()}`,
      }
    );
  } catch (err) {
    if (err instanceof MooovApiError) {
      // 404 = grant unknown to Mooov (already revoked, or never existed
      // on their side). Treated as success per the idempotent contract.
      if (err.status === 404) {
        await applyLocalRevoke(supa, churchId, row.metadata, {
          reason: "grant_already_revoked_remotely",
          remote_status: 404,
        });
        await writeAuditLog({
          churchId,
          action: "mooov_disconnected",
          entityType: "mooov_grant",
          entityId: grantId,
          summary: "Mooov revoke returned 404 (already revoked); local state cleared.",
        });
        return NextResponse.json({
          ok: true,
          revoked_remotely: false,
          reason: "grant_not_found_on_mooov",
        });
      }
      console.error("mooov/disconnect: revoke API failed", {
        church_id: churchId,
        grant_id: grantId,
        status: err.status,
        category: err.category,
        body: err.body,
      });
      return NextResponse.json(
        {
          error:
            err.status === 401
              ? "Mooov rejected our credentials. Please contact support."
              : "Could not revoke Mooov access. Please try again or contact support.",
          mooov_status: err.status,
        },
        { status: 502 }
      );
    }
    console.error("mooov/disconnect: revoke unexpected error", {
      church_id: churchId,
      grant_id: grantId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not revoke Mooov access. Please try again." },
      { status: 500 }
    );
  }

  await applyLocalRevoke(supa, churchId, row.metadata, {
    reason: "admin_clicked_disconnect",
  });
  await writeAuditLog({
    churchId,
    action: "mooov_disconnected",
    entityType: "mooov_grant",
    entityId: grantId,
    summary: `Mooov grant ${grantId} revoked by church admin.`,
  });

  return NextResponse.json({ ok: true, revoked_remotely: true });
}

// Soft-delete: keep the row + metadata for audit, flip status to revoked.
// Reconnect via /api/mooov/connect/start later will upsert back to active.
async function applyLocalRevoke(
  supa: ReturnType<typeof createServiceClient>,
  churchId: string,
  existingMetadata: Record<string, unknown> | null,
  extra: Record<string, unknown>
): Promise<void> {
  const merged: Record<string, unknown> = {
    ...(existingMetadata ?? {}),
    revoked_at: new Date().toISOString(),
    revoked_via: "churchpay_admin_disconnect",
    ...extra,
  };
  const { error } = await supa
    .schema("mooov")
    .from("churches")
    .update({ status: "revoked", metadata: merged })
    .eq("id", churchId);
  if (error) {
    console.error("mooov/disconnect: local state update failed", {
      church_id: churchId,
      message: error.message,
    });
    // Don't throw -- the remote revoke already succeeded; the local row
    // can be patched manually if this fails.
  }
}
