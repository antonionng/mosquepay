// lib/email/send-with-log.ts
//
// Thin wrapper around Resend that:
//   1. Pre-checks the email_log dedupe index so we never send a
//      duplicate when Mooov redelivers a webhook.
//   2. Records the send (sent / failed / skipped_optout) so the
//      member-detail "Recent emails" panel always reflects truth.
//   3. Returns a bool so callers can stop chaining (e.g. don't fire
//      the treasurer escalation when the member nudge already
//      happened on a redeliver).
//
// All call sites should funnel through here rather than calling
// resend.emails.send directly; the older bespoke senders
// (sendMemberInvite, sendStaffInvite, sendGivingReminder, etc.) are
// untouched for now and will be migrated in a follow-up so this
// change stays contained.

import { Resend } from "resend";
import * as db from "@/lib/db";
import { churchPayFromEmail } from "@/lib/email/templates";
import { memberWantsEmail } from "@/lib/email/preferences";

export type SendWithLogArgs = {
  /** Church owning this send (NULL for platform-wide messages). */
  churchId: string | null;
  toEmail: string;
  toName?: string | null;

  /** Snake-case classifier — see migration 064 for the canon. */
  emailType: string;

  /** Optional FK back to the entity the email is *about*. */
  entityType?: string | null;
  entityId?: string | null;

  /**
   * Optional dedupe key. When provided, send-with-log first probes
   * the email_log unique index; a match short-circuits the whole
   * call. Use the synthetic mooov payment_id / invoice_id for
   * webhook-driven sends.
   */
  dedupeKey?: string | null;

  subject: string;
  html: string;
  text?: string | null;

  /** Optional FK to admin_users.id when the recipient is staff. */
  adminUserId?: string | null;
  /** Optional FK to members.id for fast member-side lookups. */
  memberId?: string | null;

  /** Anything you'd like searchable on the email_log row. */
  metadata?: Record<string, unknown>;

  /** Optional reply-to (e.g. church.email when present). */
  replyTo?: string | null;

  /** Extra BCC addresses on top of the platform debug BCC. */
  bcc?: string | string[] | null;
};

export type SendWithLogResult =
  | { ok: true; deduped: false; resendId: string | null }
  | { ok: true; deduped: true }
  | { ok: false; error: string };

const FROM_ENV =
  process.env.RESEND_FROM_EMAIL ??
  process.env.EMAIL_FROM ??
  "ChurchPay <noreply@churchpay.co.uk>";

/**
 * Comma-separated list of BCC addresses applied to every send.
 * Defaults to the ChurchPay QA inbox so we always have an audit
 * mirror; set EMAIL_DEBUG_BCC="" in env to disable.
 */
const DEBUG_BCC =
  process.env.EMAIL_DEBUG_BCC ?? "ag@experrt.com";

function buildFrom() {
  return churchPayFromEmail(FROM_ENV);
}

function buildBcc(extraBcc: string | string[] | null | undefined): string[] {
  const out = new Set<string>();
  if (DEBUG_BCC) {
    for (const part of DEBUG_BCC.split(",")) {
      const trimmed = part.trim();
      if (trimmed) out.add(trimmed);
    }
  }
  if (extraBcc) {
    const list = Array.isArray(extraBcc) ? extraBcc : [extraBcc];
    for (const part of list) {
      const trimmed = (part ?? "").trim();
      if (trimmed) out.add(trimmed);
    }
  }
  return Array.from(out);
}

export async function sendWithLog(args: SendWithLogArgs): Promise<SendWithLogResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `sendWithLog: RESEND_API_KEY not set; skipping ${args.emailType} to ${args.toEmail}`,
    );
    // Still log the skip so the audit trail accurately reflects "we
    // didn't send" rather than silently dropping.
    await db
      .recordEmailLog({
        church_id: args.churchId,
        to_email: args.toEmail,
        member_id: args.memberId ?? null,
        admin_user_id: args.adminUserId ?? null,
        email_type: args.emailType,
        entity_type: args.entityType ?? null,
        entity_id: args.entityId ?? null,
        dedupe_key: args.dedupeKey ?? null,
        subject: args.subject,
        resend_message_id: null,
        status: "failed",
        error: "RESEND_API_KEY missing",
        metadata: { ...(args.metadata ?? {}), to_name: args.toName ?? null },
      })
      .catch(() => null);
    return { ok: false, error: "Resend not configured." };
  }

  // Pre-check dedupe. Cheap (count-only) and lets us skip rendering
  // the call to Resend altogether when a redeliver hits.
  if (args.dedupeKey) {
    const already = await db
      .emailAlreadySent(args.churchId, args.emailType, args.dedupeKey)
      .catch(() => false);
    if (already) {
      console.log("sendWithLog: dedupe hit, skipping", {
        email_type: args.emailType,
        dedupe_key: args.dedupeKey,
      });
      return { ok: true, deduped: true };
    }
  }

  // Per-member opt-out. Critical alerts always pass through;
  // optional sends are suppressed when the member has explicitly
  // turned them off in their preferences.
  if (args.memberId) {
    const wantsIt = await memberWantsEmail(args.memberId, args.emailType);
    if (!wantsIt) {
      // Persist a "skipped" row so the audit trail still shows we
      // would have sent and consciously didn't.
      await db
        .recordEmailLog({
          church_id: args.churchId,
          to_email: args.toEmail,
          member_id: args.memberId,
          admin_user_id: args.adminUserId ?? null,
          email_type: args.emailType,
          entity_type: args.entityType ?? null,
          entity_id: args.entityId ?? null,
          dedupe_key: args.dedupeKey ?? null,
          subject: args.subject,
          resend_message_id: null,
          status: "skipped_optout",
          error: null,
          metadata: { ...(args.metadata ?? {}), to_name: args.toName ?? null },
        })
        .catch(() => null);
      return { ok: true, deduped: true };
    }
  }

  const resend = new Resend(apiKey);
  let resendId: string | null = null;
  let sendError: string | null = null;
  const bccList = buildBcc(args.bcc ?? null);
  try {
    const { data, error } = await resend.emails.send({
      from: buildFrom(),
      to: args.toEmail,
      subject: args.subject,
      html: args.html,
      ...(args.text ? { text: args.text } : {}),
      ...(args.replyTo ? { replyTo: args.replyTo } : {}),
      ...(bccList.length > 0 ? { bcc: bccList } : {}),
    });
    if (error) {
      sendError = error.message ?? String(error);
    } else {
      resendId = data?.id ?? null;
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
  }

  // Always record — sent OR failed — so the member-detail panel can
  // surface the failure to the treasurer.
  const persisted = await db
    .recordEmailLog({
      church_id: args.churchId,
      to_email: args.toEmail,
      member_id: args.memberId ?? null,
      admin_user_id: args.adminUserId ?? null,
      email_type: args.emailType,
      entity_type: args.entityType ?? null,
      entity_id: args.entityId ?? null,
      dedupe_key: args.dedupeKey ?? null,
      subject: args.subject,
      resend_message_id: resendId,
      status: sendError ? "failed" : "sent",
      error: sendError,
      metadata: { ...(args.metadata ?? {}), to_name: args.toName ?? null },
    })
    .catch((err) => {
      console.error("sendWithLog: failed to write email_log", err);
      return null;
    });

  // If the dedupe race lost (two concurrent webhooks), persisted is
  // null. The send already went out — log a warn so we can spot it
  // and treat the call as success but note the duplicate.
  if (persisted === null && !sendError) {
    console.warn("sendWithLog: email_log dedupe collision after send", {
      email_type: args.emailType,
      dedupe_key: args.dedupeKey,
    });
  }

  if (sendError) {
    return { ok: false, error: sendError };
  }
  return { ok: true, deduped: false, resendId };
}
