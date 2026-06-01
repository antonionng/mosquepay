import { createServiceClient } from "@/lib/supabase/server";
import type {
  Lodge,
  LodgeSitePage,
  AdminUser,
  AuditLog,
  Lead,
  LeadActivity,
  Event,
  Rsvp,
  Payment,
  Donation,
  GiftAidDeclaration,
  GiftAidDeclarationEvent,
  LodgeSubscription,
  BlogPost,
  CharityCampaign,
  LodgeDues,
  LodgeFeeDefaults,
  LodgeMasonicYear,
  MemberDues,
  MemberDuesInstalment,
  DuesSchedule,
  DuesScheduleStatus,
  DuesSplitStrategy,
  MeetingCollection,
  GasdsClaim,
  GiftAidClaimBatch,
  GiftAidClaimDeclaration,
  GiftAidClaimItem,
  LedgerEntry,
  BankStatementImport,
  BankTransaction,
  WelfareCase,
  WelfareVisit,
  WelfareRegisterEntry,
  WelfareAlert,
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
  EventSummons,
  EventSummonsSend,
  EventSummonsAccessLink,
  EventFeeOverride,
  MeetingSequence,
  SummonsStatus,
  Province,
  MemberRank,
  LodgeVisit,
  ProvinceOfficerDirectoryEntry,
  LodgeAnnualReturn,
  MemberConsent,
  DataRetentionSettings,
  SubjectAccessRequest,
  Job,
  JobStatus,
  IntegrationCredentials,
  IntegrationProvider,
  LodgeFeatureFlag,
} from "./types";

export * from "./types";
export { resolveLodgeId, getDefaultLodgeId } from "./helpers";

function db() {
  return createServiceClient();
}

// ---------------------------------------------------------------------------
// Lodges
// ---------------------------------------------------------------------------

export async function listLodges(): Promise<Lodge[]> {
  const { data, error } = await db()
    .from("lodges")
    .select("*")
    .order("name");
  if (error) throw error;
  return data as Lodge[];
}

export async function getLodgeBySlug(slug: string): Promise<Lodge | null> {
  const { data, error } = await db()
    .from("lodges")
    .select("*")
    .eq("slug", slug.trim().toLowerCase())
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as Lodge | null;
}

export async function getLodgeByCustomDomain(
  domain: string
): Promise<Lodge | null> {
  const { data, error } = await db()
    .from("lodges")
    .select("*")
    .eq("custom_domain", domain.trim().toLowerCase())
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as Lodge | null;
}

export async function updateLodge(
  id: string,
  updates: Partial<Omit<Lodge, "id" | "created_at" | "updated_at">>
): Promise<Lodge | null> {
  const { data, error } = await db()
    .from("lodges")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Lodge | null;
}

export async function createLodge(
  data: {
    slug: string;
    name: string;
    province_id?: string | null;
  } & Partial<Omit<Lodge, "id" | "created_at" | "updated_at" | "slug" | "name">>
): Promise<Lodge> {
  const insert = {
    is_active: true,
    ...data,
    slug: data.slug.trim().toLowerCase(),
  };
  const { data: row, error } = await db()
    .from("lodges")
    .insert(insert)
    .select("*")
    .single();
  if (error) throw error;
  return row as Lodge;
}

export async function getLodgeById(id: string): Promise<Lodge | null> {
  const { data, error } = await db()
    .from("lodges")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Lodge | null;
}

export async function getAdminUserByEmail(
  email: string,
  lodgeId?: string | null
): Promise<AdminUser | null> {
  let query = db()
    .from("admin_users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .eq("active", true);
  if (lodgeId) {
    query = query.or(`lodge_id.eq.${lodgeId},lodge_id.is.null`);
  }
  const { data, error } = await query
    .order("lodge_id", { ascending: false })
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
    .order("lodge_id", { ascending: true })
    .order("role");
  if (error) throw error;
  return data as AdminUser[];
}

export async function getAdminUserForScope(
  email: string,
  lodgeId: string | null
): Promise<AdminUser | null> {
  let query = db()
    .from("admin_users")
    .select("*")
    .eq("email", email.trim().toLowerCase());
  query =
    lodgeId === null
      ? query.is("lodge_id", null)
      : query.eq("lodge_id", lodgeId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as AdminUser | null;
}

export async function listPlatformAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await db()
    .from("admin_users")
    .select("*")
    .is("lodge_id", null)
    .order("role")
    .order("full_name");
  if (error) throw error;
  return data as AdminUser[];
}

export async function listTenantAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await db()
    .from("admin_users")
    .select("*")
    .not("lodge_id", "is", null)
    .order("lodge_id")
    .order("role")
    .order("full_name");
  if (error) throw error;
  return data as AdminUser[];
}

export async function listAdminUsersForLodge(
  lodgeId: string
): Promise<AdminUser[]> {
  const { data, error } = await db()
    .from("admin_users")
    .select("*")
    .or(`lodge_id.eq.${lodgeId},lodge_id.is.null`)
    .order("role")
    .order("full_name");
  if (error) throw error;
  return data as AdminUser[];
}

export async function createAdminUser(
  data: Pick<AdminUser, "email" | "full_name" | "role" | "active"> & {
    lodge_id: string | null;
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
      lodge_id: string | null;
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
  lodgeId: string,
  limit = 100
): Promise<AuditLog[]> {
  const { data, error } = await db()
    .from("audit_logs")
    .select("*")
    .eq("lodge_id", lodgeId)
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

export async function upsertLodge(
  input: Partial<Omit<Lodge, "id" | "created_at" | "updated_at">> &
    Pick<Lodge, "slug" | "name">
): Promise<Lodge> {
  const { data, error } = await db()
    .from("lodges")
    .upsert(
      { ...input, slug: input.slug.trim().toLowerCase() },
      { onConflict: "slug" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as Lodge;
}

// ---------------------------------------------------------------------------
// Lodge Sites
// ---------------------------------------------------------------------------

export async function getLodgeSite(
  lodgeId: string
): Promise<LodgeSitePage | null> {
  const { data, error } = await db()
    .from("lodge_site_pages")
    .select("*")
    .eq("lodge_id", lodgeId)
    .eq("page_key", "home")
    .maybeSingle();
  if (error) throw error;
  return data as LodgeSitePage | null;
}

export async function updateLodgeSite(
  lodgeId: string,
  updates: Partial<
    Pick<
      LodgeSitePage,
      | "page_title"
      | "page_description"
      | "sections"
      | "custom_pages"
      | "header_settings"
      | "footer_settings"
      | "published"
    >
  >
): Promise<LodgeSitePage> {
  const { data, error } = await db()
    .from("lodge_site_pages")
    .upsert(
      { lodge_id: lodgeId, page_key: "home", ...updates },
      { onConflict: "lodge_id,page_key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as LodgeSitePage;
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function getLeads(
  lodgeId: string,
  opts?: { stage?: string }
): Promise<Lead[]> {
  let query = db()
    .from("leads")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });

  if (opts?.stage) {
    query = query.eq("stage", opts.stage);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Lead[];
}

export async function getLeadById(
  id: string,
  lodgeId: string
): Promise<Lead | null> {
  const { data, error } = await db()
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as Lead | null;
}

export async function addLead(
  lodgeId: string,
  data: Omit<Lead, "id" | "lodge_id" | "created_at" | "updated_at" | "stage_changed_at">
): Promise<Lead> {
  const { data: row, error } = await db()
    .from("leads")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as Lead;
}

export async function updateLead(
  id: string,
  lodgeId: string,
  updates: Partial<
    Pick<
      Lead,
      | "stage"
      | "assigned_to"
      | "proposer_member_id"
      | "proposer_name"
      | "seconder_member_id"
      | "seconder_name"
      | "next_step"
      | "next_step_due_date"
      | "proposal_date"
      | "ballot_date"
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
): Promise<Lead | null> {
  const patch: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  if (updates.stage) {
    patch.stage_changed_at = new Date().toISOString();
  }

  const { data, error } = await db()
    .from("leads")
    .update(patch)
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Lead | null;
}

export async function deleteLead(
  id: string,
  lodgeId: string
): Promise<{ deleted: boolean }> {
  const { error, count } = await db()
    .from("leads")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
  return { deleted: (count ?? 0) > 0 };
}

// ---------------------------------------------------------------------------
// Lead Activities
// ---------------------------------------------------------------------------

export async function getLeadActivities(
  leadId: string,
  lodgeId: string
): Promise<LeadActivity[]> {
  const { data, error } = await db()
    .from("lead_activities")
    .select("*")
    .eq("lead_id", leadId)
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as LeadActivity[];
}

export async function addLeadActivity(
  lodgeId: string,
  data: Omit<LeadActivity, "id" | "lodge_id" | "created_at">
): Promise<LeadActivity> {
  const { data: row, error } = await db()
    .from("lead_activities")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as LeadActivity;
}

export async function updateLeadActivity(
  id: string,
  lodgeId: string,
  updates: Partial<
    Pick<
      LeadActivity,
      | "title"
      | "description"
      | "meeting_date"
      | "attendees"
      | "due_date"
      | "completed"
    >
  >
): Promise<LeadActivity | null> {
  const { data, error } = await db()
    .from("lead_activities")
    .update(updates)
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as LeadActivity | null;
}

export async function getLatestLeadActivity(
  leadId: string,
  lodgeId: string
): Promise<LeadActivity | null> {
  const { data, error } = await db()
    .from("lead_activities")
    .select("*")
    .eq("lead_id", leadId)
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as LeadActivity | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function getEvents(
  lodgeId: string,
  opts?: { published?: boolean; upcoming?: boolean }
): Promise<Event[]> {
  let query = db()
    .from("events")
    .select("*")
    .eq("lodge_id", lodgeId)
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
  lodgeId: string
): Promise<Event | null> {
  const { data, error } = await db()
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as Event | null;
}

export async function getEventBySlug(
  slug: string,
  lodgeId: string
): Promise<Event | null> {
  const { data, error } = await db()
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("lodge_id", lodgeId)
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
  | "summons_status"
  | "summons_auto_drafted_at"
  | "summons_approved_at"
  | "summons_approved_by_email"
  | "summons_last_sent_at"
  | "dining_waived_for_all"
  // Per-meeting close (migration 059). Defaulted in DB; callers don't set.
  | "meeting_closed_at"
  | "meeting_closed_by_email"
  | "meeting_close_notes";

export async function addEvent(
  lodgeId: string,
  data: Omit<Event, "id" | "lodge_id" | "created_at" | "updated_at" | AddEventOptional> &
    Partial<Pick<Event, AddEventOptional>>
): Promise<Event> {
  const { data: row, error } = await db()
    .from("events")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as Event;
}

export async function updateEvent(
  id: string,
  lodgeId: string,
  updates: Partial<Omit<Event, "id" | "lodge_id" | "created_at">>
): Promise<Event | null> {
  const { data, error } = await db()
    .from("events")
    .update(updates)
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Event | null;
}

// ---------------------------------------------------------------------------
// RSVPs
// ---------------------------------------------------------------------------

export async function getRsvpsByEventId(
  eventId: string,
  lodgeId: string
): Promise<Rsvp[]> {
  const { data, error } = await db()
    .from("rsvps")
    .select("*")
    .eq("event_id", eventId)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
  return data as Rsvp[];
}

export async function getRsvpById(
  id: string,
  lodgeId: string
): Promise<Rsvp | null> {
  const { data, error } = await db()
    .from("rsvps")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as Rsvp | null;
}

type RsvpWineFields =
  | "raffle_wine_pledged"
  | "raffle_wine_bottles"
  | "raffle_wine_note";

export async function addRsvp(
  lodgeId: string,
  data: Omit<Rsvp, "id" | "lodge_id" | "created_at" | "updated_at" | RsvpWineFields> &
    Partial<Pick<Rsvp, RsvpWineFields>>
): Promise<Rsvp> {
  const { data: row, error } = await db()
    .from("rsvps")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as Rsvp;
}

export async function updateRsvp(
  id: string,
  lodgeId: string,
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
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Rsvp | null;
}

export async function getRsvpByEventAndEmail(
  eventId: string,
  email: string,
  lodgeId: string
): Promise<Rsvp | null> {
  const { data, error } = await db()
    .from("rsvps")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_email", email.trim().toLowerCase())
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as Rsvp | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function getPayments(lodgeId: string): Promise<Payment[]> {
  const { data, error } = await db()
    .from("payments")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Payment[];
}

/**
 * Payments linked to a specific meeting. Used by the admin meeting detail
 * page's "Money raised" panel — pulls every row whose `event_id` matches,
 * regardless of `status`, so the caller can decide which buckets (succeeded,
 * pending, refunded) to surface.
 */
export async function getPaymentsByEventId(
  eventId: string,
  lodgeId: string,
): Promise<Payment[]> {
  const { data, error } = await db()
    .from("payments")
    .select("*")
    .eq("lodge_id", lodgeId)
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

// Lookup by Mooov-side payment id (e.g. don_<lodge>_<rand>). The Mooov webhook
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
  lodgeId: string
): Promise<Payment | null> {
  const { data, error } = await db()
    .from("payments")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as Payment | null;
}

export async function getDonationById(
  id: string,
  lodgeId: string
): Promise<Donation | null> {
  const { data, error } = await db()
    .from("donations")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as Donation | null;
}

export async function addPayment(
  lodgeId: string,
  data: Omit<Payment, "id" | "lodge_id" | "created_at" | "updated_at">
): Promise<Payment> {
  const { data: row, error } = await db()
    .from("payments")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as Payment;
}

export async function updatePayment(
  id: string,
  lodgeId: string,
  updates: Partial<
    Omit<Payment, "id" | "lodge_id" | "created_at">
  >
): Promise<Payment | null> {
  const { data, error } = await db()
    .from("payments")
    .update(updates)
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Payment | null;
}

// ---------------------------------------------------------------------------
// Donations
// ---------------------------------------------------------------------------

export async function getDonations(lodgeId: string): Promise<Donation[]> {
  const { data, error } = await db()
    .from("donations")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Donation[];
}

export async function addDonation(
  lodgeId: string,
  data: Omit<
    Donation,
    | "id"
    | "lodge_id"
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
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as Donation;
}

export async function updateDonation(
  id: string,
  lodgeId: string,
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
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Donation | null;
}

export async function getGiftAidClaimBatches(
  lodgeId: string
): Promise<GiftAidClaimBatch[]> {
  const { data, error } = await db()
    .from("gift_aid_claim_batches")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as GiftAidClaimBatch[];
}

export async function createGiftAidClaimBatch(
  lodgeId: string,
  data: Omit<
    GiftAidClaimBatch,
    | "id"
    | "lodge_id"
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
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as GiftAidClaimBatch;
}

export async function setClaimBatchDeclarationsCount(
  id: string,
  lodgeId: string,
  count: number
): Promise<void> {
  const { error } = await db()
    .from("gift_aid_claim_batches")
    .update({
      declarations_count: count,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
}

export async function markClaimBatchPackGenerated(
  id: string,
  lodgeId: string,
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
    .eq("lodge_id", lodgeId);
  if (error) throw error;
}

export async function updateGiftAidClaimBatch(
  id: string,
  lodgeId: string,
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
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as GiftAidClaimBatch | null;
}

export async function getGiftAidClaimItems(
  lodgeId: string,
  claimBatchId: string
): Promise<GiftAidClaimItem[]> {
  const { data, error } = await db()
    .from("gift_aid_claim_items")
    .select("*")
    .eq("lodge_id", lodgeId)
    .eq("claim_batch_id", claimBatchId)
    .order("donation_date", { ascending: true });
  if (error) throw error;
  return data as GiftAidClaimItem[];
}

export async function createGiftAidClaimItems(
  lodgeId: string,
  rows: Array<
    Omit<GiftAidClaimItem, "id" | "lodge_id" | "created_at">
  >
): Promise<GiftAidClaimItem[]> {
  if (rows.length === 0) return [];
  const { data, error } = await db()
    .from("gift_aid_claim_items")
    .insert(rows.map((row) => ({ ...row, lodge_id: lodgeId })))
    .select("*");
  if (error) throw error;
  return data as GiftAidClaimItem[];
}

// ---------------------------------------------------------------------------
// Claim batch -> declaration linkage (migration 060)
// ---------------------------------------------------------------------------

/**
 * Find the previously-created claim batch for this lodge. Used by the
 * close flow to compute "what declarations are new since the last pack".
 * Returns null if this is the lodge's first batch.
 */
export async function getMostRecentClaimBatchBefore(
  lodgeId: string,
  beforeIso: string
): Promise<GiftAidClaimBatch | null> {
  const { data, error } = await db()
    .from("gift_aid_claim_batches")
    .select("*")
    .eq("lodge_id", lodgeId)
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
  lodgeId: string,
  startIso: string,
  endIso: string
): Promise<GiftAidDeclaration[]> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .select("*")
    .eq("lodge_id", lodgeId)
    .gt("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as GiftAidDeclaration[];
}

export async function getGiftAidDeclarationsByIds(
  lodgeId: string,
  ids: string[]
): Promise<GiftAidDeclaration[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .select("*")
    .eq("lodge_id", lodgeId)
    .in("id", ids);
  if (error) throw error;
  return data as GiftAidDeclaration[];
}

export async function linkDeclarationsToClaimBatch(
  lodgeId: string,
  claimBatchId: string,
  links: Array<{
    gift_aid_declaration_id: string;
    inclusion_reason: GiftAidClaimDeclaration["inclusion_reason"];
  }>
): Promise<GiftAidClaimDeclaration[]> {
  if (links.length === 0) return [];
  const payload = links.map((row) => ({
    ...row,
    lodge_id: lodgeId,
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
  lodgeId: string,
  claimBatchId: string
): Promise<GiftAidClaimDeclaration[]> {
  const { data, error } = await db()
    .from("gift_aid_claim_declarations")
    .select("*")
    .eq("lodge_id", lodgeId)
    .eq("claim_batch_id", claimBatchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as GiftAidClaimDeclaration[];
}

// ---------------------------------------------------------------------------
// Gift Aid Declarations
// ---------------------------------------------------------------------------

export async function getGiftAidDeclarations(
  lodgeId: string
): Promise<GiftAidDeclaration[]> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as GiftAidDeclaration[];
}

export async function getGiftAidDeclarationById(
  id: string,
  lodgeId: string
): Promise<GiftAidDeclaration | null> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as GiftAidDeclaration | null;
}

export async function getActiveGiftAidDeclarationByEmail(
  lodgeId: string,
  email: string
): Promise<GiftAidDeclaration | null> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .select("*")
    .eq("lodge_id", lodgeId)
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
  lodgeId: string,
  updates: Partial<
    Omit<GiftAidDeclaration, "id" | "lodge_id" | "created_at">
  >
): Promise<GiftAidDeclaration | null> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as GiftAidDeclaration | null;
}

export async function getDonationsByGiftAidDeclaration(
  declarationId: string,
  lodgeId: string
): Promise<Donation[]> {
  const { data, error } = await db()
    .from("donations")
    .select("*")
    .eq("gift_aid_declaration_id", declarationId)
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Donation[];
}

export async function listAuditLogsByEntity(
  lodgeId: string,
  entityType: string,
  entityId: string
): Promise<AuditLog[]> {
  const { data, error } = await db()
    .from("audit_logs")
    .select("*")
    .eq("lodge_id", lodgeId)
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
  lodgeId: string,
  data: AddGiftAidDeclarationInput
): Promise<GiftAidDeclaration> {
  const { data: row, error } = await db()
    .from("gift_aid_declarations")
    .insert({ ...data, lodge_id: lodgeId })
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
  lodgeId: string,
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
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as GiftAidDeclaration | null;
}

export async function revokeGiftAidDeclaration(
  id: string,
  lodgeId: string,
  opts?: { reason?: string | null }
): Promise<GiftAidDeclaration | null> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: opts?.reason ?? null,
    })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
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
  lodgeId: string,
  member: { id: string; email: string }
): Promise<GiftAidDeclaration | null> {
  const { data: linked, error: linkedError } = await db()
    .from("gift_aid_declarations")
    .select("*")
    .eq("lodge_id", lodgeId)
    .eq("member_id", member.id)
    .is("revoked_at", null)
    .eq("declaration_confirmed", true)
    .eq("hmrc_eligible", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (linkedError) throw linkedError;
  if (linked) return linked as GiftAidDeclaration;
  return getActiveGiftAidDeclarationByEmail(lodgeId, member.email);
}

// ---------------------------------------------------------------------------
// Gift Aid declaration events (append-only audit trail, migration 059)
// ---------------------------------------------------------------------------

export type InsertGiftAidDeclarationEventInput = Omit<
  GiftAidDeclarationEvent,
  "id" | "lodge_id" | "declaration_id" | "created_at"
> & {
  declaration_id: string;
};

export async function insertGiftAidDeclarationEvent(
  lodgeId: string,
  input: InsertGiftAidDeclarationEventInput
): Promise<GiftAidDeclarationEvent> {
  const { data, error } = await db()
    .from("gift_aid_declaration_events")
    .insert({ ...input, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return data as GiftAidDeclarationEvent;
}

export async function listGiftAidDeclarationEvents(
  lodgeId: string,
  declarationId: string
): Promise<GiftAidDeclarationEvent[]> {
  const { data, error } = await db()
    .from("gift_aid_declaration_events")
    .select("*")
    .eq("lodge_id", lodgeId)
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
  lodgeId: string,
  patch: {
    gift_aid_consent_status?: "unknown" | "declared" | "declined";
    gift_aid_prompted_at?: string | null;
  }
): Promise<void> {
  const { error } = await db()
    .from("members")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Meeting close helpers (migration 059)
// ---------------------------------------------------------------------------

export async function markEventMeetingClosed(
  eventId: string,
  lodgeId: string,
  patch: {
    meeting_closed_at: string;
    meeting_closed_by_email: string | null;
    meeting_close_notes: string | null;
  }
): Promise<void> {
  const { error } = await db()
    .from("events")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
}

export async function attachClaimBatchToMeetingCollection(
  collectionId: string,
  lodgeId: string,
  patch: {
    gift_aid_claim_batch_id: string;
    relief_chest_delivered_at?: string | null;
    relief_chest_delivered_to?: string | null;
  }
): Promise<void> {
  const { error } = await db()
    .from("meeting_collections")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", collectionId)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Lodge Subscriptions
// ---------------------------------------------------------------------------

export async function getLodgeSubscription(
  lodgeId: string
): Promise<LodgeSubscription | null> {
  const { data, error } = await db()
    .from("lodge_subscriptions")
    .select("*")
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as LodgeSubscription | null;
}

export async function upsertLodgeSubscription(
  lodgeId: string,
  data: Omit<
    LodgeSubscription,
    | "id"
    | "lodge_id"
    | "created_at"
    | "updated_at"
    | "requested_plan_code"
    | "last_upgrade_requested_at"
    | "lodge_limit"
  > &
    Partial<
      Pick<
        LodgeSubscription,
        "requested_plan_code" | "last_upgrade_requested_at" | "lodge_limit"
      >
    >
): Promise<LodgeSubscription> {
  const { data: row, error } = await db()
    .from("lodge_subscriptions")
    .upsert(
      { ...data, lodge_id: lodgeId },
      { onConflict: "lodge_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as LodgeSubscription;
}

// ---------------------------------------------------------------------------
// Blog Posts
// ---------------------------------------------------------------------------

export async function getBlogPosts(
  lodgeId: string,
  opts?: { published?: boolean }
): Promise<BlogPost[]> {
  let query = db()
    .from("blog_posts")
    .select("*")
    .eq("lodge_id", lodgeId);

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
  lodgeId: string
): Promise<BlogPost | null> {
  const { data, error } = await db()
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as BlogPost | null;
}

export async function getBlogPostBySlug(
  slug: string,
  lodgeId: string
): Promise<BlogPost | null> {
  const { data, error } = await db()
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("lodge_id", lodgeId)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return data as BlogPost | null;
}

export async function addBlogPost(
  lodgeId: string,
  data: Omit<BlogPost, "id" | "lodge_id" | "created_at" | "updated_at">
): Promise<BlogPost> {
  const { data: row, error } = await db()
    .from("blog_posts")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as BlogPost;
}

export async function updateBlogPost(
  id: string,
  lodgeId: string,
  updates: Partial<Omit<BlogPost, "id" | "lodge_id" | "created_at">>
): Promise<BlogPost | null> {
  const { data, error } = await db()
    .from("blog_posts")
    .update(updates)
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as BlogPost | null;
}

// ---------------------------------------------------------------------------
// Charity Campaigns
// ---------------------------------------------------------------------------

export async function getCharityCampaigns(
  lodgeId: string
): Promise<CharityCampaign[]> {
  const { data, error } = await db()
    .from("charity_campaigns")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as CharityCampaign[];
}

export async function getCharityCampaignById(
  id: string,
  lodgeId: string
): Promise<CharityCampaign | null> {
  const { data, error } = await db()
    .from("charity_campaigns")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as CharityCampaign | null;
}

export async function addCharityCampaign(
  lodgeId: string,
  data: Omit<CharityCampaign, "id" | "lodge_id" | "created_at" | "updated_at">
): Promise<CharityCampaign> {
  const { data: row, error } = await db()
    .from("charity_campaigns")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as CharityCampaign;
}

export async function updateCharityCampaign(
  id: string,
  lodgeId: string,
  updates: Partial<
    Pick<CharityCampaign, "name" | "description" | "target_amount" | "raised_amount" | "status" | "end_date">
  >
): Promise<CharityCampaign | null> {
  const { data, error } = await db()
    .from("charity_campaigns")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as CharityCampaign | null;
}

export async function getDonationsByCampaign(
  campaignId: string,
  lodgeId: string
): Promise<Donation[]> {
  const { data, error } = await db()
    .from("donations")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Donation[];
}

export async function getDonationsByEvent(
  eventId: string,
  lodgeId: string
): Promise<Donation[]> {
  const { data, error } = await db()
    .from("donations")
    .select("*")
    .eq("event_id", eventId)
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Donation[];
}

// ---------------------------------------------------------------------------
// Lodge Dues
// ---------------------------------------------------------------------------

export async function getLodgeDues(lodgeId: string): Promise<LodgeDues[]> {
  const { data, error } = await db()
    .from("lodge_dues")
    .select("*")
    .eq("lodge_id", lodgeId)
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as LodgeDues[];
}

export async function getMemberDues(
  lodgeId: string,
  opts?: { memberEmail?: string; status?: string }
): Promise<MemberDues[]> {
  let query = db()
    .from("member_dues")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("period_start", { ascending: false });

  if (opts?.memberEmail) {
    query = query.eq("member_email", opts.memberEmail);
  }
  if (opts?.status) {
    query = query.eq("status", opts.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as MemberDues[];
}

export async function createMemberDues(
  lodgeId: string,
  data: Omit<
    MemberDues,
    | "id"
    | "lodge_id"
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
  > &
    Partial<
      Pick<
        MemberDues,
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
      >
    >
): Promise<MemberDues> {
  const { data: row, error } = await db()
    .from("member_dues")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as MemberDues;
}

export async function updateMemberDuesStatus(
  id: string,
  lodgeId: string,
  updates: Partial<
    Pick<
      MemberDues,
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
    >
  >
): Promise<MemberDues | null> {
  const { data, error } = await db()
    .from("member_dues")
    .update(updates)
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as MemberDues | null;
}

// ---------------------------------------------------------------------------
// Member dues instalments
// ---------------------------------------------------------------------------

export async function createMemberDuesInstalments(
  lodgeId: string,
  rows: Array<
    Omit<
      MemberDuesInstalment,
      "id" | "lodge_id" | "created_at" | "updated_at" | "mooov_payment_id" | "schedule_id"
    > &
      Partial<Pick<MemberDuesInstalment, "mooov_payment_id" | "schedule_id">>
  >
): Promise<MemberDuesInstalment[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((row) => ({ ...row, lodge_id: lodgeId }));
  const { data, error } = await db()
    .from("member_dues_instalments")
    .insert(payload)
    .select("*");
  if (error) throw error;
  return data as MemberDuesInstalment[];
}

export async function getInstalmentsForDues(
  memberDuesId: string,
  lodgeId: string
): Promise<MemberDuesInstalment[]> {
  const { data, error } = await db()
    .from("member_dues_instalments")
    .select("*")
    .eq("member_dues_id", memberDuesId)
    .eq("lodge_id", lodgeId)
    .order("sequence", { ascending: true });
  if (error) throw error;
  return data as MemberDuesInstalment[];
}

export async function getOutstandingInstalments(
  lodgeId: string,
  opts?: { onOrBefore?: string }
): Promise<MemberDuesInstalment[]> {
  let query = db()
    .from("member_dues_instalments")
    .select("*")
    .eq("lodge_id", lodgeId)
    .in("status", ["outstanding", "overdue"])
    .order("due_date", { ascending: true });
  if (opts?.onOrBefore) {
    query = query.lte("due_date", opts.onOrBefore);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as MemberDuesInstalment[];
}

export async function updateInstalment(
  id: string,
  lodgeId: string,
  updates: Partial<
    Pick<
      MemberDuesInstalment,
      "status" | "paid_at" | "reminder_sent_at" | "payment_reference" | "amount"
    >
  >
): Promise<MemberDuesInstalment | null> {
  const { data, error } = await db()
    .from("member_dues_instalments")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as MemberDuesInstalment | null;
}

// ---------------------------------------------------------------------------
// Dues schedules (saved-charge subscription state)
// ---------------------------------------------------------------------------

export type CreateDuesScheduleInput = {
  member_id: string | null;
  member_dues_id: string;
  member_email: string;
  customer_ref: string;
  cadence: "monthly" | "quarterly";
  split_strategy: DuesSplitStrategy;
  auto_renew: boolean;
  status?: DuesScheduleStatus;
  next_charge_at?: string | null;
  metadata?: Record<string, unknown>;
  /**
   * Pre-stamped Stripe Subscription identifier for the Mooov-branded
   * subscription_checkouts flow. Set to `sub_dues_<schedule_uuid>` so
   * the LP-side schedule and the Stripe Subscription share an idempotent
   * key. Null on saved-charge schedules.
   */
  mooov_subscription_id?: string | null;
};

export async function createDuesSchedule(
  lodgeId: string,
  input: CreateDuesScheduleInput
): Promise<DuesSchedule> {
  const { data, error } = await db()
    .from("dues_schedules")
    .insert({
      lodge_id: lodgeId,
      member_id: input.member_id,
      member_dues_id: input.member_dues_id,
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
  return data as DuesSchedule;
}

/**
 * Look up a dues schedule by its Mooov-side subscription_id (the one we
 * stamp on /v1/subscription_checkouts). Used by the Mooov webhook to
 * route subscription.* events back to the LP schedule. Cross-tenant by
 * design — the subscription_id is unique platform-wide.
 */
export async function getDuesScheduleByMooovSubscriptionId(
  mooovSubscriptionId: string
): Promise<DuesSchedule | null> {
  const { data, error } = await db()
    .from("dues_schedules")
    .select("*")
    .eq("mooov_subscription_id", mooovSubscriptionId)
    .maybeSingle();
  if (error) throw error;
  return (data as DuesSchedule | null) ?? null;
}

export async function getDuesSchedule(
  id: string,
  lodgeId: string
): Promise<DuesSchedule | null> {
  const { data, error } = await db()
    .from("dues_schedules")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return (data as DuesSchedule | null) ?? null;
}

export async function getDuesSchedulesForMember(
  lodgeId: string,
  memberEmail: string
): Promise<DuesSchedule[]> {
  const { data, error } = await db()
    .from("dues_schedules")
    .select("*")
    .eq("lodge_id", lodgeId)
    .eq("member_email", memberEmail)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DuesSchedule[];
}

export async function getDuesSchedulesDue(
  onOrBefore: string,
  limit = 100
): Promise<DuesSchedule[]> {
  const { data, error } = await db()
    .from("dues_schedules")
    .select("*")
    .in("status", ["active", "past_due"])
    .lte("next_charge_at", onOrBefore)
    .order("next_charge_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DuesSchedule[];
}

export async function listDuesSchedules(
  lodgeId: string,
  opts?: {
    status?: DuesScheduleStatus | DuesScheduleStatus[];
    memberEmail?: string;
    limit?: number;
  }
): Promise<DuesSchedule[]> {
  let query = db()
    .from("dues_schedules")
    .select("*")
    .eq("lodge_id", lodgeId);

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
  return (data ?? []) as DuesSchedule[];
}

// Treasurer dashboard: count of schedules grouped by status. Returned
// as a record keyed on DuesScheduleStatus with 0-fill for missing
// statuses so callers can index without checks.
export async function countDuesSchedulesByStatus(
  lodgeId: string
): Promise<Record<DuesScheduleStatus, number>> {
  const { data, error } = await db()
    .from("dues_schedules")
    .select("status")
    .eq("lodge_id", lodgeId);
  if (error) throw error;

  const counts: Record<DuesScheduleStatus, number> = {
    pending: 0,
    active: 0,
    action_required: 0,
    past_due: 0,
    paused: 0,
    cancelled: 0,
    completed: 0,
    active_stripe: 0,
  };
  for (const row of (data ?? []) as { status: DuesScheduleStatus }[]) {
    if (row.status in counts) {
      counts[row.status] += 1;
    }
  }
  return counts;
}

export async function updateDuesSchedule(
  id: string,
  lodgeId: string,
  updates: Partial<
    Pick<
      DuesSchedule,
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
): Promise<DuesSchedule | null> {
  const { data, error } = await db()
    .from("dues_schedules")
    .update(updates)
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as DuesSchedule | null) ?? null;
}

export async function getMemberDuesById(
  id: string,
  lodgeId: string
): Promise<MemberDues | null> {
  const { data, error } = await db()
    .from("member_dues")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return (data as MemberDues | null) ?? null;
}

// ---------------------------------------------------------------------------
// Meeting collections and GASDS
// ---------------------------------------------------------------------------

export async function getMeetingCollections(
  lodgeId: string,
  opts?: { eventId?: string; taxYear?: string }
): Promise<MeetingCollection[]> {
  let query = db()
    .from("meeting_collections")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("collection_date", { ascending: false });

  if (opts?.eventId) query = query.eq("event_id", opts.eventId);
  if (opts?.taxYear) query = query.eq("gasds_tax_year", opts.taxYear);

  const { data, error } = await query;
  if (error) throw error;
  return data as MeetingCollection[];
}

export async function createMeetingCollection(
  lodgeId: string,
  data: Omit<
    MeetingCollection,
    | "id"
    | "lodge_id"
    | "created_at"
    | "updated_at"
    | "gift_aid_claim_batch_id"
    | "relief_chest_delivered_at"
    | "relief_chest_delivered_to"
  > &
    Partial<
      Pick<
        MeetingCollection,
        | "gift_aid_claim_batch_id"
        | "relief_chest_delivered_at"
        | "relief_chest_delivered_to"
      >
    >
): Promise<MeetingCollection> {
  const { data: row, error } = await db()
    .from("meeting_collections")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as MeetingCollection;
}

export async function getGasdsClaims(lodgeId: string): Promise<GasdsClaim[]> {
  const { data, error } = await db()
    .from("gasds_claims")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("tax_year", { ascending: false });
  if (error) throw error;
  return data as GasdsClaim[];
}

export async function upsertGasdsClaim(
  lodgeId: string,
  data: Omit<GasdsClaim, "id" | "lodge_id" | "created_at" | "updated_at">
): Promise<GasdsClaim> {
  const { data: row, error } = await db()
    .from("gasds_claims")
    .upsert({ ...data, lodge_id: lodgeId }, { onConflict: "lodge_id,tax_year" })
    .select("*")
    .single();
  if (error) throw error;
  return row as GasdsClaim;
}

// ---------------------------------------------------------------------------
// Treasurer ledger view
// ---------------------------------------------------------------------------

export async function getTreasurerLedger(
  lodgeId: string,
  opts?: {
    from?: string;
    to?: string;
    sourceTypes?: Array<"payment" | "dues" | "donation">;
    statuses?: string[];
  }
): Promise<LedgerEntry[]> {
  let query = db()
    .from("treasurer_ledger")
    .select("*")
    .eq("lodge_id", lodgeId)
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
  lodgeId: string,
  guests: Omit<EventGuest, "id" | "lodge_id" | "created_at">[]
): Promise<EventGuest[]> {
  if (guests.length === 0) return [];
  const rows = guests.map((g) => ({ ...g, lodge_id: lodgeId }));
  const { data, error } = await db()
    .from("event_guests")
    .insert(rows)
    .select("*");
  if (error) throw error;
  return data as EventGuest[];
}

export async function getGuestsByRsvp(
  rsvpId: string,
  lodgeId: string
): Promise<EventGuest[]> {
  const { data, error } = await db()
    .from("event_guests")
    .select("*")
    .eq("rsvp_id", rsvpId)
    .eq("lodge_id", lodgeId);
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
  lodgeId: string
): Promise<void> {
  const { error } = await db()
    .from("event_guests")
    .delete()
    .eq("rsvp_id", rsvpId)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
}

export async function getGuestsByEvent(
  eventId: string,
  lodgeId: string
): Promise<EventGuest[]> {
  const { data, error } = await db()
    .from("event_guests")
    .select("*")
    .eq("event_id", eventId)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
  return data as EventGuest[];
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function getMembers(
  lodgeId: string,
  opts?: { status?: string; search?: string }
): Promise<Member[]> {
  let query = db()
    .from("members")
    .select("*")
    .eq("lodge_id", lodgeId)
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
  lodgeId: string
): Promise<Member | null> {
  const { data, error } = await db()
    .from("members")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as Member | null;
}

export async function getMemberByEmail(
  email: string,
  lodgeId: string
): Promise<Member | null> {
  const { data, error } = await db()
    .from("members")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .eq("lodge_id", lodgeId)
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

export async function getMemberByEmailAcrossLodges(
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
  lodgeId: string,
  data: Omit<
    Member,
    | "id"
    | "lodge_id"
    | "created_at"
    | "updated_at"
    | "portal_token"
    | "date_of_birth"
    | "date_of_passing"
    | "date_of_raising"
    | "progression_signed_off_initiation"
    | "progression_signed_off_passing"
    | "progression_signed_off_raising"
    | "archived_at"
    | "archived_reason"
    | "member_levy_amount"
    | "member_dining_amount"
    | "levy_waived"
    | "dining_waived"
    | "fee_use_custom"
    | "annual_dues_waived"
    | "annual_dues_waiver_reason"
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
        | "progression_signed_off_initiation"
        | "progression_signed_off_passing"
        | "progression_signed_off_raising"
        | "archived_at"
        | "archived_reason"
        | "member_levy_amount"
        | "member_dining_amount"
        | "levy_waived"
        | "dining_waived"
        | "fee_use_custom"
        | "annual_dues_waived"
        | "annual_dues_waiver_reason"
        | "show_on_website"
        | "public_bio"
        | "gift_aid_prompted_at"
        | "gift_aid_consent_status"
      >
    >
): Promise<Member> {
  const { data: row, error } = await db()
    .from("members")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as Member;
}

export async function updateMember(
  id: string,
  lodgeId: string,
  updates: Partial<Omit<Member, "id" | "lodge_id" | "created_at">>
): Promise<Member | null> {
  const { data, error } = await db()
    .from("members")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Member | null;
}

/**
 * Rewrite a member's email everywhere it is used as a join key. Email is the
 * de-facto link between the members row and historical payments / RSVPs / dues
 * (instead of member_id), so changing it without backfilling these tables
 * would orphan the member's history in the admin detail view.
 *
 * Returns the new member row plus per-table backfill counts so the caller can
 * surface them in the audit log / response.
 */
export async function changeMemberEmail(
  id: string,
  lodgeId: string,
  newEmail: string
): Promise<{
  member: Member | null;
  oldEmail: string;
  paymentsUpdated: number;
  rsvpsUpdated: number;
  duesUpdated: number;
}> {
  const supabase = db();
  const normalised = newEmail.trim().toLowerCase();

  const existing = await getMemberById(id, lodgeId);
  if (!existing) {
    return {
      member: null,
      oldEmail: "",
      paymentsUpdated: 0,
      rsvpsUpdated: 0,
      duesUpdated: 0,
    };
  }
  const oldEmail = existing.email;

  if (oldEmail === normalised) {
    return {
      member: existing,
      oldEmail,
      paymentsUpdated: 0,
      rsvpsUpdated: 0,
      duesUpdated: 0,
    };
  }

  const { data: updated, error: memberError } = await supabase
    .from("members")
    .update({ email: normalised, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (memberError) throw memberError;

  const { data: paymentsRows, error: paymentsError } = await supabase
    .from("payments")
    .update({ user_email: normalised, updated_at: new Date().toISOString() })
    .eq("lodge_id", lodgeId)
    .eq("user_email", oldEmail)
    .select("id");
  if (paymentsError) throw paymentsError;

  const { data: rsvpRows, error: rsvpError } = await supabase
    .from("rsvps")
    .update({ user_email: normalised, updated_at: new Date().toISOString() })
    .eq("lodge_id", lodgeId)
    .eq("user_email", oldEmail)
    .select("id");
  if (rsvpError) throw rsvpError;

  const { data: duesRows, error: duesError } = await supabase
    .from("member_dues")
    .update({ member_email: normalised, updated_at: new Date().toISOString() })
    .eq("lodge_id", lodgeId)
    .eq("member_email", oldEmail)
    .select("id");
  if (duesError) throw duesError;

  return {
    member: updated as Member | null,
    oldEmail,
    paymentsUpdated: paymentsRows?.length ?? 0,
    rsvpsUpdated: rsvpRows?.length ?? 0,
    duesUpdated: duesRows?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Summons
// ---------------------------------------------------------------------------

export async function getEventSummons(
  eventId: string,
  lodgeId: string
): Promise<EventSummons | null> {
  const { data, error } = await db()
    .from("event_summons")
    .select("*")
    .eq("event_id", eventId)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as EventSummons | null;
}

export async function upsertEventSummons(
  lodgeId: string,
  eventId: string,
  data: Partial<
    Omit<
      EventSummons,
      "id" | "lodge_id" | "event_id" | "created_at" | "updated_at"
    >
  >
): Promise<EventSummons> {
  const { data: row, error } = await db()
    .from("event_summons")
    .upsert(
      {
        ...data,
        lodge_id: lodgeId,
        event_id: eventId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lodge_id,event_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as EventSummons;
}

export async function listEventSummonsSends(
  lodgeId: string,
  eventId: string,
  limit = 5
): Promise<EventSummonsSend[]> {
  const { data, error } = await db()
    .from("event_summons_sends")
    .select("*")
    .eq("lodge_id", lodgeId)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as EventSummonsSend[];
}

export async function createEventSummonsSend(
  lodgeId: string,
  data: Omit<EventSummonsSend, "id" | "lodge_id" | "created_at">
): Promise<EventSummonsSend> {
  const { data: row, error } = await db()
    .from("event_summons_sends")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as EventSummonsSend;
}

export async function createEventSummonsAccessLink(
  lodgeId: string,
  data: Omit<EventSummonsAccessLink, "id" | "lodge_id" | "created_at" | "accessed_at" | "access_count">
): Promise<EventSummonsAccessLink> {
  const { data: row, error } = await db()
    .from("event_summons_access_links")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as EventSummonsAccessLink;
}

export async function getEventSummonsAccessLinkByTokenHash(
  tokenHash: string
): Promise<EventSummonsAccessLink | null> {
  const { data, error } = await db()
    .from("event_summons_access_links")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  return data as EventSummonsAccessLink | null;
}

// ---------------------------------------------------------------------------
// Meeting sequences (recurring schedule recipes)
// ---------------------------------------------------------------------------

export async function listMeetingSequences(
  lodgeId: string
): Promise<MeetingSequence[]> {
  const { data, error } = await db()
    .from("meeting_sequences")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MeetingSequence[];
}

export async function getMeetingSequenceById(
  id: string,
  lodgeId: string
): Promise<MeetingSequence | null> {
  const { data, error } = await db()
    .from("meeting_sequences")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as MeetingSequence | null;
}

export async function listActiveMeetingSequencesForAllLodges(): Promise<
  MeetingSequence[]
> {
  const { data, error } = await db()
    .from("meeting_sequences")
    .select("*")
    .eq("active", true)
    .eq("auto_draft_summons", true);
  if (error) throw error;
  return (data ?? []) as MeetingSequence[];
}

export async function createMeetingSequence(
  lodgeId: string,
  data: Omit<MeetingSequence, "id" | "lodge_id" | "created_at" | "updated_at">
): Promise<MeetingSequence> {
  const { data: row, error } = await db()
    .from("meeting_sequences")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as MeetingSequence;
}

export async function updateMeetingSequence(
  id: string,
  lodgeId: string,
  updates: Partial<
    Omit<MeetingSequence, "id" | "lodge_id" | "created_at" | "updated_at">
  >
): Promise<MeetingSequence | null> {
  const { data, error } = await db()
    .from("meeting_sequences")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as MeetingSequence | null;
}

export async function deleteMeetingSequence(
  id: string,
  lodgeId: string
): Promise<boolean> {
  const { error } = await db()
    .from("meeting_sequences")
    .delete()
    .eq("id", id)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
  return true;
}

export async function getEventsBySequenceId(
  sequenceId: string,
  lodgeId: string
): Promise<Event[]> {
  const { data, error } = await db()
    .from("events")
    .select("*")
    .eq("sequence_id", sequenceId)
    .eq("lodge_id", lodgeId)
    .order("event_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Event[];
}

export async function getEventsAwaitingSummonsDraft(
  lodgeId: string,
  windowEndIso: string
): Promise<Event[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await db()
    .from("events")
    .select("*")
    .eq("lodge_id", lodgeId)
    .eq("summons_status", "none")
    .gte("event_date", nowIso)
    .lte("event_date", windowEndIso)
    .order("event_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Event[];
}

export async function setEventSummonsStatus(
  eventId: string,
  lodgeId: string,
  status: SummonsStatus,
  extra?: Partial<
    Pick<
      Event,
      | "summons_auto_drafted_at"
      | "summons_approved_at"
      | "summons_approved_by_email"
      | "summons_last_sent_at"
    >
  >
): Promise<Event | null> {
  const { data, error } = await db()
    .from("events")
    .update({ summons_status: status, ...(extra ?? {}) })
    .eq("id", eventId)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Event | null;
}

// ---------------------------------------------------------------------------
// Event fee overrides
//
// Per-recipient overrides of levy/dining for a single event. Used by the
// recipients panel to mark "complimentary at this meeting only" for an
// individual member or honorary guest, without changing their profile
// defaults.
// ---------------------------------------------------------------------------

export async function listEventFeeOverrides(
  lodgeId: string,
  eventId: string
): Promise<EventFeeOverride[]> {
  const { data, error } = await db()
    .from("event_fee_overrides")
    .select("*")
    .eq("lodge_id", lodgeId)
    .eq("event_id", eventId);
  if (error) throw error;
  return (data ?? []) as EventFeeOverride[];
}

export async function upsertEventFeeOverride(
  lodgeId: string,
  data: Omit<
    EventFeeOverride,
    "id" | "lodge_id" | "created_at" | "updated_at"
  >
): Promise<EventFeeOverride> {
  const { data: row, error } = await db()
    .from("event_fee_overrides")
    .upsert(
      {
        ...data,
        lodge_id: lodgeId,
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
  lodgeId: string,
  eventId: string,
  subjectType: "member" | "guest",
  subjectId: string
): Promise<void> {
  const { error } = await db()
    .from("event_fee_overrides")
    .delete()
    .eq("lodge_id", lodgeId)
    .eq("event_id", eventId)
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId);
  if (error) throw error;
}

export async function recordEventSummonsAccess(
  id: string,
  currentAccessCount: number
): Promise<EventSummonsAccessLink | null> {
  const { data, error } = await db()
    .from("event_summons_access_links")
    .update({
      accessed_at: new Date().toISOString(),
      access_count: currentAccessCount + 1,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as EventSummonsAccessLink | null;
}

export async function getRsvpDietaryByEmail(
  email: string,
  lodgeId: string
): Promise<Array<{ event_id: string; dietary_requirements: string | null; created_at: string }>> {
  const { data, error } = await db()
    .from("rsvps")
    .select("event_id, dietary_requirements, created_at")
    .eq("user_email", email)
    .eq("lodge_id", lodgeId)
    .not("dietary_requirements", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRsvpsByEmail(
  email: string,
  lodgeId: string
): Promise<Rsvp[]> {
  const { data, error } = await db()
    .from("rsvps")
    .select("*")
    .eq("user_email", email)
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Rsvp[];
}

export async function getSummonsAccessLinksByEmail(
  email: string,
  lodgeId: string
): Promise<EventSummonsAccessLink[]> {
  const { data, error } = await db()
    .from("event_summons_access_links")
    .select("*")
    .eq("recipient_email", email)
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as EventSummonsAccessLink[];
}

export async function getPaymentsByEmail(
  email: string,
  lodgeId: string
): Promise<Payment[]> {
  const { data, error } = await db()
    .from("payments")
    .select("*")
    .eq("user_email", email)
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Payment[];
}

export async function getDonationsByEmail(
  email: string,
  lodgeId: string
): Promise<Donation[]> {
  const { data, error } = await db()
    .from("donations")
    .select("*")
    .eq("donor_email", email)
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Donation[];
}

export async function upsertLodgeDues(
  lodgeId: string,
  data: Omit<
    LodgeDues,
    | "id"
    | "lodge_id"
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
        LodgeDues,
        | "enable_strategy_catch_up_lump"
        | "enable_strategy_balloon"
        | "enable_strategy_reslice"
        | "auto_renew_default"
        | "year_start_prompt_days"
        | "catch_up_max_months"
        | "advance_discount_percent"
      >
    >
): Promise<LodgeDues> {
  const existing = await getLodgeDues(lodgeId);
  if (existing.length > 0) {
    const { data: row, error } = await db()
      .from("lodge_dues")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", existing[0].id)
      .eq("lodge_id", lodgeId)
      .select("*")
      .single();
    if (error) throw error;
    return row as LodgeDues;
  }
  const { data: row, error } = await db()
    .from("lodge_dues")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as LodgeDues;
}

export async function getMembersForInitiation(
  today: string
): Promise<Array<Member & { lodge_slug: string }>> {
  const { data, error } = await db()
    .from("members")
    .select("*, lodges!inner(slug)")
    .eq("date_of_initiation", today)
    .eq("initiation_email_sent", false);
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => {
    const lodges = row.lodges as { slug: string } | undefined;
    return {
      ...row,
      lodge_slug: lodges?.slug ?? "",
    } as Member & { lodge_slug: string };
  });
}

// ---------------------------------------------------------------------------
// Bank reconciliation
// ---------------------------------------------------------------------------

export async function createBankImport(
  lodgeId: string,
  data: Omit<
    BankStatementImport,
    "id" | "lodge_id" | "created_at" | "matched_rows" | "total_rows"
  > &
    Partial<Pick<BankStatementImport, "matched_rows" | "total_rows">>
): Promise<BankStatementImport> {
  const { data: row, error } = await db()
    .from("bank_statement_imports")
    .insert({
      ...data,
      lodge_id: lodgeId,
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
  lodgeId: string,
  updates: Partial<
    Pick<BankStatementImport, "total_rows" | "matched_rows" | "notes" | "account_label">
  >
): Promise<BankStatementImport | null> {
  const { data, error } = await db()
    .from("bank_statement_imports")
    .update(updates)
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as BankStatementImport | null;
}

export async function listBankImports(
  lodgeId: string
): Promise<BankStatementImport[]> {
  const { data, error } = await db()
    .from("bank_statement_imports")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as BankStatementImport[];
}

export async function insertBankTransactions(
  lodgeId: string,
  rows: Array<
    Omit<
      BankTransaction,
      "id" | "lodge_id" | "created_at" | "updated_at" | "matched_at" | "matched_by_admin_user_id" | "matched_confidence" | "matched_source_id" | "matched_source_type" | "status" | "notes"
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
  const payload = rows.map((row) => ({ ...row, lodge_id: lodgeId }));
  const { data, error } = await db()
    .from("bank_transactions")
    .insert(payload)
    .select("*");
  if (error) throw error;
  return data as BankTransaction[];
}

export async function listBankTransactions(
  lodgeId: string,
  opts?: { importId?: string; status?: BankTransaction["status"] }
): Promise<BankTransaction[]> {
  let query = db()
    .from("bank_transactions")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("posted_date", { ascending: false });
  if (opts?.importId) query = query.eq("import_id", opts.importId);
  if (opts?.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw error;
  return data as BankTransaction[];
}

export async function updateBankTransaction(
  id: string,
  lodgeId: string,
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
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as BankTransaction | null;
}

// ---------------------------------------------------------------------------
// Welfare / Almoner module
// ---------------------------------------------------------------------------

export async function listWelfareCases(
  lodgeId: string,
  opts?: { status?: WelfareCase["status"] }
): Promise<WelfareCase[]> {
  let query = db()
    .from("welfare_cases")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("opened_at", { ascending: false });
  if (opts?.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw error;
  return data as WelfareCase[];
}

export async function getWelfareCaseById(
  id: string,
  lodgeId: string
): Promise<WelfareCase | null> {
  const { data, error } = await db()
    .from("welfare_cases")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as WelfareCase | null;
}

export async function createWelfareCase(
  lodgeId: string,
  data: Omit<WelfareCase, "id" | "lodge_id" | "created_at" | "updated_at" | "opened_at" | "closed_at"> &
    Partial<Pick<WelfareCase, "opened_at" | "closed_at">>
): Promise<WelfareCase> {
  const { data: row, error } = await db()
    .from("welfare_cases")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as WelfareCase;
}

export async function updateWelfareCase(
  id: string,
  lodgeId: string,
  updates: Partial<
    Pick<
      WelfareCase,
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
): Promise<WelfareCase | null> {
  const { data, error } = await db()
    .from("welfare_cases")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as WelfareCase | null;
}

export async function listWelfareVisits(
  caseId: string,
  lodgeId: string
): Promise<WelfareVisit[]> {
  const { data, error } = await db()
    .from("welfare_visits")
    .select("*")
    .eq("case_id", caseId)
    .eq("lodge_id", lodgeId)
    .order("visited_at", { ascending: false });
  if (error) throw error;
  return data as WelfareVisit[];
}

export async function createWelfareVisit(
  lodgeId: string,
  data: Omit<WelfareVisit, "id" | "lodge_id" | "created_at">
): Promise<WelfareVisit> {
  const { data: row, error } = await db()
    .from("welfare_visits")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as WelfareVisit;
}

export async function listWelfareRegister(
  lodgeId: string,
  registerType?: WelfareRegisterEntry["register_type"]
): Promise<WelfareRegisterEntry[]> {
  let query = db()
    .from("welfare_register_entries")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("date_of_event", { ascending: false });
  if (registerType) query = query.eq("register_type", registerType);
  const { data, error } = await query;
  if (error) throw error;
  return data as WelfareRegisterEntry[];
}

export async function createWelfareRegister(
  lodgeId: string,
  data: Omit<WelfareRegisterEntry, "id" | "lodge_id" | "created_at" | "updated_at">
): Promise<WelfareRegisterEntry> {
  const { data: row, error } = await db()
    .from("welfare_register_entries")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as WelfareRegisterEntry;
}

export async function updateWelfareRegister(
  id: string,
  lodgeId: string,
  updates: Partial<
    Pick<
      WelfareRegisterEntry,
      | "full_name"
      | "relationship"
      | "contact_email"
      | "contact_phone"
      | "address"
      | "last_contact_at"
      | "notes"
    >
  >
): Promise<WelfareRegisterEntry | null> {
  const { data, error } = await db()
    .from("welfare_register_entries")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as WelfareRegisterEntry | null;
}

export async function listWelfareAlerts(
  lodgeId: string,
  opts?: { status?: WelfareAlert["status"] }
): Promise<WelfareAlert[]> {
  let query = db()
    .from("welfare_alerts")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (opts?.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw error;
  return data as WelfareAlert[];
}

export async function upsertWelfareAlert(
  lodgeId: string,
  data: Omit<WelfareAlert, "id" | "lodge_id" | "created_at" | "updated_at"> &
    Partial<Pick<WelfareAlert, "id">>
): Promise<WelfareAlert> {
  const { data: row, error } = await db()
    .from("welfare_alerts")
    .upsert(
      { ...data, lodge_id: lodgeId, updated_at: new Date().toISOString() },
      { onConflict: "lodge_id,member_id,alert_type" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as WelfareAlert;
}

export async function updateWelfareAlert(
  id: string,
  lodgeId: string,
  updates: Partial<
    Pick<
      WelfareAlert,
      "status" | "acknowledged_by_admin_user_id" | "acknowledged_at" | "case_id" | "severity"
    >
  >
): Promise<WelfareAlert | null> {
  const { data, error } = await db()
    .from("welfare_alerts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as WelfareAlert | null;
}

// ---------------------------------------------------------------------------
// Communications hub
// ---------------------------------------------------------------------------

export async function listMessageTemplates(
  lodgeId: string
): Promise<MessageTemplate[]> {
  const { data, error } = await db()
    .from("message_templates")
    .select("*")
    .or(`lodge_id.eq.${lodgeId},lodge_id.is.null`)
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return data as MessageTemplate[];
}

export async function getMessageTemplateByKey(
  lodgeId: string,
  templateKey: string
): Promise<MessageTemplate | null> {
  const { data, error } = await db()
    .from("message_templates")
    .select("*")
    .eq("template_key", templateKey)
    .or(`lodge_id.eq.${lodgeId},lodge_id.is.null`)
    .order("lodge_id", { ascending: true, nullsFirst: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as MessageTemplate | undefined) ?? null;
}

export async function upsertMessageTemplate(
  lodgeId: string | null,
  data: Omit<MessageTemplate, "id" | "lodge_id" | "created_at" | "updated_at">
): Promise<MessageTemplate> {
  const { data: row, error } = await db()
    .from("message_templates")
    .upsert(
      { ...data, lodge_id: lodgeId, updated_at: new Date().toISOString() },
      { onConflict: "lodge_id,template_key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as MessageTemplate;
}

export async function deleteMessageTemplate(
  lodgeId: string,
  id: string
): Promise<{ deleted: boolean }> {
  const { error, count } = await db()
    .from("message_templates")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .eq("is_system", false);
  if (error) throw error;
  return { deleted: (count ?? 0) > 0 };
}

export async function listMessages(
  lodgeId: string,
  opts?: { memberId?: string; leadId?: string; templateKey?: string; limit?: number }
): Promise<Message[]> {
  let query = db()
    .from("messages")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (opts?.memberId) query = query.eq("recipient_member_id", opts.memberId);
  if (opts?.leadId) query = query.eq("recipient_lead_id", opts.leadId);
  if (opts?.templateKey) query = query.eq("template_key", opts.templateKey);
  if (opts?.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data as Message[];
}

export async function logMessages(
  lodgeId: string,
  rows: Array<
    Omit<Message, "id" | "lodge_id" | "created_at"> &
      Partial<Pick<Message, "metadata" | "status">>
  >
): Promise<Message[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((row) => ({ ...row, lodge_id: lodgeId }));
  const { data, error } = await db()
    .from("messages")
    .insert(payload)
    .select("*");
  if (error) throw error;
  return data as Message[];
}

export async function listAutomationSettings(
  lodgeId: string
): Promise<AutomationSetting[]> {
  const { data, error } = await db()
    .from("automation_settings")
    .select("*")
    .eq("lodge_id", lodgeId);
  if (error) throw error;
  return data as AutomationSetting[];
}

export async function upsertAutomationSetting(
  lodgeId: string,
  automationKey: string,
  enabled: boolean,
  config?: Record<string, unknown>
): Promise<AutomationSetting> {
  const { data, error } = await db()
    .from("automation_settings")
    .upsert(
      {
        lodge_id: lodgeId,
        automation_key: automationKey,
        enabled,
        config: config ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lodge_id,automation_key" }
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
  lodgeId: string,
  data: Omit<ProgressionSignoff, "id" | "lodge_id" | "created_at">
): Promise<ProgressionSignoff> {
  const { data: row, error } = await db()
    .from("progression_signoffs")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as ProgressionSignoff;
}

export async function listProgressionSignoffs(
  lodgeId: string,
  memberId: string
): Promise<ProgressionSignoff[]> {
  const { data, error } = await db()
    .from("progression_signoffs")
    .select("*")
    .eq("lodge_id", lodgeId)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProgressionSignoff[];
}

export async function listMentorAssignments(
  lodgeId: string,
  opts?: { active?: boolean }
): Promise<MentorAssignment[]> {
  let query = db()
    .from("mentor_assignments")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("started_at", { ascending: false });
  if (opts?.active) {
    query = query.is("ended_at", null);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as MentorAssignment[];
}

export async function createMentorAssignment(
  lodgeId: string,
  data: Omit<MentorAssignment, "id" | "lodge_id" | "created_at" | "updated_at">
): Promise<MentorAssignment> {
  const { data: row, error } = await db()
    .from("mentor_assignments")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as MentorAssignment;
}

export async function updateMentorAssignment(
  id: string,
  lodgeId: string,
  updates: Partial<Pick<MentorAssignment, "ended_at" | "notes">>
): Promise<MentorAssignment | null> {
  const { data, error } = await db()
    .from("mentor_assignments")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as MentorAssignment | null;
}

export async function listMentorContacts(
  lodgeId: string,
  opts?: { assignmentId?: string }
): Promise<MentorContact[]> {
  let query = db()
    .from("mentor_contact_log")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("contacted_at", { ascending: false });
  if (opts?.assignmentId) {
    query = query.eq("assignment_id", opts.assignmentId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as MentorContact[];
}

export async function createMentorContact(
  lodgeId: string,
  data: Omit<MentorContact, "id" | "lodge_id" | "created_at">
): Promise<MentorContact> {
  const { data: row, error } = await db()
    .from("mentor_contact_log")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as MentorContact;
}

export async function listEventRitualRoles(
  eventId: string,
  lodgeId: string
): Promise<EventRitualRole[]> {
  const { data, error } = await db()
    .from("event_ritual_roles")
    .select("*")
    .eq("event_id", eventId)
    .eq("lodge_id", lodgeId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data as EventRitualRole[];
}

export async function upsertEventRitualRoles(
  lodgeId: string,
  rows: Array<
    Omit<EventRitualRole, "id" | "lodge_id" | "created_at" | "updated_at">
  >
): Promise<EventRitualRole[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((row) => ({
    ...row,
    lodge_id: lodgeId,
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
  lodgeId: string
): Promise<OfficerLadderRung[]> {
  const { data, error } = await db()
    .from("officer_ladder")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data as OfficerLadderRung[];
}

export async function upsertOfficerLadderRung(
  lodgeId: string,
  data: Omit<OfficerLadderRung, "id" | "lodge_id" | "created_at" | "updated_at">
): Promise<OfficerLadderRung> {
  const { data: row, error } = await db()
    .from("officer_ladder")
    .upsert(
      { ...data, lodge_id: lodgeId, updated_at: new Date().toISOString() },
      { onConflict: "lodge_id,rung_label" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as OfficerLadderRung;
}

export async function patchOfficerLadderRung(
  id: string,
  lodgeId: string,
  patch: Partial<Pick<OfficerLadderRung,
    "current_member_id" | "successor_member_id" | "notes" | "rung_label" | "sort_order"
  >>
): Promise<OfficerLadderRung> {
  const { data, error } = await db()
    .from("officer_ladder")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .single();
  if (error) throw error;
  return data as OfficerLadderRung;
}

export async function deleteOfficerLadderRung(
  id: string,
  lodgeId: string
): Promise<void> {
  const { error } = await db()
    .from("officer_ladder")
    .delete()
    .eq("id", id)
    .eq("lodge_id", lodgeId);
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
 * shows the current officer, never the line of progression.
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
  lodgeId: string
): Promise<PublicOfficer[]> {
  const { data, error } = await db()
    .from("officer_ladder")
    .select(
      `id, rung_label, sort_order, current_member_id,
       members:current_member_id(id, full_name, rank, public_bio, show_on_website, membership_status)`
    )
    .eq("lodge_id", lodgeId)
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
// Provincial layer
// ---------------------------------------------------------------------------

export async function listProvinces(): Promise<Province[]> {
  const { data, error } = await db()
    .from("provinces")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Province[];
}

export async function getProvinceById(id: string): Promise<Province | null> {
  const { data, error } = await db()
    .from("provinces")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Province | null;
}

export async function getProvinceBySlug(slug: string): Promise<Province | null> {
  const { data, error } = await db()
    .from("provinces")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as Province | null;
}

export async function createProvince(
  data: Omit<Province, "id" | "created_at" | "updated_at">
): Promise<Province> {
  const { data: row, error } = await db()
    .from("provinces")
    .insert(data)
    .select("*")
    .single();
  if (error) throw error;
  return row as Province;
}

export async function updateProvince(
  id: string,
  updates: Partial<Omit<Province, "id" | "created_at" | "updated_at">>
): Promise<Province | null> {
  const { data, error } = await db()
    .from("provinces")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Province | null;
}

export async function listLodgesByProvince(provinceId: string): Promise<Lodge[]> {
  const { data, error } = await db()
    .from("lodges")
    .select("*")
    .eq("province_id", provinceId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Lodge[];
}

export async function setLodgeProvince(
  lodgeId: string,
  provinceId: string | null
): Promise<void> {
  const { error } = await db()
    .from("lodges")
    .update({ province_id: provinceId })
    .eq("id", lodgeId);
  if (error) throw error;
}

export async function listMemberRanks(
  lodgeId: string,
  opts?: { memberId?: string; scope?: MemberRank["scope"] }
): Promise<MemberRank[]> {
  let query = db()
    .from("member_ranks")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("conferred_on", { ascending: false, nullsFirst: false });
  if (opts?.memberId) query = query.eq("member_id", opts.memberId);
  if (opts?.scope) query = query.eq("scope", opts.scope);
  const { data, error } = await query;
  if (error) throw error;
  return data as MemberRank[];
}

export async function createMemberRank(
  lodgeId: string,
  data: Omit<MemberRank, "id" | "lodge_id" | "created_at" | "updated_at">
): Promise<MemberRank> {
  const { data: row, error } = await db()
    .from("member_ranks")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as MemberRank;
}

export async function deleteMemberRank(id: string, lodgeId: string): Promise<void> {
  const { error } = await db()
    .from("member_ranks")
    .delete()
    .eq("id", id)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
}

export async function listLodgeVisits(
  visitingLodgeId: string,
  opts?: { limit?: number }
): Promise<LodgeVisit[]> {
  let query = db()
    .from("lodge_visits")
    .select("*")
    .eq("visiting_lodge_id", visitingLodgeId)
    .order("visit_date", { ascending: false });
  if (opts?.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data as LodgeVisit[];
}

export async function createLodgeVisit(
  data: Omit<LodgeVisit, "id" | "created_at">
): Promise<LodgeVisit> {
  const { data: row, error } = await db()
    .from("lodge_visits")
    .insert(data)
    .select("*")
    .single();
  if (error) throw error;
  return row as LodgeVisit;
}

export async function deleteLodgeVisit(id: string, lodgeId: string): Promise<void> {
  const { error } = await db()
    .from("lodge_visits")
    .delete()
    .eq("id", id)
    .eq("visiting_lodge_id", lodgeId);
  if (error) throw error;
}

export async function listProvinceOfficers(
  provinceId: string
): Promise<ProvinceOfficerDirectoryEntry[]> {
  const { data, error } = await db()
    .from("province_officer_directory")
    .select("*")
    .eq("province_id", provinceId)
    .order("officer_sort_order", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as ProvinceOfficerDirectoryEntry[];
}

export async function listLodgeAnnualReturns(
  provinceId?: string
): Promise<LodgeAnnualReturn[]> {
  let query = db()
    .from("lodge_annual_returns")
    .select("*")
    .order("lodge_name", { ascending: true });
  if (provinceId) query = query.eq("province_id", provinceId);
  const { data, error } = await query;
  if (error) throw error;
  return data as LodgeAnnualReturn[];
}

// ---------------------------------------------------------------------------
// Compliance & trust
// ---------------------------------------------------------------------------

export async function listMemberConsents(
  lodgeId: string,
  memberId?: string
): Promise<MemberConsent[]> {
  let query = db()
    .from("member_consents")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("granted_at", { ascending: false });
  if (memberId) query = query.eq("member_id", memberId);
  const { data, error } = await query;
  if (error) throw error;
  return data as MemberConsent[];
}

export async function recordMemberConsent(
  lodgeId: string,
  data: Omit<MemberConsent, "id" | "lodge_id" | "created_at" | "updated_at">
): Promise<MemberConsent> {
  // Revoke any active consent of the same key for this member first.
  await db()
    .from("member_consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("lodge_id", lodgeId)
    .eq("member_id", data.member_id)
    .eq("consent_key", data.consent_key)
    .is("revoked_at", null);
  const { data: row, error } = await db()
    .from("member_consents")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as MemberConsent;
}

export async function revokeMemberConsent(
  id: string,
  lodgeId: string
): Promise<void> {
  const { error } = await db()
    .from("member_consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
}

export async function getDataRetentionSettings(
  lodgeId: string
): Promise<DataRetentionSettings | null> {
  const { data, error } = await db()
    .from("data_retention_settings")
    .select("*")
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return data as DataRetentionSettings | null;
}

export async function upsertDataRetentionSettings(
  lodgeId: string,
  data: Partial<
    Omit<DataRetentionSettings, "id" | "lodge_id" | "created_at" | "updated_at">
  >
): Promise<DataRetentionSettings> {
  const { data: row, error } = await db()
    .from("data_retention_settings")
    .upsert(
      {
        lodge_id: lodgeId,
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lodge_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as DataRetentionSettings;
}

export async function listSubjectAccessRequests(
  lodgeId: string
): Promise<SubjectAccessRequest[]> {
  const { data, error } = await db()
    .from("subject_access_requests")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as SubjectAccessRequest[];
}

export async function createSubjectAccessRequest(
  lodgeId: string,
  data: Omit<
    SubjectAccessRequest,
    "id" | "lodge_id" | "created_at" | "updated_at"
  >
): Promise<SubjectAccessRequest> {
  const { data: row, error } = await db()
    .from("subject_access_requests")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as SubjectAccessRequest;
}

export async function updateSubjectAccessRequest(
  id: string,
  lodgeId: string,
  updates: Partial<
    Omit<SubjectAccessRequest, "id" | "lodge_id" | "created_at" | "updated_at">
  >
): Promise<SubjectAccessRequest | null> {
  const { data, error } = await db()
    .from("subject_access_requests")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as SubjectAccessRequest | null;
}

export async function archiveMember(
  memberId: string,
  lodgeId: string,
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
    .eq("lodge_id", lodgeId)
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
  lodgeId: string
): Promise<Record<string, unknown>> {
  const supabase = db();
  const tables = [
    "members",
    "member_dues",
    "member_dues_instalments",
    "rsvps",
    "payments",
    "donations",
    "gift_aid_declarations",
    "member_consents",
    "member_ranks",
    "progression_signoffs",
    "mentor_assignments",
    "mentor_contact_log",
    "messages",
    "welfare_cases",
    "welfare_visits",
  ];
  const result: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    lodge_id: lodgeId,
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
    let query = supabase.from(table).select("*").eq("lodge_id", lodgeId);
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
  opts?: { lodgeId?: string | null; status?: JobStatus; limit?: number }
): Promise<Job[]> {
  let query = db()
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts && opts.lodgeId === null) {
    query = query.is("lodge_id", null);
  } else if (opts?.lodgeId) {
    query = query.eq("lodge_id", opts.lodgeId);
  }
  if (opts?.status) query = query.eq("status", opts.status);
  if (opts?.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data as Job[];
}

export async function claimNextJobs(limit = 5): Promise<Job[]> {
  const nowIso = new Date().toISOString();
  const { data: candidates, error: pickError } = await db()
    .from("jobs")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (pickError) throw pickError;
  if (!candidates || candidates.length === 0) return [];

  const ids = candidates.map((c) => c.id);
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
  lodgeId: string
): Promise<IntegrationCredentials[]> {
  const { data, error } = await db()
    .from("integration_credentials")
    .select("*")
    .eq("lodge_id", lodgeId);
  if (error) throw error;
  return data as IntegrationCredentials[];
}

export async function upsertIntegrationCredentials(
  lodgeId: string,
  provider: IntegrationProvider,
  data: Partial<
    Omit<
      IntegrationCredentials,
      "id" | "lodge_id" | "provider" | "created_at" | "updated_at"
    >
  >
): Promise<IntegrationCredentials> {
  const { data: row, error } = await db()
    .from("integration_credentials")
    .upsert(
      {
        lodge_id: lodgeId,
        provider,
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lodge_id,provider" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return row as IntegrationCredentials;
}

export async function deleteIntegrationCredentials(
  lodgeId: string,
  provider: IntegrationProvider
): Promise<void> {
  const { error } = await db()
    .from("integration_credentials")
    .delete()
    .eq("lodge_id", lodgeId)
    .eq("provider", provider);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Platform-wide aggregates (operator console)
// ---------------------------------------------------------------------------

export type PlatformLodgeStats = {
  lodge_id: string;
  lodge_slug: string;
  lodge_name: string;
  province_id: string | null;
  members: number;
  active_members: number;
  upcoming_events: number;
  outstanding_dues: number;
  paid_dues_amount: number;
  donations_amount: number;
  last_meeting_at: string | null;
};

// ---------------------------------------------------------------------------
// Lodge feature flags
// ---------------------------------------------------------------------------

export async function listLodgeFeatureFlags(
  lodgeId: string
): Promise<LodgeFeatureFlag[]> {
  const { data, error } = await db()
    .from("lodge_feature_flags")
    .select("*")
    .eq("lodge_id", lodgeId);
  if (error) throw error;
  return (data ?? []) as LodgeFeatureFlag[];
}

export async function setLodgeFeatureFlag(
  lodgeId: string,
  flagKey: string,
  enabled: boolean,
  opts?: { notes?: string | null; updated_by_email?: string | null }
): Promise<LodgeFeatureFlag> {
  const { data, error } = await db()
    .from("lodge_feature_flags")
    .upsert(
      {
        lodge_id: lodgeId,
        flag_key: flagKey,
        enabled,
        notes: opts?.notes ?? null,
        updated_by_email: opts?.updated_by_email ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lodge_id,flag_key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as LodgeFeatureFlag;
}

export async function getPlatformLodgeStats(): Promise<PlatformLodgeStats[]> {
  const lodges = await listLodges();
  const stats: PlatformLodgeStats[] = [];
  for (const lodge of lodges) {
    const [members, events, dues, donations] = await Promise.all([
      getMembers(lodge.id, {}),
      getEvents(lodge.id, {}),
      getMemberDues(lodge.id, {}),
      getDonations(lodge.id),
    ]);
    const now = new Date();
    const upcoming = events.filter((e) => new Date(e.event_date) >= now);
    const past = events
      .filter((e) => new Date(e.event_date) < now)
      .sort((a, b) => +new Date(b.event_date) - +new Date(a.event_date));

    stats.push({
      lodge_id: lodge.id,
      lodge_slug: lodge.slug,
      lodge_name: lodge.name,
      province_id: lodge.province_id,
      members: members.length,
      active_members: members.filter((m) => m.membership_status === "active").length,
      upcoming_events: upcoming.length,
      outstanding_dues: dues.filter((d) => d.status === "outstanding" || d.status === "overdue").length,
      paid_dues_amount: dues
        .filter((d) => d.status === "paid")
        .reduce((sum, d) => sum + Number(d.amount ?? 0), 0),
      donations_amount: donations.reduce((sum, d) => sum + Number(d.amount ?? 0), 0),
      last_meeting_at: past[0]?.event_date ?? null,
    });
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Guests directory and guest invitations
// ---------------------------------------------------------------------------

export async function listGuests(
  lodgeId: string,
  opts?: {
    search?: string;
    includeArchived?: boolean;
    guestCategory?: "guest" | "honorary_guest";
  }
): Promise<Guest[]> {
  let query = db()
    .from("guests")
    .select("*")
    .eq("lodge_id", lodgeId)
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
      `full_name.ilike.${term},email.ilike.${term},mother_lodge_name.ilike.${term}`
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Guest[];
}

export async function getGuestById(
  id: string,
  lodgeId: string
): Promise<Guest | null> {
  const { data, error } = await db()
    .from("guests")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return (data as Guest | null) ?? null;
}

export async function findGuestByEmail(
  lodgeId: string,
  email: string
): Promise<Guest | null> {
  const { data, error } = await db()
    .from("guests")
    .select("*")
    .eq("lodge_id", lodgeId)
    .ilike("email", email)
    .maybeSingle();
  if (error) throw error;
  return (data as Guest | null) ?? null;
}

export async function findGuestByNameAndLodge(
  lodgeId: string,
  fullName: string,
  motherLodgeName: string | null
): Promise<Guest | null> {
  let query = db()
    .from("guests")
    .select("*")
    .eq("lodge_id", lodgeId)
    .ilike("full_name", fullName)
    .limit(1);
  if (motherLodgeName) {
    query = query.ilike("mother_lodge_name", motherLodgeName);
  } else {
    query = query.is("mother_lodge_name", null);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as Guest | null) ?? null;
}

export async function createGuest(
  lodgeId: string,
  guest: Partial<Omit<Guest, "id" | "lodge_id" | "created_at" | "updated_at">> & {
    full_name: string;
  }
): Promise<Guest> {
  const { data, error } = await db()
    .from("guests")
    .insert({ ...guest, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Guest;
}

export async function updateGuest(
  id: string,
  lodgeId: string,
  patch: Partial<Omit<Guest, "id" | "lodge_id" | "created_at">>
): Promise<Guest> {
  const { data, error } = await db()
    .from("guests")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Guest;
}

export async function archiveGuest(
  id: string,
  lodgeId: string
): Promise<Guest> {
  return updateGuest(id, lodgeId, {
    archived_at: new Date().toISOString(),
  });
}

export async function restoreGuest(
  id: string,
  lodgeId: string
): Promise<Guest> {
  return updateGuest(id, lodgeId, { archived_at: null });
}

export async function hardDeleteGuestIfUnused(
  id: string,
  lodgeId: string
): Promise<{ deleted: boolean }> {
  const guest = await getGuestById(id, lodgeId);
  if (!guest) return { deleted: false };
  if ((guest.visit_count ?? 0) > 0) return { deleted: false };
  const { error } = await db()
    .from("guests")
    .delete()
    .eq("id", id)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
  return { deleted: true };
}

export async function setGuestVisitorTokenHash(
  id: string,
  lodgeId: string,
  tokenHash: string
): Promise<Guest> {
  return updateGuest(id, lodgeId, { visitor_token_hash: tokenHash });
}

export async function getGuestByVisitorTokenHash(
  tokenHash: string
): Promise<Guest | null> {
  const { data, error } = await db()
    .from("guests")
    .select("*")
    .eq("visitor_token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  return (data as Guest | null) ?? null;
}

export async function upsertGuest(
  lodgeId: string,
  input: {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    mother_lodge_name?: string | null;
    mother_lodge_number?: string | null;
    constitution?: string | null;
    rank?: string | null;
    dietary_requirements?: string | null;
    is_mason?: boolean;
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
  const motherLodgeName = input.mother_lodge_name?.trim() || null;
  const recordVisit = input.recordVisit !== false;

  const existing = email
    ? await findGuestByEmail(lodgeId, email)
    : await findGuestByNameAndLodge(lodgeId, fullName, motherLodgeName);

  if (existing) {
    return updateGuest(existing.id, lodgeId, {
      full_name: fullName || existing.full_name,
      email: email ?? existing.email,
      phone: input.phone?.trim() ?? existing.phone,
      mother_lodge_name: motherLodgeName ?? existing.mother_lodge_name,
      mother_lodge_number:
        input.mother_lodge_number?.trim() ?? existing.mother_lodge_number,
      constitution: input.constitution?.trim() ?? existing.constitution,
      rank: input.rank?.trim() ?? existing.rank,
      dietary_requirements:
        input.dietary_requirements?.trim() ?? existing.dietary_requirements,
      is_mason: input.is_mason ?? existing.is_mason,
      visit_count: recordVisit ? existing.visit_count + 1 : existing.visit_count,
      last_seen_event_id: recordVisit
        ? (input.event_id ?? existing.last_seen_event_id)
        : existing.last_seen_event_id,
      first_seen_event_id:
        existing.first_seen_event_id ?? input.event_id ?? null,
    });
  }

  return createGuest(lodgeId, {
    full_name: fullName,
    email,
    phone: input.phone?.trim() || null,
    mother_lodge_name: motherLodgeName,
    mother_lodge_number: input.mother_lodge_number?.trim() || null,
    constitution: input.constitution?.trim() || null,
    rank: input.rank?.trim() || null,
    dietary_requirements: input.dietary_requirements?.trim() || null,
    is_mason: input.is_mason ?? true,
    visit_count: recordVisit ? 1 : 0,
    first_seen_event_id: input.event_id ?? null,
    last_seen_event_id: recordVisit ? (input.event_id ?? null) : null,
    notes: null,
    archived_at: null,
    source: input.source ?? "admin",
  });
}

export async function createGuestInvitation(
  lodgeId: string,
  data: Omit<
    GuestInvitation,
    | "id"
    | "lodge_id"
    | "uses"
    | "created_at"
    | "last_used_at"
    | "revoked_at"
    | "guest_id"
  > & { uses?: number; guest_id?: string | null }
): Promise<GuestInvitation> {
  const { data: row, error } = await db()
    .from("guest_invitations")
    .insert({ ...data, lodge_id: lodgeId, uses: data.uses ?? 0 })
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
  lodgeId: string
): Promise<GuestInvitation | null> {
  const { data, error } = await db()
    .from("guest_invitations")
    .select("*")
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return (data as GuestInvitation | null) ?? null;
}

export async function listGuestInvitationsForGuest(
  guestId: string,
  lodgeId: string
): Promise<GuestInvitation[]> {
  const { data, error } = await db()
    .from("guest_invitations")
    .select("*")
    .eq("guest_id", guestId)
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GuestInvitation[];
}

export async function listGuestInvitationsForEvent(
  eventId: string,
  lodgeId: string
): Promise<GuestInvitation[]> {
  const { data, error } = await db()
    .from("guest_invitations")
    .select("*")
    .eq("event_id", eventId)
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GuestInvitation[];
}

export async function listGuestInvitationsForMember(
  memberId: string,
  lodgeId: string
): Promise<GuestInvitation[]> {
  const { data, error } = await db()
    .from("guest_invitations")
    .select("*")
    .eq("inviter_member_id", memberId)
    .eq("lodge_id", lodgeId)
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
  lodgeId: string
): Promise<void> {
  const { error } = await db()
    .from("guest_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
}

export async function listEventGuestsForLodge(
  lodgeId: string,
  opts?: { eventId?: string; guestId?: string }
): Promise<EventGuest[]> {
  let query = db()
    .from("event_guests")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("created_at", { ascending: false });
  if (opts?.eventId) query = query.eq("event_id", opts.eventId);
  if (opts?.guestId) query = query.eq("guest_id", opts.guestId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as EventGuest[];
}

export async function markEventGuestWelcomeSent(
  ids: string[],
  lodgeId: string
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await db()
    .from("event_guests")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .in("id", ids)
    .eq("lodge_id", lodgeId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Lodge fee defaults & masonic year
// ---------------------------------------------------------------------------

export async function getLodgeFeeDefaults(
  lodgeId: string
): Promise<LodgeFeeDefaults | null> {
  const { data, error } = await db()
    .from("lodge_fee_defaults")
    .select("*")
    .eq("lodge_id", lodgeId)
    .maybeSingle();
  if (error) throw error;
  return (data as LodgeFeeDefaults | null) ?? null;
}

export async function upsertLodgeFeeDefaults(
  lodgeId: string,
  input: Omit<LodgeFeeDefaults, "lodge_id" | "updated_at">
): Promise<LodgeFeeDefaults> {
  const { data, error } = await db()
    .from("lodge_fee_defaults")
    .upsert(
      {
        lodge_id: lodgeId,
        ...input,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lodge_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as LodgeFeeDefaults;
}

export async function listLodgeMasonicYears(
  lodgeId: string
): Promise<LodgeMasonicYear[]> {
  const { data, error } = await db()
    .from("lodge_masonic_years")
    .select("*")
    .eq("lodge_id", lodgeId)
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LodgeMasonicYear[];
}

export async function getCurrentMasonicYear(
  lodgeId: string
): Promise<LodgeMasonicYear | null> {
  const { data, error } = await db()
    .from("lodge_masonic_years")
    .select("*")
    .eq("lodge_id", lodgeId)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw error;
  return (data as LodgeMasonicYear | null) ?? null;
}

export async function upsertLodgeMasonicYear(
  lodgeId: string,
  input: Omit<LodgeMasonicYear, "id" | "lodge_id" | "created_at" | "updated_at"> & {
    id?: string;
  }
): Promise<LodgeMasonicYear> {
  if (input.is_current) {
    await db()
      .from("lodge_masonic_years")
      .update({ is_current: false, updated_at: new Date().toISOString() })
      .eq("lodge_id", lodgeId)
      .eq("is_current", true);
  }

  const payload = {
    lodge_id: lodgeId,
    label: input.label,
    start_date: input.start_date,
    end_date: input.end_date,
    annual_dues_amount: input.annual_dues_amount,
    is_current: input.is_current,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await db()
      .from("lodge_masonic_years")
      .update(payload)
      .eq("id", input.id)
      .eq("lodge_id", lodgeId)
      .select("*")
      .single();
    if (error) throw error;
    return data as LodgeMasonicYear;
  }

  const { data, error } = await db()
    .from("lodge_masonic_years")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as LodgeMasonicYear;
}

export async function listHonoraryGuests(lodgeId: string): Promise<Guest[]> {
  return listGuests(lodgeId, { guestCategory: "honorary_guest" });
}
