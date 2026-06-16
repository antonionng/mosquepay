// lib/email/preferences.ts
//
// One place to ask "should we send this email?". Two layers gate:
//
//   1. Critical/unmutable list — we ALWAYS send these regardless of
//      preferences. A subscription-failure nudge is how we stop the
//      member's standing order silently lapsing.
//
//   2. Per-member preferences (member_notification_preferences) for
//      optional emails. Default is on; an explicit row with
//      enabled=false is the only opt-out signal.
//
// Mosque-wide opt-outs for treasurers/secretaries live separately in
// public.mosque_notification_settings and are consulted by
// lib/email/recipients.ts.

import * as db from "@/lib/db";

/**
 * Email types that the member CAN'T opt out of. These are the ones
 * that protect the member from a bad outcome (failed payment, lost
 * subscription, account access).
 */
export const CRITICAL_EVENT_TYPES = new Set<string>([
  "giving_subscription_invoice_failed_member",
  "giving_subscription_canceled_member",
  "member_invite",
  "member_password_reset",
  "staff_invite",
  "staff_password_reset",
  "notice_member", // legally important — suppress mosque-wide if at all
]);

/**
 * Optional emails grouped for the preferences UI. Each key is an
 * `event_type` value that must match what the senders pass to
 * sendWithLog.
 */
export const OPTIONAL_PREFERENCES: Array<{
  group: string;
  items: Array<{ eventType: string; label: string; description: string }>;
}> = [
  {
    group: "Giving & subscriptions",
    items: [
      {
        eventType: "giving_subscription_activated_member",
        label: "Subscription confirmation",
        description:
          "When you set up a new giving subscription, we email a confirmation with your cycle amount and cadence.",
      },
      {
        eventType: "giving_subscription_invoice_paid_member",
        label: "Per-cycle giving receipts",
        description:
          "Receipt for every successful subscription cycle (monthly or quarterly).",
      },
      {
        eventType: "giving_method_changed_bacs_member",
        label: "BACS recorded",
        description:
          "When the treasurer marks you as paying by BACS standing order.",
      },
      {
        eventType: "giving_method_changed_paid_in_full_member",
        label: "Paid in full",
        description: "Confirmation when your giving are settled for the year.",
      },
      {
        eventType: "giving_method_changed_fee_waived_member",
        label: "Fee waived",
        description: "Confirmation when your giving are waived for the year.",
      },
      {
        eventType: "giving_reminder_member",
        label: "Giving reminders",
        description:
          "Friendly reminders before your annual giving are due. Skipping these does not stop your giving from accruing.",
      },
    ],
  },
  {
    group: "Payments & receipts",
    items: [
      {
        eventType: "payment_receipt_giving_full",
        label: "One-off giving receipts",
        description: "Receipt when you pay annual giving in one transaction.",
      },
      {
        eventType: "payment_receipt_donation",
        label: "Donation receipts",
        description: "Receipt for each charitable donation.",
      },
      {
        eventType: "payment_receipt_event",
        label: "Event-booking receipts",
        description:
          "Receipt for paid event RSVPs, dining, raffles, and guest tickets.",
      },
      {
        eventType: "payment_receipt_take_payment",
        label: "In-person payment receipts",
        description:
          "Receipt when the treasurer takes a payment from you in person.",
      },
    ],
  },
  {
    group: "Mosque updates",
    items: [
      {
        eventType: "notice_acknowledgement_member",
        label: "Notice acknowledgement",
        description:
          "We confirm when you reply to a notice. The notice itself is always sent.",
      },
      {
        eventType: "wine_pledge_thanks_member",
        label: "Wine pledge thanks",
        description: "Confirmation when you pledge wine for an event.",
      },
    ],
  },
];

/**
 * Returns true when this member is opted into `eventType`. Critical
 * events always return true; optional events default to true unless
 * an explicit suppression row exists.
 */
export async function memberWantsEmail(
  memberId: string | null | undefined,
  eventType: string,
): Promise<boolean> {
  if (CRITICAL_EVENT_TYPES.has(eventType)) return true;
  if (!memberId) return true; // no member context = guest send, always on

  const supa = await getServiceClient();
  const { data, error } = await supa
    .from("member_notification_preferences")
    .select("enabled")
    .eq("member_id", memberId)
    .eq("event_type", eventType)
    .maybeSingle();
  if (error) {
    console.error("memberWantsEmail: query failed", error);
    return true;
  }
  return data ? data.enabled !== false : true;
}

/**
 * Bulk read for the preferences UI. Returns a Set of event_types
 * that the member has explicitly opted OUT of. Anything not in the
 * set is opted in.
 */
export async function listMemberOptOuts(
  memberId: string,
): Promise<Set<string>> {
  const supa = await getServiceClient();
  const { data, error } = await supa
    .from("member_notification_preferences")
    .select("event_type, enabled")
    .eq("member_id", memberId);
  if (error) {
    console.error("listMemberOptOuts: query failed", error);
    return new Set();
  }
  const out = new Set<string>();
  for (const row of (data ?? []) as Array<{ event_type: string; enabled: boolean }>) {
    if (row.enabled === false) out.add(row.event_type);
  }
  return out;
}

/**
 * Idempotent upsert of a member preference. enabled=true is the
 * default state, so we DELETE on enable rather than persist a row.
 */
export async function setMemberPreference(
  memberId: string,
  eventType: string,
  enabled: boolean,
): Promise<void> {
  if (CRITICAL_EVENT_TYPES.has(eventType)) {
    // Defence in depth — UI doesn't expose these, but a crafted
    // request shouldn't be able to silence a critical alert.
    throw new Error(
      `${eventType} is a critical alert and cannot be muted by the member.`,
    );
  }
  const supa = await getServiceClient();
  if (enabled) {
    const { error } = await supa
      .from("member_notification_preferences")
      .delete()
      .eq("member_id", memberId)
      .eq("event_type", eventType);
    if (error) throw error;
    return;
  }
  const { error } = await supa
    .from("member_notification_preferences")
    .upsert(
      { member_id: memberId, event_type: eventType, enabled: false },
      { onConflict: "member_id,event_type" },
    );
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Mosque-wide settings convenience (admin UI uses these too)
// ---------------------------------------------------------------------------

export const ADMIN_NOTIFICATION_EVENTS: Array<{
  eventType: string;
  label: string;
  description: string;
}> = [
  {
    eventType: "giving_subscription_activated",
    label: "New giving subscription",
    description:
      "When a member sets up a new subscription. Useful for treasurer / secretary awareness.",
  },
  {
    eventType: "giving_subscription_invoice_failed",
    label: "Subscription payment failed",
    description:
      "Escalation at the 1st, 3rd, and 5th consecutive failure. The 5th pauses the subscription.",
  },
  {
    eventType: "giving_subscription_canceled",
    label: "Subscription cancelled",
    description:
      "When a member or system cancels a subscription. Useful for follow-up.",
  },
  {
    eventType: "giving_method_changed_bacs",
    label: "Member marked as BACS payer",
    description:
      "When a treasurer records that a member is paying giving by BACS standing order. Other officers see who set the tag and the agreed monthly amount.",
  },
  {
    eventType: "giving_method_changed_paid_in_full",
    label: "Member giving paid in full",
    description:
      "When a treasurer marks giving paid in full off-platform (cash / cheque). Keeps the rest of the admin team in sync.",
  },
  {
    eventType: "giving_method_changed_fee_waived",
    label: "Member fee waived",
    description:
      "When an admin waives this year's giving for a member. Sensitive — secretaries / pastoral_cares typically want to know.",
  },
];

/**
 * Roles offered in the admin notifications settings UI. Mirrors
 * ADMIN_NOTIFY_ROLES in lib/email/recipients.ts. The 'platform_owner'
 * scope is intentionally excluded — that's the MosquePay vendor and
 * we don't expose them as a per-mosque toggle.
 */
export const ADMIN_NOTIFICATION_ROLES: Array<{
  role: string;
  label: string;
}> = [
  { role: "treasurer", label: "Treasurer" },
  { role: "secretary", label: "Secretary" },
  { role: "master", label: "Master" },
  { role: "charity_steward", label: "Charity steward" },
  { role: "membership_officer", label: "Membership officer" },
  { role: "pastoral_care", label: "PastoralCare" },
  { role: "super_admin", label: "Super admin" },
];

export async function listMosqueNotificationSettings(
  mosqueId: string,
): Promise<Map<string, boolean>> {
  const supa = await getServiceClient();
  const { data, error } = await supa
    .from("mosque_notification_settings")
    .select("role, event_type, enabled")
    .eq("mosque_id", mosqueId);
  if (error) {
    console.error("listMosqueNotificationSettings: query failed", error);
    return new Map();
  }
  const out = new Map<string, boolean>();
  for (const row of (data ?? []) as Array<{
    role: string;
    event_type: string;
    enabled: boolean;
  }>) {
    out.set(`${row.role}::${row.event_type}`, row.enabled);
  }
  return out;
}

export async function setMosqueNotificationSetting(
  mosqueId: string,
  role: string,
  eventType: string,
  enabled: boolean,
): Promise<void> {
  const supa = await getServiceClient();
  if (enabled) {
    // "Send" is the default; clearing the row is enough.
    const { error } = await supa
      .from("mosque_notification_settings")
      .delete()
      .eq("mosque_id", mosqueId)
      .eq("role", role)
      .eq("event_type", eventType);
    if (error) throw error;
    return;
  }
  const { error } = await supa
    .from("mosque_notification_settings")
    .upsert(
      {
        mosque_id: mosqueId,
        role,
        event_type: eventType,
        enabled: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mosque_id,role,event_type" },
    );
  if (error) throw error;
}

// Indirection so server-only callers can pull the service client
// without importing from a client-only module. We import lazily
// because some callers (member-side preferences API) need to use the
// auth user's client instead.
async function getServiceClient() {
  const { createServiceClient } = await import("@/lib/supabase/server");
  return createServiceClient();
}

void db; // keep namespace import for type alignment
