import { createServiceClient } from "@/lib/supabase/server";
import type {
  Lodge,
  LodgeSitePage,
  Lead,
  LeadActivity,
  Event,
  Rsvp,
  Payment,
  Donation,
  GiftAidDeclaration,
  LodgeSubscription,
  BlogPost,
  CharityCampaign,
  LodgeDues,
  MemberDues,
  EventGuest,
  Member,
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

export async function getLodgeById(id: string): Promise<Lodge | null> {
  const { data, error } = await db()
    .from("lodges")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Lodge | null;
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
    Pick<LodgeSitePage, "page_title" | "page_description" | "sections">
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
  updates: Partial<Pick<Lead, "stage" | "assigned_to">>
): Promise<Lead | null> {
  const patch: Record<string, unknown> = { ...updates };
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

export async function addEvent(
  lodgeId: string,
  data: Omit<Event, "id" | "lodge_id" | "created_at" | "updated_at">
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

export async function addRsvp(
  lodgeId: string,
  data: Omit<Rsvp, "id" | "lodge_id" | "created_at" | "updated_at">
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
  updates: Partial<Pick<Rsvp, "payment_id" | "payment_completed" | "status">>
): Promise<Rsvp | null> {
  const { data, error } = await db()
    .from("rsvps")
    .update(updates)
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as Rsvp | null;
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
  data: Omit<Donation, "id" | "lodge_id" | "created_at">
): Promise<Donation> {
  const { data: row, error } = await db()
    .from("donations")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as Donation;
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

export async function addGiftAidDeclaration(
  lodgeId: string,
  data: Omit<GiftAidDeclaration, "id" | "lodge_id" | "created_at" | "updated_at" | "revoked_at">
): Promise<GiftAidDeclaration> {
  const { data: row, error } = await db()
    .from("gift_aid_declarations")
    .insert({ ...data, lodge_id: lodgeId })
    .select("*")
    .single();
  if (error) throw error;
  return row as GiftAidDeclaration;
}

export async function revokeGiftAidDeclaration(
  id: string,
  lodgeId: string
): Promise<GiftAidDeclaration | null> {
  const { data, error } = await db()
    .from("gift_aid_declarations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("lodge_id", lodgeId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as GiftAidDeclaration | null;
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
  data: Omit<LodgeSubscription, "id" | "lodge_id" | "created_at" | "updated_at">
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
  data: Omit<MemberDues, "id" | "lodge_id" | "created_at" | "updated_at">
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
  updates: Partial<Pick<MemberDues, "status" | "payment_id" | "stripe_payment_intent_id" | "paid_at">>
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

export async function createMember(
  lodgeId: string,
  data: Omit<Member, "id" | "lodge_id" | "created_at" | "updated_at">
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

export async function upsertLodgeDues(
  lodgeId: string,
  data: Omit<LodgeDues, "id" | "lodge_id" | "created_at" | "updated_at">
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
