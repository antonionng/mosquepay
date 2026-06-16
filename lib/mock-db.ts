/**
 * In-memory mock DB for front-end iteration. No Supabase/DB required.
 * Data resets on server restart. Replace with real DB when ready.
 */

import type {
  AdminUser,
  MosqueSiteCustomPage,
  MosqueSiteFooterSettings,
  MosqueSiteHeaderSettings,
  MosqueSiteSection,
  Network,
} from "@/lib/db/types";
type PlatformMosqueStats = {
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
import {
  PLATFORM_DEMO_MOSQUES,
  demoEmailFor,
} from "@/lib/platform-demo-mosques";
import { shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import { DEFAULT_MOSQUE_SLUG } from "@/lib/tenant";

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

type MosqueScoped = {
  mosque_slug: string;
};

function withMosqueSlug(slug?: string): string {
  return (slug ?? DEFAULT_MOSQUE_SLUG).trim().toLowerCase();
}

// --- Mosques and mosque websites ---
export type MockMosque = {
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
  mosque_number: string | null;
  consecrated_at: string | null;
  governing_body: string | null;
  service_schedule: string | null;
  secretary_name: string | null;
  secretary_address: string | null;
  secretary_phone: string | null;
  charity_donation_url: string | null;
  gift_aid_pack_name: string | null;
  data_protection_notice: string | null;
  newcomer_notice: string | null;
  loi_contact: string | null;
  wifi_details: string | null;
  service_location: string | null;
  service_location_url: string | null;
  accessibility_notes: string | null;
  default_dress_code: string | null;
  is_active: boolean;
  network_id: string | null;
  custom_domain: string | null;
  custom_domain_verified_at: string | null;
  custom_domain_verification_token: string | null;
  accepts_self_registration: boolean;
  current_charity_campaign_id: string | null;
  gift_aid_default_mode: "digital" | "paper" | "both";
  gift_aid_pack_email: string | null;
  gift_aid_pack_charity_number: string | null;
  hmrc_charity_reference: string | null;
  created_at: string;
  updated_at: string;
};

export type MockMosqueSite = MosqueScoped & {
  id: string;
  page_title: string;
  page_description: string | null;
  sections: MosqueSiteSection[];
  custom_pages: MosqueSiteCustomPage[];
  header_settings: MosqueSiteHeaderSettings | null;
  footer_settings: MosqueSiteFooterSettings | null;
  published: boolean;
  updated_at: string;
};

const mosques: MockMosque[] = [];
const mosqueSites: MockMosqueSite[] = [];

type MockNetwork = Network & { created_at: string; updated_at: string };
const networks: MockNetwork[] = [];

export function listMosques(): MockMosque[] {
  assertInMemoryMock();
  return [...mosques].sort((a, b) => a.name.localeCompare(b.name));
}

export function getMosqueBySlug(slug: string): MockMosque | null {
  assertInMemoryMock();
  const safeSlug = withMosqueSlug(slug);
  return mosques.find((l) => l.slug === safeSlug && l.is_active) ?? null;
}

export function upsertMosque(
  input: Partial<Omit<MockMosque, "id" | "created_at" | "updated_at">> & Pick<MockMosque, "slug" | "name">
): MockMosque {
  assertInMemoryMock();
  const safeSlug = withMosqueSlug(input.slug);
  const now = new Date().toISOString();
  const existing = mosques.find((l) => l.slug === safeSlug);
  if (existing) {
    Object.assign(existing, input, { slug: safeSlug, updated_at: now });
    return existing;
  }
  const mosque: MockMosque = {
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
    mosque_number: input.mosque_number ?? null,
    consecrated_at: input.consecrated_at ?? null,
    governing_body: input.governing_body ?? null,
    service_schedule: input.service_schedule ?? null,
    secretary_name: input.secretary_name ?? null,
    secretary_address: input.secretary_address ?? null,
    secretary_phone: input.secretary_phone ?? null,
    charity_donation_url: input.charity_donation_url ?? null,
    gift_aid_pack_name: input.gift_aid_pack_name ?? null,
    data_protection_notice: input.data_protection_notice ?? null,
    newcomer_notice: input.newcomer_notice ?? null,
    loi_contact: input.loi_contact ?? null,
    wifi_details: input.wifi_details ?? null,
    service_location: input.service_location ?? null,
    service_location_url: input.service_location_url ?? null,
    accessibility_notes: input.accessibility_notes ?? null,
    default_dress_code: input.default_dress_code ?? null,
    is_active: input.is_active ?? true,
    network_id: input.network_id ?? null,
    custom_domain: input.custom_domain ?? null,
    custom_domain_verified_at: input.custom_domain_verified_at ?? null,
    custom_domain_verification_token: input.custom_domain_verification_token ?? null,
    accepts_self_registration: input.accepts_self_registration ?? false,
    current_charity_campaign_id: null,
    gift_aid_default_mode: input.gift_aid_default_mode ?? "both",
    gift_aid_pack_email: input.gift_aid_pack_email ?? null,
    gift_aid_pack_charity_number: input.gift_aid_pack_charity_number ?? null,
    hmrc_charity_reference: input.hmrc_charity_reference ?? null,
    created_at: now,
    updated_at: now,
  };
  mosques.push(mosque);
  return mosque;
}

export function getMosqueSite(mosqueSlug?: string): MockMosqueSite {
  assertInMemoryMock();
  const safeSlug = withMosqueSlug(mosqueSlug);
  const existing = mosqueSites.find((s) => s.mosque_slug === safeSlug);
  if (existing) return existing;
  const site: MockMosqueSite = {
    id: uuid(),
    mosque_slug: safeSlug,
    page_title: "Mosque Homepage",
    page_description: null,
    sections: [],
    custom_pages: [],
    header_settings: null,
    footer_settings: null,
    published: true,
    updated_at: new Date().toISOString(),
  };
  mosqueSites.push(site);
  return site;
}

export function updateMosqueSite(
  mosqueSlug: string,
  updates: Partial<
    Pick<
      MockMosqueSite,
      | "page_title"
      | "page_description"
      | "sections"
      | "custom_pages"
      | "header_settings"
      | "footer_settings"
      | "published"
    >
  >
): MockMosqueSite {
  assertInMemoryMock();
  const site = getMosqueSite(mosqueSlug);
  Object.assign(site, updates, { updated_at: new Date().toISOString() });
  return site;
}

// --- Newcomers ---
export type MockNewcomer = MosqueScoped & {
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
  membership_decision_date: string | null;
  interview_completed_at: string | null;
  consent_given_at: string | null;
  notes: string | null;
  converted_member_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  stage_changed_at: string;
};

const newcomers: MockNewcomer[] = [];

export function getNewcomers(opts?: { mosque_slug?: string }): MockNewcomer[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return [...newcomers]
    .filter((newcomer) => newcomer.mosque_slug === mosqueSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getNewcomerById(id: string, opts?: { mosque_slug?: string }): MockNewcomer | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return newcomers.find((l) => l.id === id && l.mosque_slug === mosqueSlug) ?? null;
}

type AddNewcomerInput = Omit<
  MockNewcomer,
  | "id"
  | "created_at"
  | "updated_at"
  | "stage_changed_at"
  | "mosque_slug"
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
> & {
  mosque_slug?: string;
  proposer_member_id?: string | null;
  proposer_name?: string | null;
  seconder_member_id?: string | null;
  seconder_name?: string | null;
  next_step?: string | null;
  next_step_due_date?: string | null;
  proposal_date?: string | null;
  membership_decision_date?: string | null;
  interview_completed_at?: string | null;
  consent_given_at?: string | null;
  notes?: string | null;
  converted_member_id?: string | null;
  converted_at?: string | null;
};

export function addNewcomer(data: AddNewcomerInput): MockNewcomer {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const newcomer: MockNewcomer = {
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
    membership_decision_date: data.membership_decision_date ?? null,
    interview_completed_at: data.interview_completed_at ?? null,
    consent_given_at: data.consent_given_at ?? null,
    notes: data.notes ?? null,
    converted_member_id: data.converted_member_id ?? null,
    converted_at: data.converted_at ?? null,
    mosque_slug: withMosqueSlug(data.mosque_slug),
    created_at: now,
    updated_at: now,
    stage_changed_at: now,
  };
  newcomers.push(newcomer);
  return newcomer;
}

export function updateNewcomer(
  id: string,
  updates: Partial<Omit<MockNewcomer, "id" | "created_at" | "mosque_slug">>,
  opts?: { mosque_slug?: string }
): MockNewcomer | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  const i = newcomers.findIndex((l) => l.id === id && l.mosque_slug === mosqueSlug);
  if (i === -1) return null;
  const now = new Date().toISOString();
  if (updates.stage) newcomers[i].stage_changed_at = now;
  Object.assign(newcomers[i], updates, { updated_at: now });
  return newcomers[i];
}

export function deleteNewcomer(
  id: string,
  opts?: { mosque_slug?: string }
): { deleted: boolean } {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  const i = newcomers.findIndex((l) => l.id === id && l.mosque_slug === mosqueSlug);
  if (i === -1) return { deleted: false };
  newcomers.splice(i, 1);
  for (let j = newcomerActivities.length - 1; j >= 0; j--) {
    const a = newcomerActivities[j];
    if (a.newcomer_id === id && a.mosque_slug === mosqueSlug) {
      newcomerActivities.splice(j, 1);
    }
  }
  return { deleted: true };
}

export function updateNewcomerActivity(
  id: string,
  updates: Partial<Pick<MockNewcomerActivity, "title" | "description" | "service_date" | "attendees" | "due_date" | "completed">>,
  opts?: { mosque_slug?: string }
): MockNewcomerActivity | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  const i = newcomerActivities.findIndex(
    (a) => a.id === id && a.mosque_slug === mosqueSlug
  );
  if (i === -1) return null;
  Object.assign(newcomerActivities[i], updates);
  return newcomerActivities[i];
}

export function getLatestNewcomerActivity(
  newcomerId: string,
  opts?: { mosque_slug?: string }
): MockNewcomerActivity | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return (
    newcomerActivities
      .filter((a) => a.newcomer_id === newcomerId && a.mosque_slug === mosqueSlug)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0] ?? null
  );
}

// --- Newcomer activities ---
export type MockNewcomerActivity = MosqueScoped & {
  id: string;
  newcomer_id: string;
  activity_type: string;
  title: string | null;
  description: string | null;
  service_date: string | null;
  attendees: string[] | null;
  due_date: string | null;
  completed: boolean;
  created_by: string | null;
  created_at: string;
};

const newcomerActivities: MockNewcomerActivity[] = [];

export function getNewcomerActivities(newcomerId: string, opts?: { mosque_slug?: string }): MockNewcomerActivity[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return newcomerActivities
    .filter((a) => a.newcomer_id === newcomerId && a.mosque_slug === mosqueSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addNewcomerActivity(
  data: Omit<MockNewcomerActivity, "id" | "created_at" | "mosque_slug"> & { mosque_slug?: string }
): MockNewcomerActivity {
  assertInMemoryMock();
  const activity: MockNewcomerActivity = {
    id: uuid(),
    ...data,
    mosque_slug: withMosqueSlug(data.mosque_slug),
    created_at: new Date().toISOString(),
  };
  newcomerActivities.push(activity);
  return activity;
}

// --- Events ---
export type MockEvent = MosqueScoped & {
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
  enable_service_fee: boolean;
  service_fee_amount: number | null;
  service_fee_description: string | null;
  enable_guest_tickets: boolean;
  guest_ticket_price: number | null;
  guest_ticket_description: string | null;
  guest_policy: "blue_table" | "white_table" | "closed";
  featured_image_url: string | null;
  published: boolean;
  feature_on_website: boolean;
  sequence_id: string | null;
  sequence_position: number | null;
  notice_status: "none" | "draft" | "approved" | "sent";
  notice_auto_drafted_at: string | null;
  notice_approved_at: string | null;
  notice_approved_by_email: string | null;
  notice_last_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

const events: MockEvent[] = [];

export function getEvents(opts?: { published?: boolean; upcoming?: boolean; mosque_slug?: string }): MockEvent[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  let list = [...events];
  list = list.filter((event) => event.mosque_slug === mosqueSlug);
  if (opts?.published !== undefined) list = list.filter((e) => e.published === opts.published);
  if (opts?.upcoming) list = list.filter((e) => new Date(e.event_date) >= new Date());
  return list.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
}

export function getEventById(id: string, opts?: { mosque_slug?: string }): MockEvent | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return events.find((e) => e.id === id && e.mosque_slug === mosqueSlug) ?? null;
}

export function getEventBySlug(slug: string, opts?: { mosque_slug?: string }): MockEvent | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return events.find((e) => e.slug === slug && e.published && e.mosque_slug === mosqueSlug) ?? null;
}

type AddEventInput = Omit<
  MockEvent,
  | "id"
  | "created_at"
  | "updated_at"
  | "mosque_slug"
  | "sequence_id"
  | "sequence_position"
  | "notice_status"
  | "notice_auto_drafted_at"
  | "notice_approved_at"
  | "notice_approved_by_email"
  | "notice_last_sent_at"
  | "feature_on_website"
> & {
  mosque_slug?: string;
  sequence_id?: string | null;
  sequence_position?: number | null;
  notice_status?: MockEvent["notice_status"];
  notice_auto_drafted_at?: string | null;
  notice_approved_at?: string | null;
  notice_approved_by_email?: string | null;
  notice_last_sent_at?: string | null;
  feature_on_website?: boolean;
};

export function addEvent(data: AddEventInput): MockEvent {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const event: MockEvent = {
    id: uuid(),
    sequence_id: null,
    sequence_position: null,
    notice_status: "none",
    notice_auto_drafted_at: null,
    notice_approved_at: null,
    notice_approved_by_email: null,
    notice_last_sent_at: null,
    feature_on_website: false,
    ...data,
    mosque_slug: withMosqueSlug(data.mosque_slug),
    created_at: now,
    updated_at: now,
  };
  events.push(event);
  return event;
}

export function updateEvent(id: string, updates: Partial<MockEvent>, opts?: { mosque_slug?: string }): MockEvent | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  const i = events.findIndex((e) => e.id === id && e.mosque_slug === mosqueSlug);
  if (i === -1) return null;
  Object.assign(events[i], updates, { updated_at: new Date().toISOString() });
  return events[i];
}

export function deleteEvent(id: string, opts?: { mosque_slug?: string }): MockEvent | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  const i = events.findIndex((e) => e.id === id && e.mosque_slug === mosqueSlug);
  if (i === -1) return null;
  const [removed] = events.splice(i, 1);
  return removed;
}

// --- RSVPs ---
export type MockRsvp = MosqueScoped & {
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

export function getRsvpsByEventId(eventId: string, opts?: { mosque_slug?: string }): MockRsvp[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return rsvps.filter((r) => r.event_id === eventId && r.mosque_slug === mosqueSlug);
}

export function addRsvp(
  data: Omit<MockRsvp, "id" | "created_at" | "updated_at" | "mosque_slug"> & { mosque_slug?: string }
): MockRsvp {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const rsvp: MockRsvp = {
    id: uuid(),
    ...data,
    mosque_slug: withMosqueSlug(data.mosque_slug),
    created_at: now,
    updated_at: now,
  };
  rsvps.push(rsvp);
  return rsvp;
}

export function updateRsvp(
  id: string,
  updates: Partial<Pick<MockRsvp, "payment_id" | "payment_completed" | "status">>,
  opts?: { mosque_slug?: string }
): MockRsvp | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  const i = rsvps.findIndex((r) => r.id === id && r.mosque_slug === mosqueSlug);
  if (i === -1) return null;
  Object.assign(rsvps[i], updates, { updated_at: new Date().toISOString() });
  return rsvps[i];
}

export function getRsvpById(id: string, opts?: { mosque_slug?: string }): MockRsvp | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return rsvps.find((r) => r.id === id && r.mosque_slug === mosqueSlug) ?? null;
}

// --- Payments ---
export type MockPayment = MosqueScoped & {
  id: string;
  rsvp_id: string | null;
  event_id: string | null;
  user_email: string;
  user_name: string | null;
  stripe_payment_intent_id: string | null;
  dining_amount: number;
  charity_amount: number;
  raffle_amount: number;
  service_fee_amount: number;
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

export function getPayments(opts?: { mosque_slug?: string }): MockPayment[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return [...payments]
    .filter((payment) => payment.mosque_slug === mosqueSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addPayment(
  data: Omit<MockPayment, "id" | "created_at" | "updated_at" | "mosque_slug"> & { mosque_slug?: string }
): MockPayment {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const payment: MockPayment = {
    id: uuid(),
    ...data,
    mosque_slug: withMosqueSlug(data.mosque_slug),
    created_at: now,
    updated_at: now,
  };
  payments.push(payment);
  return payment;
}

// --- Event Guests ---
export type MockEventGuest = MosqueScoped & {
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
  mosque_slug?: string;
};

export function addEventGuests(
  guests: MockEventGuestInput[],
  mosqueSlug?: string
): MockEventGuest[] {
  assertInMemoryMock();
  const slug = withMosqueSlug(mosqueSlug);
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
      mosque_slug: withMosqueSlug(g.mosque_slug ?? slug),
      created_at: new Date().toISOString(),
    };
    eventGuests.push(guest);
    return guest;
  });
}

export function getGuestsByRsvp(rsvpId: string, opts?: { mosque_slug?: string }): MockEventGuest[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return eventGuests.filter((g) => g.rsvp_id === rsvpId && g.mosque_slug === mosqueSlug);
}

export function getGuestsByEvent(eventId: string, opts?: { mosque_slug?: string }): MockEventGuest[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return eventGuests.filter((g) => g.event_id === eventId && g.mosque_slug === mosqueSlug);
}

export function listEventGuestsForMosque(
  opts?: { mosque_slug?: string; eventId?: string; guestId?: string }
): MockEventGuest[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return eventGuests
    .filter((g) => g.mosque_slug === mosqueSlug)
    .filter((g) => (opts?.eventId ? g.event_id === opts.eventId : true))
    .filter((g) => (opts?.guestId ? g.guest_id === opts.guestId : true));
}

// --- Guests directory + guest invitations ---
export type MockGuest = MosqueScoped & {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  mother_mosque_name: string | null;
  mother_mosque_number: string | null;
  constitution: string | null;
  rank: string | null;
  dietary_requirements: string | null;
  guest_category: "guest" | "honorary_guest";
  guest_dining_amount: number | null;
  dining_waived: boolean;
  is_member: boolean;
  first_seen_event_id: string | null;
  last_seen_event_id: string | null;
  visit_count: number;
  notes: string | null;
  archived_at: string | null;
  newcomer_token_hash: string | null;
  source: "admin" | "member_invite" | "self_invite_event" | "self_register";
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

const guestsDirectory: MockGuest[] = [];

export function listGuests(opts?: {
  mosque_slug?: string;
  search?: string;
  includeArchived?: boolean;
}): MockGuest[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  let list = guestsDirectory.filter((g) => g.mosque_slug === mosqueSlug);
  if (!opts?.includeArchived) {
    list = list.filter((g) => g.archived_at === null);
  }
  if (opts?.search) {
    const term = opts.search.toLowerCase();
    list = list.filter(
      (g) =>
        g.full_name.toLowerCase().includes(term) ||
        (g.email ?? "").toLowerCase().includes(term) ||
        (g.mother_mosque_name ?? "").toLowerCase().includes(term)
    );
  }
  return list;
}

export function getGuestById(id: string, opts?: { mosque_slug?: string }): MockGuest | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return guestsDirectory.find((g) => g.id === id && g.mosque_slug === mosqueSlug) ?? null;
}

export function createGuestRecord(
  data: Partial<Omit<MockGuest, "id" | "created_at" | "updated_at" | "mosque_slug">> & {
    full_name: string;
    mosque_slug?: string;
  }
): MockGuest {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const guest: MockGuest = {
    id: uuid(),
    mosque_slug: withMosqueSlug(data.mosque_slug),
    full_name: data.full_name,
    email: data.email ?? null,
    phone: data.phone ?? null,
    mother_mosque_name: data.mother_mosque_name ?? null,
    mother_mosque_number: data.mother_mosque_number ?? null,
    constitution: data.constitution ?? null,
    rank: data.rank ?? null,
    dietary_requirements: data.dietary_requirements ?? null,
    guest_category: data.guest_category ?? "guest",
    guest_dining_amount: data.guest_dining_amount ?? null,
    dining_waived: data.dining_waived ?? false,
    is_member: data.is_member ?? true,
    first_seen_event_id: data.first_seen_event_id ?? null,
    last_seen_event_id: data.last_seen_event_id ?? null,
    visit_count: data.visit_count ?? 0,
    notes: data.notes ?? null,
    archived_at: data.archived_at ?? null,
    newcomer_token_hash: data.newcomer_token_hash ?? null,
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
  patch: Partial<Omit<MockGuest, "id" | "mosque_slug" | "created_at">>,
  opts?: { mosque_slug?: string }
): MockGuest | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  const guest = guestsDirectory.find(
    (g) => g.id === id && g.mosque_slug === mosqueSlug
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
    mother_mosque_name?: string | null;
    mother_mosque_number?: string | null;
    constitution?: string | null;
    rank?: string | null;
    dietary_requirements?: string | null;
    is_member?: boolean;
    event_id?: string | null;
    mosque_slug?: string;
    source?:
      | "admin"
      | "member_invite"
      | "self_invite_event"
      | "self_register";
    recordVisit?: boolean;
  }
): MockGuest {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(input.mosque_slug);
  const email = input.email?.trim() || null;
  const fullName = input.full_name.trim();
  const motherMosqueName = input.mother_mosque_name?.trim() || null;

  const existing = guestsDirectory.find((g) => {
    if (g.mosque_slug !== mosqueSlug) return false;
    if (email && g.email) return g.email.toLowerCase() === email.toLowerCase();
    if (!email) {
      const sameName = g.full_name.toLowerCase() === fullName.toLowerCase();
      const sameMother =
        (g.mother_mosque_name ?? null) === (motherMosqueName ?? null);
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
        mother_mosque_name: motherMosqueName ?? existing.mother_mosque_name,
        mother_mosque_number:
          input.mother_mosque_number?.trim() ?? existing.mother_mosque_number,
        constitution: input.constitution?.trim() ?? existing.constitution,
        rank: input.rank?.trim() ?? existing.rank,
        dietary_requirements:
          input.dietary_requirements?.trim() ?? existing.dietary_requirements,
        is_member: input.is_member ?? existing.is_member,
        visit_count: recordVisit
          ? existing.visit_count + 1
          : existing.visit_count,
        last_seen_event_id: recordVisit
          ? (input.event_id ?? existing.last_seen_event_id)
          : existing.last_seen_event_id,
        first_seen_event_id:
          existing.first_seen_event_id ?? input.event_id ?? null,
      },
      { mosque_slug: mosqueSlug }
    )!;
  }

  return createGuestRecord({
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
    newcomer_token_hash: null,
    source: input.source ?? "admin",
    email_confirmed_at: null,
    mosque_slug: mosqueSlug,
  });
}

export function archiveGuestRecord(
  id: string,
  opts?: { mosque_slug?: string }
): MockGuest | null {
  return updateGuestRecord(
    id,
    { archived_at: new Date().toISOString() },
    opts
  );
}

export function restoreGuestRecord(
  id: string,
  opts?: { mosque_slug?: string }
): MockGuest | null {
  return updateGuestRecord(id, { archived_at: null }, opts);
}

export function hardDeleteGuestRecordIfUnused(
  id: string,
  opts?: { mosque_slug?: string }
): boolean {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  const idx = guestsDirectory.findIndex(
    (g) => g.id === id && g.mosque_slug === mosqueSlug
  );
  if (idx === -1) return false;
  if ((guestsDirectory[idx].visit_count ?? 0) > 0) return false;
  guestsDirectory.splice(idx, 1);
  return true;
}

export function getGuestByNewcomerTokenHash(
  tokenHash: string,
  opts?: { mosque_slug?: string }
): MockGuest | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return (
    guestsDirectory.find(
      (g) => g.newcomer_token_hash === tokenHash && g.mosque_slug === mosqueSlug
    ) ?? null
  );
}

export function setGuestNewcomerTokenHash(
  id: string,
  tokenHash: string,
  opts?: { mosque_slug?: string }
): MockGuest | null {
  return updateGuestRecord(id, { newcomer_token_hash: tokenHash }, opts);
}

export type MockGuestInvitation = MosqueScoped & {
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
    | "mosque_slug"
  > & {
    mosque_slug?: string;
    guest_id?: string | null;
    uses?: number;
  }
): MockGuestInvitation {
  assertInMemoryMock();
  const { mosque_slug: providedSlug, guest_id, ...rest } = data;
  const inv: MockGuestInvitation = {
    id: uuid(),
    mosque_slug: withMosqueSlug(providedSlug),
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
  opts?: { mosque_slug?: string }
): MockGuestInvitation[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return guestInvitations
    .filter((i) => i.event_id === eventId && i.mosque_slug === mosqueSlug)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function getGuestInvitationById(
  id: string,
  opts?: { mosque_slug?: string }
): MockGuestInvitation | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return (
    guestInvitations.find(
      (i) => i.id === id && i.mosque_slug === mosqueSlug
    ) ?? null
  );
}

export function listGuestInvitationsForGuest(
  guestId: string,
  opts?: { mosque_slug?: string }
): MockGuestInvitation[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return guestInvitations
    .filter((i) => i.guest_id === guestId && i.mosque_slug === mosqueSlug)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function listGuestInvitationsForMember(
  memberId: string,
  opts?: { mosque_slug?: string }
): MockGuestInvitation[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return guestInvitations
    .filter(
      (i) => i.inviter_member_id === memberId && i.mosque_slug === mosqueSlug
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
  opts?: { mosque_slug?: string }
): MockGuestInvitation | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  const inv = guestInvitations.find(
    (i) => i.id === id && i.mosque_slug === mosqueSlug
  );
  if (!inv) return null;
  inv.revoked_at = new Date().toISOString();
  return inv;
}

// --- Members ---
export type MockMember = MosqueScoped & {
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
  annual_giving_waived?: boolean;
  annual_giving_waiver_reason?: string | null;
  date_of_membership: string | null;
  membership_email_sent: boolean;
  membership_status: 'active' | 'suspended' | 'resigned' | 'excluded';
  stripe_customer_id: string | null;
  show_on_website?: boolean;
  public_bio?: string | null;
  created_at: string;
  updated_at: string;
};

const members: MockMember[] = [];

export function getMembers(opts?: { mosque_slug?: string; status?: string; search?: string }): MockMember[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  let list = members.filter((m) => m.mosque_slug === mosqueSlug);
  if (opts?.status) list = list.filter((m) => m.membership_status === opts.status);
  if (opts?.search) {
    const q = opts.search.toLowerCase();
    list = list.filter((m) => m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }
  return list.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export function getMemberById(id: string, opts?: { mosque_slug?: string }): MockMember | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return members.find((m) => m.id === id && m.mosque_slug === mosqueSlug) ?? null;
}

export function getMemberByEmail(email: string, opts?: { mosque_slug?: string }): MockMember | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return members.find((m) => m.email.toLowerCase() === email.toLowerCase() && m.mosque_slug === mosqueSlug) ?? null;
}

export function createMember(
  data: Omit<MockMember, "id" | "created_at" | "updated_at" | "mosque_slug"> & { mosque_slug?: string }
): MockMember {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const member: MockMember = {
    id: uuid(),
    ...data,
    mosque_slug: withMosqueSlug(data.mosque_slug),
    created_at: now,
    updated_at: now,
  };
  members.push(member);
  return member;
}

export function updateMember(
  id: string,
  updates: Partial<Omit<MockMember, "id" | "mosque_slug" | "created_at">>,
  opts?: { mosque_slug?: string }
): MockMember | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  const i = members.findIndex((m) => m.id === id && m.mosque_slug === mosqueSlug);
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
      if (p.mosque_slug === mosqueSlug && p.user_email.toLowerCase() === oldEmail.toLowerCase()) {
        p.user_email = normalisedEmail;
      }
    }
    for (const r of rsvps) {
      if (r.mosque_slug === mosqueSlug && r.user_email.toLowerCase() === oldEmail.toLowerCase()) {
        r.user_email = normalisedEmail;
      }
    }
  }
  return members[i];
}

export function getRsvpDietaryByEmail(email: string, opts?: { mosque_slug?: string }): Array<{ event_id: string; dietary_requirements: string | null; created_at: string }> {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return rsvps
    .filter((r) => r.user_email.toLowerCase() === email.toLowerCase() && r.mosque_slug === mosqueSlug && r.dietary_requirements)
    .map((r) => ({ event_id: r.event_id, dietary_requirements: r.dietary_requirements, created_at: r.created_at }));
}

export function getPaymentsByEmail(email: string, opts?: { mosque_slug?: string }): MockPayment[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return payments
    .filter((p) => p.user_email.toLowerCase() === email.toLowerCase() && p.mosque_slug === mosqueSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// --- Blog posts ---
export type MockBlogPost = MosqueScoped & {
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

export function getBlogPosts(opts?: { published?: boolean; mosque_slug?: string }): MockBlogPost[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  let list = [...blogPosts];
  list = list.filter((post) => post.mosque_slug === mosqueSlug);
  if (opts?.published !== undefined) {
    list = list.filter((p) => p.published && p.published_at && new Date(p.published_at) <= new Date());
  }
  return list.sort((a, b) => new Date((b.published_at ?? b.created_at)).getTime() - new Date((a.published_at ?? a.created_at)).getTime());
}

export function getBlogPostById(id: string, opts?: { mosque_slug?: string }): MockBlogPost | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return blogPosts.find((p) => p.id === id && p.mosque_slug === mosqueSlug) ?? null;
}

export function getBlogPostBySlug(slug: string, opts?: { mosque_slug?: string }): MockBlogPost | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return blogPosts.find((p) => p.slug === slug && p.published && p.mosque_slug === mosqueSlug) ?? null;
}

export function addBlogPost(
  data: Omit<MockBlogPost, "id" | "created_at" | "updated_at" | "mosque_slug"> & { mosque_slug?: string }
): MockBlogPost {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const post: MockBlogPost = {
    id: uuid(),
    ...data,
    mosque_slug: withMosqueSlug(data.mosque_slug),
    created_at: now,
    updated_at: now,
  };
  blogPosts.push(post);
  return post;
}

export function updateBlogPost(id: string, updates: Partial<MockBlogPost>, opts?: { mosque_slug?: string }): MockBlogPost | null {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  const i = blogPosts.findIndex((p) => p.id === id && p.mosque_slug === mosqueSlug);
  if (i === -1) return null;
  Object.assign(blogPosts[i], updates, { updated_at: new Date().toISOString() });
  return blogPosts[i];
}

// --- Charity Campaigns ---
export type MockCharityCampaign = MosqueScoped & {
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

export function getCharityCampaigns(opts?: { mosque_slug?: string }): MockCharityCampaign[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return [...charityCampaigns]
    .filter((c) => c.mosque_slug === mosqueSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addCharityCampaign(
  data: Omit<MockCharityCampaign, "id" | "created_at" | "updated_at" | "mosque_slug"> & { mosque_slug?: string }
): MockCharityCampaign {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const campaign: MockCharityCampaign = {
    id: uuid(),
    ...data,
    mosque_slug: withMosqueSlug(data.mosque_slug),
    created_at: now,
    updated_at: now,
  };
  charityCampaigns.push(campaign);
  return campaign;
}

// --- Donations ---
export type MockDonation = MosqueScoped & {
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

export function getDonations(opts?: { mosque_slug?: string }): MockDonation[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return [...donations]
    .filter((d) => d.mosque_slug === mosqueSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addDonation(
  data: Omit<MockDonation, "id" | "created_at" | "mosque_slug"> & { mosque_slug?: string }
): MockDonation {
  assertInMemoryMock();
  const donation: MockDonation = {
    id: uuid(),
    ...data,
    mosque_slug: withMosqueSlug(data.mosque_slug),
    created_at: new Date().toISOString(),
  };
  donations.push(donation);
  return donation;
}

// --- Gift Aid Declarations ---
export type MockGiftAidDeclaration = MosqueScoped & {
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

export function getGiftAidDeclarations(opts?: { mosque_slug?: string }): MockGiftAidDeclaration[] {
  assertInMemoryMock();
  const mosqueSlug = withMosqueSlug(opts?.mosque_slug);
  return [...giftAidDeclarations]
    .filter((g) => g.mosque_slug === mosqueSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addGiftAidDeclaration(
  data: Omit<MockGiftAidDeclaration, "id" | "created_at" | "mosque_slug"> & { mosque_slug?: string }
): MockGiftAidDeclaration {
  assertInMemoryMock();
  const declaration: MockGiftAidDeclaration = {
    id: uuid(),
    ...data,
    mosque_slug: withMosqueSlug(data.mosque_slug),
    created_at: new Date().toISOString(),
  };
  giftAidDeclarations.push(declaration);
  return declaration;
}

// --- Platform mock (operator console) ---
export function listNetworks(): Network[] {
  assertInMemoryMock();
  return [...networks].sort((a, b) => a.name.localeCompare(b.name));
}

export function getNetworkBySlug(slug: string): Network | null {
  assertInMemoryMock();
  const normalized = slug.trim().toLowerCase();
  return networks.find((n) => n.slug === normalized) ?? null;
}

export function listMosquesByNetwork(networkId: string): MockMosque[] {
  assertInMemoryMock();
  return mosques.filter((c) => c.network_id === networkId && c.is_active);
}

export function listNetworkOfficers(
  _networkId: string
): import("@/lib/db/types").NetworkOfficerDirectoryEntry[] {
  assertInMemoryMock();
  return [];
}

export function listMosqueAnnualReturns(
  networkId: string
): import("@/lib/db/types").MosqueAnnualReturn[] {
  assertInMemoryMock();
  return listMosquesByNetwork(networkId).map((mosque) => {
    const mosqueMembers = members.filter((m) => m.mosque_slug === mosque.slug);
    const active = mosqueMembers.filter((m) => m.membership_status === "active");
    return {
      mosque_id: mosque.id,
      network_id: mosque.network_id,
      mosque_name: mosque.name,
      mosque_number: mosque.mosque_number,
      active_members: active.length,
      resigned_members: mosqueMembers.filter((m) => m.membership_status === "resigned").length,
      excluded_members: mosqueMembers.filter((m) => m.membership_status === "excluded").length,
      memberships_ytd: Math.max(1, Math.floor(active.length / 3)),
      passings_ytd: 0,
      raisings_ytd: 0,
    };
  });
}

export function listPlatformAdminUsers(): AdminUser[] {
  assertInMemoryMock();
  const now = new Date().toISOString();
  return [
    {
      id: uuid(),
      mosque_id: null,
      auth_user_id: null,
      email: "ag@experrt.com",
      full_name: "Platform Owner",
      role: "super_admin",
      permissions: [],
      active: true,
      created_at: now,
      updated_at: now,
      last_login: null,
      mfa_enabled: false,
      mfa_secret: null,
      mfa_backup_codes: null,
      mfa_enrolled_at: null,
    },
  ];
}

export function listTenantAdminUsers(): AdminUser[] {
  assertInMemoryMock();
  const now = new Date().toISOString();
  return PLATFORM_DEMO_MOSQUES.flatMap((profile) => {
    const mosque = mosques.find((c) => c.slug === profile.slug);
    if (!mosque) return [];
    const secretary =
      profile.officers.find((o) =>
        /secretary|clerk|administrator/i.test(o.office_title)
      ) ?? profile.officers[1];
    return [
      {
        id: uuid(),
        mosque_id: mosque.id,
        auth_user_id: null,
        email: demoEmailFor(profile.slug, "secretary"),
        full_name: secretary.full_name,
        role: "secretary",
        permissions: [],
        active: true,
        created_at: now,
        updated_at: now,
        last_login: null,
        mfa_enabled: false,
        mfa_secret: null,
        mfa_backup_codes: null,
        mfa_enrolled_at: null,
      },
    ];
  });
}

export function getPlatformMosqueStats(): PlatformMosqueStats[] {
  assertInMemoryMock();
  const now = new Date();
  return listMosques().map((mosque) => {
    const mosqueEvents = events.filter((e) => e.mosque_slug === mosque.slug);
    const mosqueMembers = members.filter((m) => m.mosque_slug === mosque.slug);
    const mosqueDonations = donations.filter((d) => d.mosque_slug === mosque.slug);
    const upcoming = mosqueEvents.filter((e) => new Date(e.event_date) >= now);
    const past = mosqueEvents
      .filter((e) => new Date(e.event_date) < now)
      .sort((a, b) => +new Date(b.event_date) - +new Date(a.event_date));
    const donationTotal = mosqueDonations.reduce((sum, d) => sum + d.amount, 0);
    return {
      mosque_id: mosque.id,
      mosque_slug: mosque.slug,
      mosque_name: mosque.name,
      network_id: mosque.network_id,
      members: mosqueMembers.length,
      active_members: mosqueMembers.filter((m) => m.membership_status === "active").length,
      upcoming_events: upcoming.length,
      outstanding_giving: Math.max(
        0,
        mosqueMembers.filter((m) => m.membership_status === "active").length % 4
      ),
      paid_giving_amount: Math.round(donationTotal * 0.65),
      donations_amount: donationTotal,
      last_service_at: past[0]?.event_date ?? null,
    };
  });
}

export function getPlatformOverviewData() {
  return {
    stats: getPlatformMosqueStats(),
    networks: listNetworks(),
    mosques: listMosques(),
    platformAdmins: listPlatformAdminUsers(),
    tenantAdmins: listTenantAdminUsers(),
  };
}

// --- Seed data ---
let platformDemoSeeded = false;

function seedData() {
  mockDbSeeding = true;
  try {
  if (platformDemoSeeded) return;

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();

  const networkDefs: Array<Omit<Network, "id" | "created_at" | "updated_at">> = [
    {
      slug: "anglican-uk",
      name: "Anglican Networks (UK)",
      jurisdiction: "England & Wales",
      country: "GB",
      contact_email: "networks@mosquepay.demo",
      contact_phone: null,
      primary_color: "#1e3a5f",
      notes: null,
      is_active: true,
    },
    {
      slug: "free-mosques-uk",
      name: "Free Mosques Group",
      jurisdiction: "United Kingdom",
      country: "GB",
      contact_email: "freemosques@mosquepay.demo",
      contact_phone: null,
      primary_color: "#005eb8",
      notes: null,
      is_active: true,
    },
    {
      slug: "catholic-uk",
      name: "Roman Catholic Networks (UK)",
      jurisdiction: "England & Wales",
      country: "GB",
      contact_email: "catholic@mosquepay.demo",
      contact_phone: null,
      primary_color: "#7c1c2e",
      notes: null,
      is_active: true,
    },
    {
      slug: "orthodox-uk",
      name: "Orthodox Mosques (UK)",
      jurisdiction: "Great Britain",
      country: "GB",
      contact_email: "orthodox@mosquepay.demo",
      contact_phone: null,
      primary_color: "#1a237e",
      notes: null,
      is_active: true,
    },
  ];

  const networkIdBySlug = new Map<string, string>();
  for (const def of networkDefs) {
    const ts = new Date().toISOString();
    const row: MockNetwork = {
      id: uuid(),
      ...def,
      created_at: ts,
      updated_at: ts,
    };
    networks.push(row);
    networkIdBySlug.set(def.slug, row.id);
  }

  function networkForDenomination(denomination: string): string | null {
    if (denomination === "Anglican") return networkIdBySlug.get("anglican-uk") ?? null;
    if (denomination === "Roman Catholic") return networkIdBySlug.get("catholic-uk") ?? null;
    if (denomination === "Orthodox") return networkIdBySlug.get("orthodox-uk") ?? null;
    return networkIdBySlug.get("free-mosques-uk") ?? null;
  }

  const guestServiceDefaults = {
    enable_service_fee: false,
    service_fee_amount: null,
    service_fee_description: null,
    enable_guest_tickets: false,
    guest_ticket_price: null,
    guest_ticket_description: null,
    guest_policy: "blue_table" as const,
    enable_raffle_wine_pledge: false,
    raffle_wine_description: "Bring a bottle of wine for the evening raffle" as string | null,
  };

  for (const profile of PLATFORM_DEMO_MOSQUES) {
    upsertMosque({
      slug: profile.slug,
      name: profile.name,
      city: profile.city,
      country: profile.country,
      tagline: profile.tagline,
      governing_body: profile.governing_body,
      mosque_number: profile.mosque_number,
      primary_color: profile.primary_color,
      secondary_color: profile.secondary_color,
      support_email: profile.support_email,
      support_phone: profile.support_phone,
      secretary_name: profile.secretary_name,
      secretary_address: profile.secretary_address,
      secretary_phone: profile.secretary_phone,
      service_schedule: profile.service_schedule,
      service_location: profile.service_location,
      service_location_url: profile.service_location_url,
      accessibility_notes: profile.accessibility_notes,
      default_dress_code: profile.default_dress_code,
      hmrc_charity_reference: profile.hmrc_charity_reference,
      gift_aid_pack_name: profile.gift_aid_pack_name,
      gift_aid_pack_email: profile.gift_aid_pack_email,
      charity_donation_url: profile.charity_donation_url,
      data_protection_notice: `Member records are held by ${profile.secretary_name} for mosque administration.`,
      newcomer_notice: `Visitors are welcome. Contact ${profile.support_email} before your first visit.`,
      network_id: networkForDenomination(profile.denomination),
      gift_aid_default_mode: "both",
      accepts_self_registration: true,
    });

    updateMosqueSite(profile.slug, {
      page_title: profile.name,
      page_description: profile.tagline,
      sections: [
        {
          id: uuid(),
          type: "hero",
          heading: `Welcome to ${profile.name}`,
          body: `${profile.tagline} (${profile.denomination} · ${profile.city})`,
          cta_label: "Express Interest",
          cta_href: "/join",
          visible: true,
          order: 1,
        },
        {
          id: uuid(),
          type: "service_details",
          heading: "Service times",
          body: profile.service_schedule,
          cta_label: "View Events",
          cta_href: "/events",
          visible: true,
          order: 2,
        },
        {
          id: uuid(),
          type: "charity",
          heading: "Giving & Gift Aid",
          body: "Support our community work through one-off gifts and regular giving.",
          cta_label: "Give",
          cta_href: "/charity",
          visible: true,
          order: 3,
        },
        {
          id: uuid(),
          type: "contact",
          heading: "Contact us",
          body: `Reach ${profile.secretary_name} at ${profile.support_phone}.`,
          cta_label: "Contact",
          cta_href: "/contact",
          visible: true,
          order: 4,
        },
      ],
      published: true,
    });

    profile.officers.forEach((officer, i) => {
      createMember({
        auth_user_id: null,
        email: demoEmailFor(profile.slug, `officer-${i + 1}`),
        full_name: officer.full_name,
        phone: profile.support_phone,
        address_line_1: profile.secretary_address,
        address_line_2: null,
        city: profile.city,
        county: null,
        postcode: null,
        country: profile.country,
        country_list: false,
        royal_arch: false,
        honorary: false,
        office_title: officer.office_title,
        officer_sort_order: i + 1,
        directory_sort_order: i + 1,
        rank: officer.rank ?? "MM",
        dietary_requirements: null,
        date_of_membership: daysAgo(400 + i * 30),
        membership_email_sent: true,
        membership_status: "active",
        stripe_customer_id: null,
        show_on_website: i < 3,
        public_bio: `${officer.office_title} at ${profile.name}.`,
        mosque_slug: profile.slug,
      });
    });

    profile.member_names.forEach((name, i) => {
      createMember({
        auth_user_id: null,
        email: demoEmailFor(profile.slug, `member-${i + 1}`),
        full_name: name,
        phone: `07700 ${String(30000 + i).slice(-5)}`,
        address_line_1: `${12 + i} Mosque Lane`,
        address_line_2: null,
        city: profile.city,
        county: null,
        postcode: null,
        country: profile.country,
        country_list: i % 4 === 0,
        royal_arch: false,
        honorary: false,
        office_title: null,
        officer_sort_order: null,
        directory_sort_order: 20 + i,
        rank: "MM",
        dietary_requirements: null,
        date_of_membership: daysAgo(200 + i * 45),
        membership_email_sent: true,
        membership_status: "active",
        stripe_customer_id: null,
        mosque_slug: profile.slug,
      });
    });

    profile.newcomer_names.forEach((person, i) => {
      addNewcomer({
        first_name: person.first,
        last_name: person.last,
        email: demoEmailFor(profile.slug, `newcomer-${i + 1}`),
        phone: null,
        location: profile.city,
        source: "website",
        how_heard_about_us: profile.denomination,
        initial_message: `Interested in ${profile.name}.`,
        stage: person.stage,
        assigned_to: profile.officers[0]?.full_name.split(" ").pop() ?? null,
        mosque_slug: profile.slug,
      });
    });

    const campaign = addCharityCampaign({
      name: `${profile.denomination} Community Fund`,
      description: `Supporting outreach and welfare at ${profile.name}.`,
      target_amount: 2500,
      raised_amount: 900 + profile.member_names.length * 120,
      status: "active",
      start_date: daysAgo(60),
      end_date: daysFromNow(200),
      mosque_slug: profile.slug,
    });

    const upcomingSlug = `sunday-${profile.slug}`;
    addEvent({
      title: `Jumu'ah Prayers`,
      slug: upcomingSlug,
      description: `Regular Friday Jumu'ah at ${profile.name}.`,
      event_type: "mosque_service",
      event_date: daysFromNow(7 + (profile.slug.length % 5)),
      event_time: "10:30",
      location: profile.service_location,
      temple_room: null,
      dress_code: profile.default_dress_code,
      enable_rsvp: true,
      rsvp_deadline: daysFromNow(5),
      max_attendees: 80,
      enable_payments: false,
      enable_dining_rsvp: false,
      dining_price: null,
      dining_description: null,
      enable_charity_donation: true,
      charity_name: `${profile.denomination} Appeal`,
      charity_description: "Support community ministries.",
      charity_suggested_amounts: [5, 10, 20, 50],
      charity_allow_custom: true,
      enable_raffle_donation: false,
      raffle_description: null,
      raffle_suggested_amounts: null,
      raffle_allow_custom: false,
      ...guestServiceDefaults,
      featured_image_url: null,
      published: true,
      mosque_slug: profile.slug,
    });

    addEvent({
      title: `Past Service — ${profile.city}`,
      slug: `past-${profile.slug}`,
      description: "Recent service with collection recorded.",
      event_type: "mosque_service",
      event_date: daysAgo(14),
      event_time: "10:30",
      location: profile.service_location,
      temple_room: null,
      dress_code: profile.default_dress_code,
      enable_rsvp: false,
      rsvp_deadline: null,
      max_attendees: null,
      enable_payments: true,
      enable_dining_rsvp: false,
      dining_price: null,
      dining_description: null,
      enable_charity_donation: true,
      charity_name: "Community Fund",
      charity_description: null,
      charity_suggested_amounts: [5, 10, 20],
      charity_allow_custom: true,
      enable_raffle_donation: false,
      raffle_description: null,
      raffle_suggested_amounts: null,
      raffle_allow_custom: false,
      ...guestServiceDefaults,
      featured_image_url: null,
      published: true,
      mosque_slug: profile.slug,
    });

    profile.member_names.slice(0, 3).forEach((name, i) => {
      addDonation({
        donor_name: name,
        donor_email: demoEmailFor(profile.slug, `member-${i + 1}`),
        amount: 25 + i * 15,
        currency: "gbp",
        source: "campaign",
        campaign_id: campaign.id,
        event_id: null,
        payment_id: null,
        gift_aid_eligible: true,
        gift_aid_declared: i % 2 === 0,
        status: "completed",
        mosque_slug: profile.slug,
      });
    });

    addBlogPost({
      title: `${profile.name} news`,
      slug: `welcome-${profile.slug}`,
      excerpt: profile.tagline,
      content: `Latest news from ${profile.name} in ${profile.city}.`,
      category: "news",
      author_name: profile.secretary_name,
      published: true,
      published_at: daysAgo(3),
      featured_image_url: null,
      mosque_slug: profile.slug,
    });
  }

  platformDemoSeeded = true;
  } finally {
    mockDbSeeding = false;
  }
}

seedData();
