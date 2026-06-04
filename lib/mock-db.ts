/**
 * In-memory mock DB for front-end iteration. No Supabase/DB required.
 * Data resets on server restart. Replace with real DB when ready.
 */

import type {
  LodgeSiteCustomPage,
  LodgeSiteFooterSettings,
  LodgeSiteHeaderSettings,
  LodgeSiteSection,
} from "@/lib/db/types";
import { shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import { DEFAULT_LODGE_SLUG } from "@/lib/tenant";

/** True while module init seed runs (allows seed without Supabase). */
let mockDbSeeding = false;

function assertInMemoryMock(): void {
  if (mockDbSeeding) return;
  if (!shouldUseInMemoryMock()) {
    throw new Error(
      "In-memory mock DB is not in use. Set Supabase env vars for Postgres-backed data, " +
        "or set ALLOW_IN_MEMORY_MOCK=true for offline demo mode."
    );
  }
}

function uuid() {
  return crypto.randomUUID();
}

type LodgeScoped = {
  lodge_slug: string;
};

function withLodgeSlug(slug?: string): string {
  return (slug ?? DEFAULT_LODGE_SLUG).trim().toLowerCase();
}

// --- Lodges and lodge websites ---
export type MockLodge = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  support_email: string | null;
  support_phone: string | null;
  lodge_number: string | null;
  consecrated_at: string | null;
  governing_body: string | null;
  meeting_schedule: string | null;
  secretary_name: string | null;
  secretary_address: string | null;
  secretary_phone: string | null;
  charity_donation_url: string | null;
  relief_chest_name: string | null;
  data_protection_notice: string | null;
  visiting_notice: string | null;
  loi_contact: string | null;
  wifi_details: string | null;
  meeting_location: string | null;
  meeting_location_url: string | null;
  accessibility_notes: string | null;
  default_dress_code: string | null;
  is_active: boolean;
  province_id: string | null;
  custom_domain: string | null;
  custom_domain_verified_at: string | null;
  custom_domain_verification_token: string | null;
  accepts_self_registration: boolean;
  current_charity_campaign_id: string | null;
  gift_aid_default_mode: "digital" | "paper" | "both";
  relief_chest_email: string | null;
  relief_chest_charity_number: string | null;
  hmrc_charity_reference: string | null;
  created_at: string;
  updated_at: string;
};

export type MockLodgeSite = LodgeScoped & {
  id: string;
  page_title: string;
  page_description: string | null;
  sections: LodgeSiteSection[];
  custom_pages: LodgeSiteCustomPage[];
  header_settings: LodgeSiteHeaderSettings | null;
  footer_settings: LodgeSiteFooterSettings | null;
  published: boolean;
  updated_at: string;
};

const lodges: MockLodge[] = [
  {
    id: uuid(),
    slug: DEFAULT_LODGE_SLUG,
    name: "Covenant Lodge No. 4344",
    city: "London",
    country: "United Kingdom",
    tagline: "Brotherhood, charity, and timeless tradition.",
    logo_url: null,
    primary_color: "#111827",
    secondary_color: "#b45309",
    support_email: "secretary@covenantlodge4344.org",
    support_phone: null,
    lodge_number: "4344",
    consecrated_at: "1922-04-03",
    governing_body: "Member of London Metropolitan Grand Lodge",
    meeting_schedule:
      "Regular meetings are held in January, March, June, and November.",
    secretary_name: "Lodge Secretary",
    secretary_address: "Mark Masons Hall, 86 St James's Street, London, SW1A 1PL",
    secretary_phone: "01582 461961",
    charity_donation_url: "https://gtap.uk/L4344",
    relief_chest_name: "Covenant Relief Chest",
    data_protection_notice:
      "A member database is held by the Lodge Secretary for lodge business.",
    visiting_notice:
      "Brethren travelling abroad should confirm regularity before visiting lodges under other jurisdictions.",
    loi_contact: "Contact the Secretary for Lodge of Instruction dates.",
    wifi_details: "MMH Guest WiFi details available at the venue.",
    meeting_location: "Mark Masons Hall, 86 St James's Street, London, SW1A 1PL",
    meeting_location_url: "https://maps.app.goo.gl/HsCmZTMVbHkM26ck6",
    accessibility_notes: "Step-free access via the side entrance. Hearing loop available in the temple. Please contact the secretary in advance if you need additional arrangements.",
    default_dress_code: "Lounge suit, black tie. White gloves provided.",
    is_active: true,
    province_id: null,
    custom_domain: null,
    custom_domain_verified_at: null,
    custom_domain_verification_token: null,
    accepts_self_registration: true,
    current_charity_campaign_id: null,
    gift_aid_default_mode: "both",
    relief_chest_email: null,
    relief_chest_charity_number: null,
    hmrc_charity_reference: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const lodgeSites: MockLodgeSite[] = [
  {
    id: uuid(),
    lodge_slug: DEFAULT_LODGE_SLUG,
    page_title: "Covenant Lodge No. 4344",
    page_description: "A London lodge rooted in fellowship, service, and meaningful ritual.",
    custom_pages: [],
    header_settings: null,
    footer_settings: null,
    sections: [
      {
        id: uuid(),
        type: "hero",
        heading: "Welcome to Covenant Lodge No. 4344",
        body: "Join a modern brotherhood with deep heritage in the heart of London.",
        cta_label: "Express Interest",
        cta_href: "/join",
        visible: true,
        order: 1,
      },
      {
        id: uuid(),
        type: "meeting_details",
        heading: "Meetings at Mark Masons' Hall",
        body: "Regular meetings, social dining, and charity events throughout the year.",
        cta_label: "View Events",
        cta_href: "/events",
        visible: true,
        order: 2,
      },
      {
        id: uuid(),
        type: "charity",
        heading: "Charity and Community",
        body: "We support local and national causes through regular giving and fundraising.",
        cta_label: "Our Charity Work",
        cta_href: "/charity",
        visible: true,
        order: 3,
      },
      {
        id: uuid(),
        type: "contact",
        heading: "Speak With Our Team",
        body: "If you are interested in joining or visiting, we are happy to hear from you.",
        cta_label: "Contact Us",
        cta_href: "/contact",
        visible: true,
        order: 4,
      },
    ],
    published: true,
    updated_at: new Date().toISOString(),
  },
];

export function listLodges(): MockLodge[] {
  assertInMemoryMock();
  return [...lodges].sort((a, b) => a.name.localeCompare(b.name));
}

export function getLodgeBySlug(slug: string): MockLodge | null {
  assertInMemoryMock();
  const safeSlug = withLodgeSlug(slug);
  return lodges.find((l) => l.slug === safeSlug && l.is_active) ?? null;
}

export function upsertLodge(
  input: Partial<Omit<MockLodge, "id" | "created_at" | "updated_at">> & Pick<MockLodge, "slug" | "name">
): MockLodge {
  assertInMemoryMock();
  const safeSlug = withLodgeSlug(input.slug);
  const now = new Date().toISOString();
  const existing = lodges.find((l) => l.slug === safeSlug);
  if (existing) {
    Object.assign(existing, input, { slug: safeSlug, updated_at: now });
    return existing;
  }
  const lodge: MockLodge = {
    id: uuid(),
    slug: safeSlug,
    name: input.name,
    city: input.city ?? null,
    country: input.country ?? null,
    tagline: input.tagline ?? null,
    logo_url: input.logo_url ?? null,
    primary_color: input.primary_color ?? null,
    secondary_color: input.secondary_color ?? null,
    support_email: input.support_email ?? null,
    support_phone: input.support_phone ?? null,
    lodge_number: input.lodge_number ?? null,
    consecrated_at: input.consecrated_at ?? null,
    governing_body: input.governing_body ?? null,
    meeting_schedule: input.meeting_schedule ?? null,
    secretary_name: input.secretary_name ?? null,
    secretary_address: input.secretary_address ?? null,
    secretary_phone: input.secretary_phone ?? null,
    charity_donation_url: input.charity_donation_url ?? null,
    relief_chest_name: input.relief_chest_name ?? null,
    data_protection_notice: input.data_protection_notice ?? null,
    visiting_notice: input.visiting_notice ?? null,
    loi_contact: input.loi_contact ?? null,
    wifi_details: input.wifi_details ?? null,
    meeting_location: input.meeting_location ?? null,
    meeting_location_url: input.meeting_location_url ?? null,
    accessibility_notes: input.accessibility_notes ?? null,
    default_dress_code: input.default_dress_code ?? null,
    is_active: input.is_active ?? true,
    province_id: input.province_id ?? null,
    custom_domain: input.custom_domain ?? null,
    custom_domain_verified_at: input.custom_domain_verified_at ?? null,
    custom_domain_verification_token: input.custom_domain_verification_token ?? null,
    accepts_self_registration: input.accepts_self_registration ?? false,
    current_charity_campaign_id: null,
    gift_aid_default_mode: input.gift_aid_default_mode ?? "both",
    relief_chest_email: input.relief_chest_email ?? null,
    relief_chest_charity_number: input.relief_chest_charity_number ?? null,
    hmrc_charity_reference: input.hmrc_charity_reference ?? null,
    created_at: now,
    updated_at: now,
  };
  lodges.push(lodge);
  return lodge;
}

export function getLodgeSite(lodgeSlug?: string): MockLodgeSite {
  assertInMemoryMock();
  const safeSlug = withLodgeSlug(lodgeSlug);
  const existing = lodgeSites.find((s) => s.lodge_slug === safeSlug);
  if (existing) return existing;
  const site: MockLodgeSite = {
    id: uuid(),
    lodge_slug: safeSlug,
    page_title: "Lodge Homepage",
    page_description: null,
    sections: [],
    custom_pages: [],
    header_settings: null,
    footer_settings: null,
    published: true,
    updated_at: new Date().toISOString(),
  };
  lodgeSites.push(site);
  return site;
}

export function updateLodgeSite(
  lodgeSlug: string,
  updates: Partial<
    Pick<
      MockLodgeSite,
      | "page_title"
      | "page_description"
      | "sections"
      | "custom_pages"
      | "header_settings"
      | "footer_settings"
      | "published"
    >
  >
): MockLodgeSite {
  assertInMemoryMock();
  const site = getLodgeSite(lodgeSlug);
  Object.assign(site, updates, { updated_at: new Date().toISOString() });
  return site;
}

// --- Leads ---
export type MockLead = LodgeScoped & {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  source: string | null;
  how_heard_about_us: string | null;
  initial_message: string | null;
  stage: string;
  assigned_to: string | null;
  proposer_member_id: string | null;
  proposer_name: string | null;
  seconder_member_id: string | null;
  seconder_name: string | null;
  next_step: string | null;
  next_step_due_date: string | null;
  proposal_date: string | null;
  ballot_date: string | null;
  interview_completed_at: string | null;
  consent_given_at: string | null;
  notes: string | null;
  converted_member_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  stage_changed_at: string;
};

const leads: MockLead[] = [];

export function getLeads(opts?: { lodge_slug?: string }): MockLead[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return [...leads]
    .filter((lead) => lead.lodge_slug === lodgeSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getLeadById(id: string, opts?: { lodge_slug?: string }): MockLead | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return leads.find((l) => l.id === id && l.lodge_slug === lodgeSlug) ?? null;
}

type AddLeadInput = Omit<
  MockLead,
  | "id"
  | "created_at"
  | "updated_at"
  | "stage_changed_at"
  | "lodge_slug"
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
> & {
  lodge_slug?: string;
  proposer_member_id?: string | null;
  proposer_name?: string | null;
  seconder_member_id?: string | null;
  seconder_name?: string | null;
  next_step?: string | null;
  next_step_due_date?: string | null;
  proposal_date?: string | null;
  ballot_date?: string | null;
  interview_completed_at?: string | null;
  consent_given_at?: string | null;
  notes?: string | null;
  converted_member_id?: string | null;
  converted_at?: string | null;
};

export function addLead(data: AddLeadInput): MockLead {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const lead: MockLead = {
    id: uuid(),
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email,
    phone: data.phone,
    location: data.location,
    source: data.source,
    how_heard_about_us: data.how_heard_about_us,
    initial_message: data.initial_message,
    stage: data.stage,
    assigned_to: data.assigned_to,
    proposer_member_id: data.proposer_member_id ?? null,
    proposer_name: data.proposer_name ?? null,
    seconder_member_id: data.seconder_member_id ?? null,
    seconder_name: data.seconder_name ?? null,
    next_step: data.next_step ?? null,
    next_step_due_date: data.next_step_due_date ?? null,
    proposal_date: data.proposal_date ?? null,
    ballot_date: data.ballot_date ?? null,
    interview_completed_at: data.interview_completed_at ?? null,
    consent_given_at: data.consent_given_at ?? null,
    notes: data.notes ?? null,
    converted_member_id: data.converted_member_id ?? null,
    converted_at: data.converted_at ?? null,
    lodge_slug: withLodgeSlug(data.lodge_slug),
    created_at: now,
    updated_at: now,
    stage_changed_at: now,
  };
  leads.push(lead);
  return lead;
}

export function updateLead(
  id: string,
  updates: Partial<Omit<MockLead, "id" | "created_at" | "lodge_slug">>,
  opts?: { lodge_slug?: string }
): MockLead | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  const i = leads.findIndex((l) => l.id === id && l.lodge_slug === lodgeSlug);
  if (i === -1) return null;
  const now = new Date().toISOString();
  if (updates.stage) leads[i].stage_changed_at = now;
  Object.assign(leads[i], updates, { updated_at: now });
  return leads[i];
}

export function deleteLead(
  id: string,
  opts?: { lodge_slug?: string }
): { deleted: boolean } {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  const i = leads.findIndex((l) => l.id === id && l.lodge_slug === lodgeSlug);
  if (i === -1) return { deleted: false };
  leads.splice(i, 1);
  for (let j = leadActivities.length - 1; j >= 0; j--) {
    const a = leadActivities[j];
    if (a.lead_id === id && a.lodge_slug === lodgeSlug) {
      leadActivities.splice(j, 1);
    }
  }
  return { deleted: true };
}

export function updateLeadActivity(
  id: string,
  updates: Partial<Pick<MockLeadActivity, "title" | "description" | "meeting_date" | "attendees" | "due_date" | "completed">>,
  opts?: { lodge_slug?: string }
): MockLeadActivity | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  const i = leadActivities.findIndex(
    (a) => a.id === id && a.lodge_slug === lodgeSlug
  );
  if (i === -1) return null;
  Object.assign(leadActivities[i], updates);
  return leadActivities[i];
}

export function getLatestLeadActivity(
  leadId: string,
  opts?: { lodge_slug?: string }
): MockLeadActivity | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return (
    leadActivities
      .filter((a) => a.lead_id === leadId && a.lodge_slug === lodgeSlug)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0] ?? null
  );
}

// --- Lead activities ---
export type MockLeadActivity = LodgeScoped & {
  id: string;
  lead_id: string;
  activity_type: string;
  title: string | null;
  description: string | null;
  meeting_date: string | null;
  attendees: string[] | null;
  due_date: string | null;
  completed: boolean;
  created_by: string | null;
  created_at: string;
};

const leadActivities: MockLeadActivity[] = [];

export function getLeadActivities(leadId: string, opts?: { lodge_slug?: string }): MockLeadActivity[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return leadActivities
    .filter((a) => a.lead_id === leadId && a.lodge_slug === lodgeSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addLeadActivity(
  data: Omit<MockLeadActivity, "id" | "created_at" | "lodge_slug"> & { lodge_slug?: string }
): MockLeadActivity {
  assertInMemoryMock();
  const activity: MockLeadActivity = {
    id: uuid(),
    ...data,
    lodge_slug: withLodgeSlug(data.lodge_slug),
    created_at: new Date().toISOString(),
  };
  leadActivities.push(activity);
  return activity;
}

// --- Events ---
export type MockEvent = LodgeScoped & {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  event_type: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  temple_room: string | null;
  dress_code: string | null;
  enable_rsvp: boolean;
  rsvp_deadline: string | null;
  max_attendees: number | null;
  enable_payments: boolean;
  enable_dining_rsvp: boolean;
  dining_price: number | null;
  dining_description: string | null;
  enable_charity_donation: boolean;
  charity_name: string | null;
  charity_description: string | null;
  charity_suggested_amounts: number[] | null;
  charity_allow_custom: boolean;
  enable_raffle_donation: boolean;
  raffle_description: string | null;
  raffle_suggested_amounts: number[] | null;
  raffle_allow_custom: boolean;
  enable_raffle_wine_pledge: boolean;
  raffle_wine_description: string | null;
  enable_meeting_fee: boolean;
  meeting_fee_amount: number | null;
  meeting_fee_description: string | null;
  enable_guest_tickets: boolean;
  guest_ticket_price: number | null;
  guest_ticket_description: string | null;
  guest_policy: "blue_table" | "white_table" | "closed";
  featured_image_url: string | null;
  published: boolean;
  feature_on_website: boolean;
  sequence_id: string | null;
  sequence_position: number | null;
  summons_status: "none" | "draft" | "approved" | "sent";
  summons_auto_drafted_at: string | null;
  summons_approved_at: string | null;
  summons_approved_by_email: string | null;
  summons_last_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

const events: MockEvent[] = [];

export function getEvents(opts?: { published?: boolean; upcoming?: boolean; lodge_slug?: string }): MockEvent[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  let list = [...events];
  list = list.filter((event) => event.lodge_slug === lodgeSlug);
  if (opts?.published !== undefined) list = list.filter((e) => e.published === opts.published);
  if (opts?.upcoming) list = list.filter((e) => new Date(e.event_date) >= new Date());
  return list.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
}

export function getEventById(id: string, opts?: { lodge_slug?: string }): MockEvent | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return events.find((e) => e.id === id && e.lodge_slug === lodgeSlug) ?? null;
}

export function getEventBySlug(slug: string, opts?: { lodge_slug?: string }): MockEvent | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return events.find((e) => e.slug === slug && e.published && e.lodge_slug === lodgeSlug) ?? null;
}

type AddEventInput = Omit<
  MockEvent,
  | "id"
  | "created_at"
  | "updated_at"
  | "lodge_slug"
  | "sequence_id"
  | "sequence_position"
  | "summons_status"
  | "summons_auto_drafted_at"
  | "summons_approved_at"
  | "summons_approved_by_email"
  | "summons_last_sent_at"
  | "feature_on_website"
> & {
  lodge_slug?: string;
  sequence_id?: string | null;
  sequence_position?: number | null;
  summons_status?: MockEvent["summons_status"];
  summons_auto_drafted_at?: string | null;
  summons_approved_at?: string | null;
  summons_approved_by_email?: string | null;
  summons_last_sent_at?: string | null;
  feature_on_website?: boolean;
};

export function addEvent(data: AddEventInput): MockEvent {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const event: MockEvent = {
    id: uuid(),
    sequence_id: null,
    sequence_position: null,
    summons_status: "none",
    summons_auto_drafted_at: null,
    summons_approved_at: null,
    summons_approved_by_email: null,
    summons_last_sent_at: null,
    feature_on_website: false,
    ...data,
    lodge_slug: withLodgeSlug(data.lodge_slug),
    created_at: now,
    updated_at: now,
  };
  events.push(event);
  return event;
}

export function updateEvent(id: string, updates: Partial<MockEvent>, opts?: { lodge_slug?: string }): MockEvent | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  const i = events.findIndex((e) => e.id === id && e.lodge_slug === lodgeSlug);
  if (i === -1) return null;
  Object.assign(events[i], updates, { updated_at: new Date().toISOString() });
  return events[i];
}

export function deleteEvent(id: string, opts?: { lodge_slug?: string }): MockEvent | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  const i = events.findIndex((e) => e.id === id && e.lodge_slug === lodgeSlug);
  if (i === -1) return null;
  const [removed] = events.splice(i, 1);
  return removed;
}

// --- RSVPs ---
export type MockRsvp = LodgeScoped & {
  id: string;
  event_id: string;
  user_name: string;
  user_email: string;
  user_phone: string | null;
  attending_ceremony: boolean;
  attending_dining: boolean;
  number_of_guests: number;
  dietary_requirements: string | null;
  special_requests: string | null;
  payment_required: boolean;
  payment_completed: boolean;
  payment_id: string | null;
  status: string;
  raffle_wine_pledged?: boolean;
  raffle_wine_bottles?: number;
  raffle_wine_note?: string | null;
  created_at: string;
  updated_at: string;
};

const rsvps: MockRsvp[] = [];

export function getRsvpsByEventId(eventId: string, opts?: { lodge_slug?: string }): MockRsvp[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return rsvps.filter((r) => r.event_id === eventId && r.lodge_slug === lodgeSlug);
}

export function addRsvp(
  data: Omit<MockRsvp, "id" | "created_at" | "updated_at" | "lodge_slug"> & { lodge_slug?: string }
): MockRsvp {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const rsvp: MockRsvp = {
    id: uuid(),
    ...data,
    lodge_slug: withLodgeSlug(data.lodge_slug),
    created_at: now,
    updated_at: now,
  };
  rsvps.push(rsvp);
  return rsvp;
}

export function updateRsvp(
  id: string,
  updates: Partial<Pick<MockRsvp, "payment_id" | "payment_completed" | "status">>,
  opts?: { lodge_slug?: string }
): MockRsvp | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  const i = rsvps.findIndex((r) => r.id === id && r.lodge_slug === lodgeSlug);
  if (i === -1) return null;
  Object.assign(rsvps[i], updates, { updated_at: new Date().toISOString() });
  return rsvps[i];
}

export function getRsvpById(id: string, opts?: { lodge_slug?: string }): MockRsvp | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return rsvps.find((r) => r.id === id && r.lodge_slug === lodgeSlug) ?? null;
}

// --- Payments ---
export type MockPayment = LodgeScoped & {
  id: string;
  rsvp_id: string | null;
  event_id: string | null;
  user_email: string;
  user_name: string | null;
  stripe_payment_intent_id: string | null;
  dining_amount: number;
  charity_amount: number;
  raffle_amount: number;
  meeting_fee_amount: number;
  guest_ticket_amount: number;
  total_amount: number;
  currency: string;
  charity_name: string | null;
  status: string;
  refund_amount: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const payments: MockPayment[] = [];

export function getPayments(opts?: { lodge_slug?: string }): MockPayment[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return [...payments]
    .filter((payment) => payment.lodge_slug === lodgeSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addPayment(
  data: Omit<MockPayment, "id" | "created_at" | "updated_at" | "lodge_slug"> & { lodge_slug?: string }
): MockPayment {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const payment: MockPayment = {
    id: uuid(),
    ...data,
    lodge_slug: withLodgeSlug(data.lodge_slug),
    created_at: now,
    updated_at: now,
  };
  payments.push(payment);
  return payment;
}

// --- Event Guests ---
export type MockEventGuest = LodgeScoped & {
  id: string;
  rsvp_id: string | null;
  event_id: string;
  guest_name: string;
  dietary_requirements: string | null;
  email: string | null;
  phone: string | null;
  guest_id: string | null;
  guest_invitation_id: string | null;
  source: "member_party" | "self_invite" | "admin_added";
  welcome_email_sent_at: string | null;
  created_at: string;
};

const eventGuests: MockEventGuest[] = [];

export type MockEventGuestInput = {
  rsvp_id: string | null;
  event_id: string;
  guest_name: string;
  dietary_requirements: string | null;
  email?: string | null;
  phone?: string | null;
  guest_id?: string | null;
  guest_invitation_id?: string | null;
  source?: MockEventGuest["source"];
  lodge_slug?: string;
};

export function addEventGuests(
  guests: MockEventGuestInput[],
  lodgeSlug?: string
): MockEventGuest[] {
  assertInMemoryMock();
  const slug = withLodgeSlug(lodgeSlug);
  return guests.map((g) => {
    const guest: MockEventGuest = {
      id: uuid(),
      rsvp_id: g.rsvp_id,
      event_id: g.event_id,
      guest_name: g.guest_name,
      dietary_requirements: g.dietary_requirements,
      email: g.email ?? null,
      phone: g.phone ?? null,
      guest_id: g.guest_id ?? null,
      guest_invitation_id: g.guest_invitation_id ?? null,
      source: g.source ?? "member_party",
      welcome_email_sent_at: null,
      lodge_slug: withLodgeSlug(g.lodge_slug ?? slug),
      created_at: new Date().toISOString(),
    };
    eventGuests.push(guest);
    return guest;
  });
}

export function getGuestsByRsvp(rsvpId: string, opts?: { lodge_slug?: string }): MockEventGuest[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return eventGuests.filter((g) => g.rsvp_id === rsvpId && g.lodge_slug === lodgeSlug);
}

export function getGuestsByEvent(eventId: string, opts?: { lodge_slug?: string }): MockEventGuest[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return eventGuests.filter((g) => g.event_id === eventId && g.lodge_slug === lodgeSlug);
}

export function listEventGuestsForLodge(
  opts?: { lodge_slug?: string; eventId?: string; guestId?: string }
): MockEventGuest[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return eventGuests
    .filter((g) => g.lodge_slug === lodgeSlug)
    .filter((g) => (opts?.eventId ? g.event_id === opts.eventId : true))
    .filter((g) => (opts?.guestId ? g.guest_id === opts.guestId : true));
}

// --- Guests directory + guest invitations ---
export type MockGuest = LodgeScoped & {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  mother_lodge_name: string | null;
  mother_lodge_number: string | null;
  constitution: string | null;
  rank: string | null;
  dietary_requirements: string | null;
  guest_category: "guest" | "honorary_guest";
  guest_dining_amount: number | null;
  dining_waived: boolean;
  is_mason: boolean;
  first_seen_event_id: string | null;
  last_seen_event_id: string | null;
  visit_count: number;
  notes: string | null;
  archived_at: string | null;
  visitor_token_hash: string | null;
  source: "admin" | "member_invite" | "self_invite_event" | "self_register";
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

const guestsDirectory: MockGuest[] = [];

export function listGuests(opts?: {
  lodge_slug?: string;
  search?: string;
  includeArchived?: boolean;
}): MockGuest[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  let list = guestsDirectory.filter((g) => g.lodge_slug === lodgeSlug);
  if (!opts?.includeArchived) {
    list = list.filter((g) => g.archived_at === null);
  }
  if (opts?.search) {
    const term = opts.search.toLowerCase();
    list = list.filter(
      (g) =>
        g.full_name.toLowerCase().includes(term) ||
        (g.email ?? "").toLowerCase().includes(term) ||
        (g.mother_lodge_name ?? "").toLowerCase().includes(term)
    );
  }
  return list;
}

export function getGuestById(id: string, opts?: { lodge_slug?: string }): MockGuest | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return guestsDirectory.find((g) => g.id === id && g.lodge_slug === lodgeSlug) ?? null;
}

export function createGuestRecord(
  data: Partial<Omit<MockGuest, "id" | "created_at" | "updated_at" | "lodge_slug">> & {
    full_name: string;
    lodge_slug?: string;
  }
): MockGuest {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const guest: MockGuest = {
    id: uuid(),
    lodge_slug: withLodgeSlug(data.lodge_slug),
    full_name: data.full_name,
    email: data.email ?? null,
    phone: data.phone ?? null,
    mother_lodge_name: data.mother_lodge_name ?? null,
    mother_lodge_number: data.mother_lodge_number ?? null,
    constitution: data.constitution ?? null,
    rank: data.rank ?? null,
    dietary_requirements: data.dietary_requirements ?? null,
    guest_category: data.guest_category ?? "guest",
    guest_dining_amount: data.guest_dining_amount ?? null,
    dining_waived: data.dining_waived ?? false,
    is_mason: data.is_mason ?? true,
    first_seen_event_id: data.first_seen_event_id ?? null,
    last_seen_event_id: data.last_seen_event_id ?? null,
    visit_count: data.visit_count ?? 0,
    notes: data.notes ?? null,
    archived_at: data.archived_at ?? null,
    visitor_token_hash: data.visitor_token_hash ?? null,
    source: data.source ?? "admin",
    email_confirmed_at: data.email_confirmed_at ?? null,
    created_at: now,
    updated_at: now,
  };
  guestsDirectory.push(guest);
  return guest;
}

export function updateGuestRecord(
  id: string,
  patch: Partial<Omit<MockGuest, "id" | "lodge_slug" | "created_at">>,
  opts?: { lodge_slug?: string }
): MockGuest | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  const guest = guestsDirectory.find(
    (g) => g.id === id && g.lodge_slug === lodgeSlug
  );
  if (!guest) return null;
  Object.assign(guest, patch, { updated_at: new Date().toISOString() });
  return guest;
}

export function upsertGuest(
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
    lodge_slug?: string;
    source?:
      | "admin"
      | "member_invite"
      | "self_invite_event"
      | "self_register";
    recordVisit?: boolean;
  }
): MockGuest {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(input.lodge_slug);
  const email = input.email?.trim() || null;
  const fullName = input.full_name.trim();
  const motherLodgeName = input.mother_lodge_name?.trim() || null;

  const existing = guestsDirectory.find((g) => {
    if (g.lodge_slug !== lodgeSlug) return false;
    if (email && g.email) return g.email.toLowerCase() === email.toLowerCase();
    if (!email) {
      const sameName = g.full_name.toLowerCase() === fullName.toLowerCase();
      const sameMother =
        (g.mother_lodge_name ?? null) === (motherLodgeName ?? null);
      return sameName && sameMother;
    }
    return false;
  });

  const recordVisit = input.recordVisit !== false;

  if (existing) {
    return updateGuestRecord(
      existing.id,
      {
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
        visit_count: recordVisit
          ? existing.visit_count + 1
          : existing.visit_count,
        last_seen_event_id: recordVisit
          ? (input.event_id ?? existing.last_seen_event_id)
          : existing.last_seen_event_id,
        first_seen_event_id:
          existing.first_seen_event_id ?? input.event_id ?? null,
      },
      { lodge_slug: lodgeSlug }
    )!;
  }

  return createGuestRecord({
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
    visitor_token_hash: null,
    source: input.source ?? "admin",
    email_confirmed_at: null,
    lodge_slug: lodgeSlug,
  });
}

export function archiveGuestRecord(
  id: string,
  opts?: { lodge_slug?: string }
): MockGuest | null {
  return updateGuestRecord(
    id,
    { archived_at: new Date().toISOString() },
    opts
  );
}

export function restoreGuestRecord(
  id: string,
  opts?: { lodge_slug?: string }
): MockGuest | null {
  return updateGuestRecord(id, { archived_at: null }, opts);
}

export function hardDeleteGuestRecordIfUnused(
  id: string,
  opts?: { lodge_slug?: string }
): boolean {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  const idx = guestsDirectory.findIndex(
    (g) => g.id === id && g.lodge_slug === lodgeSlug
  );
  if (idx === -1) return false;
  if ((guestsDirectory[idx].visit_count ?? 0) > 0) return false;
  guestsDirectory.splice(idx, 1);
  return true;
}

export function getGuestByVisitorTokenHash(
  tokenHash: string,
  opts?: { lodge_slug?: string }
): MockGuest | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return (
    guestsDirectory.find(
      (g) => g.visitor_token_hash === tokenHash && g.lodge_slug === lodgeSlug
    ) ?? null
  );
}

export function setGuestVisitorTokenHash(
  id: string,
  tokenHash: string,
  opts?: { lodge_slug?: string }
): MockGuest | null {
  return updateGuestRecord(id, { visitor_token_hash: tokenHash }, opts);
}

export type MockGuestInvitation = LodgeScoped & {
  id: string;
  event_id: string;
  inviter_member_id: string | null;
  inviter_admin_user_id: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  token_hash: string;
  payer: "guest" | "inviter";
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  guest_id: string | null;
  created_at: string;
};

const guestInvitations: MockGuestInvitation[] = [];

export function createGuestInvitation(
  data: Omit<
    MockGuestInvitation,
    | "id"
    | "uses"
    | "created_at"
    | "last_used_at"
    | "revoked_at"
    | "guest_id"
    | "lodge_slug"
  > & {
    lodge_slug?: string;
    guest_id?: string | null;
    uses?: number;
  }
): MockGuestInvitation {
  assertInMemoryMock();
  const { lodge_slug: providedSlug, guest_id, ...rest } = data;
  const inv: MockGuestInvitation = {
    id: uuid(),
    lodge_slug: withLodgeSlug(providedSlug),
    uses: data.uses ?? 0,
    last_used_at: null,
    revoked_at: null,
    guest_id: guest_id ?? null,
    created_at: new Date().toISOString(),
    ...rest,
  };
  guestInvitations.push(inv);
  return inv;
}

export function getGuestInvitationByTokenHash(
  tokenHash: string
): MockGuestInvitation | null {
  assertInMemoryMock();
  return guestInvitations.find((i) => i.token_hash === tokenHash) ?? null;
}

export function listGuestInvitationsForEvent(
  eventId: string,
  opts?: { lodge_slug?: string }
): MockGuestInvitation[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return guestInvitations
    .filter((i) => i.event_id === eventId && i.lodge_slug === lodgeSlug)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function getGuestInvitationById(
  id: string,
  opts?: { lodge_slug?: string }
): MockGuestInvitation | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return (
    guestInvitations.find(
      (i) => i.id === id && i.lodge_slug === lodgeSlug
    ) ?? null
  );
}

export function listGuestInvitationsForGuest(
  guestId: string,
  opts?: { lodge_slug?: string }
): MockGuestInvitation[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return guestInvitations
    .filter((i) => i.guest_id === guestId && i.lodge_slug === lodgeSlug)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function listGuestInvitationsForMember(
  memberId: string,
  opts?: { lodge_slug?: string }
): MockGuestInvitation[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return guestInvitations
    .filter(
      (i) => i.inviter_member_id === memberId && i.lodge_slug === lodgeSlug
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function recordGuestInvitationUse(id: string): MockGuestInvitation | null {
  assertInMemoryMock();
  const inv = guestInvitations.find((i) => i.id === id);
  if (!inv) return null;
  inv.uses += 1;
  inv.last_used_at = new Date().toISOString();
  return inv;
}

export function revokeGuestInvitation(
  id: string,
  opts?: { lodge_slug?: string }
): MockGuestInvitation | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  const inv = guestInvitations.find(
    (i) => i.id === id && i.lodge_slug === lodgeSlug
  );
  if (!inv) return null;
  inv.revoked_at = new Date().toISOString();
  return inv;
}

// --- Members ---
export type MockMember = LodgeScoped & {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
  country_list: boolean;
  royal_arch: boolean;
  honorary: boolean;
  office_title: string | null;
  officer_sort_order: number | null;
  directory_sort_order: number | null;
  rank: string | null;
  dietary_requirements: string | null;
  annual_dues_waived?: boolean;
  annual_dues_waiver_reason?: string | null;
  date_of_initiation: string | null;
  initiation_email_sent: boolean;
  membership_status: 'active' | 'suspended' | 'resigned' | 'excluded';
  stripe_customer_id: string | null;
  show_on_website?: boolean;
  public_bio?: string | null;
  created_at: string;
  updated_at: string;
};

const members: MockMember[] = [];

export function getMembers(opts?: { lodge_slug?: string; status?: string; search?: string }): MockMember[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  let list = members.filter((m) => m.lodge_slug === lodgeSlug);
  if (opts?.status) list = list.filter((m) => m.membership_status === opts.status);
  if (opts?.search) {
    const q = opts.search.toLowerCase();
    list = list.filter((m) => m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }
  return list.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export function getMemberById(id: string, opts?: { lodge_slug?: string }): MockMember | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return members.find((m) => m.id === id && m.lodge_slug === lodgeSlug) ?? null;
}

export function getMemberByEmail(email: string, opts?: { lodge_slug?: string }): MockMember | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return members.find((m) => m.email.toLowerCase() === email.toLowerCase() && m.lodge_slug === lodgeSlug) ?? null;
}

export function createMember(
  data: Omit<MockMember, "id" | "created_at" | "updated_at" | "lodge_slug"> & { lodge_slug?: string }
): MockMember {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const member: MockMember = {
    id: uuid(),
    ...data,
    lodge_slug: withLodgeSlug(data.lodge_slug),
    created_at: now,
    updated_at: now,
  };
  members.push(member);
  return member;
}

export function updateMember(
  id: string,
  updates: Partial<Omit<MockMember, "id" | "lodge_slug" | "created_at">>,
  opts?: { lodge_slug?: string }
): MockMember | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  const i = members.findIndex((m) => m.id === id && m.lodge_slug === lodgeSlug);
  if (i === -1) return null;
  const oldEmail = members[i].email;
  const normalisedEmail =
    typeof updates.email === "string"
      ? updates.email.trim().toLowerCase()
      : undefined;
  const next: Partial<MockMember> =
    normalisedEmail !== undefined
      ? { ...updates, email: normalisedEmail }
      : updates;
  Object.assign(members[i], next, { updated_at: new Date().toISOString() });
  if (normalisedEmail !== undefined && normalisedEmail !== oldEmail) {
    for (const p of payments) {
      if (p.lodge_slug === lodgeSlug && p.user_email.toLowerCase() === oldEmail.toLowerCase()) {
        p.user_email = normalisedEmail;
      }
    }
    for (const r of rsvps) {
      if (r.lodge_slug === lodgeSlug && r.user_email.toLowerCase() === oldEmail.toLowerCase()) {
        r.user_email = normalisedEmail;
      }
    }
  }
  return members[i];
}

export function getRsvpDietaryByEmail(email: string, opts?: { lodge_slug?: string }): Array<{ event_id: string; dietary_requirements: string | null; created_at: string }> {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return rsvps
    .filter((r) => r.user_email.toLowerCase() === email.toLowerCase() && r.lodge_slug === lodgeSlug && r.dietary_requirements)
    .map((r) => ({ event_id: r.event_id, dietary_requirements: r.dietary_requirements, created_at: r.created_at }));
}

export function getPaymentsByEmail(email: string, opts?: { lodge_slug?: string }): MockPayment[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return payments
    .filter((p) => p.user_email.toLowerCase() === email.toLowerCase() && p.lodge_slug === lodgeSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// --- Blog posts ---
export type MockBlogPost = LodgeScoped & {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  category: string | null;
  author_name: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const blogPosts: MockBlogPost[] = [];

export function getBlogPosts(opts?: { published?: boolean; lodge_slug?: string }): MockBlogPost[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  let list = [...blogPosts];
  list = list.filter((post) => post.lodge_slug === lodgeSlug);
  if (opts?.published !== undefined) {
    list = list.filter((p) => p.published && p.published_at && new Date(p.published_at) <= new Date());
  }
  return list.sort((a, b) => new Date((b.published_at ?? b.created_at)).getTime() - new Date((a.published_at ?? a.created_at)).getTime());
}

export function getBlogPostById(id: string, opts?: { lodge_slug?: string }): MockBlogPost | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return blogPosts.find((p) => p.id === id && p.lodge_slug === lodgeSlug) ?? null;
}

export function getBlogPostBySlug(slug: string, opts?: { lodge_slug?: string }): MockBlogPost | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return blogPosts.find((p) => p.slug === slug && p.published && p.lodge_slug === lodgeSlug) ?? null;
}

export function addBlogPost(
  data: Omit<MockBlogPost, "id" | "created_at" | "updated_at" | "lodge_slug"> & { lodge_slug?: string }
): MockBlogPost {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const post: MockBlogPost = {
    id: uuid(),
    ...data,
    lodge_slug: withLodgeSlug(data.lodge_slug),
    created_at: now,
    updated_at: now,
  };
  blogPosts.push(post);
  return post;
}

export function updateBlogPost(id: string, updates: Partial<MockBlogPost>, opts?: { lodge_slug?: string }): MockBlogPost | null {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  const i = blogPosts.findIndex((p) => p.id === id && p.lodge_slug === lodgeSlug);
  if (i === -1) return null;
  Object.assign(blogPosts[i], updates, { updated_at: new Date().toISOString() });
  return blogPosts[i];
}

// --- Charity Campaigns ---
export type MockCharityCampaign = LodgeScoped & {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  raised_amount: number;
  status: "active" | "completed" | "paused";
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

const charityCampaigns: MockCharityCampaign[] = [];

export function getCharityCampaigns(opts?: { lodge_slug?: string }): MockCharityCampaign[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return [...charityCampaigns]
    .filter((c) => c.lodge_slug === lodgeSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addCharityCampaign(
  data: Omit<MockCharityCampaign, "id" | "created_at" | "updated_at" | "lodge_slug"> & { lodge_slug?: string }
): MockCharityCampaign {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const campaign: MockCharityCampaign = {
    id: uuid(),
    ...data,
    lodge_slug: withLodgeSlug(data.lodge_slug),
    created_at: now,
    updated_at: now,
  };
  charityCampaigns.push(campaign);
  return campaign;
}

// --- Donations ---
export type MockDonation = LodgeScoped & {
  id: string;
  donor_name: string;
  donor_email: string;
  amount: number;
  currency: string;
  source: "event" | "direct" | "campaign";
  campaign_id: string | null;
  event_id: string | null;
  payment_id: string | null;
  gift_aid_eligible: boolean;
  gift_aid_declared: boolean;
  status: "completed" | "pending" | "refunded";
  created_at: string;
};

const donations: MockDonation[] = [];

export function getDonations(opts?: { lodge_slug?: string }): MockDonation[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return [...donations]
    .filter((d) => d.lodge_slug === lodgeSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addDonation(
  data: Omit<MockDonation, "id" | "created_at" | "lodge_slug"> & { lodge_slug?: string }
): MockDonation {
  assertInMemoryMock();
  const donation: MockDonation = {
    id: uuid(),
    ...data,
    lodge_slug: withLodgeSlug(data.lodge_slug),
    created_at: new Date().toISOString(),
  };
  donations.push(donation);
  return donation;
}

// --- Gift Aid Declarations ---
export type MockGiftAidDeclaration = LodgeScoped & {
  id: string;
  donor_name: string;
  donor_email: string;
  donor_address: string;
  declaration_date: string;
  status: "active" | "expired" | "revoked";
  total_donations: number;
  reclaimable_amount: number;
  created_at: string;
};

const giftAidDeclarations: MockGiftAidDeclaration[] = [];

export function getGiftAidDeclarations(opts?: { lodge_slug?: string }): MockGiftAidDeclaration[] {
  assertInMemoryMock();
  const lodgeSlug = withLodgeSlug(opts?.lodge_slug);
  return [...giftAidDeclarations]
    .filter((g) => g.lodge_slug === lodgeSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addGiftAidDeclaration(
  data: Omit<MockGiftAidDeclaration, "id" | "created_at" | "lodge_slug"> & { lodge_slug?: string }
): MockGiftAidDeclaration {
  assertInMemoryMock();
  const declaration: MockGiftAidDeclaration = {
    id: uuid(),
    ...data,
    lodge_slug: withLodgeSlug(data.lodge_slug),
    created_at: new Date().toISOString(),
  };
  giftAidDeclarations.push(declaration);
  return declaration;
}

// --- Seed data ---
function seedData() {
  mockDbSeeding = true;
  try {
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();

  if (leads.length > 0) return;

  const seedLeads = [
    { first_name: "James", last_name: "Harrison", email: "james.h@example.com", phone: "07700 100001", location: "London", source: "website", how_heard_about_us: "Google", initial_message: "Interested in Freemasonry", stage: "expression_of_interest", assigned_to: null },
    { first_name: "Robert", last_name: "Mitchell", email: "r.mitchell@example.com", phone: "07700 100002", location: "Surrey", source: "referral", how_heard_about_us: "A friend", initial_message: "Would like to visit", stage: "initial_contact", assigned_to: "WM" },
    { first_name: "William", last_name: "Clarke", email: "w.clarke@example.com", phone: "07700 100003", location: "Kent", source: "event", how_heard_about_us: "Open day", initial_message: null, stage: "meeting_scheduled", assigned_to: "SW" },
    { first_name: "David", last_name: "Thompson", email: "d.thompson@example.com", phone: null, location: "London", source: "website", how_heard_about_us: "UGLE website", initial_message: "What does membership involve?", stage: "approved", assigned_to: "WM" },
    { first_name: "Michael", last_name: "Wright", email: "m.wright@example.com", phone: "07700 100005", location: "Essex", source: "referral", how_heard_about_us: "Brother in lodge", initial_message: "Ready to join", stage: "initiated", assigned_to: "WM" },
    { first_name: "Andrew", last_name: "Baker", email: "a.baker@example.com", phone: null, location: "London", source: "website", how_heard_about_us: null, initial_message: "General enquiry", stage: "expression_of_interest", assigned_to: null },
    { first_name: "Thomas", last_name: "Evans", email: "t.evans@example.com", phone: "07700 100007", location: "Hertfordshire", source: "social_media", how_heard_about_us: "Facebook", initial_message: null, stage: "initial_contact", assigned_to: "JW" },
    { first_name: "Philip", last_name: "Grant", email: "p.grant@example.com", phone: "07700 100008", location: "London", source: "referral", how_heard_about_us: "Existing member", initial_message: "Recommended by a friend", stage: "proposal_lodge", assigned_to: "WM" },
    { first_name: "Stephen", last_name: "Ward", email: "s.ward@example.com", phone: null, location: "Buckinghamshire", source: "website", how_heard_about_us: "Google", initial_message: null, stage: "on_hold", assigned_to: null },
    { first_name: "Daniel", last_name: "Scott", email: "d.scott@example.com", phone: "07700 100010", location: "London", source: "event", how_heard_about_us: "Open day 2025", initial_message: "Not for me at this time", stage: "declined", assigned_to: "SW" },
  ];

  seedLeads.forEach((l, i) => {
    const lead = addLead({ ...l, lodge_slug: DEFAULT_LODGE_SLUG });
    leads[leads.length - 1].created_at = daysAgo(i * 3 + 1);
    leads[leads.length - 1].updated_at = daysAgo(i * 2);
    if (i < 5) {
      addLeadActivity({
        lead_id: lead.id,
        activity_type: "note",
        title: "Initial contact made",
        description: `Called ${l.first_name} to discuss lodge membership.`,
        meeting_date: null,
        attendees: null,
        due_date: null,
        completed: true,
        created_by: "Admin",
        lodge_slug: DEFAULT_LODGE_SLUG,
      });
      leadActivities[leadActivities.length - 1].created_at = daysAgo(i * 3 + 2);
    }
    if (i < 3) {
      addLeadActivity({
        lead_id: lead.id,
        activity_type: "meeting",
        title: "Informal meeting at lodge",
        description: `${l.first_name} attended an informal meeting with the WM and SW.`,
        meeting_date: daysAgo(i * 2),
        attendees: ["WM", "SW", `${l.first_name} ${l.last_name}`],
        due_date: null,
        completed: true,
        created_by: "WM",
        lodge_slug: DEFAULT_LODGE_SLUG,
      });
      leadActivities[leadActivities.length - 1].created_at = daysAgo(i * 2);
    }
    if (i === 0) {
      addLeadActivity({
        lead_id: lead.id,
        activity_type: "email",
        title: "Follow-up email sent",
        description: "Sent information pack and lodge history booklet.",
        meeting_date: null,
        attendees: null,
        due_date: null,
        completed: true,
        created_by: "Secretary",
        lodge_slug: DEFAULT_LODGE_SLUG,
      });
      leadActivities[leadActivities.length - 1].created_at = daysAgo(1);
      addLeadActivity({
        lead_id: lead.id,
        activity_type: "phone_call",
        title: "Phone conversation",
        description: "Discussed next steps and answered questions about the initiation process.",
        meeting_date: null,
        attendees: null,
        due_date: null,
        completed: true,
        created_by: "WM",
        lodge_slug: DEFAULT_LODGE_SLUG,
      });
      leadActivities[leadActivities.length - 1].created_at = daysAgo(4);
      addLeadActivity({
        lead_id: lead.id,
        activity_type: "task",
        title: "Arrange second informal meeting",
        description: null,
        meeting_date: null,
        attendees: null,
        due_date: daysFromNow(7),
        completed: false,
        created_by: "SW",
        lodge_slug: DEFAULT_LODGE_SLUG,
      });
      leadActivities[leadActivities.length - 1].created_at = daysAgo(0);
    }
  });

  const guestMeetingDefaults = { enable_meeting_fee: false, meeting_fee_amount: null, meeting_fee_description: null, enable_guest_tickets: false, guest_ticket_price: null, guest_ticket_description: null, guest_policy: "blue_table" as const, enable_raffle_wine_pledge: false, raffle_wine_description: "Bring a bottle of wine for the evening raffle" as string | null };
  const seedEvents: Array<AddEventInput> = [
    { title: "Regular Meeting – April", slug: "regular-meeting-april", description: "Monthly regular meeting with ceremony.", event_type: "regular_meeting", event_date: daysFromNow(5), event_time: "18:30", location: "Mark Masons' Hall", temple_room: "Temple 1", dress_code: "Dark lounge suit", enable_rsvp: true, rsvp_deadline: daysFromNow(3), max_attendees: 60, enable_payments: true, enable_dining_rsvp: true, dining_price: 45, dining_description: "Three course festive board", enable_charity_donation: true, charity_name: "Masonic Charitable Foundation", charity_description: "Support MCF", charity_suggested_amounts: [5, 10, 20], charity_allow_custom: true, enable_raffle_donation: true, raffle_description: "Charity raffle", raffle_suggested_amounts: [2, 5, 10], raffle_allow_custom: true, ...guestMeetingDefaults, enable_guest_tickets: true, guest_ticket_price: 45, guest_ticket_description: "Guest dining ticket", featured_image_url: null, published: true },
    { title: "Installation Meeting", slug: "installation-meeting", description: "Annual installation of the new Worshipful Master.", event_type: "installation", event_date: daysFromNow(30), event_time: "16:00", location: "Mark Masons' Hall", temple_room: "Grand Temple", dress_code: "Morning dress", enable_rsvp: true, rsvp_deadline: daysFromNow(25), max_attendees: 120, enable_payments: true, enable_dining_rsvp: true, dining_price: 65, dining_description: "Four course installation banquet", enable_charity_donation: true, charity_name: "London Grand Rank Benevolent Fund", charity_description: null, charity_suggested_amounts: [10, 25, 50], charity_allow_custom: true, enable_raffle_donation: true, raffle_description: "Grand raffle", raffle_suggested_amounts: [5, 10], raffle_allow_custom: false, ...guestMeetingDefaults, enable_guest_tickets: true, guest_ticket_price: 65, guest_ticket_description: "Guest banquet ticket", featured_image_url: null, published: true },
    { title: "Summer Social Evening", slug: "summer-social", description: "Annual summer social for brethren and guests.", event_type: "social", event_date: daysFromNow(60), event_time: "19:00", location: "The Ivy, London", temple_room: null, dress_code: "Smart casual", enable_rsvp: true, rsvp_deadline: daysFromNow(55), max_attendees: 40, enable_payments: true, enable_dining_rsvp: false, dining_price: null, dining_description: null, enable_charity_donation: false, charity_name: null, charity_description: null, charity_suggested_amounts: null, charity_allow_custom: false, enable_raffle_donation: false, raffle_description: null, raffle_suggested_amounts: null, raffle_allow_custom: false, ...guestMeetingDefaults, featured_image_url: null, published: true },
    { title: "Regular Meeting – March", slug: "regular-meeting-march", description: "Monthly regular meeting.", event_type: "regular_meeting", event_date: daysAgo(15), event_time: "18:30", location: "Mark Masons' Hall", temple_room: "Temple 1", dress_code: "Dark lounge suit", enable_rsvp: true, rsvp_deadline: daysAgo(17), max_attendees: 60, enable_payments: true, enable_dining_rsvp: true, dining_price: 45, dining_description: "Three course festive board", enable_charity_donation: true, charity_name: "MCF", charity_description: null, charity_suggested_amounts: [5, 10, 20], charity_allow_custom: true, enable_raffle_donation: true, raffle_description: "Charity raffle", raffle_suggested_amounts: [2, 5], raffle_allow_custom: true, ...guestMeetingDefaults, featured_image_url: null, published: true },
    { title: "Committee of General Purposes", slug: "cgp-meeting-april", description: "Pre-meeting committee.", event_type: "committee", event_date: daysFromNow(3), event_time: "17:00", location: "Mark Masons' Hall", temple_room: "Committee Room", dress_code: "Lounge suit", enable_rsvp: false, rsvp_deadline: null, max_attendees: 12, enable_payments: false, enable_dining_rsvp: false, dining_price: null, dining_description: null, enable_charity_donation: false, charity_name: null, charity_description: null, charity_suggested_amounts: null, charity_allow_custom: false, enable_raffle_donation: false, raffle_description: null, raffle_suggested_amounts: null, raffle_allow_custom: false, ...guestMeetingDefaults, featured_image_url: null, published: true },
  ];

  seedEvents.forEach((e) => addEvent(e));

  const memberNames = [
    ["John", "Smith", "john.smith@example.com"],
    ["Peter", "Brown", "peter.brown@example.com"],
    ["Richard", "Taylor", "richard.taylor@example.com"],
    ["George", "Wilson", "george.wilson@example.com"],
    ["Edward", "Davis", "edward.davis@example.com"],
    ["Charles", "Jones", "charles.jones@example.com"],
    ["Henry", "Miller", "henry.miller@example.com"],
    ["Philip", "Anderson", "philip.anderson@example.com"],
  ];

  memberNames.forEach(([first, last, email], i) => {
    createMember({
      auth_user_id: null,
      email,
      full_name: `${first} ${last}`,
      phone: i % 2 === 0 ? `07700 20000${i}` : null,
      address_line_1: `${10 + i} Example Road`,
      address_line_2: null,
      city: i % 2 === 0 ? "London" : "Essex",
      county: i % 2 === 0 ? null : "Essex",
      postcode: `SW1A ${i + 1}AA`,
      country: "United Kingdom",
      country_list: i % 5 === 0,
      royal_arch: i % 3 === 0,
      honorary: false,
      office_title: [
        "Worshipful Master",
        "Senior Warden",
        "Junior Warden",
        "Secretary",
        "Treasurer",
        "Charity Steward",
        "Almoner",
        null,
      ][i],
      officer_sort_order: i < 7 ? i + 1 : null,
      directory_sort_order: i + 1,
      rank: ["EA", "FC", "MM", "MM", "MM", "MM", "MM", "MM"][i],
      dietary_requirements: ["Vegetarian", null, "Gluten-free", null, null, "Vegan", null, "No nuts"][i],
      date_of_initiation: daysAgo(365 + i * 90),
      initiation_email_sent: true,
      membership_status: i === 7 ? "resigned" : "active",
      stripe_customer_id: null,
    });
  });

  const paymentStatuses = ["succeeded", "succeeded", "succeeded", "succeeded", "succeeded", "pending", "succeeded", "refunded"];
  memberNames.forEach(([first, last, email], i) => {
    const dining = [45, 45, 65, 45, 45, 45, 65, 45][i];
    const charity = [10, 20, 25, 5, 15, 10, 50, 0][i];
    const raffle = [5, 10, 10, 5, 0, 5, 10, 5][i];
    addPayment({
      rsvp_id: null,
      event_id: events[i % events.length]?.id ?? null,
      user_email: email,
      user_name: `${first} ${last}`,
      stripe_payment_intent_id: `pi_mock_${i}`,
      dining_amount: dining,
      charity_amount: charity,
      raffle_amount: raffle,
      meeting_fee_amount: 0,
      guest_ticket_amount: 0,
      total_amount: dining + charity + raffle,
      currency: "gbp",
      charity_name: "Masonic Charitable Foundation",
      status: paymentStatuses[i],
      refund_amount: paymentStatuses[i] === "refunded" ? dining + charity + raffle : 0,
      completed_at: paymentStatuses[i] === "succeeded" ? daysAgo(i * 2 + 1) : null,
    });
    payments[payments.length - 1].created_at = daysAgo(i * 2 + 1);
  });

  const seedBlogPosts = [
    { title: "Welcome to Covenant Lodge", slug: "welcome", excerpt: "A warm welcome to all visitors.", content: "We are delighted to welcome you to Covenant Lodge No. 4344.", category: "news", author_name: "Secretary", published: true, published_at: daysAgo(10), featured_image_url: null },
    { title: "Spring Charity Drive Results", slug: "spring-charity", excerpt: "Our spring charity drive raised over £2,000.", content: "Thanks to the generosity of our brethren...", category: "charity", author_name: "Charity Steward", published: true, published_at: daysAgo(5), featured_image_url: null },
    { title: "Installation Preview", slug: "installation-preview", excerpt: "Looking ahead to the installation.", content: "The upcoming installation meeting...", category: "events", author_name: "WM", published: false, published_at: null, featured_image_url: null },
  ];
  seedBlogPosts.forEach((b) => addBlogPost(b));

  addCharityCampaign({ name: "MCF Festival 2026", description: "Lodge festival contribution to the Masonic Charitable Foundation.", target_amount: 5000, raised_amount: 3250, status: "active", start_date: daysAgo(90), end_date: daysFromNow(270) });
  addCharityCampaign({ name: "Local Food Bank Appeal", description: "Supporting our local community food bank through the winter months.", target_amount: 1500, raised_amount: 1500, status: "completed", start_date: daysAgo(180), end_date: daysAgo(30) });
  addCharityCampaign({ name: "Blood Bikes Sponsorship", description: "Sponsoring a blood bike for the volunteer service.", target_amount: 3000, raised_amount: 850, status: "active", start_date: daysAgo(30), end_date: daysFromNow(150) });

  const donationData = [
    { donor_name: "John Smith", donor_email: "john.smith@example.com", amount: 50, source: "campaign" as const, gift_aid_eligible: true, gift_aid_declared: true },
    { donor_name: "Peter Brown", donor_email: "peter.brown@example.com", amount: 100, source: "campaign" as const, gift_aid_eligible: true, gift_aid_declared: true },
    { donor_name: "Richard Taylor", donor_email: "richard.taylor@example.com", amount: 25, source: "event" as const, gift_aid_eligible: true, gift_aid_declared: false },
    { donor_name: "George Wilson", donor_email: "george.wilson@example.com", amount: 200, source: "direct" as const, gift_aid_eligible: false, gift_aid_declared: false },
    { donor_name: "Edward Davis", donor_email: "edward.davis@example.com", amount: 75, source: "campaign" as const, gift_aid_eligible: true, gift_aid_declared: true },
    { donor_name: "Charles Jones", donor_email: "charles.jones@example.com", amount: 30, source: "event" as const, gift_aid_eligible: true, gift_aid_declared: true },
    { donor_name: "Henry Miller", donor_email: "henry.miller@example.com", amount: 150, source: "direct" as const, gift_aid_eligible: true, gift_aid_declared: false },
    { donor_name: "Philip Anderson", donor_email: "philip.anderson@example.com", amount: 40, source: "campaign" as const, gift_aid_eligible: false, gift_aid_declared: false },
  ];
  donationData.forEach((d, i) => {
    addDonation({
      ...d,
      currency: "gbp",
      campaign_id: charityCampaigns[i % charityCampaigns.length]?.id ?? null,
      event_id: i % 2 === 0 ? events[0]?.id ?? null : null,
      payment_id: payments[i]?.id ?? null,
      status: "completed",
    });
    donations[donations.length - 1].created_at = daysAgo(i * 3 + 1);
  });

  addGiftAidDeclaration({ donor_name: "John Smith", donor_email: "john.smith@example.com", donor_address: "12 High Street, London, EC1A 1BB", declaration_date: daysAgo(365), status: "active", total_donations: 250, reclaimable_amount: 62.5 });
  addGiftAidDeclaration({ donor_name: "Peter Brown", donor_email: "peter.brown@example.com", donor_address: "5 Oak Lane, Surrey, GU1 2AB", declaration_date: daysAgo(200), status: "active", total_donations: 400, reclaimable_amount: 100 });
  addGiftAidDeclaration({ donor_name: "Edward Davis", donor_email: "edward.davis@example.com", donor_address: "8 Park Road, Kent, ME1 3CD", declaration_date: daysAgo(150), status: "active", total_donations: 175, reclaimable_amount: 43.75 });
  addGiftAidDeclaration({ donor_name: "Charles Jones", donor_email: "charles.jones@example.com", donor_address: "22 Church Street, Essex, CM1 4EF", declaration_date: daysAgo(500), status: "expired", total_donations: 120, reclaimable_amount: 30 });

  events.forEach((event) => {
    if (event.enable_rsvp) {
      const attendees = memberNames.slice(0, Math.min(4, memberNames.length));
      attendees.forEach(([first, last, email]) => {
        addRsvp({
          event_id: event.id,
          user_name: `${first} ${last}`,
          user_email: email,
          user_phone: null,
          attending_ceremony: true,
          attending_dining: event.enable_dining_rsvp,
          number_of_guests: Math.random() > 0.7 ? 1 : 0,
          dietary_requirements: null,
          special_requests: null,
          payment_required: event.enable_payments,
          payment_completed: Math.random() > 0.3,
          payment_id: null,
          status: "confirmed",
        });
      });
    }
  });
  } finally {
    mockDbSeeding = false;
  }
}

seedData();
