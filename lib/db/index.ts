import { createServiceClient } from "@/lib/supabase/server";
import type {
  Mosque,
  MosqueSitePage,
  AdminUser,
  AuditLog,
  Newcomer,
  NewcomerActivity,
  Event,
  Rsvp,
  Payment,
  Donation,
  GiftAidDeclaration,
  GiftAidDeclarationEvent,
  MosqueSubscription,
  BlogPost,
  CharityCampaign,
  MosqueGiving,
  MosqueFeeDefaults,
  MosqueGivingYear,
  MemberGiving,
  MemberGivingInstalment,
  GivingSchedule,
  GivingScheduleStatus,
  GivingSplitStrategy,
  ServiceCollection,
  GasdsClaim,
  GiftAidClaimBatch,
  GiftAidClaimDeclaration,
  GiftAidClaimItem,
  LedgerEntry,
  BankStatementImport,
  BankTransaction,
  PastoralCareCase,
  PastoralCareVisit,
  PastoralCareRegisterEntry,
  PastoralCareAlert,
  MessageTemplate,
  Message,
  AutomationSetting,
  ProgressionSignoff,
  MentorAssignment,
  MentorContact,
  EventRitualRole,
  OfficerLadderRung,
  EventGuest,
  Guest,
  GuestInvitation,
  Member,
  ServiceNotice,
  ServiceNoticeSend,
  ServiceNoticeAccessLink,
  EventFeeOverride,
  ServiceSequence,
  NoticeStatus,
  Network,
  MemberRank,
  MosqueVisit,
  NetworkOfficerDirectoryEntry,
  MosqueAnnualReturn,
  MemberConsent,
  DataRetentionSettings,
  SubjectAccessRequest,
  Job,
  JobStatus,
  IntegrationCredentials,
  IntegrationProvider,
  MosqueFeatureFlag,
  EmailLog,
  MosqueNotificationSetting,
} from "./types";

export * from "./types";
export { resolveMosqueId, getDefaultMosqueId } from "./helpers";

function db() {
  return createServiceClient();
}

// ---------------------------------------------------------------------------
// Mosques
// ---------------------------------------------------------------------------

export async function listMosques(): Promise<Mosque[]> {
  const { data, error } = await db()
    .from("mosques")
    .select("*")
    .order("name");
  if (error) throw error;
  return data as Mosque[];
}

export async function getMosqueBySlug(slug: string): Promise<Mosque | null> {
  const { data, error } = await db()
    .from("mosques")
    .select("*")
    .eq("slug", slug.trim().toLowerCase())
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as Mosque | null;
}

export async function getMosqueByCustomDomain(
  domain: string
): Promise<Mosque | null> {
  const { data, error } = await db()
    .from("mosques")
    .select("*")
    .eq("custom_domain", domain.trim().toLowerCase())
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as Mosque | null;
}

export async function updateMosque(
  id: string,
  updates: Partial<Omit<Mosque, "id" | "created_at" | "updated_at">>
): Promise<Mosque | null> {
  const { data, error } = await db()
    .from("mosques")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Mosque | null;
}

export async function createMosque(
  data: {
    slug: string;
    name: string;
    network_id?: string | null;
  } & Partial<Omit<Mosque, "id" | "created_at" | "updated_at" | "slug" | "name">>
): Promise<Mosque> {
  const insert = {
    is_active: true,
    ...data,
    slug: data.slug.trim().toLowerCase(),
  };
  const { data: row, error } = await db()
    .from("mosques")
    .insert(insert)
    .select("*")
    .single();
  if (error) throw error;
  return row as Mosque;
}

export async function getMosqueById(id: string): Promise<Mosque | null> {
  const { data, error } = await db()
    .from("mosques")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Mosque | null;
}

export async function getAdminUserByEmail(
  email: string,
  mosqueId?: string | null
): Promise<AdminUser | null> {
  let query = db()
    .from("admin_users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .eq("active", true);
  if (mosqueId) {
    query = query.or(`mosque_id.eq.${mosqueId},mosque_id.is.null`);
  }
  const { data, error } = await query
    .order("mosque_id", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as AdminUser | undefined) ?? null;
}

export async function listAdminUsersByEmail(email: string): Promise<AdminUser[]> {
  const { data, error } = await db()
    .from("admin_users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .eq("active", true)
    .order("mosque_id", { ascending: true })
    .order("role");
  if (error) throw error;
  return data as AdminUser[];
}

export async function getAdminUserForScope(
  email: string,
  mosqueId: string | null
): Promise<AdminUser | null> {
  let query = db()
    .from("admin_users")
    .select("*")
    .eq("email", email.trim().toLowerCase());
  query =
    mosqueId === null
      ? query.is("mosque_id", null)
      : query.eq("mosque_id", mosqueId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as AdminUser | null;
}

export async function listPlatformAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await db()
    .from("admin_users")
    .select("*")
    .is("mosque_id", null)
    .order("role")
    .order("full_name");
  if (error) throw error;
  return data as AdminUser[];
}

export async function listTenantAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await db()
    .from("admin_users")
    .select("*")
    .not("mosque_id", "is", null)
    .order("mosque_id")
    .order("role")
    .order("full_name");
  if (error) throw error;
  return data as AdminUser[];
}

export async function listAdminUsersForMosque(
  mosqueId: string
): Promise<AdminUser[]> {
  const { data, error } = await db()
    .from("admin_users")
    .select("*")
    .or(`mosque_id.eq.${mosqueId},mosque_id.is.null`)
    .order("role")
    .order("full_name");
  if (error) throw error;
  return data as AdminUser[];
}

export async function createAdminUser(
  data: Pick<AdminUser, "email" | "full_name" | "role" | "active"> & {
    mosque_id: string | null;
    permissions?: string[];
  }
): Promise<AdminUser> {
  const { data: row, error } = await db()
    .from("admin_users")
    .insert({
      ...data,
      email: data.email.trim().toLowerCase(),
      permissions: data.permissions ?? [],
    })
    .select("*")
    .single();
  if (error) throw error;
  return row as AdminUser;
}

export async function updateAdminUser(
  id: string,
  data: Partial<
    Pick<AdminUser, "auth_user_id" | "full_name" | "role" | "active" | "permissions"> & {
      mosque_id: string | null;
    }
  >
): Promise<AdminUser | null> {
  const { data: row, error } = await db()
    .from("admin_users")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return row as AdminUser | null;
}

export async function listAuditLogs(
  mosqueId: string,
  limit = 100
): Promise<AuditLog[]> {
  const { data, error } = await db()
    .from("audit_logs")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as AuditLog[];
}

export async function createAuditLog(
  data: Omit<AuditLog, "id" | "created_at">
): Promise<AuditLog> {
  const { data: row, error } = await db()
    .from("audit_logs")
    .insert(data)
    .select("*")
    .single();
  if (error) throw error;
  return row as AuditLog;
}

// ---------------------------------------------------------------------------
// email_log
// ---------------------------------------------------------------------------

/**
 * Append a row to the email_log. Returns the persisted row (or null
 * if Postgres rejected the insert because the dedupe constraint
 * matched, which the caller treats as "already sent — bail").
 *
 * Callers should NOT throw on conflict — the unique-on-dedupe index
 * is doing exactly the job we want it to do (skip the second send of
 * a redelivered Mooov event). We surface that as null and let the
 * sender skip cleanly.
 */
export async function recordEmailLog(
  data: Omit<EmailLog, "id" | "created_at">,
): Promise<EmailLog | null> {
  const { data: row, error } = await db()
    .from("email_log")
    .insert({
      ...data,
      to_email: data.to_email.trim().toLowerCase(),
    })
    .select("*")
    .maybeSingle();
  if (error) {
    // 23505 = unique_violation (dedupe hit). Caller treats as no-op.
    if ((error as { code?: string }).code === "23505") return null;
    throw error;
  }
  return row as EmailLog | null;
}

/**
 * Returns true when a row already exists for (mosque_id, email_type,
 * dedupe_key). Used by webhook senders as a pre-check so we don't
 * even render the email when Mooov redelivers an event.
 */
export async function emailAlreadySent(
  mosqueId: string | null,
  emailType: string,
  dedupeKey: string,
): Promise<boolean> {
  let query = db()
    .from("email_log")
    .select("id", { count: "exact", head: true })
    .eq("email_type", emailType)
    .eq("dedupe_key", dedupeKey);
  query = mosqueId ? query.eq("mosque_id", mosqueId) : query.is("mosque_id", null);
  const { count, error } = await query;
  if (error) {
    // Conservative: failing open lets the email try; the unique index
    // is the hard guard.
    console.error("emailAlreadySent: query failed", error);
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * Recent email log rows for a member. Drives the "Recent emails"
 * panel on /admin/members/[id].
 */
export async function listEmailLogForMember(
  mosqueId: string,
  memberEmail: string,
  limit = 10,
): Promise<EmailLog[]> {
  const { data, error } = await db()
    .from("email_log")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("to_email", memberEmail.trim().toLowerCase())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EmailLog[];
}

// ---------------------------------------------------------------------------
// mosque_notification_settings
// ---------------------------------------------------------------------------

/**
 * Returns true when this (mosque, role, event_type) is allowed to
 * send. Default is "send" — only an explicit row with enabled=false
 * suppresses. Also honours the mosque-wide kill-switch row stored
 * with role='__all__'.
 */
export async function notificationEnabled(
  mosqueId: string,
  role: string,
  eventType: string,
): Promise<boolean> {
  const { data, error } = await db()
    .from("mosque_notification_settings")
    .select("role, enabled")
    .eq("mosque_id", mosqueId)
    .in("role", [role, "__all__"])
    .eq("event_type", eventType);
  if (error) {
    console.error("notificationEnabled: query failed", error);
    return true;
  }
  for (const row of (data ?? []) as Array<Pick<MosqueNotificationSetting, "role" | "enabled">>) {
    if (row.enabled === false) return false;
  }
  return true;
}

export async function upsertMosque(
  input: Partial<Omit<Mosque, "id" | "created_at" | "updated_at">> &
    Pick<Mosque, "slug" | "name">
): Promise<Mosque> {
  const { data, error } = await db()
    .from("mosques")
    .upsert(
      { ...input, slug: input.slug.trim().toLowerCase() },
      { onConflict: "slug" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as Mosque;
}

// ---------------------------------------------------------------------------
// Mosque Sites
// ---------------------------------------------------------------------------

export async function getMosqueSite(
  mosqueId: string
): Promise<MosqueSitePage | null> {
  const { data, error } = await db()
    .from("mosque_site_pages")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("page_key", "home")
    .maybeSingle();
  if (error) throw error;
  return data as MosqueSitePage | null;
}

export async function updateMosqueSite(
  mosqueId: string,
  updates: Partial<
    Pick<
      MosqueSitePage,
      | "page_title"
      | "page_description"
      | "sections"
      | "custom_pages"
      | "header_settings"
      | "footer_settings"
      | "published"
    >
  >
): Promise<MosqueSitePage> {
  const { data, error } = await db()
    .from("mosque_site_pages")
    .upsert(
      { mosque_id: mosqueId, page_key: "home", ...updates },
      { onConflict: "mosque_id,page_key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as MosqueSitePage;
}

// ---------------------------------------------------------------------------
// Newcomers
// ---------------------------------------------------------------------------

export async function getNewcomers(
  mosqueId: string,
  opts?: { stage?: string }
): Promise<Newcomer[]> {
  let query = db()
    .from("newcomers")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });

  if (opts?.stage) {
    query = query.eq("stage", opts.stage);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Newcomer[];
}

export async function getNewcomerById(
  id: string,
  mosqueId: string
): Promise<Newcomer | null> {
  const { data, error } = await db()
    .from("newcomers")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as Newcomer | null;
}

export async function addNewcomer(
  mosqueId: string,
  data: Omit<Newcomer, "id" | "mosque_id" | "created_at" | "updated_at" | "stage_changed_at">
): Promise<Newcomer> {
  const { data: row, error } = await db()
    .from("newcomers")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as Newcomer;
}

export async function updateNewcomer(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<
      Newcomer,
      | "stage"
      | "assigned_to"
      | "proposer_member_id"
      | "proposer_name"
      | "seconder_member_id"
      | "seconder_name"
      | "next_step"
      | "next_step_due_date"
      | "proposal_date"
      | "membership_decision_date"
      | "interview_completed_at"
      | "consent_given_at"
      | "notes"
      | "converted_member_id"
      | "converted_at"
      | "first_name"
      | "last_name"
      | "phone"
      | "location"
    >
  >
): Promise<Newcomer | null> {
  const patch: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  if (updates.stage) {
    patch.stage_changed_at = new Date().toISOString();
  }

  const { data, error } = await db()
    .from("newcomers")
    .update(patch)
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Newcomer | null;
}

export async function deleteNewcomer(
  id: string,
  mosqueId: string
): Promise<{ deleted: boolean }> {
  const { error, count } = await db()
    .from("newcomers")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
  return { deleted: (count ?? 0) > 0 };
}

// ---------------------------------------------------------------------------
// Newcomer Activities
// ---------------------------------------------------------------------------

export async function getNewcomerActivities(
  newcomerId: string,
  mosqueId: string
): Promise<NewcomerActivity[]> {
  const { data, error } = await db()
    .from("newcomer_activities")
    .select("*")
    .eq("newcomer_id", newcomerId)
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as NewcomerActivity[];
}

export async function addNewcomerActivity(
  mosqueId: string,
  data: Omit<NewcomerActivity, "id" | "mosque_id" | "created_at">
): Promise<NewcomerActivity> {
  const { data: row, error } = await db()
    .from("newcomer_activities")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as NewcomerActivity;
}

export async function updateNewcomerActivity(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<
      NewcomerActivity,
      | "title"
      | "description"
      | "service_date"
      | "attendees"
      | "due_date"
      | "completed"
    >
  >
): Promise<NewcomerActivity | null> {
  const { data, error } = await db()
    .from("newcomer_activities")
    .update(updates)
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as NewcomerActivity | null;
}

export async function getLatestNewcomerActivity(
  newcomerId: string,
  mosqueId: string
): Promise<NewcomerActivity | null> {
  const { data, error } = await db()
    .from("newcomer_activities")
    .select("*")
    .eq("newcomer_id", newcomerId)
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as NewcomerActivity | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function getEvents(
  mosqueId: string,
  opts?: { published?: boolean; upcoming?: boolean }
): Promise<Event[]> {
  let query = db()
    .from("events")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("event_date", { ascending: true });

  if (opts?.published !== undefined) {
    query = query.eq("published", opts.published);
  }
  if (opts?.upcoming) {
    query = query.gte("event_date", new Date().toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Event[];
}

export async function getEventById(
  id: string,
  mosqueId: string
): Promise<Event | null> {
  const { data, error } = await db()
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as Event | null;
}

export async function getEventBySlug(
  slug: string,
  mosqueId: string
): Promise<Event | null> {
  const { data, error } = await db()
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("mosque_id", mosqueId)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return data as Event | null;
}

type AddEventOptional =
  | "sequence_id"
  | "sequence_position"
  | "enable_raffle_wine_pledge"
  | "raffle_wine_description"
  | "notice_status"
  | "notice_auto_drafted_at"
  | "notice_approved_at"
  | "notice_approved_by_email"
  | "notice_last_sent_at"
  | "dining_waived_for_all"
  // Per-service close (migration 059). Defaulted in DB; callers don't set.
  | "service_closed_at"
  | "service_closed_by_email"
  | "service_close_notes";

export async function addEvent(
  mosqueId: string,
  data: Omit<Event, "id" | "mosque_id" | "created_at" | "updated_at" | AddEventOptional> &
    Partial<Pick<Event, AddEventOptional>>
): Promise<Event> {
  const { data: row, error } = await db()
    .from("events")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as Event;
}

export async function updateEvent(
  id: string,
  mosqueId: string,
  updates: Partial<Omit<Event, "id" | "mosque_id" | "created_at">>
): Promise<Event | null> {
  const { data, error } = await db()
    .from("events")
    .update(updates)
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Event | null;
}

/**
 * Permanently remove a service. RSVPs, notice, guests, and other
 * event-scoped rows cascade away. Payments and donations stay in the ledger
 * but are detached from the service first so the FK on payments does not
 * block the delete.
 */
export async function deleteEvent(
  id: string,
  mosqueId: string,
): Promise<{ title: string } | null> {
  const event = await getEventById(id, mosqueId);
  if (!event) return null;

  const { error: detachError } = await db()
    .from("payments")
    .update({ event_id: null })
    .eq("event_id", id)
    .eq("mosque_id", mosqueId);
  if (detachError) throw detachError;

  const { error } = await db()
    .from("events")
    .delete()
    .eq("id", id)
    .eq("mosque_id", mosqueId);
  if (error) throw error;

  return { title: event.title };
}

// ---------------------------------------------------------------------------
// RSVPs
// ---------------------------------------------------------------------------

export async function getRsvpsByEventId(
  eventId: string,
  mosqueId: string
): Promise<Rsvp[]> {
  const { data, error } = await db()
    .from("rsvps")
    .select("*")
    .eq("event_id", eventId)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
  return data as Rsvp[];
}

export async function getRsvpById(
  id: string,
  mosqueId: string
): Promise<Rsvp | null> {
  const { data, error } = await db()
    .from("rsvps")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as Rsvp | null;
}

type RsvpWineFields =
  | "raffle_wine_pledged"
  | "raffle_wine_bottles"
  | "raffle_wine_note";

export async function addRsvp(
  mosqueId: string,
  data: Omit<Rsvp, "id" | "mosque_id" | "created_at" | "updated_at" | RsvpWineFields> &
    Partial<Pick<Rsvp, RsvpWineFields>>
): Promise<Rsvp> {
  const { data: row, error } = await db()
    .from("rsvps")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as Rsvp;
}

export async function updateRsvp(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<
      Rsvp,
      | "payment_id"
      | "payment_completed"
      | "status"
      | "attending_ceremony"
      | "attending_dining"
      | "number_of_guests"
      | "dietary_requirements"
      | "special_requests"
      | "raffle_wine_pledged"
      | "raffle_wine_bottles"
      | "raffle_wine_note"
    >
  >
): Promise<Rsvp | null> {
  const { data, error } = await db()
    .from("rsvps")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Rsvp | null;
}

export async function getRsvpByEventAndEmail(
  eventId: string,
  email: string,
  mosqueId: string
): Promise<Rsvp | null> {
  const { data, error } = await db()
    .from("rsvps")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_email", email.trim().toLowerCase())
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as Rsvp | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function getPayments(mosqueId: string): Promise<Payment[]> {
  const { data, error } = await db()
    .from("payments")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Payment[];
}

/**
 * Payments linked to a specific service. Used by the admin service detail
 * page's "Money raised" panel — pulls every row whose `event_id` matches,
 * regardless of `status`, so the caller can decide which buckets (succeeded,
 * pending, refunded) to surface.
 */
export async function getPaymentsByEventId(
  eventId: string,
  mosqueId: string,
): Promise<Payment[]> {
  const { data, error } = await db()
    .from("payments")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Payment[];
}

export async function getPaymentByStripeId(
  stripePaymentIntentId: string
): Promise<Payment | null> {
  const { data, error } = await db()
    .from("payments")
    .select("*")
    .eq("stripe_payment_intent_id", stripePaymentIntentId)
    .maybeSingle();
  if (error) throw error;
  return data as Payment | null;
}

// Lookup by Mooov-side payment id (e.g. don_<mosque>_<rand>). The Mooov webhook
// handler uses this for idempotency when projecting payment.succeeded /
// payment.captured into public.payments, the same way getPaymentByStripeId
// is used in the legacy Stripe webhook path.
export async function getPaymentByMooovId(
  mooovPaymentId: string
): Promise<Payment | null> {
  const { data, error } = await db()
    .from("payments")
    .select("*")
    .eq("mooov_payment_id", mooovPaymentId)
    .maybeSingle();
  if (error) throw error;
  return data as Payment | null;
}

export async function getPaymentById(
  id: string,
  mosqueId: string
): Promise<Payment | null> {
  const { data, error } = await db()
    .from("payments")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as Payment | null;
}

export async function getDonationById(
  id: string,
  mosqueId: string
): Promise<Donation | null> {
  const { data, error } = await db()
    .from("donations")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as Donation | null;
}

export async function addPayment(
  mosqueId: string,
  data: Omit<Payment, "id" | "mosque_id" | "created_at" | "updated_at">
): Promise<Payment> {
  const { data: row, error } = await db()
    .from("payments")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as Payment;
}

export async function updatePayment(
  id: string,
  mosqueId: string,
  updates: Partial<
    Omit<Payment, "id" | "mosque_id" | "created_at">
  >
): Promise<Payment | null> {
  const { data, error } = await db()
    .from("payments")
    .update(updates)
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Payment | null;
}

// ---------------------------------------------------------------------------
// Donations
// ---------------------------------------------------------------------------

export async function getDonations(mosqueId: string): Promise<Donation[]> {
  const { data, error } = await db()
    .from("donations")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Donation[];
}

export async function addDonation(
  mosqueId: string,
  data: Omit<
    Donation,
    | "id"
    | "mosque_id"
    | "created_at"
    | "campaign_id"
    | "gift_aid_status"
    | "gift_aid_eligible_amount"
    | "gift_aid_claimed_at"
      | "gift_aid_claim_batch_id"
    | "gasds_eligible"
    | "gasds_claimed_at"
    | "tax_year"
  > &
    Partial<
      Pick<
        Donation,
        | "campaign_id"
        | "gift_aid_status"
        | "gift_aid_eligible_amount"
        | "gift_aid_claimed_at"
        | "gift_aid_claim_batch_id"
        | "gasds_eligible"
        | "gasds_claimed_at"
        | "tax_year"
      >
    >
): Promise<Donation> {
  const { data: row, error } = await db()
    .from("donations")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as Donation;
}

export async function updateDonation(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<
      Donation,
      | "donor_name"
      | "donor_email"
      | "amount"
      | "source"
      | "status"
      | "campaign_id"
      | "gift_aid_declaration_id"
      | "gift_aid_status"
      | "gift_aid_eligible_amount"
      | "gift_aid_claimed_at"
      | "gift_aid_claim_batch_id"
      | "event_id"
    >
  >
): Promise<Donation | null> {
  const { data, error } = await db()
    .from("donations")
    .update(updates)
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Donation | null;
}

export async function getDonationsByPaymentId(
  paymentId: string,
  mosqueId: string
): Promise<Donation[]> {
  const { data, error } = await db()
    .from("donations")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("payment_id", paymentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Donation[];
}

export async function deleteDonation(
  id: string,
  mosqueId: string
): Promise<void> {
  const { error } = await db()
    .from("donations")
    .delete()
    .eq("id", id)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
}

export async function getGiftAidClaimBatches(
  mosqueId: string
): Promise<GiftAidClaimBatch[]> {
  const { data, error } = await db()
    .from("gift_aid_claim_batches")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as GiftAidClaimBatch[];
}

export async function createGiftAidClaimBatch(
  mosqueId: string,
  data: Omit<
    GiftAidClaimBatch,
    | "id"
    | "mosque_id"
    | "created_at"
    | "updated_at"
    | "declarations_count"
    | "pack_generated_at"
    | "pack_generated_by_email"
  > &
    Partial<
      Pick<
        GiftAidClaimBatch,
        "declarations_count" | "pack_generated_at" | "pack_generated_by_email"
      >
    >
): Promise<GiftAidClaimBatch> {
  const { data: row, error } = await db()
    .from("gift_aid_claim_batches")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as GiftAidClaimBatch;
}

export async function setClaimBatchDeclarationsCount(
  id: string,
  mosqueId: string,
  count: number
): Promise<void> {
  const { error } = await db()
    .from("gift_aid_claim_batches")
    .update({
      declarations_count: count,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
}

export async function markClaimBatchPackGenerated(
  id: string,
  mosqueId: string,
  actorEmail: string | null
): Promise<void> {
  const { error } = await db()
    .from("gift_aid_claim_batches")
    .update({
      pack_generated_at: new Date().toISOString(),
      pack_generated_by_email: actorEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
}

export async function updateGiftAidClaimBatch(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<
      GiftAidClaimBatch,
      "status" | "exported_at" | "filed_at" | "paid_at" | "notes" | "claim_reference"
    >
  >
): Promise<GiftAidClaimBatch | null> {
  const { data, error } = await db()
    .from("gift_aid_claim_batches")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as GiftAidClaimBatch | null;
}

export async function getGiftAidClaimItems(
  mosqueId: string,
  claimBatchId: string
): Promise<GiftAidClaimItem[]> {
  const { data, error } = await db()
    .from("gift_aid_claim_items")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("claim_batch_id", claimBatchId)
    .order("donation_date", { ascending: true });
  if (error) throw error;
  return data as GiftAidClaimItem[];
}

export async function createGiftAidClaimItems(
  mosqueId: string,
  rows: Array<
    Omit<GiftAidClaimItem, "id" | "mosque_id" | "created_at">
  >
): Promise<GiftAidClaimItem[]> {
  if (rows.length === 0) return [];
  const { data, error } = await db()
    .from("gift_aid_claim_items")
    .insert(rows.map((row) => ({ ...row, mosque_id: mosqueId })))
    .select("*");
  if (error) throw error;
  return data as GiftAidClaimItem[];
}

// ---------------------------------------------------------------------------
// Claim batch -> declaration linkage (migration 060)
// ---------------------------------------------------------------------------

/**
 * Find the previously-created claim batch for this mosque. Used by the
 * close flow to compute "what declarations are new since the last pack".
 * Returns null if this is the mosque's first batch.
 */
export async function getMostRecentClaimBatchBefore(
  mosqueId: string,
  beforeIso: string
): Promise<GiftAidClaimBatch | null> {
  const { data, error } = await db()
    .from("gift_aid_claim_batches")
    .select("*")
    .eq("mosque_id", mosqueId)
    .lt("created_at", beforeIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as GiftAidClaimBatch | null;
}

/**
 * Declarations whose `created_at` falls in (startIso, endIso]. Includes
 * revoked ones intentionally: if a declaration was created AND revoked in
 * the window, UGLE still wants to know it existed.
 */
export async function getDeclarationsCreatedBetween(
  mosqueId: string,
  startIso: string,
  endIso: string
): Promise<GiftAidDeclaration[]> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .select("*")
    .eq("mosque_id", mosqueId)
    .gt("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as GiftAidDeclaration[];
}

export async function getGiftAidDeclarationsByIds(
  mosqueId: string,
  ids: string[]
): Promise<GiftAidDeclaration[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .select("*")
    .eq("mosque_id", mosqueId)
    .in("id", ids);
  if (error) throw error;
  return data as GiftAidDeclaration[];
}

export async function linkDeclarationsToClaimBatch(
  mosqueId: string,
  claimBatchId: string,
  links: Array<{
    gift_aid_declaration_id: string;
    inclusion_reason: GiftAidClaimDeclaration["inclusion_reason"];
  }>
): Promise<GiftAidClaimDeclaration[]> {
  if (links.length === 0) return [];
  const payload = links.map((row) => ({
    ...row,
    mosque_id: mosqueId,
    claim_batch_id: claimBatchId,
  }));
  // Best-effort insert. The unique index on
  // (claim_batch_id, gift_aid_declaration_id, inclusion_reason) catches a
  // re-attach race; we swallow that and re-read so the caller gets the
  // canonical row regardless of which leg won.
  const { data, error } = await db()
    .from("gift_aid_claim_declarations")
    .upsert(payload, {
      onConflict: "claim_batch_id,gift_aid_declaration_id,inclusion_reason",
      ignoreDuplicates: true,
    })
    .select("*");
  if (error) throw error;
  return (data ?? []) as GiftAidClaimDeclaration[];
}

export async function listClaimBatchDeclarations(
  mosqueId: string,
  claimBatchId: string
): Promise<GiftAidClaimDeclaration[]> {
  const { data, error } = await db()
    .from("gift_aid_claim_declarations")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("claim_batch_id", claimBatchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as GiftAidClaimDeclaration[];
}

// ---------------------------------------------------------------------------
// Gift Aid Declarations
// ---------------------------------------------------------------------------

export async function getGiftAidDeclarations(
  mosqueId: string
): Promise<GiftAidDeclaration[]> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as GiftAidDeclaration[];
}

export async function getGiftAidDeclarationById(
  id: string,
  mosqueId: string
): Promise<GiftAidDeclaration | null> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as GiftAidDeclaration | null;
}

export async function getActiveGiftAidDeclarationByEmail(
  mosqueId: string,
  email: string
): Promise<GiftAidDeclaration | null> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .select("*")
    .eq("mosque_id", mosqueId)
    .ilike("donor_email", email)
    .is("revoked_at", null)
    .eq("declaration_confirmed", true)
    .eq("hmrc_eligible", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as GiftAidDeclaration | null;
}

export async function updateGiftAidDeclaration(
  id: string,
  mosqueId: string,
  updates: Partial<
    Omit<GiftAidDeclaration, "id" | "mosque_id" | "created_at">
  >
): Promise<GiftAidDeclaration | null> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as GiftAidDeclaration | null;
}

export async function getDonationsByGiftAidDeclaration(
  declarationId: string,
  mosqueId: string
): Promise<Donation[]> {
  // Donations linked to this declaration explicitly.
  const { data: linked, error } = await db()
    .from("donations")
    .select("*")
    .eq("gift_aid_declaration_id", declarationId)
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Also surface donations that aren't explicitly linked but match this
  // declaration's email. Charity taken via take-payment / QR / cash (and
  // rows backfilled from historical charity payments) carry only the donor
  // email; the declaration is matched at claim time. Including them here
  // keeps the declaration's "linked donations" + reclaim figure consistent
  // with what the claim batcher will actually pick up.
  const { data: decl } = await db()
    .from("gift_aid_declarations")
    .select("donor_email")
    .eq("id", declarationId)
    .eq("mosque_id", mosqueId)
    .maybeSingle<{ donor_email: string | null }>();
  const email = decl?.donor_email?.trim().toLowerCase() ?? null;
  if (!email) return linked as Donation[];

  const { data: unlinked, error: unlinkedError } = await db()
    .from("donations")
    .select("*")
    .eq("mosque_id", mosqueId)
    .is("gift_aid_declaration_id", null)
    .order("created_at", { ascending: false });
  if (unlinkedError) throw unlinkedError;

  const emailMatched = ((unlinked ?? []) as Donation[]).filter(
    (d) => (d.donor_email ?? "").trim().toLowerCase() === email
  );
  return [...(linked as Donation[]), ...emailMatched];
}

export async function listAuditLogsByEntity(
  mosqueId: string,
  entityType: string,
  entityId: string
): Promise<AuditLog[]> {
  const { data, error } = await db()
    .from("audit_logs")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as AuditLog[];
}

export type AddGiftAidDeclarationInput = {
  donor_name: string;
  donor_email: string;
  declaration_text: string;
  declaration_confirmed: boolean;
  confirmation_method: string;
  hmrc_eligible: boolean;
  donor_address_line_1?: string | null;
  donor_address_line_2?: string | null;
  donor_city?: string | null;
  donor_postcode?: string | null;
  donor_country?: string | null;
  declaration_source?: string;
  retained_until?: string | null;
  revoked_reason?: string | null;
  // Evidence (migration 059). Evidence rows can be stamped after the
  // insert via updateGiftAidDeclarationEvidence; passing them on insert is
  // a convenience for callers that already have the file in hand.
  evidence_source?: GiftAidDeclaration["evidence_source"];
  evidence_storage_bucket?: string | null;
  evidence_storage_path?: string | null;
  evidence_sha256?: string | null;
  evidence_size_bytes?: number | null;
  evidence_mime_type?: string | null;
  evidence_uploaded_at?: string | null;
  evidence_uploaded_by_email?: string | null;
  paper_received_date?: string | null;
  paper_filing_reference?: string | null;
  digital_signature_ip?: string | null;
  digital_signature_user_agent?: string | null;
  digital_declaration_text_snapshot?: string | null;
  member_id?: string | null;
};

export async function addGiftAidDeclaration(
  mosqueId: string,
  data: AddGiftAidDeclarationInput
): Promise<GiftAidDeclaration> {
  const { data: row, error } = await db()
    .from("gift_aid_declarations")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as GiftAidDeclaration;
}

/**
 * Stamp evidence metadata on an existing declaration after the file has
 * been uploaded to storage. Used by the paper-upload flow which writes the
 * row first (to get an id for the storage path), then stores the bytes,
 * then comes back here to record the hash + path.
 */
export async function updateGiftAidDeclarationEvidence(
  id: string,
  mosqueId: string,
  evidence: {
    evidence_source: GiftAidDeclaration["evidence_source"];
    evidence_storage_bucket: string;
    evidence_storage_path: string;
    evidence_sha256: string;
    evidence_size_bytes: number;
    evidence_mime_type: string;
    evidence_uploaded_at: string;
    evidence_uploaded_by_email: string | null;
  }
): Promise<GiftAidDeclaration | null> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .update({ ...evidence, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as GiftAidDeclaration | null;
}

export async function revokeGiftAidDeclaration(
  id: string,
  mosqueId: string,
  opts?: { reason?: string | null }
): Promise<GiftAidDeclaration | null> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: opts?.reason ?? null,
    })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as GiftAidDeclaration | null;
}

/**
 * Active declaration for a known member. Prefers the explicit member_id
 * link (migration 059) but falls back to the email lookup for declarations
 * recorded before the link existed.
 */
export async function getActiveGiftAidDeclarationByMember(
  mosqueId: string,
  member: { id: string; email: string }
): Promise<GiftAidDeclaration | null> {
  const { data: linked, error: linkedError } = await db()
    .from("gift_aid_declarations")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("member_id", member.id)
    .is("revoked_at", null)
    .eq("declaration_confirmed", true)
    .eq("hmrc_eligible", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (linkedError) throw linkedError;
  if (linked) return linked as GiftAidDeclaration;
  return getActiveGiftAidDeclarationByEmail(mosqueId, member.email);
}

// ---------------------------------------------------------------------------
// Gift Aid declaration events (append-only audit trail, migration 059)
// ---------------------------------------------------------------------------

export type InsertGiftAidDeclarationEventInput = Omit<
  GiftAidDeclarationEvent,
  "id" | "mosque_id" | "declaration_id" | "created_at"
> & {
  declaration_id: string;
};

export async function insertGiftAidDeclarationEvent(
  mosqueId: string,
  input: InsertGiftAidDeclarationEventInput
): Promise<GiftAidDeclarationEvent> {
  const { data, error } = await db()
    .from("gift_aid_declaration_events")
    .insert({ ...input, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return data as GiftAidDeclarationEvent;
}

export async function listGiftAidDeclarationEvents(
  mosqueId: string,
  declarationId: string
): Promise<GiftAidDeclarationEvent[]> {
  const { data, error } = await db()
    .from("gift_aid_declaration_events")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("declaration_id", declarationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as GiftAidDeclarationEvent[];
}

// ---------------------------------------------------------------------------
// Member-level Gift Aid posture (migration 059)
// ---------------------------------------------------------------------------

export async function updateMemberGiftAidPosture(
  memberId: string,
  mosqueId: string,
  patch: {
    gift_aid_consent_status?: "unknown" | "declared" | "declined";
    gift_aid_prompted_at?: string | null;
  }
): Promise<void> {
  const { error } = await db()
    .from("members")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Service close helpers (migration 059)
// ---------------------------------------------------------------------------

export async function markEventServiceClosed(
  eventId: string,
  mosqueId: string,
  patch: {
    service_closed_at: string;
    service_closed_by_email: string | null;
    service_close_notes: string | null;
  }
): Promise<void> {
  const { error } = await db()
    .from("events")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
}

export async function attachClaimBatchToServiceCollection(
  collectionId: string,
  mosqueId: string,
  patch: {
    gift_aid_claim_batch_id: string;
    gift_aid_pack_delivered_at?: string | null;
    gift_aid_pack_delivered_to?: string | null;
  }
): Promise<void> {
  const { error } = await db()
    .from("service_collections")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", collectionId)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
}

// Stamp (or clear) the Gift Aid pack delivery on the service collection(s)
// for an event. Used by the service close panel so the treasurer can record
// that the Gift Aid pack has actually been forwarded to UGLE.
export async function markReliefChestDeliveredForEvent(
  mosqueId: string,
  eventId: string,
  opts: { deliveredAt?: string | null; deliveredTo?: string | null }
): Promise<void> {
  const { error } = await db()
    .from("service_collections")
    .update({
      gift_aid_pack_delivered_at:
        opts.deliveredAt === undefined
          ? new Date().toISOString()
          : opts.deliveredAt,
      gift_aid_pack_delivered_to: opts.deliveredTo ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("mosque_id", mosqueId)
    .eq("event_id", eventId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Mosque Subscriptions
// ---------------------------------------------------------------------------

export async function getMosqueSubscription(
  mosqueId: string
): Promise<MosqueSubscription | null> {
  const { data, error } = await db()
    .from("mosque_subscriptions")
    .select("*")
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as MosqueSubscription | null;
}

export async function upsertMosqueSubscription(
  mosqueId: string,
  data: Omit<
    MosqueSubscription,
    | "id"
    | "mosque_id"
    | "created_at"
    | "updated_at"
    | "requested_plan_code"
    | "last_upgrade_requested_at"
    | "mosque_limit"
  > &
    Partial<
      Pick<
        MosqueSubscription,
        "requested_plan_code" | "last_upgrade_requested_at" | "mosque_limit"
      >
    >
): Promise<MosqueSubscription> {
  const { data: row, error } = await db()
    .from("mosque_subscriptions")
    .upsert(
      { ...data, mosque_id: mosqueId },
      { onConflict: "mosque_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as MosqueSubscription;
}

// ---------------------------------------------------------------------------
// Blog Posts
// ---------------------------------------------------------------------------

export async function getBlogPosts(
  mosqueId: string,
  opts?: { published?: boolean }
): Promise<BlogPost[]> {
  let query = db()
    .from("blog_posts")
    .select("*")
    .eq("mosque_id", mosqueId);

  if (opts?.published !== undefined) {
    query = query
      .eq("published", true)
      .lte("published_at", new Date().toISOString());
  }

  query = query.order("published_at", {
    ascending: false,
    nullsFirst: false,
  });

  const { data, error } = await query;
  if (error) throw error;
  return data as BlogPost[];
}

export async function getBlogPostById(
  id: string,
  mosqueId: string
): Promise<BlogPost | null> {
  const { data, error } = await db()
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as BlogPost | null;
}

export async function getBlogPostBySlug(
  slug: string,
  mosqueId: string
): Promise<BlogPost | null> {
  const { data, error } = await db()
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("mosque_id", mosqueId)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return data as BlogPost | null;
}

export async function addBlogPost(
  mosqueId: string,
  data: Omit<BlogPost, "id" | "mosque_id" | "created_at" | "updated_at">
): Promise<BlogPost> {
  const { data: row, error } = await db()
    .from("blog_posts")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as BlogPost;
}

export async function updateBlogPost(
  id: string,
  mosqueId: string,
  updates: Partial<Omit<BlogPost, "id" | "mosque_id" | "created_at">>
): Promise<BlogPost | null> {
  const { data, error } = await db()
    .from("blog_posts")
    .update(updates)
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as BlogPost | null;
}

// ---------------------------------------------------------------------------
// Charity Campaigns
// ---------------------------------------------------------------------------

export async function getCharityCampaigns(
  mosqueId: string
): Promise<CharityCampaign[]> {
  const { data, error } = await db()
    .from("charity_campaigns")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as CharityCampaign[];
}

export async function getCharityCampaignById(
  id: string,
  mosqueId: string
): Promise<CharityCampaign | null> {
  const { data, error } = await db()
    .from("charity_campaigns")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as CharityCampaign | null;
}

export async function addCharityCampaign(
  mosqueId: string,
  data: Omit<CharityCampaign, "id" | "mosque_id" | "created_at" | "updated_at">
): Promise<CharityCampaign> {
  const { data: row, error } = await db()
    .from("charity_campaigns")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as CharityCampaign;
}

export async function updateCharityCampaign(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<CharityCampaign, "name" | "description" | "target_amount" | "raised_amount" | "status" | "end_date">
  >
): Promise<CharityCampaign | null> {
  const { data, error } = await db()
    .from("charity_campaigns")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as CharityCampaign | null;
}

export async function getDonationsByCampaign(
  campaignId: string,
  mosqueId: string
): Promise<Donation[]> {
  const { data, error } = await db()
    .from("donations")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Donation[];
}

export async function getDonationsByEvent(
  eventId: string,
  mosqueId: string
): Promise<Donation[]> {
  const { data, error } = await db()
    .from("donations")
    .select("*")
    .eq("event_id", eventId)
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Donation[];
}

// ---------------------------------------------------------------------------
// Mosque Giving
// ---------------------------------------------------------------------------

export async function getMosqueGiving(mosqueId: string): Promise<MosqueGiving[]> {
  const { data, error } = await db()
    .from("mosque_giving")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as MosqueGiving[];
}

export async function getMemberGiving(
  mosqueId: string,
  opts?: { memberEmail?: string; status?: string }
): Promise<MemberGiving[]> {
  let query = db()
    .from("member_giving")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("period_start", { ascending: false });

  if (opts?.memberEmail) {
    query = query.eq("member_email", opts.memberEmail);
  }
  if (opts?.status) {
    query = query.eq("status", opts.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as MemberGiving[];
}

export async function createMemberGiving(
  mosqueId: string,
  data: Omit<
    MemberGiving,
    | "id"
    | "mosque_id"
    | "created_at"
    | "updated_at"
    | "reminder_sent_at"
    | "reminder_count"
    | "is_pro_rata"
    | "full_year_amount"
    | "charitable_amount"
    | "gift_aid_declaration_id"
    | "gift_aid_status"
    | "gift_aid_eligible_amount"
    | "waiver_reason"
    | "is_advance"
    | "advance_for_year_id"
    | "giving_payment_method"
    | "bacs_monthly_amount"
    | "bacs_reference"
    | "payment_method_set_by"
    | "payment_method_set_at"
  > &
    Partial<
      Pick<
        MemberGiving,
        | "reminder_sent_at"
        | "reminder_count"
        | "is_pro_rata"
        | "full_year_amount"
        | "charitable_amount"
        | "gift_aid_declaration_id"
        | "gift_aid_status"
        | "gift_aid_eligible_amount"
        | "waiver_reason"
        | "is_advance"
        | "advance_for_year_id"
        | "giving_payment_method"
        | "bacs_monthly_amount"
        | "bacs_reference"
        | "payment_method_set_by"
        | "payment_method_set_at"
      >
    >
): Promise<MemberGiving> {
  const { data: row, error } = await db()
    .from("member_giving")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as MemberGiving;
}

export async function updateMemberGivingStatus(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<
      MemberGiving,
      | "status"
      | "payment_id"
      | "stripe_payment_intent_id"
      | "paid_at"
      | "reminder_sent_at"
      | "reminder_count"
      | "gift_aid_declaration_id"
      | "gift_aid_status"
      | "gift_aid_eligible_amount"
      | "waiver_reason"
      | "giving_payment_method"
      | "bacs_monthly_amount"
      | "bacs_reference"
      | "payment_method_set_by"
      | "payment_method_set_at"
    >
  >
): Promise<MemberGiving | null> {
  const { data, error } = await db()
    .from("member_giving")
    .update(updates)
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as MemberGiving | null;
}

// ---------------------------------------------------------------------------
// Giving payment method (per-year admin tagging)
// ---------------------------------------------------------------------------

export type SetGivingPaymentMethodInput =
  | { method: "online_subscription"; setBy: string }
  | {
      method: "bacs";
      setBy: string;
      bacsMonthlyAmount: number | null;
      bacsReference?: string | null;
    }
  | { method: "paid_in_full"; setBy: string; note?: string | null }
  | { method: "fee_waived"; setBy: string; waiverReason: string }
  | { method: null; setBy: string };

/**
 * Apply an admin-driven payment-method change to a single member_giving
 * row. Encapsulates the side-effects each method implies (e.g.
 * paid_in_full also flips status + paid_at; fee_waived flips status +
 * waiver_reason). The caller is responsible for audit logging.
 *
 * Designed to be the single mutation point for the new admin
 * /api/admin/members/[id]/giving-method route, the treasurer dashboard's
 * inline actions, and any future automation (e.g. webhook auto-tagging
 * 'online_subscription' when a schedule activates).
 */
export async function setMemberGivingPaymentMethod(
  memberGivingId: string,
  mosqueId: string,
  input: SetGivingPaymentMethodInput,
): Promise<MemberGiving | null> {
  const now = new Date().toISOString();

  type Updates = Parameters<typeof updateMemberGivingStatus>[2];
  const updates: Updates = {
    payment_method_set_by: input.setBy,
    payment_method_set_at: now,
  };

  if (input.method === null) {
    updates.giving_payment_method = null;
    updates.bacs_monthly_amount = null;
    updates.bacs_reference = null;
    return updateMemberGivingStatus(memberGivingId, mosqueId, updates);
  }

  updates.giving_payment_method = input.method;

  if (input.method === "bacs") {
    updates.bacs_monthly_amount = input.bacsMonthlyAmount;
    updates.bacs_reference = input.bacsReference ?? null;
  } else {
    updates.bacs_monthly_amount = null;
    updates.bacs_reference = null;
  }

  if (input.method === "paid_in_full") {
    updates.status = "paid";
    updates.paid_at = now;
  } else if (input.method === "fee_waived") {
    updates.status = "waived";
    updates.waiver_reason = input.waiverReason;
    updates.paid_at = null;
  }

  return updateMemberGivingStatus(memberGivingId, mosqueId, updates);
}

/**
 * Mosque-wide breakdown of giving payment methods for the dashboard tile.
 * Counts ALL non-advance member_giving rows for the mosque by method,
 * including a synthetic "unset" bucket for NULL.
 *
 * Optional yearId narrows to a specific giving year when the caller
 * has resolved one (treasurer dashboard scopes to current year).
 */
export async function countMemberGivingByPaymentMethod(
  mosqueId: string,
  opts: { yearStart?: string; yearEnd?: string } = {},
): Promise<{
  online_subscription: number;
  bacs: number;
  paid_in_full: number;
  fee_waived: number;
  unset: number;
  bacs_monthly_total: number;
}> {
  let query = db()
    .from("member_giving")
    .select("giving_payment_method, bacs_monthly_amount, period_start, period_end, is_advance")
    .eq("mosque_id", mosqueId)
    .eq("is_advance", false);

  if (opts.yearStart) query = query.gte("period_end", opts.yearStart);
  if (opts.yearEnd) query = query.lte("period_start", opts.yearEnd);

  const { data, error } = await query;
  if (error) throw error;

  const counts = {
    online_subscription: 0,
    bacs: 0,
    paid_in_full: 0,
    fee_waived: 0,
    unset: 0,
    bacs_monthly_total: 0,
  };
  for (const row of (data as Array<Pick<MemberGiving, "giving_payment_method" | "bacs_monthly_amount">>) ?? []) {
    const method = row.giving_payment_method;
    if (method == null) {
      counts.unset += 1;
    } else {
      counts[method] += 1;
      if (method === "bacs" && row.bacs_monthly_amount != null) {
        counts.bacs_monthly_total += Number(row.bacs_monthly_amount);
      }
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Member giving instalments
// ---------------------------------------------------------------------------

export async function createMemberGivingInstalments(
  mosqueId: string,
  rows: Array<
    Omit<
      MemberGivingInstalment,
      "id" | "mosque_id" | "created_at" | "updated_at" | "mooov_payment_id" | "schedule_id"
    > &
      Partial<Pick<MemberGivingInstalment, "mooov_payment_id" | "schedule_id">>
  >
): Promise<MemberGivingInstalment[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((row) => ({ ...row, mosque_id: mosqueId }));
  const { data, error } = await db()
    .from("member_giving_instalments")
    .insert(payload)
    .select("*");
  if (error) throw error;
  return data as MemberGivingInstalment[];
}

export async function getInstalmentsForGiving(
  memberGivingId: string,
  mosqueId: string
): Promise<MemberGivingInstalment[]> {
  const { data, error } = await db()
    .from("member_giving_instalments")
    .select("*")
    .eq("member_giving_id", memberGivingId)
    .eq("mosque_id", mosqueId)
    .order("sequence", { ascending: true });
  if (error) throw error;
  return data as MemberGivingInstalment[];
}

export async function getOutstandingInstalments(
  mosqueId: string,
  opts?: { onOrBefore?: string }
): Promise<MemberGivingInstalment[]> {
  let query = db()
    .from("member_giving_instalments")
    .select("*")
    .eq("mosque_id", mosqueId)
    .in("status", ["outstanding", "overdue"])
    .order("due_date", { ascending: true });
  if (opts?.onOrBefore) {
    query = query.lte("due_date", opts.onOrBefore);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as MemberGivingInstalment[];
}

export async function updateInstalment(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<
      MemberGivingInstalment,
      "status" | "paid_at" | "reminder_sent_at" | "payment_reference" | "amount"
    >
  >
): Promise<MemberGivingInstalment | null> {
  const { data, error } = await db()
    .from("member_giving_instalments")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as MemberGivingInstalment | null;
}

/**
 * Hard-delete instalments that were pre-created for a schedule that
 * never made it past pending. Used by the giving subscription enrolment
 * code path when the previous attempt left orphan rows (Mooov call
 * failed, hosted_url missing, member abandoned the redirect, etc.).
 * Only callable while the parent schedule is still pending; we never
 * delete instalments tied to a schedule that has captured money.
 */
export async function deleteInstalmentsForSchedule(
  scheduleId: string,
  mosqueId: string
): Promise<number> {
  const { error, count } = await db()
    .from("member_giving_instalments")
    .delete({ count: "exact" })
    .eq("schedule_id", scheduleId)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Giving schedules (saved-charge subscription state)
// ---------------------------------------------------------------------------

export type CreateGivingScheduleInput = {
  member_id: string | null;
  member_giving_id: string;
  member_email: string;
  customer_ref: string;
  cadence: "monthly" | "quarterly";
  split_strategy: GivingSplitStrategy;
  auto_renew: boolean;
  status?: GivingScheduleStatus;
  next_charge_at?: string | null;
  metadata?: Record<string, unknown>;
  /**
   * Pre-stamped Stripe Subscription identifier for the Mooov-branded
   * subscription_checkouts flow. Set to `sub_giving_<schedule_uuid>` so
   * the LP-side schedule and the Stripe Subscription share an idempotent
   * key. Null on saved-charge schedules.
   */
  mooov_subscription_id?: string | null;
};

export async function createGivingSchedule(
  mosqueId: string,
  input: CreateGivingScheduleInput
): Promise<GivingSchedule> {
  const { data, error } = await db()
    .from("giving_schedules")
    .insert({
      mosque_id: mosqueId,
      member_id: input.member_id,
      member_giving_id: input.member_giving_id,
      member_email: input.member_email,
      customer_ref: input.customer_ref,
      cadence: input.cadence,
      split_strategy: input.split_strategy,
      auto_renew: input.auto_renew,
      status: input.status ?? "pending",
      next_charge_at: input.next_charge_at ?? null,
      metadata: input.metadata ?? {},
      mooov_subscription_id: input.mooov_subscription_id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as GivingSchedule;
}

/**
 * Look up a giving schedule by its Mooov-side subscription_id (the one we
 * stamp on /v1/subscription_checkouts). Used by the Mooov webhook to
 * route subscription.* events back to the LP schedule. Cross-tenant by
 * design — the subscription_id is unique platform-wide.
 */
export async function getGivingScheduleByMooovSubscriptionId(
  mooovSubscriptionId: string
): Promise<GivingSchedule | null> {
  const { data, error } = await db()
    .from("giving_schedules")
    .select("*")
    .eq("mooov_subscription_id", mooovSubscriptionId)
    .maybeSingle();
  if (error) throw error;
  return (data as GivingSchedule | null) ?? null;
}

export async function getGivingSchedule(
  id: string,
  mosqueId: string
): Promise<GivingSchedule | null> {
  const { data, error } = await db()
    .from("giving_schedules")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return (data as GivingSchedule | null) ?? null;
}

export async function getGivingSchedulesForMember(
  mosqueId: string,
  memberEmail: string
): Promise<GivingSchedule[]> {
  const { data, error } = await db()
    .from("giving_schedules")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("member_email", memberEmail)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GivingSchedule[];
}

export async function getGivingSchedulesDue(
  onOrBefore: string,
  limit = 100
): Promise<GivingSchedule[]> {
  // The cron retry path must never re-pick a cancelled schedule, even
  // if a late Mooov webhook clobbered its status back to `past_due`.
  const { data, error } = await db()
    .from("giving_schedules")
    .select("*")
    .in("status", ["active", "past_due"])
    .is("cancelled_at", null)
    .lte("next_charge_at", onOrBefore)
    .order("next_charge_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as GivingSchedule[];
}

export async function listGivingSchedules(
  mosqueId: string,
  opts?: {
    status?: GivingScheduleStatus | GivingScheduleStatus[];
    memberEmail?: string;
    limit?: number;
  }
): Promise<GivingSchedule[]> {
  let query = db()
    .from("giving_schedules")
    .select("*")
    .eq("mosque_id", mosqueId);

  if (opts?.status) {
    if (Array.isArray(opts.status)) {
      query = query.in("status", opts.status);
    } else {
      query = query.eq("status", opts.status);
    }
  }
  if (opts?.memberEmail) {
    query = query.ilike("member_email", `%${opts.memberEmail}%`);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 500);
  if (error) throw error;
  return (data ?? []) as GivingSchedule[];
}

// Treasurer dashboard: count of schedules grouped by status. Returned
// as a record keyed on GivingScheduleStatus with 0-fill for missing
// statuses so callers can index without checks.
export async function countGivingSchedulesByStatus(
  mosqueId: string
): Promise<Record<GivingScheduleStatus, number>> {
  const { data, error } = await db()
    .from("giving_schedules")
    .select("status, cancelled_at")
    .eq("mosque_id", mosqueId);
  if (error) throw error;

  const counts: Record<GivingScheduleStatus, number> = {
    pending: 0,
    active: 0,
    action_required: 0,
    past_due: 0,
    paused: 0,
    cancelled: 0,
    completed: 0,
    active_stripe: 0,
  };
  // Defence-in-depth: any row with `cancelled_at` set is treated as
  // cancelled regardless of its `status` column. Late webhooks used
  // to be able to clobber a cancelled row's status back to past_due
  // and skew the treasurer dashboard counts.
  for (const row of (data ?? []) as {
    status: GivingScheduleStatus;
    cancelled_at: string | null;
  }[]) {
    const effective: GivingScheduleStatus =
      row.cancelled_at != null ? "cancelled" : row.status;
    if (effective in counts) {
      counts[effective] += 1;
    }
  }
  return counts;
}

export async function updateGivingSchedule(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<
      GivingSchedule,
      | "status"
      | "mooov_payment_method_id"
      | "stripe_customer_id"
      | "mooov_subscription_id"
      | "consecutive_failures"
      | "last_failure_code"
      | "last_failure_category"
      | "last_failure_at"
      | "next_action_client_secret"
      | "next_action_connected_account_id"
      | "next_action_expires_at"
      | "next_charge_at"
      | "last_charged_at"
      | "cancelled_at"
      | "cancelled_by_actor"
      | "auto_renew"
      | "metadata"
    >
  >
): Promise<GivingSchedule | null> {
  const { data, error } = await db()
    .from("giving_schedules")
    .update(updates)
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as GivingSchedule | null) ?? null;
}

export async function getMemberGivingById(
  id: string,
  mosqueId: string
): Promise<MemberGiving | null> {
  const { data, error } = await db()
    .from("member_giving")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return (data as MemberGiving | null) ?? null;
}

// ---------------------------------------------------------------------------
// Service collections and GASDS
// ---------------------------------------------------------------------------

export async function getServiceCollections(
  mosqueId: string,
  opts?: { eventId?: string; taxYear?: string }
): Promise<ServiceCollection[]> {
  let query = db()
    .from("service_collections")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("collection_date", { ascending: false });

  if (opts?.eventId) query = query.eq("event_id", opts.eventId);
  if (opts?.taxYear) query = query.eq("gasds_tax_year", opts.taxYear);

  const { data, error } = await query;
  if (error) throw error;
  return data as ServiceCollection[];
}

export async function createServiceCollection(
  mosqueId: string,
  data: Omit<
    ServiceCollection,
    | "id"
    | "mosque_id"
    | "created_at"
    | "updated_at"
    | "gift_aid_claim_batch_id"
    | "gift_aid_pack_delivered_at"
    | "gift_aid_pack_delivered_to"
  > &
    Partial<
      Pick<
        ServiceCollection,
        | "gift_aid_claim_batch_id"
        | "gift_aid_pack_delivered_at"
        | "gift_aid_pack_delivered_to"
      >
    >
): Promise<ServiceCollection> {
  const { data: row, error } = await db()
    .from("service_collections")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as ServiceCollection;
}

export async function getGasdsClaims(mosqueId: string): Promise<GasdsClaim[]> {
  const { data, error } = await db()
    .from("gasds_claims")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("tax_year", { ascending: false });
  if (error) throw error;
  return data as GasdsClaim[];
}

export async function upsertGasdsClaim(
  mosqueId: string,
  data: Omit<GasdsClaim, "id" | "mosque_id" | "created_at" | "updated_at">
): Promise<GasdsClaim> {
  const { data: row, error } = await db()
    .from("gasds_claims")
    .upsert({ ...data, mosque_id: mosqueId }, { onConflict: "mosque_id,tax_year" })
    .select("*")
    .single();
  if (error) throw error;
  return row as GasdsClaim;
}

// ---------------------------------------------------------------------------
// Treasurer ledger view
// ---------------------------------------------------------------------------

export async function getTreasurerLedger(
  mosqueId: string,
  opts?: {
    from?: string;
    to?: string;
    sourceTypes?: Array<"payment" | "giving" | "donation">;
    statuses?: string[];
  }
): Promise<LedgerEntry[]> {
  let query = db()
    .from("treasurer_ledger")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("occurred_at", { ascending: false });
  if (opts?.from) query = query.gte("occurred_at", opts.from);
  if (opts?.to) query = query.lte("occurred_at", opts.to);
  if (opts?.sourceTypes && opts.sourceTypes.length > 0) {
    query = query.in("source_type", opts.sourceTypes);
  }
  if (opts?.statuses && opts.statuses.length > 0) {
    query = query.in("status", opts.statuses);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as LedgerEntry[];
}

// ---------------------------------------------------------------------------
// Event Guests
// ---------------------------------------------------------------------------

export async function addEventGuests(
  mosqueId: string,
  guests: Omit<EventGuest, "id" | "mosque_id" | "created_at">[]
): Promise<EventGuest[]> {
  if (guests.length === 0) return [];
  const rows = guests.map((g) => ({ ...g, mosque_id: mosqueId }));
  const { data, error } = await db()
    .from("event_guests")
    .insert(rows)
    .select("*");
  if (error) throw error;
  return data as EventGuest[];
}

export async function getGuestsByRsvp(
  rsvpId: string,
  mosqueId: string
): Promise<EventGuest[]> {
  const { data, error } = await db()
    .from("event_guests")
    .select("*")
    .eq("rsvp_id", rsvpId)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
  return data as EventGuest[];
}

/**
 * Drop every event_guests row attached to a single RSVP. Used by the
 * Mooov webhook when a checkout is abandoned: the speculative RSVP gets
 * cancelled, and the placeholder guests we wrote in pre-checkout would
 * otherwise linger in the table and pollute the dining list.
 */
export async function deleteEventGuestsByRsvp(
  rsvpId: string,
  mosqueId: string
): Promise<void> {
  const { error } = await db()
    .from("event_guests")
    .delete()
    .eq("rsvp_id", rsvpId)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
}

export async function getGuestsByEvent(
  eventId: string,
  mosqueId: string
): Promise<EventGuest[]> {
  const { data, error } = await db()
    .from("event_guests")
    .select("*")
    .eq("event_id", eventId)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
  return data as EventGuest[];
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function getMembers(
  mosqueId: string,
  opts?: { status?: string; search?: string }
): Promise<Member[]> {
  let query = db()
    .from("members")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("full_name");

  if (opts?.status) {
    query = query.eq("membership_status", opts.status);
  }
  if (opts?.search) {
    query = query.or(
      `full_name.ilike.%${opts.search}%,email.ilike.%${opts.search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Member[];
}

export async function getMemberById(
  id: string,
  mosqueId: string
): Promise<Member | null> {
  const { data, error } = await db()
    .from("members")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as Member | null;
}

export async function getMemberByEmail(
  email: string,
  mosqueId: string
): Promise<Member | null> {
  const { data, error } = await db()
    .from("members")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as Member | null;
}

export async function getMemberByAuthUserId(
  authUserId: string
): Promise<Member | null> {
  const { data, error } = await db()
    .from("members")
    .select("*")
    .eq("auth_user_id", authUserId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as Member | undefined) ?? null;
}

export async function getMemberByEmailAcrossMosques(
  email: string
): Promise<Member | null> {
  const { data, error } = await db()
    .from("members")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .eq("membership_status", "active")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as Member | undefined) ?? null;
}

export async function getMemberByPortalToken(
  token: string
): Promise<Member | null> {
  const { data, error } = await db()
    .from("members")
    .select("*")
    .eq("portal_token", token)
    .limit(1);
  if (error) throw error;
  return (data?.[0] as Member | undefined) ?? null;
}

export async function createMember(
  mosqueId: string,
  data: Omit<
    Member,
    | "id"
    | "mosque_id"
    | "created_at"
    | "updated_at"
    | "portal_token"
    | "date_of_birth"
    | "date_of_passing"
    | "date_of_raising"
    | "discipleship_signed_off_membership"
    | "discipleship_signed_off_passing"
    | "discipleship_signed_off_raising"
    | "archived_at"
    | "archived_reason"
    | "member_levy_amount"
    | "member_dining_amount"
    | "levy_waived"
    | "dining_waived"
    | "fee_use_custom"
    | "annual_giving_waived"
    | "annual_giving_waiver_reason"
    | "show_on_website"
    | "public_bio"
    | "gift_aid_prompted_at"
    | "gift_aid_consent_status"
  > &
    Partial<
      Pick<
        Member,
        | "portal_token"
        | "date_of_birth"
        | "date_of_passing"
        | "date_of_raising"
        | "discipleship_signed_off_membership"
        | "discipleship_signed_off_passing"
        | "discipleship_signed_off_raising"
        | "archived_at"
        | "archived_reason"
        | "member_levy_amount"
        | "member_dining_amount"
        | "levy_waived"
        | "dining_waived"
        | "fee_use_custom"
        | "annual_giving_waived"
        | "annual_giving_waiver_reason"
        | "show_on_website"
        | "public_bio"
        | "gift_aid_prompted_at"
        | "gift_aid_consent_status"
      >
    >
): Promise<Member> {
  const { data: row, error } = await db()
    .from("members")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as Member;
}

export async function updateMember(
  id: string,
  mosqueId: string,
  updates: Partial<Omit<Member, "id" | "mosque_id" | "created_at">>
): Promise<Member | null> {
  const { data, error } = await db()
    .from("members")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Member | null;
}

/**
 * Rewrite a member's email everywhere it is used as a join key. Email is the
 * de-facto link between the members row and historical payments / RSVPs / giving
 * (instead of member_id), so changing it without backfilling these tables
 * would orphan the member's history in the admin detail view.
 *
 * Returns the new member row plus per-table backfill counts so the caller can
 * surface them in the audit log / response.
 */
export async function changeMemberEmail(
  id: string,
  mosqueId: string,
  newEmail: string
): Promise<{
  member: Member | null;
  oldEmail: string;
  paymentsUpdated: number;
  rsvpsUpdated: number;
  givingUpdated: number;
}> {
  const supabase = db();
  const normalised = newEmail.trim().toLowerCase();

  const existing = await getMemberById(id, mosqueId);
  if (!existing) {
    return {
      member: null,
      oldEmail: "",
      paymentsUpdated: 0,
      rsvpsUpdated: 0,
      givingUpdated: 0,
    };
  }
  const oldEmail = existing.email;

  if (oldEmail === normalised) {
    return {
      member: existing,
      oldEmail,
      paymentsUpdated: 0,
      rsvpsUpdated: 0,
      givingUpdated: 0,
    };
  }

  const { data: updated, error: memberError } = await supabase
    .from("members")
    .update({ email: normalised, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (memberError) throw memberError;

  const { data: paymentsRows, error: paymentsError } = await supabase
    .from("payments")
    .update({ user_email: normalised, updated_at: new Date().toISOString() })
    .eq("mosque_id", mosqueId)
    .eq("user_email", oldEmail)
    .select("id");
  if (paymentsError) throw paymentsError;

  const { data: rsvpRows, error: rsvpError } = await supabase
    .from("rsvps")
    .update({ user_email: normalised, updated_at: new Date().toISOString() })
    .eq("mosque_id", mosqueId)
    .eq("user_email", oldEmail)
    .select("id");
  if (rsvpError) throw rsvpError;

  const { data: givingRows, error: givingError } = await supabase
    .from("member_giving")
    .update({ member_email: normalised, updated_at: new Date().toISOString() })
    .eq("mosque_id", mosqueId)
    .eq("member_email", oldEmail)
    .select("id");
  if (givingError) throw givingError;

  return {
    member: updated as Member | null,
    oldEmail,
    paymentsUpdated: paymentsRows?.length ?? 0,
    rsvpsUpdated: rsvpRows?.length ?? 0,
    givingUpdated: givingRows?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Notice
// ---------------------------------------------------------------------------

export async function getServiceNotice(
  eventId: string,
  mosqueId: string
): Promise<ServiceNotice | null> {
  const { data, error } = await db()
    .from("service_notices")
    .select("*")
    .eq("event_id", eventId)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as ServiceNotice | null;
}

export async function upsertServiceNotice(
  mosqueId: string,
  eventId: string,
  data: Partial<
    Omit<
      ServiceNotice,
      "id" | "mosque_id" | "event_id" | "created_at" | "updated_at"
    >
  >
): Promise<ServiceNotice> {
  const { data: row, error } = await db()
    .from("service_notices")
    .upsert(
      {
        ...data,
        mosque_id: mosqueId,
        event_id: eventId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mosque_id,event_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as ServiceNotice;
}

export async function listServiceNoticeSends(
  mosqueId: string,
  eventId: string,
  limit = 5
): Promise<ServiceNoticeSend[]> {
  const { data, error } = await db()
    .from("service_notice_sends")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ServiceNoticeSend[];
}

export async function createServiceNoticeSend(
  mosqueId: string,
  data: Omit<ServiceNoticeSend, "id" | "mosque_id" | "created_at">
): Promise<ServiceNoticeSend> {
  const { data: row, error } = await db()
    .from("service_notice_sends")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as ServiceNoticeSend;
}

export async function createServiceNoticeAccessLink(
  mosqueId: string,
  data: Omit<ServiceNoticeAccessLink, "id" | "mosque_id" | "created_at" | "accessed_at" | "access_count">
): Promise<ServiceNoticeAccessLink> {
  const { data: row, error } = await db()
    .from("service_notice_access_links")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as ServiceNoticeAccessLink;
}

export async function getServiceNoticeAccessLinkByTokenHash(
  tokenHash: string
): Promise<ServiceNoticeAccessLink | null> {
  const { data, error } = await db()
    .from("service_notice_access_links")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  return data as ServiceNoticeAccessLink | null;
}

// ---------------------------------------------------------------------------
// Service sequences (recurring schedule recipes)
// ---------------------------------------------------------------------------

export async function listServiceSequences(
  mosqueId: string
): Promise<ServiceSequence[]> {
  const { data, error } = await db()
    .from("service_sequences")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ServiceSequence[];
}

export async function getServiceSequenceById(
  id: string,
  mosqueId: string
): Promise<ServiceSequence | null> {
  const { data, error } = await db()
    .from("service_sequences")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as ServiceSequence | null;
}

export async function listActiveServiceSequencesForAllMosques(): Promise<
  ServiceSequence[]
> {
  const { data, error } = await db()
    .from("service_sequences")
    .select("*")
    .eq("active", true)
    .eq("auto_draft_notice", true);
  if (error) throw error;
  return (data ?? []) as ServiceSequence[];
}

export async function createServiceSequence(
  mosqueId: string,
  data: Omit<ServiceSequence, "id" | "mosque_id" | "created_at" | "updated_at">
): Promise<ServiceSequence> {
  const { data: row, error } = await db()
    .from("service_sequences")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as ServiceSequence;
}

export async function updateServiceSequence(
  id: string,
  mosqueId: string,
  updates: Partial<
    Omit<ServiceSequence, "id" | "mosque_id" | "created_at" | "updated_at">
  >
): Promise<ServiceSequence | null> {
  const { data, error } = await db()
    .from("service_sequences")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as ServiceSequence | null;
}

export async function deleteServiceSequence(
  id: string,
  mosqueId: string
): Promise<boolean> {
  const { error } = await db()
    .from("service_sequences")
    .delete()
    .eq("id", id)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
  return true;
}

export async function getEventsBySequenceId(
  sequenceId: string,
  mosqueId: string
): Promise<Event[]> {
  const { data, error } = await db()
    .from("events")
    .select("*")
    .eq("sequence_id", sequenceId)
    .eq("mosque_id", mosqueId)
    .order("event_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Event[];
}

export async function getEventsAwaitingNoticeDraft(
  mosqueId: string,
  windowEndIso: string
): Promise<Event[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await db()
    .from("events")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("notice_status", "none")
    .gte("event_date", nowIso)
    .lte("event_date", windowEndIso)
    .order("event_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Event[];
}

export async function setServiceNoticeStatus(
  eventId: string,
  mosqueId: string,
  status: NoticeStatus,
  extra?: Partial<
    Pick<
      Event,
      | "notice_auto_drafted_at"
      | "notice_approved_at"
      | "notice_approved_by_email"
      | "notice_last_sent_at"
    >
  >
): Promise<Event | null> {
  const { data, error } = await db()
    .from("events")
    .update({ notice_status: status, ...(extra ?? {}) })
    .eq("id", eventId)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Event | null;
}

// ---------------------------------------------------------------------------
// Event fee overrides
//
// Per-recipient overrides of levy/dining for a single event. Used by the
// recipients panel to mark "complimentary at this service only" for an
// individual member or honorary guest, without changing their profile
// defaults.
// ---------------------------------------------------------------------------

export async function listEventFeeOverrides(
  mosqueId: string,
  eventId: string
): Promise<EventFeeOverride[]> {
  const { data, error } = await db()
    .from("event_fee_overrides")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("event_id", eventId);
  if (error) throw error;
  return (data ?? []) as EventFeeOverride[];
}

export async function upsertEventFeeOverride(
  mosqueId: string,
  data: Omit<
    EventFeeOverride,
    "id" | "mosque_id" | "created_at" | "updated_at"
  >
): Promise<EventFeeOverride> {
  const { data: row, error } = await db()
    .from("event_fee_overrides")
    .upsert(
      {
        ...data,
        mosque_id: mosqueId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id,subject_type,subject_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as EventFeeOverride;
}

export async function deleteEventFeeOverride(
  mosqueId: string,
  eventId: string,
  subjectType: "member" | "guest",
  subjectId: string
): Promise<void> {
  const { error } = await db()
    .from("event_fee_overrides")
    .delete()
    .eq("mosque_id", mosqueId)
    .eq("event_id", eventId)
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId);
  if (error) throw error;
}

export async function recordServiceNoticeAccess(
  id: string,
  currentAccessCount: number
): Promise<ServiceNoticeAccessLink | null> {
  const { data, error } = await db()
    .from("service_notice_access_links")
    .update({
      accessed_at: new Date().toISOString(),
      access_count: currentAccessCount + 1,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as ServiceNoticeAccessLink | null;
}

export async function getRsvpDietaryByEmail(
  email: string,
  mosqueId: string
): Promise<Array<{ event_id: string; dietary_requirements: string | null; created_at: string }>> {
  const { data, error } = await db()
    .from("rsvps")
    .select("event_id, dietary_requirements, created_at")
    .eq("user_email", email)
    .eq("mosque_id", mosqueId)
    .not("dietary_requirements", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRsvpsByEmail(
  email: string,
  mosqueId: string
): Promise<Rsvp[]> {
  const { data, error } = await db()
    .from("rsvps")
    .select("*")
    .eq("user_email", email)
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Rsvp[];
}

export async function getNoticeAccessLinksByEmail(
  email: string,
  mosqueId: string
): Promise<ServiceNoticeAccessLink[]> {
  const { data, error } = await db()
    .from("service_notice_access_links")
    .select("*")
    .eq("recipient_email", email)
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ServiceNoticeAccessLink[];
}

export async function getPaymentsByEmail(
  email: string,
  mosqueId: string
): Promise<Payment[]> {
  const { data, error } = await db()
    .from("payments")
    .select("*")
    .eq("user_email", email)
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Payment[];
}

export async function getDonationsByEmail(
  email: string,
  mosqueId: string
): Promise<Donation[]> {
  const { data, error } = await db()
    .from("donations")
    .select("*")
    .eq("donor_email", email)
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Donation[];
}

export async function upsertMosqueGiving(
  mosqueId: string,
  data: Omit<
    MosqueGiving,
    | "id"
    | "mosque_id"
    | "created_at"
    | "updated_at"
    | "enable_strategy_catch_up_lump"
    | "enable_strategy_balloon"
    | "enable_strategy_reslice"
    | "auto_renew_default"
    | "year_start_prompt_days"
    | "catch_up_max_months"
    | "advance_discount_percent"
  > &
    Partial<
      Pick<
        MosqueGiving,
        | "enable_strategy_catch_up_lump"
        | "enable_strategy_balloon"
        | "enable_strategy_reslice"
        | "auto_renew_default"
        | "year_start_prompt_days"
        | "catch_up_max_months"
        | "advance_discount_percent"
      >
    >
): Promise<MosqueGiving> {
  const existing = await getMosqueGiving(mosqueId);
  if (existing.length > 0) {
    const { data: row, error } = await db()
      .from("mosque_giving")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", existing[0].id)
      .eq("mosque_id", mosqueId)
      .select("*")
      .single();
    if (error) throw error;
    return row as MosqueGiving;
  }
  const { data: row, error } = await db()
    .from("mosque_giving")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as MosqueGiving;
}

export async function getMembersForInitiation(
  today: string
): Promise<Array<Member & { mosque_slug: string }>> {
  const { data, error } = await db()
    .from("members")
    .select("*, mosques!inner(slug)")
    .eq("date_of_membership", today)
    .eq("membership_email_sent", false);
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => {
    const mosques = row.mosques as { slug: string } | undefined;
    return {
      ...row,
      mosque_slug: mosques?.slug ?? "",
    } as Member & { mosque_slug: string };
  });
}

// ---------------------------------------------------------------------------
// Bank reconciliation
// ---------------------------------------------------------------------------

export async function createBankImport(
  mosqueId: string,
  data: Omit<
    BankStatementImport,
    "id" | "mosque_id" | "created_at" | "matched_rows" | "total_rows"
  > &
    Partial<Pick<BankStatementImport, "matched_rows" | "total_rows">>
): Promise<BankStatementImport> {
  const { data: row, error } = await db()
    .from("bank_statement_imports")
    .insert({
      ...data,
      mosque_id: mosqueId,
      total_rows: data.total_rows ?? 0,
      matched_rows: data.matched_rows ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return row as BankStatementImport;
}

export async function updateBankImport(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<BankStatementImport, "total_rows" | "matched_rows" | "notes" | "account_label">
  >
): Promise<BankStatementImport | null> {
  const { data, error } = await db()
    .from("bank_statement_imports")
    .update(updates)
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as BankStatementImport | null;
}

export async function listBankImports(
  mosqueId: string
): Promise<BankStatementImport[]> {
  const { data, error } = await db()
    .from("bank_statement_imports")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as BankStatementImport[];
}

export async function insertBankTransactions(
  mosqueId: string,
  rows: Array<
    Omit<
      BankTransaction,
      "id" | "mosque_id" | "created_at" | "updated_at" | "matched_at" | "matched_by_admin_user_id" | "matched_confidence" | "matched_source_id" | "matched_source_type" | "status" | "notes"
    > &
      Partial<
        Pick<
          BankTransaction,
          | "status"
          | "matched_source_type"
          | "matched_source_id"
          | "matched_confidence"
          | "matched_at"
          | "matched_by_admin_user_id"
          | "notes"
        >
      >
  >
): Promise<BankTransaction[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((row) => ({ ...row, mosque_id: mosqueId }));
  const { data, error } = await db()
    .from("bank_transactions")
    .insert(payload)
    .select("*");
  if (error) throw error;
  return data as BankTransaction[];
}

export async function listBankTransactions(
  mosqueId: string,
  opts?: { importId?: string; status?: BankTransaction["status"] }
): Promise<BankTransaction[]> {
  let query = db()
    .from("bank_transactions")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("posted_date", { ascending: false });
  if (opts?.importId) query = query.eq("import_id", opts.importId);
  if (opts?.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw error;
  return data as BankTransaction[];
}

export async function updateBankTransaction(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<
      BankTransaction,
      | "status"
      | "matched_source_type"
      | "matched_source_id"
      | "matched_confidence"
      | "matched_at"
      | "matched_by_admin_user_id"
      | "notes"
    >
  >
): Promise<BankTransaction | null> {
  const { data, error } = await db()
    .from("bank_transactions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as BankTransaction | null;
}

// ---------------------------------------------------------------------------
// PastoralCare / PastoralCare module
// ---------------------------------------------------------------------------

export async function listPastoralCareCases(
  mosqueId: string,
  opts?: { status?: PastoralCareCase["status"] }
): Promise<PastoralCareCase[]> {
  let query = db()
    .from("pastoral_cases")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("opened_at", { ascending: false });
  if (opts?.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw error;
  return data as PastoralCareCase[];
}

export async function getPastoralCareCaseById(
  id: string,
  mosqueId: string
): Promise<PastoralCareCase | null> {
  const { data, error } = await db()
    .from("pastoral_cases")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as PastoralCareCase | null;
}

export async function createPastoralCareCase(
  mosqueId: string,
  data: Omit<PastoralCareCase, "id" | "mosque_id" | "created_at" | "updated_at" | "opened_at" | "closed_at"> &
    Partial<Pick<PastoralCareCase, "opened_at" | "closed_at">>
): Promise<PastoralCareCase> {
  const { data: row, error } = await db()
    .from("pastoral_cases")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as PastoralCareCase;
}

export async function updatePastoralCareCase(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<
      PastoralCareCase,
      | "status"
      | "severity"
      | "summary"
      | "next_action"
      | "next_action_due"
      | "case_type"
      | "contact_phone"
      | "contact_email"
      | "closed_at"
    >
  >
): Promise<PastoralCareCase | null> {
  const { data, error } = await db()
    .from("pastoral_cases")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as PastoralCareCase | null;
}

export async function listPastoralCareVisits(
  caseId: string,
  mosqueId: string
): Promise<PastoralCareVisit[]> {
  const { data, error } = await db()
    .from("pastoral_visits")
    .select("*")
    .eq("case_id", caseId)
    .eq("mosque_id", mosqueId)
    .order("visited_at", { ascending: false });
  if (error) throw error;
  return data as PastoralCareVisit[];
}

export async function createPastoralCareVisit(
  mosqueId: string,
  data: Omit<PastoralCareVisit, "id" | "mosque_id" | "created_at">
): Promise<PastoralCareVisit> {
  const { data: row, error } = await db()
    .from("pastoral_visits")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as PastoralCareVisit;
}

export async function listPastoralCareRegister(
  mosqueId: string,
  registerType?: PastoralCareRegisterEntry["register_type"]
): Promise<PastoralCareRegisterEntry[]> {
  let query = db()
    .from("pastoral_register_entries")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("date_of_event", { ascending: false });
  if (registerType) query = query.eq("register_type", registerType);
  const { data, error } = await query;
  if (error) throw error;
  return data as PastoralCareRegisterEntry[];
}

export async function createPastoralCareRegister(
  mosqueId: string,
  data: Omit<PastoralCareRegisterEntry, "id" | "mosque_id" | "created_at" | "updated_at">
): Promise<PastoralCareRegisterEntry> {
  const { data: row, error } = await db()
    .from("pastoral_register_entries")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as PastoralCareRegisterEntry;
}

export async function updatePastoralCareRegister(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<
      PastoralCareRegisterEntry,
      | "full_name"
      | "relationship"
      | "contact_email"
      | "contact_phone"
      | "address"
      | "last_contact_at"
      | "notes"
    >
  >
): Promise<PastoralCareRegisterEntry | null> {
  const { data, error } = await db()
    .from("pastoral_register_entries")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as PastoralCareRegisterEntry | null;
}

export async function listPastoralCareAlerts(
  mosqueId: string,
  opts?: { status?: PastoralCareAlert["status"] }
): Promise<PastoralCareAlert[]> {
  let query = db()
    .from("pastoral_alerts")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (opts?.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw error;
  return data as PastoralCareAlert[];
}

export async function upsertPastoralCareAlert(
  mosqueId: string,
  data: Omit<PastoralCareAlert, "id" | "mosque_id" | "created_at" | "updated_at"> &
    Partial<Pick<PastoralCareAlert, "id">>
): Promise<PastoralCareAlert> {
  const { data: row, error } = await db()
    .from("pastoral_alerts")
    .upsert(
      { ...data, mosque_id: mosqueId, updated_at: new Date().toISOString() },
      { onConflict: "mosque_id,member_id,alert_type" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as PastoralCareAlert;
}

export async function updatePastoralCareAlert(
  id: string,
  mosqueId: string,
  updates: Partial<
    Pick<
      PastoralCareAlert,
      "status" | "acknowledged_by_admin_user_id" | "acknowledged_at" | "case_id" | "severity"
    >
  >
): Promise<PastoralCareAlert | null> {
  const { data, error } = await db()
    .from("pastoral_alerts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as PastoralCareAlert | null;
}

// ---------------------------------------------------------------------------
// Communications hub
// ---------------------------------------------------------------------------

export async function listMessageTemplates(
  mosqueId: string
): Promise<MessageTemplate[]> {
  const { data, error } = await db()
    .from("message_templates")
    .select("*")
    .or(`mosque_id.eq.${mosqueId},mosque_id.is.null`)
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return data as MessageTemplate[];
}

export async function getMessageTemplateByKey(
  mosqueId: string,
  templateKey: string
): Promise<MessageTemplate | null> {
  const { data, error } = await db()
    .from("message_templates")
    .select("*")
    .eq("template_key", templateKey)
    .or(`mosque_id.eq.${mosqueId},mosque_id.is.null`)
    .order("mosque_id", { ascending: true, nullsFirst: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as MessageTemplate | undefined) ?? null;
}

export async function upsertMessageTemplate(
  mosqueId: string | null,
  data: Omit<MessageTemplate, "id" | "mosque_id" | "created_at" | "updated_at">
): Promise<MessageTemplate> {
  const { data: row, error } = await db()
    .from("message_templates")
    .upsert(
      { ...data, mosque_id: mosqueId, updated_at: new Date().toISOString() },
      { onConflict: "mosque_id,template_key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as MessageTemplate;
}

export async function deleteMessageTemplate(
  mosqueId: string,
  id: string
): Promise<{ deleted: boolean }> {
  const { error, count } = await db()
    .from("message_templates")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .eq("is_system", false);
  if (error) throw error;
  return { deleted: (count ?? 0) > 0 };
}

export async function listMessages(
  mosqueId: string,
  opts?: { memberId?: string; newcomerId?: string; templateKey?: string; limit?: number }
): Promise<Message[]> {
  let query = db()
    .from("messages")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (opts?.memberId) query = query.eq("recipient_member_id", opts.memberId);
  if (opts?.newcomerId) query = query.eq("recipient_newcomer_id", opts.newcomerId);
  if (opts?.templateKey) query = query.eq("template_key", opts.templateKey);
  if (opts?.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data as Message[];
}

export async function logMessages(
  mosqueId: string,
  rows: Array<
    Omit<Message, "id" | "mosque_id" | "created_at"> &
      Partial<Pick<Message, "metadata" | "status">>
  >
): Promise<Message[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((row) => ({ ...row, mosque_id: mosqueId }));
  const { data, error } = await db()
    .from("messages")
    .insert(payload)
    .select("*");
  if (error) throw error;
  return data as Message[];
}

export async function listAutomationSettings(
  mosqueId: string
): Promise<AutomationSetting[]> {
  const { data, error } = await db()
    .from("automation_settings")
    .select("*")
    .eq("mosque_id", mosqueId);
  if (error) throw error;
  return data as AutomationSetting[];
}

export async function upsertAutomationSetting(
  mosqueId: string,
  automationKey: string,
  enabled: boolean,
  config?: Record<string, unknown>
): Promise<AutomationSetting> {
  const { data, error } = await db()
    .from("automation_settings")
    .upsert(
      {
        mosque_id: mosqueId,
        automation_key: automationKey,
        enabled,
        config: config ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mosque_id,automation_key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as AutomationSetting;
}

// ---------------------------------------------------------------------------
// Mentor / Progression
// ---------------------------------------------------------------------------

export async function recordProgressionSignoff(
  mosqueId: string,
  data: Omit<ProgressionSignoff, "id" | "mosque_id" | "created_at">
): Promise<ProgressionSignoff> {
  const { data: row, error } = await db()
    .from("discipleship_signoffs")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as ProgressionSignoff;
}

export async function listProgressionSignoffs(
  mosqueId: string,
  memberId: string
): Promise<ProgressionSignoff[]> {
  const { data, error } = await db()
    .from("discipleship_signoffs")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProgressionSignoff[];
}

export async function listMentorAssignments(
  mosqueId: string,
  opts?: { active?: boolean }
): Promise<MentorAssignment[]> {
  let query = db()
    .from("mentor_assignments")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("started_at", { ascending: false });
  if (opts?.active) {
    query = query.is("ended_at", null);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as MentorAssignment[];
}

export async function createMentorAssignment(
  mosqueId: string,
  data: Omit<MentorAssignment, "id" | "mosque_id" | "created_at" | "updated_at">
): Promise<MentorAssignment> {
  const { data: row, error } = await db()
    .from("mentor_assignments")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as MentorAssignment;
}

export async function updateMentorAssignment(
  id: string,
  mosqueId: string,
  updates: Partial<Pick<MentorAssignment, "ended_at" | "notes">>
): Promise<MentorAssignment | null> {
  const { data, error } = await db()
    .from("mentor_assignments")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as MentorAssignment | null;
}

export async function listMentorContacts(
  mosqueId: string,
  opts?: { assignmentId?: string }
): Promise<MentorContact[]> {
  let query = db()
    .from("mentor_contact_log")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("contacted_at", { ascending: false });
  if (opts?.assignmentId) {
    query = query.eq("assignment_id", opts.assignmentId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as MentorContact[];
}

export async function createMentorContact(
  mosqueId: string,
  data: Omit<MentorContact, "id" | "mosque_id" | "created_at">
): Promise<MentorContact> {
  const { data: row, error } = await db()
    .from("mentor_contact_log")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as MentorContact;
}

export async function listEventRitualRoles(
  eventId: string,
  mosqueId: string
): Promise<EventRitualRole[]> {
  const { data, error } = await db()
    .from("event_ritual_roles")
    .select("*")
    .eq("event_id", eventId)
    .eq("mosque_id", mosqueId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data as EventRitualRole[];
}

export async function upsertEventRitualRoles(
  mosqueId: string,
  rows: Array<
    Omit<EventRitualRole, "id" | "mosque_id" | "created_at" | "updated_at">
  >
): Promise<EventRitualRole[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((row) => ({
    ...row,
    mosque_id: mosqueId,
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await db()
    .from("event_ritual_roles")
    .upsert(payload, { onConflict: "event_id,role_title" })
    .select("*");
  if (error) throw error;
  return data as EventRitualRole[];
}

export async function listOfficerLadder(
  mosqueId: string
): Promise<OfficerLadderRung[]> {
  const { data, error } = await db()
    .from("officer_ladder")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data as OfficerLadderRung[];
}

export async function upsertOfficerLadderRung(
  mosqueId: string,
  data: Omit<OfficerLadderRung, "id" | "mosque_id" | "created_at" | "updated_at">
): Promise<OfficerLadderRung> {
  const { data: row, error } = await db()
    .from("officer_ladder")
    .upsert(
      { ...data, mosque_id: mosqueId, updated_at: new Date().toISOString() },
      { onConflict: "mosque_id,rung_label" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as OfficerLadderRung;
}

export async function patchOfficerLadderRung(
  id: string,
  mosqueId: string,
  patch: Partial<Pick<OfficerLadderRung,
    "current_member_id" | "successor_member_id" | "notes" | "rung_label" | "sort_order"
  >>
): Promise<OfficerLadderRung> {
  const { data, error } = await db()
    .from("officer_ladder")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .single();
  if (error) throw error;
  return data as OfficerLadderRung;
}

export async function deleteOfficerLadderRung(
  id: string,
  mosqueId: string
): Promise<void> {
  const { error } = await db()
    .from("officer_ladder")
    .delete()
    .eq("id", id)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
}

/**
 * Public-facing officer entry, joining the officer_ladder rung to the
 * member assigned to it. Only members who have explicitly opted in via
 * `members.show_on_website = true` are returned, regardless of whether
 * they currently hold a rung. This is the single read path used by the
 * public website Officers section.
 *
 * Successors are intentionally excluded; the public site only ever
 * shows the current officer, never the line of discipleship.
 */
export type PublicOfficer = {
  rung_id: string;
  rung_label: string;
  sort_order: number;
  member_id: string;
  full_name: string;
  rank: string | null;
  public_bio: string | null;
};

export async function listPublicOfficers(
  mosqueId: string
): Promise<PublicOfficer[]> {
  const { data, error } = await db()
    .from("officer_ladder")
    .select(
      `id, rung_label, sort_order, current_member_id,
       members:current_member_id(id, full_name, rank, public_bio, show_on_website, membership_status)`
    )
    .eq("mosque_id", mosqueId)
    .not("current_member_id", "is", null)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  type JoinedMember = {
    id: string;
    full_name: string;
    rank: string | null;
    public_bio: string | null;
    show_on_website: boolean;
    membership_status: string;
  };
  type Row = {
    id: string;
    rung_label: string;
    sort_order: number;
    current_member_id: string | null;
    // PostgREST returns the embedded resource as either a single object
    // or an array depending on whether the FK relationship is uniquely
    // inferred. Handle both shapes defensively.
    members: JoinedMember | JoinedMember[] | null;
  };
  return ((data ?? []) as unknown as Row[])
    .map((row) => {
      const member = Array.isArray(row.members)
        ? row.members[0] ?? null
        : row.members;
      if (
        !member ||
        member.show_on_website !== true ||
        member.membership_status !== "active"
      ) {
        return null;
      }
      return {
        rung_id: row.id,
        rung_label: row.rung_label,
        sort_order: row.sort_order,
        member_id: member.id,
        full_name: member.full_name,
        rank: member.rank,
        public_bio: member.public_bio,
      } satisfies PublicOfficer;
    })
    .filter((entry): entry is PublicOfficer => entry != null);
}

// ---------------------------------------------------------------------------
// Network layer
// ---------------------------------------------------------------------------

export async function listNetworks(): Promise<Network[]> {
  const { data, error } = await db()
    .from("networks")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Network[];
}

export async function getNetworkById(id: string): Promise<Network | null> {
  const { data, error } = await db()
    .from("networks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Network | null;
}

export async function getNetworkBySlug(slug: string): Promise<Network | null> {
  const { data, error } = await db()
    .from("networks")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as Network | null;
}

export async function createNetwork(
  data: Omit<Network, "id" | "created_at" | "updated_at">
): Promise<Network> {
  const { data: row, error } = await db()
    .from("networks")
    .insert(data)
    .select("*")
    .single();
  if (error) throw error;
  return row as Network;
}

export async function updateNetwork(
  id: string,
  updates: Partial<Omit<Network, "id" | "created_at" | "updated_at">>
): Promise<Network | null> {
  const { data, error } = await db()
    .from("networks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Network | null;
}

export async function listMosquesByNetwork(networkId: string): Promise<Mosque[]> {
  const { data, error } = await db()
    .from("mosques")
    .select("*")
    .eq("network_id", networkId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Mosque[];
}

export async function setMosqueNetwork(
  mosqueId: string,
  networkId: string | null
): Promise<void> {
  const { error } = await db()
    .from("mosques")
    .update({ network_id: networkId })
    .eq("id", mosqueId);
  if (error) throw error;
}

export async function listMemberRanks(
  mosqueId: string,
  opts?: { memberId?: string; scope?: MemberRank["scope"] }
): Promise<MemberRank[]> {
  let query = db()
    .from("member_ranks")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("conferred_on", { ascending: false, nullsFirst: false });
  if (opts?.memberId) query = query.eq("member_id", opts.memberId);
  if (opts?.scope) query = query.eq("scope", opts.scope);
  const { data, error } = await query;
  if (error) throw error;
  return data as MemberRank[];
}

export async function createMemberRank(
  mosqueId: string,
  data: Omit<MemberRank, "id" | "mosque_id" | "created_at" | "updated_at">
): Promise<MemberRank> {
  const { data: row, error } = await db()
    .from("member_ranks")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as MemberRank;
}

export async function deleteMemberRank(id: string, mosqueId: string): Promise<void> {
  const { error } = await db()
    .from("member_ranks")
    .delete()
    .eq("id", id)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
}

export async function listMosqueVisits(
  newcomerMosqueId: string,
  opts?: { limit?: number }
): Promise<MosqueVisit[]> {
  let query = db()
    .from("mosque_visits")
    .select("*")
    .eq("newcomer_mosque_id", newcomerMosqueId)
    .order("visit_date", { ascending: false });
  if (opts?.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data as MosqueVisit[];
}

export async function createMosqueVisit(
  data: Omit<MosqueVisit, "id" | "created_at">
): Promise<MosqueVisit> {
  const { data: row, error } = await db()
    .from("mosque_visits")
    .insert(data)
    .select("*")
    .single();
  if (error) throw error;
  return row as MosqueVisit;
}

export async function deleteMosqueVisit(id: string, mosqueId: string): Promise<void> {
  const { error } = await db()
    .from("mosque_visits")
    .delete()
    .eq("id", id)
    .eq("newcomer_mosque_id", mosqueId);
  if (error) throw error;
}

export async function listNetworkOfficers(
  networkId: string
): Promise<NetworkOfficerDirectoryEntry[]> {
  const { data, error } = await db()
    .from("network_officer_directory")
    .select("*")
    .eq("network_id", networkId)
    .order("officer_sort_order", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as NetworkOfficerDirectoryEntry[];
}

export async function listMosqueAnnualReturns(
  networkId?: string
): Promise<MosqueAnnualReturn[]> {
  let query = db()
    .from("mosque_annual_returns")
    .select("*")
    .order("mosque_name", { ascending: true });
  if (networkId) query = query.eq("network_id", networkId);
  const { data, error } = await query;
  if (error) throw error;
  return data as MosqueAnnualReturn[];
}

// ---------------------------------------------------------------------------
// Compliance & trust
// ---------------------------------------------------------------------------

export async function listMemberConsents(
  mosqueId: string,
  memberId?: string
): Promise<MemberConsent[]> {
  let query = db()
    .from("member_consents")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("granted_at", { ascending: false });
  if (memberId) query = query.eq("member_id", memberId);
  const { data, error } = await query;
  if (error) throw error;
  return data as MemberConsent[];
}

export async function recordMemberConsent(
  mosqueId: string,
  data: Omit<MemberConsent, "id" | "mosque_id" | "created_at" | "updated_at">
): Promise<MemberConsent> {
  // Revoke any active consent of the same key for this member first.
  await db()
    .from("member_consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("mosque_id", mosqueId)
    .eq("member_id", data.member_id)
    .eq("consent_key", data.consent_key)
    .is("revoked_at", null);
  const { data: row, error } = await db()
    .from("member_consents")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as MemberConsent;
}

export async function revokeMemberConsent(
  id: string,
  mosqueId: string
): Promise<void> {
  const { error } = await db()
    .from("member_consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
}

export async function getDataRetentionSettings(
  mosqueId: string
): Promise<DataRetentionSettings | null> {
  const { data, error } = await db()
    .from("data_retention_settings")
    .select("*")
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return data as DataRetentionSettings | null;
}

export async function upsertDataRetentionSettings(
  mosqueId: string,
  data: Partial<
    Omit<DataRetentionSettings, "id" | "mosque_id" | "created_at" | "updated_at">
  >
): Promise<DataRetentionSettings> {
  const { data: row, error } = await db()
    .from("data_retention_settings")
    .upsert(
      {
        mosque_id: mosqueId,
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mosque_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as DataRetentionSettings;
}

export async function listSubjectAccessRequests(
  mosqueId: string
): Promise<SubjectAccessRequest[]> {
  const { data, error } = await db()
    .from("subject_access_requests")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as SubjectAccessRequest[];
}

export async function createSubjectAccessRequest(
  mosqueId: string,
  data: Omit<
    SubjectAccessRequest,
    "id" | "mosque_id" | "created_at" | "updated_at"
  >
): Promise<SubjectAccessRequest> {
  const { data: row, error } = await db()
    .from("subject_access_requests")
    .insert({ ...data, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return row as SubjectAccessRequest;
}

export async function updateSubjectAccessRequest(
  id: string,
  mosqueId: string,
  updates: Partial<
    Omit<SubjectAccessRequest, "id" | "mosque_id" | "created_at" | "updated_at">
  >
): Promise<SubjectAccessRequest | null> {
  const { data, error } = await db()
    .from("subject_access_requests")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as SubjectAccessRequest | null;
}

export async function archiveMember(
  memberId: string,
  mosqueId: string,
  reason: string
): Promise<Member | null> {
  const { data, error } = await db()
    .from("members")
    .update({
      archived_at: new Date().toISOString(),
      archived_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("mosque_id", mosqueId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Member | null;
}

export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  const { data, error } = await db()
    .from("admin_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as AdminUser | null;
}

export async function updateAdminUserMfa(
  id: string,
  updates: {
    mfa_enabled?: boolean;
    mfa_secret?: string | null;
    mfa_backup_codes?: string[] | null;
    mfa_enrolled_at?: string | null;
  }
): Promise<AdminUser | null> {
  const { data, error } = await db()
    .from("admin_users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as AdminUser | null;
}

/**
 * Subject Access Request: gather all data we hold for a member into a
 * single JSON object suitable for download or email.
 */
export async function buildSubjectAccessExport(
  memberId: string,
  mosqueId: string
): Promise<Record<string, unknown>> {
  const supabase = db();
  const tables = [
    "members",
    "member_giving",
    "member_giving_instalments",
    "rsvps",
    "payments",
    "donations",
    "gift_aid_declarations",
    "member_consents",
    "member_ranks",
    "discipleship_signoffs",
    "mentor_assignments",
    "mentor_contact_log",
    "messages",
    "pastoral_cases",
    "pastoral_visits",
  ];
  const result: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    mosque_id: mosqueId,
    member_id: memberId,
  };
  for (const table of tables) {
    const filterField =
      table === "members"
        ? "id"
        : table === "rsvps" || table === "payments" || table === "donations"
          ? "user_email"
          : table === "mentor_assignments" || table === "mentor_contact_log"
            ? "mentor_member_id"
            : "member_id";
    let query = supabase.from(table).select("*").eq("mosque_id", mosqueId);
    if (filterField === "user_email") {
      const { data: m } = await supabase
        .from("members")
        .select("email")
        .eq("id", memberId)
        .maybeSingle();
      if (m?.email) query = query.eq("user_email", m.email);
      else {
        result[table] = [];
        continue;
      }
    } else {
      query = query.eq(filterField, memberId);
    }
    const { data, error } = await query;
    if (error) {
      result[table] = { error: error.message };
    } else {
      result[table] = data;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Background job queue
// ---------------------------------------------------------------------------

export async function enqueueJob(
  data: Omit<
    Job,
    | "id"
    | "status"
    | "started_at"
    | "finished_at"
    | "attempts"
    | "last_error"
    | "created_at"
    | "updated_at"
  > &
    Partial<Pick<Job, "max_attempts">>
): Promise<Job> {
  const { data: row, error } = await db()
    .from("jobs")
    .insert({
      ...data,
      status: "queued",
      attempts: 0,
      max_attempts: data.max_attempts ?? 3,
    })
    .select("*")
    .single();
  if (error) throw error;
  return row as Job;
}

export async function listJobs(
  opts?: { mosqueId?: string | null; status?: JobStatus; limit?: number }
): Promise<Job[]> {
  let query = db()
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts && opts.mosqueId === null) {
    query = query.is("mosque_id", null);
  } else if (opts?.mosqueId) {
    query = query.eq("mosque_id", opts.mosqueId);
  }
  if (opts?.status) query = query.eq("status", opts.status);
  if (opts?.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data as Job[];
}

export async function claimNextJobs(limit = 5): Promise<Job[]> {
  const nowIso = new Date().toISOString();
  const { data: newcomers, error: pickError } = await db()
    .from("jobs")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (pickError) throw pickError;
  if (!newcomers || newcomers.length === 0) return [];

  const ids = newcomers.map((c) => c.id);
  const { data: claimed, error: claimError } = await db()
    .from("jobs")
    .update({
      status: "in_progress",
      started_at: nowIso,
      updated_at: nowIso,
    })
    .in("id", ids)
    .eq("status", "queued")
    .select("*");
  if (claimError) throw claimError;
  return (claimed ?? []) as Job[];
}

export async function completeJob(
  id: string,
  result: { ok: boolean; error?: string }
): Promise<Job | null> {
  const job = await db().from("jobs").select("*").eq("id", id).maybeSingle();
  if (job.error || !job.data) return null;
  const current = job.data as Job;
  const attempts = current.attempts + 1;
  const status: JobStatus = result.ok
    ? "succeeded"
    : attempts >= current.max_attempts
      ? "failed"
      : "queued";
  const updates: Record<string, unknown> = {
    status,
    attempts,
    updated_at: new Date().toISOString(),
    last_error: result.error ?? null,
  };
  if (status === "succeeded" || status === "failed") {
    updates.finished_at = new Date().toISOString();
  } else if (status === "queued") {
    // Backoff: 1m * attempts
    updates.scheduled_at = new Date(
      Date.now() + 60_000 * attempts
    ).toISOString();
    updates.started_at = null;
  }
  const { data, error } = await db()
    .from("jobs")
    .update(updates)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Job | null;
}

// ---------------------------------------------------------------------------
// Integration credentials
// ---------------------------------------------------------------------------

export async function listIntegrationCredentials(
  mosqueId: string
): Promise<IntegrationCredentials[]> {
  const { data, error } = await db()
    .from("integration_credentials")
    .select("*")
    .eq("mosque_id", mosqueId);
  if (error) throw error;
  return data as IntegrationCredentials[];
}

export async function upsertIntegrationCredentials(
  mosqueId: string,
  provider: IntegrationProvider,
  data: Partial<
    Omit<
      IntegrationCredentials,
      "id" | "mosque_id" | "provider" | "created_at" | "updated_at"
    >
  >
): Promise<IntegrationCredentials> {
  const { data: row, error } = await db()
    .from("integration_credentials")
    .upsert(
      {
        mosque_id: mosqueId,
        provider,
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mosque_id,provider" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as IntegrationCredentials;
}

export async function deleteIntegrationCredentials(
  mosqueId: string,
  provider: IntegrationProvider
): Promise<void> {
  const { error } = await db()
    .from("integration_credentials")
    .delete()
    .eq("mosque_id", mosqueId)
    .eq("provider", provider);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Platform-wide aggregates (operator console)
// ---------------------------------------------------------------------------

export type PlatformMosqueStats = {
  mosque_id: string;
  mosque_slug: string;
  mosque_name: string;
  network_id: string | null;
  members: number;
  active_members: number;
  upcoming_events: number;
  outstanding_giving: number;
  paid_giving_amount: number;
  donations_amount: number;
  last_service_at: string | null;
};

// ---------------------------------------------------------------------------
// Mosque feature flags
// ---------------------------------------------------------------------------

export async function listMosqueFeatureFlags(
  mosqueId: string
): Promise<MosqueFeatureFlag[]> {
  const { data, error } = await db()
    .from("mosque_feature_flags")
    .select("*")
    .eq("mosque_id", mosqueId);
  if (error) throw error;
  return (data ?? []) as MosqueFeatureFlag[];
}

export async function setMosqueFeatureFlag(
  mosqueId: string,
  flagKey: string,
  enabled: boolean,
  opts?: { notes?: string | null; updated_by_email?: string | null }
): Promise<MosqueFeatureFlag> {
  const { data, error } = await db()
    .from("mosque_feature_flags")
    .upsert(
      {
        mosque_id: mosqueId,
        flag_key: flagKey,
        enabled,
        notes: opts?.notes ?? null,
        updated_by_email: opts?.updated_by_email ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mosque_id,flag_key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as MosqueFeatureFlag;
}

export async function getPlatformMosqueStats(): Promise<PlatformMosqueStats[]> {
  const mosques = await listMosques();
  const stats: PlatformMosqueStats[] = [];
  for (const mosque of mosques) {
    const [members, events, giving, donations] = await Promise.all([
      getMembers(mosque.id, {}),
      getEvents(mosque.id, {}),
      getMemberGiving(mosque.id, {}),
      getDonations(mosque.id),
    ]);
    const now = new Date();
    const upcoming = events.filter((e) => new Date(e.event_date) >= now);
    const past = events
      .filter((e) => new Date(e.event_date) < now)
      .sort((a, b) => +new Date(b.event_date) - +new Date(a.event_date));

    stats.push({
      mosque_id: mosque.id,
      mosque_slug: mosque.slug,
      mosque_name: mosque.name,
      network_id: mosque.network_id,
      members: members.length,
      active_members: members.filter((m) => m.membership_status === "active").length,
      upcoming_events: upcoming.length,
      outstanding_giving: giving.filter((d) => d.status === "outstanding" || d.status === "overdue").length,
      paid_giving_amount: giving
        .filter((d) => d.status === "paid")
        .reduce((sum, d) => sum + Number(d.amount ?? 0), 0),
      donations_amount: donations.reduce((sum, d) => sum + Number(d.amount ?? 0), 0),
      last_service_at: past[0]?.event_date ?? null,
    });
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Guests directory and guest invitations
// ---------------------------------------------------------------------------

export async function listGuests(
  mosqueId: string,
  opts?: {
    search?: string;
    includeArchived?: boolean;
    guestCategory?: "guest" | "honorary_guest";
  }
): Promise<Guest[]> {
  let query = db()
    .from("guests")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("last_seen_event_id", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (!opts?.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (opts?.guestCategory) {
    query = query.eq("guest_category", opts.guestCategory);
  }
  if (opts?.search) {
    const term = `%${opts.search}%`;
    query = query.or(
      `full_name.ilike.${term},email.ilike.${term},mother_mosque_name.ilike.${term}`
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Guest[];
}

export async function getGuestById(
  id: string,
  mosqueId: string
): Promise<Guest | null> {
  const { data, error } = await db()
    .from("guests")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return (data as Guest | null) ?? null;
}

export async function findGuestByEmail(
  mosqueId: string,
  email: string
): Promise<Guest | null> {
  const { data, error } = await db()
    .from("guests")
    .select("*")
    .eq("mosque_id", mosqueId)
    .ilike("email", email)
    .maybeSingle();
  if (error) throw error;
  return (data as Guest | null) ?? null;
}

export async function findGuestByNameAndMosque(
  mosqueId: string,
  fullName: string,
  motherMosqueName: string | null
): Promise<Guest | null> {
  let query = db()
    .from("guests")
    .select("*")
    .eq("mosque_id", mosqueId)
    .ilike("full_name", fullName)
    .limit(1);
  if (motherMosqueName) {
    query = query.ilike("mother_mosque_name", motherMosqueName);
  } else {
    query = query.is("mother_mosque_name", null);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as Guest | null) ?? null;
}

export async function createGuest(
  mosqueId: string,
  guest: Partial<Omit<Guest, "id" | "mosque_id" | "created_at" | "updated_at">> & {
    full_name: string;
  }
): Promise<Guest> {
  const { data, error } = await db()
    .from("guests")
    .insert({ ...guest, mosque_id: mosqueId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Guest;
}

export async function updateGuest(
  id: string,
  mosqueId: string,
  patch: Partial<Omit<Guest, "id" | "mosque_id" | "created_at">>
): Promise<Guest> {
  const { data, error } = await db()
    .from("guests")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Guest;
}

export async function archiveGuest(
  id: string,
  mosqueId: string
): Promise<Guest> {
  return updateGuest(id, mosqueId, {
    archived_at: new Date().toISOString(),
  });
}

export async function restoreGuest(
  id: string,
  mosqueId: string
): Promise<Guest> {
  return updateGuest(id, mosqueId, { archived_at: null });
}

export async function hardDeleteGuestIfUnused(
  id: string,
  mosqueId: string
): Promise<{ deleted: boolean }> {
  const guest = await getGuestById(id, mosqueId);
  if (!guest) return { deleted: false };
  if ((guest.visit_count ?? 0) > 0) return { deleted: false };
  const { error } = await db()
    .from("guests")
    .delete()
    .eq("id", id)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
  return { deleted: true };
}

export async function setGuestNewcomerTokenHash(
  id: string,
  mosqueId: string,
  tokenHash: string
): Promise<Guest> {
  return updateGuest(id, mosqueId, { newcomer_token_hash: tokenHash });
}

export async function getGuestByNewcomerTokenHash(
  tokenHash: string
): Promise<Guest | null> {
  const { data, error } = await db()
    .from("guests")
    .select("*")
    .eq("newcomer_token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  return (data as Guest | null) ?? null;
}

export async function upsertGuest(
  mosqueId: string,
  input: {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    mother_mosque_name?: string | null;
    mother_mosque_number?: string | null;
    constitution?: string | null;
    rank?: string | null;
    dietary_requirements?: string | null;
    is_member?: boolean;
    event_id?: string | null;
    source?:
      | "admin"
      | "member_invite"
      | "self_invite_event"
      | "self_register";
    /** When true, bumps visit_count and updates last_seen_event_id. Defaults to true. */
    recordVisit?: boolean;
  }
): Promise<Guest> {
  const email = input.email?.trim() || null;
  const fullName = input.full_name.trim();
  const motherMosqueName = input.mother_mosque_name?.trim() || null;
  const recordVisit = input.recordVisit !== false;

  const existing = email
    ? await findGuestByEmail(mosqueId, email)
    : await findGuestByNameAndMosque(mosqueId, fullName, motherMosqueName);

  if (existing) {
    return updateGuest(existing.id, mosqueId, {
      full_name: fullName || existing.full_name,
      email: email ?? existing.email,
      phone: input.phone?.trim() ?? existing.phone,
      mother_mosque_name: motherMosqueName ?? existing.mother_mosque_name,
      mother_mosque_number:
        input.mother_mosque_number?.trim() ?? existing.mother_mosque_number,
      constitution: input.constitution?.trim() ?? existing.constitution,
      rank: input.rank?.trim() ?? existing.rank,
      dietary_requirements:
        input.dietary_requirements?.trim() ?? existing.dietary_requirements,
      is_member: input.is_member ?? existing.is_member,
      visit_count: recordVisit ? existing.visit_count + 1 : existing.visit_count,
      last_seen_event_id: recordVisit
        ? (input.event_id ?? existing.last_seen_event_id)
        : existing.last_seen_event_id,
      first_seen_event_id:
        existing.first_seen_event_id ?? input.event_id ?? null,
    });
  }

  return createGuest(mosqueId, {
    full_name: fullName,
    email,
    phone: input.phone?.trim() || null,
    mother_mosque_name: motherMosqueName,
    mother_mosque_number: input.mother_mosque_number?.trim() || null,
    constitution: input.constitution?.trim() || null,
    rank: input.rank?.trim() || null,
    dietary_requirements: input.dietary_requirements?.trim() || null,
    is_member: input.is_member ?? true,
    visit_count: recordVisit ? 1 : 0,
    first_seen_event_id: input.event_id ?? null,
    last_seen_event_id: recordVisit ? (input.event_id ?? null) : null,
    notes: null,
    archived_at: null,
    source: input.source ?? "admin",
  });
}

export async function createGuestInvitation(
  mosqueId: string,
  data: Omit<
    GuestInvitation,
    | "id"
    | "mosque_id"
    | "uses"
    | "created_at"
    | "last_used_at"
    | "revoked_at"
    | "guest_id"
  > & { uses?: number; guest_id?: string | null }
): Promise<GuestInvitation> {
  const { data: row, error } = await db()
    .from("guest_invitations")
    .insert({ ...data, mosque_id: mosqueId, uses: data.uses ?? 0 })
    .select("*")
    .single();
  if (error) throw error;
  return row as GuestInvitation;
}

export async function getGuestInvitationByTokenHash(
  tokenHash: string
): Promise<GuestInvitation | null> {
  const { data, error } = await db()
    .from("guest_invitations")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  return (data as GuestInvitation | null) ?? null;
}

export async function getGuestInvitationById(
  id: string,
  mosqueId: string
): Promise<GuestInvitation | null> {
  const { data, error } = await db()
    .from("guest_invitations")
    .select("*")
    .eq("id", id)
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return (data as GuestInvitation | null) ?? null;
}

export async function listGuestInvitationsForGuest(
  guestId: string,
  mosqueId: string
): Promise<GuestInvitation[]> {
  const { data, error } = await db()
    .from("guest_invitations")
    .select("*")
    .eq("guest_id", guestId)
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GuestInvitation[];
}

export async function listGuestInvitationsForEvent(
  eventId: string,
  mosqueId: string
): Promise<GuestInvitation[]> {
  const { data, error } = await db()
    .from("guest_invitations")
    .select("*")
    .eq("event_id", eventId)
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GuestInvitation[];
}

export async function listGuestInvitationsForMember(
  memberId: string,
  mosqueId: string
): Promise<GuestInvitation[]> {
  const { data, error } = await db()
    .from("guest_invitations")
    .select("*")
    .eq("inviter_member_id", memberId)
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GuestInvitation[];
}

export async function recordGuestInvitationUse(
  id: string,
  currentUses: number
): Promise<GuestInvitation | null> {
  const { data, error } = await db()
    .from("guest_invitations")
    .update({
      uses: currentUses + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as GuestInvitation | null) ?? null;
}

export async function revokeGuestInvitation(
  id: string,
  mosqueId: string
): Promise<void> {
  const { error } = await db()
    .from("guest_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
}

export async function listEventGuestsForMosque(
  mosqueId: string,
  opts?: { eventId?: string; guestId?: string }
): Promise<EventGuest[]> {
  let query = db()
    .from("event_guests")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("created_at", { ascending: false });
  if (opts?.eventId) query = query.eq("event_id", opts.eventId);
  if (opts?.guestId) query = query.eq("guest_id", opts.guestId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as EventGuest[];
}

export async function markEventGuestWelcomeSent(
  ids: string[],
  mosqueId: string
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await db()
    .from("event_guests")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .in("id", ids)
    .eq("mosque_id", mosqueId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Mosque fee defaults & giving year
// ---------------------------------------------------------------------------

export async function getMosqueFeeDefaults(
  mosqueId: string
): Promise<MosqueFeeDefaults | null> {
  const { data, error } = await db()
    .from("mosque_fee_defaults")
    .select("*")
    .eq("mosque_id", mosqueId)
    .maybeSingle();
  if (error) throw error;
  return (data as MosqueFeeDefaults | null) ?? null;
}

export async function upsertMosqueFeeDefaults(
  mosqueId: string,
  input: Omit<MosqueFeeDefaults, "mosque_id" | "updated_at">
): Promise<MosqueFeeDefaults> {
  const { data, error } = await db()
    .from("mosque_fee_defaults")
    .upsert(
      {
        mosque_id: mosqueId,
        ...input,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mosque_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as MosqueFeeDefaults;
}

export async function listMosqueGivingYears(
  mosqueId: string
): Promise<MosqueGivingYear[]> {
  const { data, error } = await db()
    .from("mosque_giving_years")
    .select("*")
    .eq("mosque_id", mosqueId)
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MosqueGivingYear[];
}

export async function getCurrentMosqueYear(
  mosqueId: string
): Promise<MosqueGivingYear | null> {
  const { data, error } = await db()
    .from("mosque_giving_years")
    .select("*")
    .eq("mosque_id", mosqueId)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw error;
  return (data as MosqueGivingYear | null) ?? null;
}

export async function upsertMosqueGivingYear(
  mosqueId: string,
  input: Omit<MosqueGivingYear, "id" | "mosque_id" | "created_at" | "updated_at"> & {
    id?: string;
  }
): Promise<MosqueGivingYear> {
  if (input.is_current) {
    await db()
      .from("mosque_giving_years")
      .update({ is_current: false, updated_at: new Date().toISOString() })
      .eq("mosque_id", mosqueId)
      .eq("is_current", true);
  }

  const payload = {
    mosque_id: mosqueId,
    label: input.label,
    start_date: input.start_date,
    end_date: input.end_date,
    annual_giving_amount: input.annual_giving_amount,
    is_current: input.is_current,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await db()
      .from("mosque_giving_years")
      .update(payload)
      .eq("id", input.id)
      .eq("mosque_id", mosqueId)
      .select("*")
      .single();
    if (error) throw error;
    return data as MosqueGivingYear;
  }

  const { data, error } = await db()
    .from("mosque_giving_years")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as MosqueGivingYear;
}

export async function listHonoraryGuests(mosqueId: string): Promise<Guest[]> {
  return listGuests(mosqueId, { guestCategory: "honorary_guest" });
}
