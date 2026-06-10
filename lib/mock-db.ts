/**
 * In-memory mock DB for front-end iteration. No Supabase/DB required.
 * Data resets on server restart. Replace with real DB when ready.
 */

import type {
  ChurchSiteCustomPage,
  ChurchSiteFooterSettings,
  ChurchSiteHeaderSettings,
  ChurchSiteSection,
} from "@/lib/db/types";
import { shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import { DEFAULT_CHURCH_SLUG } from "@/lib/tenant";

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

type ChurchScoped = {
  church_slug: string;
};

function withChurchSlug(slug?: string): string {
  return (slug ?? DEFAULT_CHURCH_SLUG).trim().toLowerCase();
}

// --- Churches and church websites ---
export type MockChurch = {
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
  church_number: string | null;
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

export type MockChurchSite = ChurchScoped & {
  id: string;
  page_title: string;
  page_description: string | null;
  sections: ChurchSiteSection[];
  custom_pages: ChurchSiteCustomPage[];
  header_settings: ChurchSiteHeaderSettings | null;
  footer_settings: ChurchSiteFooterSettings | null;
  published: boolean;
  updated_at: string;
};

const churches: MockChurch[] = [
  {
    id: uuid(),
    slug: DEFAULT_CHURCH_SLUG,
    name: "St Mary's Church",
    city: "London",
    country: "United Kingdom",
    tagline: "Memberhood, charity, and timeless tradition.",
    logo_url: null,
    primary_color: "#111827",
    secondary_color: "#b45309",
    support_email: "secretary@covenantchurch4344.org",
    support_phone: null,
    church_number: "4344",
    consecrated_at: "1922-04-03",
    governing_body: "Member of London Metropolitan Grand Church",
    service_schedule:
      "Regular services are held in January, March, June, and November.",
    secretary_name: "Church Secretary",
    secretary_address: "Mark members Hall, 86 St James's Street, London, SW1A 1PL",
    secretary_phone: "01582 461961",
    charity_donation_url: "https://gtap.uk/L4344",
    gift_aid_pack_name: "Covenant Gift Aid pack",
    data_protection_notice:
      "A member database is held by the Church Secretary for church business.",
    newcomer_notice:
      "Members travelling abroad should confirm regularity before newcomer churches under other jurisdictions.",
    loi_contact: "Contact the Secretary for Church of Instruction dates.",
    wifi_details: "MMH Guest WiFi details available at the venue.",
    service_location: "Mark members Hall, 86 St James's Street, London, SW1A 1PL",
    service_location_url: "https://maps.app.goo.gl/HsCmZTMVbHkM26ck6",
    accessibility_notes: "Step-free access via the side entrance. Hearing loop available in the temple. Please contact the secretary in advance if you need additional arrangements.",
    default_dress_code: "Lounge suit, black tie. White gloves provided.",
    is_active: true,
    network_id: null,
    custom_domain: null,
    custom_domain_verified_at: null,
    custom_domain_verification_token: null,
    accepts_self_registration: true,
    current_charity_campaign_id: null,
    gift_aid_default_mode: "both",
    gift_aid_pack_email: null,
    gift_aid_pack_charity_number: null,
    hmrc_charity_reference: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const churchSites: MockChurchSite[] = [
  {
    id: uuid(),
    church_slug: DEFAULT_CHURCH_SLUG,
    page_title: "St Mary's Church",
    page_description: "A London church rooted in fellowship, service, and meaningful ritual.",
    custom_pages: [],
    header_settings: null,
    footer_settings: null,
    sections: [
      {
        id: uuid(),
        type: "hero",
        heading: "Welcome to St Mary's Church",
        body: "Join a modern memberhood with deep heritage in the heart of London.",
        cta_label: "Express Interest",
        cta_href: "/join",
        visible: true,
        order: 1,
      },
      {
        id: uuid(),
        type: "service_details",
        heading: "Services at Mark members' Hall",
        body: "Regular services, social dining, and charity events throughout the year.",
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
        body: "If you are interested in joining or newcomer, we are happy to hear from you.",
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

export function listChurches(): MockChurch[] {
  assertInMemoryMock();
  return [...churches].sort((a, b) => a.name.localeCompare(b.name));
}

export function getChurchBySlug(slug: string): MockChurch | null {
  assertInMemoryMock();
  const safeSlug = withChurchSlug(slug);
  return churches.find((l) => l.slug === safeSlug && l.is_active) ?? null;
}

export function upsertChurch(
  input: Partial<Omit<MockChurch, "id" | "created_at" | "updated_at">> & Pick<MockChurch, "slug" | "name">
): MockChurch {
  assertInMemoryMock();
  const safeSlug = withChurchSlug(input.slug);
  const now = new Date().toISOString();
  const existing = churches.find((l) => l.slug === safeSlug);
  if (existing) {
    Object.assign(existing, input, { slug: safeSlug, updated_at: now });
    return existing;
  }
  const church: MockChurch = {
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
    church_number: input.church_number ?? null,
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
  churches.push(church);
  return church;
}

export function getChurchSite(churchSlug?: string): MockChurchSite {
  assertInMemoryMock();
  const safeSlug = withChurchSlug(churchSlug);
  const existing = churchSites.find((s) => s.church_slug === safeSlug);
  if (existing) return existing;
  const site: MockChurchSite = {
    id: uuid(),
    church_slug: safeSlug,
    page_title: "Church Homepage",
    page_description: null,
    sections: [],
    custom_pages: [],
    header_settings: null,
    footer_settings: null,
    published: true,
    updated_at: new Date().toISOString(),
  };
  churchSites.push(site);
  return site;
}

export function updateChurchSite(
  churchSlug: string,
  updates: Partial<
    Pick<
      MockChurchSite,
      | "page_title"
      | "page_description"
      | "sections"
      | "custom_pages"
      | "header_settings"
      | "footer_settings"
      | "published"
    >
  >
): MockChurchSite {
  assertInMemoryMock();
  const site = getChurchSite(churchSlug);
  Object.assign(site, updates, { updated_at: new Date().toISOString() });
  return site;
}

// --- Newcomers ---
export type MockNewcomer = ChurchScoped & {
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

export function getNewcomers(opts?: { church_slug?: string }): MockNewcomer[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return [...newcomers]
    .filter((newcomer) => newcomer.church_slug === churchSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getNewcomerById(id: string, opts?: { church_slug?: string }): MockNewcomer | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return newcomers.find((l) => l.id === id && l.church_slug === churchSlug) ?? null;
}

type AddNewcomerInput = Omit<
  MockNewcomer,
  | "id"
  | "created_at"
  | "updated_at"
  | "stage_changed_at"
  | "church_slug"
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
  church_slug?: string;
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
    church_slug: withChurchSlug(data.church_slug),
    created_at: now,
    updated_at: now,
    stage_changed_at: now,
  };
  newcomers.push(newcomer);
  return newcomer;
}

export function updateNewcomer(
  id: string,
  updates: Partial<Omit<MockNewcomer, "id" | "created_at" | "church_slug">>,
  opts?: { church_slug?: string }
): MockNewcomer | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  const i = newcomers.findIndex((l) => l.id === id && l.church_slug === churchSlug);
  if (i === -1) return null;
  const now = new Date().toISOString();
  if (updates.stage) newcomers[i].stage_changed_at = now;
  Object.assign(newcomers[i], updates, { updated_at: now });
  return newcomers[i];
}

export function deleteNewcomer(
  id: string,
  opts?: { church_slug?: string }
): { deleted: boolean } {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  const i = newcomers.findIndex((l) => l.id === id && l.church_slug === churchSlug);
  if (i === -1) return { deleted: false };
  newcomers.splice(i, 1);
  for (let j = newcomerActivities.length - 1; j >= 0; j--) {
    const a = newcomerActivities[j];
    if (a.newcomer_id === id && a.church_slug === churchSlug) {
      newcomerActivities.splice(j, 1);
    }
  }
  return { deleted: true };
}

export function updateNewcomerActivity(
  id: string,
  updates: Partial<Pick<MockNewcomerActivity, "title" | "description" | "service_date" | "attendees" | "due_date" | "completed">>,
  opts?: { church_slug?: string }
): MockNewcomerActivity | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  const i = newcomerActivities.findIndex(
    (a) => a.id === id && a.church_slug === churchSlug
  );
  if (i === -1) return null;
  Object.assign(newcomerActivities[i], updates);
  return newcomerActivities[i];
}

export function getLatestNewcomerActivity(
  newcomerId: string,
  opts?: { church_slug?: string }
): MockNewcomerActivity | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return (
    newcomerActivities
      .filter((a) => a.newcomer_id === newcomerId && a.church_slug === churchSlug)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0] ?? null
  );
}

// --- Newcomer activities ---
export type MockNewcomerActivity = ChurchScoped & {
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

export function getNewcomerActivities(newcomerId: string, opts?: { church_slug?: string }): MockNewcomerActivity[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return newcomerActivities
    .filter((a) => a.newcomer_id === newcomerId && a.church_slug === churchSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addNewcomerActivity(
  data: Omit<MockNewcomerActivity, "id" | "created_at" | "church_slug"> & { church_slug?: string }
): MockNewcomerActivity {
  assertInMemoryMock();
  const activity: MockNewcomerActivity = {
    id: uuid(),
    ...data,
    church_slug: withChurchSlug(data.church_slug),
    created_at: new Date().toISOString(),
  };
  newcomerActivities.push(activity);
  return activity;
}

// --- Events ---
export type MockEvent = ChurchScoped & {
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

export function getEvents(opts?: { published?: boolean; upcoming?: boolean; church_slug?: string }): MockEvent[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  let list = [...events];
  list = list.filter((event) => event.church_slug === churchSlug);
  if (opts?.published !== undefined) list = list.filter((e) => e.published === opts.published);
  if (opts?.upcoming) list = list.filter((e) => new Date(e.event_date) >= new Date());
  return list.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
}

export function getEventById(id: string, opts?: { church_slug?: string }): MockEvent | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return events.find((e) => e.id === id && e.church_slug === churchSlug) ?? null;
}

export function getEventBySlug(slug: string, opts?: { church_slug?: string }): MockEvent | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return events.find((e) => e.slug === slug && e.published && e.church_slug === churchSlug) ?? null;
}

type AddEventInput = Omit<
  MockEvent,
  | "id"
  | "created_at"
  | "updated_at"
  | "church_slug"
  | "sequence_id"
  | "sequence_position"
  | "notice_status"
  | "notice_auto_drafted_at"
  | "notice_approved_at"
  | "notice_approved_by_email"
  | "notice_last_sent_at"
  | "feature_on_website"
> & {
  church_slug?: string;
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
    church_slug: withChurchSlug(data.church_slug),
    created_at: now,
    updated_at: now,
  };
  events.push(event);
  return event;
}

export function updateEvent(id: string, updates: Partial<MockEvent>, opts?: { church_slug?: string }): MockEvent | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  const i = events.findIndex((e) => e.id === id && e.church_slug === churchSlug);
  if (i === -1) return null;
  Object.assign(events[i], updates, { updated_at: new Date().toISOString() });
  return events[i];
}

export function deleteEvent(id: string, opts?: { church_slug?: string }): MockEvent | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  const i = events.findIndex((e) => e.id === id && e.church_slug === churchSlug);
  if (i === -1) return null;
  const [removed] = events.splice(i, 1);
  return removed;
}

// --- RSVPs ---
export type MockRsvp = ChurchScoped & {
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

export function getRsvpsByEventId(eventId: string, opts?: { church_slug?: string }): MockRsvp[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return rsvps.filter((r) => r.event_id === eventId && r.church_slug === churchSlug);
}

export function addRsvp(
  data: Omit<MockRsvp, "id" | "created_at" | "updated_at" | "church_slug"> & { church_slug?: string }
): MockRsvp {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const rsvp: MockRsvp = {
    id: uuid(),
    ...data,
    church_slug: withChurchSlug(data.church_slug),
    created_at: now,
    updated_at: now,
  };
  rsvps.push(rsvp);
  return rsvp;
}

export function updateRsvp(
  id: string,
  updates: Partial<Pick<MockRsvp, "payment_id" | "payment_completed" | "status">>,
  opts?: { church_slug?: string }
): MockRsvp | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  const i = rsvps.findIndex((r) => r.id === id && r.church_slug === churchSlug);
  if (i === -1) return null;
  Object.assign(rsvps[i], updates, { updated_at: new Date().toISOString() });
  return rsvps[i];
}

export function getRsvpById(id: string, opts?: { church_slug?: string }): MockRsvp | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return rsvps.find((r) => r.id === id && r.church_slug === churchSlug) ?? null;
}

// --- Payments ---
export type MockPayment = ChurchScoped & {
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

export function getPayments(opts?: { church_slug?: string }): MockPayment[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return [...payments]
    .filter((payment) => payment.church_slug === churchSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addPayment(
  data: Omit<MockPayment, "id" | "created_at" | "updated_at" | "church_slug"> & { church_slug?: string }
): MockPayment {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const payment: MockPayment = {
    id: uuid(),
    ...data,
    church_slug: withChurchSlug(data.church_slug),
    created_at: now,
    updated_at: now,
  };
  payments.push(payment);
  return payment;
}

// --- Event Guests ---
export type MockEventGuest = ChurchScoped & {
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
  church_slug?: string;
};

export function addEventGuests(
  guests: MockEventGuestInput[],
  churchSlug?: string
): MockEventGuest[] {
  assertInMemoryMock();
  const slug = withChurchSlug(churchSlug);
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
      church_slug: withChurchSlug(g.church_slug ?? slug),
      created_at: new Date().toISOString(),
    };
    eventGuests.push(guest);
    return guest;
  });
}

export function getGuestsByRsvp(rsvpId: string, opts?: { church_slug?: string }): MockEventGuest[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return eventGuests.filter((g) => g.rsvp_id === rsvpId && g.church_slug === churchSlug);
}

export function getGuestsByEvent(eventId: string, opts?: { church_slug?: string }): MockEventGuest[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return eventGuests.filter((g) => g.event_id === eventId && g.church_slug === churchSlug);
}

export function listEventGuestsForChurch(
  opts?: { church_slug?: string; eventId?: string; guestId?: string }
): MockEventGuest[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return eventGuests
    .filter((g) => g.church_slug === churchSlug)
    .filter((g) => (opts?.eventId ? g.event_id === opts.eventId : true))
    .filter((g) => (opts?.guestId ? g.guest_id === opts.guestId : true));
}

// --- Guests directory + guest invitations ---
export type MockGuest = ChurchScoped & {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  mother_church_name: string | null;
  mother_church_number: string | null;
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
  church_slug?: string;
  search?: string;
  includeArchived?: boolean;
}): MockGuest[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  let list = guestsDirectory.filter((g) => g.church_slug === churchSlug);
  if (!opts?.includeArchived) {
    list = list.filter((g) => g.archived_at === null);
  }
  if (opts?.search) {
    const term = opts.search.toLowerCase();
    list = list.filter(
      (g) =>
        g.full_name.toLowerCase().includes(term) ||
        (g.email ?? "").toLowerCase().includes(term) ||
        (g.mother_church_name ?? "").toLowerCase().includes(term)
    );
  }
  return list;
}

export function getGuestById(id: string, opts?: { church_slug?: string }): MockGuest | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return guestsDirectory.find((g) => g.id === id && g.church_slug === churchSlug) ?? null;
}

export function createGuestRecord(
  data: Partial<Omit<MockGuest, "id" | "created_at" | "updated_at" | "church_slug">> & {
    full_name: string;
    church_slug?: string;
  }
): MockGuest {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const guest: MockGuest = {
    id: uuid(),
    church_slug: withChurchSlug(data.church_slug),
    full_name: data.full_name,
    email: data.email ?? null,
    phone: data.phone ?? null,
    mother_church_name: data.mother_church_name ?? null,
    mother_church_number: data.mother_church_number ?? null,
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
  patch: Partial<Omit<MockGuest, "id" | "church_slug" | "created_at">>,
  opts?: { church_slug?: string }
): MockGuest | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  const guest = guestsDirectory.find(
    (g) => g.id === id && g.church_slug === churchSlug
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
    mother_church_name?: string | null;
    mother_church_number?: string | null;
    constitution?: string | null;
    rank?: string | null;
    dietary_requirements?: string | null;
    is_member?: boolean;
    event_id?: string | null;
    church_slug?: string;
    source?:
      | "admin"
      | "member_invite"
      | "self_invite_event"
      | "self_register";
    recordVisit?: boolean;
  }
): MockGuest {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(input.church_slug);
  const email = input.email?.trim() || null;
  const fullName = input.full_name.trim();
  const motherChurchName = input.mother_church_name?.trim() || null;

  const existing = guestsDirectory.find((g) => {
    if (g.church_slug !== churchSlug) return false;
    if (email && g.email) return g.email.toLowerCase() === email.toLowerCase();
    if (!email) {
      const sameName = g.full_name.toLowerCase() === fullName.toLowerCase();
      const sameMother =
        (g.mother_church_name ?? null) === (motherChurchName ?? null);
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
        mother_church_name: motherChurchName ?? existing.mother_church_name,
        mother_church_number:
          input.mother_church_number?.trim() ?? existing.mother_church_number,
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
      { church_slug: churchSlug }
    )!;
  }

  return createGuestRecord({
    full_name: fullName,
    email,
    phone: input.phone?.trim() || null,
    mother_church_name: motherChurchName,
    mother_church_number: input.mother_church_number?.trim() || null,
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
    church_slug: churchSlug,
  });
}

export function archiveGuestRecord(
  id: string,
  opts?: { church_slug?: string }
): MockGuest | null {
  return updateGuestRecord(
    id,
    { archived_at: new Date().toISOString() },
    opts
  );
}

export function restoreGuestRecord(
  id: string,
  opts?: { church_slug?: string }
): MockGuest | null {
  return updateGuestRecord(id, { archived_at: null }, opts);
}

export function hardDeleteGuestRecordIfUnused(
  id: string,
  opts?: { church_slug?: string }
): boolean {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  const idx = guestsDirectory.findIndex(
    (g) => g.id === id && g.church_slug === churchSlug
  );
  if (idx === -1) return false;
  if ((guestsDirectory[idx].visit_count ?? 0) > 0) return false;
  guestsDirectory.splice(idx, 1);
  return true;
}

export function getGuestByNewcomerTokenHash(
  tokenHash: string,
  opts?: { church_slug?: string }
): MockGuest | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return (
    guestsDirectory.find(
      (g) => g.newcomer_token_hash === tokenHash && g.church_slug === churchSlug
    ) ?? null
  );
}

export function setGuestNewcomerTokenHash(
  id: string,
  tokenHash: string,
  opts?: { church_slug?: string }
): MockGuest | null {
  return updateGuestRecord(id, { newcomer_token_hash: tokenHash }, opts);
}

export type MockGuestInvitation = ChurchScoped & {
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
    | "church_slug"
  > & {
    church_slug?: string;
    guest_id?: string | null;
    uses?: number;
  }
): MockGuestInvitation {
  assertInMemoryMock();
  const { church_slug: providedSlug, guest_id, ...rest } = data;
  const inv: MockGuestInvitation = {
    id: uuid(),
    church_slug: withChurchSlug(providedSlug),
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
  opts?: { church_slug?: string }
): MockGuestInvitation[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return guestInvitations
    .filter((i) => i.event_id === eventId && i.church_slug === churchSlug)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function getGuestInvitationById(
  id: string,
  opts?: { church_slug?: string }
): MockGuestInvitation | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return (
    guestInvitations.find(
      (i) => i.id === id && i.church_slug === churchSlug
    ) ?? null
  );
}

export function listGuestInvitationsForGuest(
  guestId: string,
  opts?: { church_slug?: string }
): MockGuestInvitation[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return guestInvitations
    .filter((i) => i.guest_id === guestId && i.church_slug === churchSlug)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function listGuestInvitationsForMember(
  memberId: string,
  opts?: { church_slug?: string }
): MockGuestInvitation[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return guestInvitations
    .filter(
      (i) => i.inviter_member_id === memberId && i.church_slug === churchSlug
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
  opts?: { church_slug?: string }
): MockGuestInvitation | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  const inv = guestInvitations.find(
    (i) => i.id === id && i.church_slug === churchSlug
  );
  if (!inv) return null;
  inv.revoked_at = new Date().toISOString();
  return inv;
}

// --- Members ---
export type MockMember = ChurchScoped & {
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

export function getMembers(opts?: { church_slug?: string; status?: string; search?: string }): MockMember[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  let list = members.filter((m) => m.church_slug === churchSlug);
  if (opts?.status) list = list.filter((m) => m.membership_status === opts.status);
  if (opts?.search) {
    const q = opts.search.toLowerCase();
    list = list.filter((m) => m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }
  return list.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export function getMemberById(id: string, opts?: { church_slug?: string }): MockMember | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return members.find((m) => m.id === id && m.church_slug === churchSlug) ?? null;
}

export function getMemberByEmail(email: string, opts?: { church_slug?: string }): MockMember | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return members.find((m) => m.email.toLowerCase() === email.toLowerCase() && m.church_slug === churchSlug) ?? null;
}

export function createMember(
  data: Omit<MockMember, "id" | "created_at" | "updated_at" | "church_slug"> & { church_slug?: string }
): MockMember {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const member: MockMember = {
    id: uuid(),
    ...data,
    church_slug: withChurchSlug(data.church_slug),
    created_at: now,
    updated_at: now,
  };
  members.push(member);
  return member;
}

export function updateMember(
  id: string,
  updates: Partial<Omit<MockMember, "id" | "church_slug" | "created_at">>,
  opts?: { church_slug?: string }
): MockMember | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  const i = members.findIndex((m) => m.id === id && m.church_slug === churchSlug);
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
      if (p.church_slug === churchSlug && p.user_email.toLowerCase() === oldEmail.toLowerCase()) {
        p.user_email = normalisedEmail;
      }
    }
    for (const r of rsvps) {
      if (r.church_slug === churchSlug && r.user_email.toLowerCase() === oldEmail.toLowerCase()) {
        r.user_email = normalisedEmail;
      }
    }
  }
  return members[i];
}

export function getRsvpDietaryByEmail(email: string, opts?: { church_slug?: string }): Array<{ event_id: string; dietary_requirements: string | null; created_at: string }> {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return rsvps
    .filter((r) => r.user_email.toLowerCase() === email.toLowerCase() && r.church_slug === churchSlug && r.dietary_requirements)
    .map((r) => ({ event_id: r.event_id, dietary_requirements: r.dietary_requirements, created_at: r.created_at }));
}

export function getPaymentsByEmail(email: string, opts?: { church_slug?: string }): MockPayment[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return payments
    .filter((p) => p.user_email.toLowerCase() === email.toLowerCase() && p.church_slug === churchSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// --- Blog posts ---
export type MockBlogPost = ChurchScoped & {
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

export function getBlogPosts(opts?: { published?: boolean; church_slug?: string }): MockBlogPost[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  let list = [...blogPosts];
  list = list.filter((post) => post.church_slug === churchSlug);
  if (opts?.published !== undefined) {
    list = list.filter((p) => p.published && p.published_at && new Date(p.published_at) <= new Date());
  }
  return list.sort((a, b) => new Date((b.published_at ?? b.created_at)).getTime() - new Date((a.published_at ?? a.created_at)).getTime());
}

export function getBlogPostById(id: string, opts?: { church_slug?: string }): MockBlogPost | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return blogPosts.find((p) => p.id === id && p.church_slug === churchSlug) ?? null;
}

export function getBlogPostBySlug(slug: string, opts?: { church_slug?: string }): MockBlogPost | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return blogPosts.find((p) => p.slug === slug && p.published && p.church_slug === churchSlug) ?? null;
}

export function addBlogPost(
  data: Omit<MockBlogPost, "id" | "created_at" | "updated_at" | "church_slug"> & { church_slug?: string }
): MockBlogPost {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const post: MockBlogPost = {
    id: uuid(),
    ...data,
    church_slug: withChurchSlug(data.church_slug),
    created_at: now,
    updated_at: now,
  };
  blogPosts.push(post);
  return post;
}

export function updateBlogPost(id: string, updates: Partial<MockBlogPost>, opts?: { church_slug?: string }): MockBlogPost | null {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  const i = blogPosts.findIndex((p) => p.id === id && p.church_slug === churchSlug);
  if (i === -1) return null;
  Object.assign(blogPosts[i], updates, { updated_at: new Date().toISOString() });
  return blogPosts[i];
}

// --- Charity Campaigns ---
export type MockCharityCampaign = ChurchScoped & {
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

export function getCharityCampaigns(opts?: { church_slug?: string }): MockCharityCampaign[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return [...charityCampaigns]
    .filter((c) => c.church_slug === churchSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addCharityCampaign(
  data: Omit<MockCharityCampaign, "id" | "created_at" | "updated_at" | "church_slug"> & { church_slug?: string }
): MockCharityCampaign {
  assertInMemoryMock();
  const now = new Date().toISOString();
  const campaign: MockCharityCampaign = {
    id: uuid(),
    ...data,
    church_slug: withChurchSlug(data.church_slug),
    created_at: now,
    updated_at: now,
  };
  charityCampaigns.push(campaign);
  return campaign;
}

// --- Donations ---
export type MockDonation = ChurchScoped & {
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

export function getDonations(opts?: { church_slug?: string }): MockDonation[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return [...donations]
    .filter((d) => d.church_slug === churchSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addDonation(
  data: Omit<MockDonation, "id" | "created_at" | "church_slug"> & { church_slug?: string }
): MockDonation {
  assertInMemoryMock();
  const donation: MockDonation = {
    id: uuid(),
    ...data,
    church_slug: withChurchSlug(data.church_slug),
    created_at: new Date().toISOString(),
  };
  donations.push(donation);
  return donation;
}

// --- Gift Aid Declarations ---
export type MockGiftAidDeclaration = ChurchScoped & {
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

export function getGiftAidDeclarations(opts?: { church_slug?: string }): MockGiftAidDeclaration[] {
  assertInMemoryMock();
  const churchSlug = withChurchSlug(opts?.church_slug);
  return [...giftAidDeclarations]
    .filter((g) => g.church_slug === churchSlug)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function addGiftAidDeclaration(
  data: Omit<MockGiftAidDeclaration, "id" | "created_at" | "church_slug"> & { church_slug?: string }
): MockGiftAidDeclaration {
  assertInMemoryMock();
  const declaration: MockGiftAidDeclaration = {
    id: uuid(),
    ...data,
    church_slug: withChurchSlug(data.church_slug),
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

  if (newcomers.length > 0) return;

  const seedNewcomers = [
    { first_name: "James", last_name: "Harrison", email: "james.h@example.com", phone: "07700 100001", location: "London", source: "website", how_heard_about_us: "Google", initial_message: "Interested in church life", stage: "expression_of_interest", assigned_to: null },
    { first_name: "Robert", last_name: "Mitchell", email: "r.mitchell@example.com", phone: "07700 100002", location: "Surrey", source: "referral", how_heard_about_us: "A friend", initial_message: "Would like to visit", stage: "initial_contact", assigned_to: "WM" },
    { first_name: "William", last_name: "Clarke", email: "w.clarke@example.com", phone: "07700 100003", location: "Kent", source: "event", how_heard_about_us: "Open day", initial_message: null, stage: "service_scheduled", assigned_to: "SW" },
    { first_name: "David", last_name: "Thompson", email: "d.thompson@example.com", phone: null, location: "London", source: "website", how_heard_about_us: "UGLE website", initial_message: "What does membership involve?", stage: "approved", assigned_to: "WM" },
    { first_name: "Michael", last_name: "Wright", email: "m.wright@example.com", phone: "07700 100005", location: "Essex", source: "referral", how_heard_about_us: "Member in church", initial_message: "Ready to join", stage: "welcomed", assigned_to: "WM" },
    { first_name: "Andrew", last_name: "Baker", email: "a.baker@example.com", phone: null, location: "London", source: "website", how_heard_about_us: null, initial_message: "General enquiry", stage: "expression_of_interest", assigned_to: null },
    { first_name: "Thomas", last_name: "Evans", email: "t.evans@example.com", phone: "07700 100007", location: "Hertfordshire", source: "social_media", how_heard_about_us: "Facebook", initial_message: null, stage: "initial_contact", assigned_to: "JW" },
    { first_name: "Philip", last_name: "Grant", email: "p.grant@example.com", phone: "07700 100008", location: "London", source: "referral", how_heard_about_us: "Existing member", initial_message: "Recommended by a friend", stage: "proposal_church", assigned_to: "WM" },
    { first_name: "Stephen", last_name: "Ward", email: "s.ward@example.com", phone: null, location: "Buckinghamshire", source: "website", how_heard_about_us: "Google", initial_message: null, stage: "on_hold", assigned_to: null },
    { first_name: "Daniel", last_name: "Scott", email: "d.scott@example.com", phone: "07700 100010", location: "London", source: "event", how_heard_about_us: "Open day 2025", initial_message: "Not for me at this time", stage: "declined", assigned_to: "SW" },
  ];

  seedNewcomers.forEach((l, i) => {
    const newcomer = addNewcomer({ ...l, church_slug: DEFAULT_CHURCH_SLUG });
    newcomers[newcomers.length - 1].created_at = daysAgo(i * 3 + 1);
    newcomers[newcomers.length - 1].updated_at = daysAgo(i * 2);
    if (i < 5) {
      addNewcomerActivity({
        newcomer_id: newcomer.id,
        activity_type: "note",
        title: "Initial contact made",
        description: `Called ${l.first_name} to discuss church membership.`,
        service_date: null,
        attendees: null,
        due_date: null,
        completed: true,
        created_by: "Admin",
        church_slug: DEFAULT_CHURCH_SLUG,
      });
      newcomerActivities[newcomerActivities.length - 1].created_at = daysAgo(i * 3 + 2);
    }
    if (i < 3) {
      addNewcomerActivity({
        newcomer_id: newcomer.id,
        activity_type: "service",
        title: "Informal service at church",
        description: `${l.first_name} attended an informal service with the WM and SW.`,
        service_date: daysAgo(i * 2),
        attendees: ["WM", "SW", `${l.first_name} ${l.last_name}`],
        due_date: null,
        completed: true,
        created_by: "WM",
        church_slug: DEFAULT_CHURCH_SLUG,
      });
      newcomerActivities[newcomerActivities.length - 1].created_at = daysAgo(i * 2);
    }
    if (i === 0) {
      addNewcomerActivity({
        newcomer_id: newcomer.id,
        activity_type: "email",
        title: "Follow-up email sent",
        description: "Sent information pack and church history booklet.",
        service_date: null,
        attendees: null,
        due_date: null,
        completed: true,
        created_by: "Secretary",
        church_slug: DEFAULT_CHURCH_SLUG,
      });
      newcomerActivities[newcomerActivities.length - 1].created_at = daysAgo(1);
      addNewcomerActivity({
        newcomer_id: newcomer.id,
        activity_type: "phone_call",
        title: "Phone conversation",
        description: "Discussed next steps and answered questions about the membership process.",
        service_date: null,
        attendees: null,
        due_date: null,
        completed: true,
        created_by: "WM",
        church_slug: DEFAULT_CHURCH_SLUG,
      });
      newcomerActivities[newcomerActivities.length - 1].created_at = daysAgo(4);
      addNewcomerActivity({
        newcomer_id: newcomer.id,
        activity_type: "task",
        title: "Arrange second informal service",
        description: null,
        service_date: null,
        attendees: null,
        due_date: daysFromNow(7),
        completed: false,
        created_by: "SW",
        church_slug: DEFAULT_CHURCH_SLUG,
      });
      newcomerActivities[newcomerActivities.length - 1].created_at = daysAgo(0);
    }
  });

  const guestServiceDefaults = { enable_service_fee: false, service_fee_amount: null, service_fee_description: null, enable_guest_tickets: false, guest_ticket_price: null, guest_ticket_description: null, guest_policy: "blue_table" as const, enable_raffle_wine_pledge: false, raffle_wine_description: "Bring a bottle of wine for the evening raffle" as string | null };
  const seedEvents: Array<AddEventInput> = [
    { title: "Regular Service – April", slug: "regular-service-april", description: "Monthly regular service with ceremony.", event_type: "regular_service", event_date: daysFromNow(5), event_time: "18:30", location: "Mark members' Hall", temple_room: "Temple 1", dress_code: "Dark lounge suit", enable_rsvp: true, rsvp_deadline: daysFromNow(3), max_attendees: 60, enable_payments: true, enable_dining_rsvp: true, dining_price: 45, dining_description: "Three course fellowship meal", enable_charity_donation: true, charity_name: "Church Charitable Foundation", charity_description: "Support MCF", charity_suggested_amounts: [5, 10, 20], charity_allow_custom: true, enable_raffle_donation: true, raffle_description: "Charity raffle", raffle_suggested_amounts: [2, 5, 10], raffle_allow_custom: true, ...guestServiceDefaults, enable_guest_tickets: true, guest_ticket_price: 45, guest_ticket_description: "Guest dining ticket", featured_image_url: null, published: true },
    { title: "Special service Service", slug: "special_service-service", description: "Annual special_service of the new Lead Pastor.", event_type: "special_service", event_date: daysFromNow(30), event_time: "16:00", location: "Mark members' Hall", temple_room: "Grand Temple", dress_code: "Morning dress", enable_rsvp: true, rsvp_deadline: daysFromNow(25), max_attendees: 120, enable_payments: true, enable_dining_rsvp: true, dining_price: 65, dining_description: "Four course special_service banquet", enable_charity_donation: true, charity_name: "London Grand Rank Benevolent Fund", charity_description: null, charity_suggested_amounts: [10, 25, 50], charity_allow_custom: true, enable_raffle_donation: true, raffle_description: "Grand raffle", raffle_suggested_amounts: [5, 10], raffle_allow_custom: false, ...guestServiceDefaults, enable_guest_tickets: true, guest_ticket_price: 65, guest_ticket_description: "Guest banquet ticket", featured_image_url: null, published: true },
    { title: "Summer Social Evening", slug: "summer-social", description: "Annual summer social for members and guests.", event_type: "social", event_date: daysFromNow(60), event_time: "19:00", location: "The Ivy, London", temple_room: null, dress_code: "Smart casual", enable_rsvp: true, rsvp_deadline: daysFromNow(55), max_attendees: 40, enable_payments: true, enable_dining_rsvp: false, dining_price: null, dining_description: null, enable_charity_donation: false, charity_name: null, charity_description: null, charity_suggested_amounts: null, charity_allow_custom: false, enable_raffle_donation: false, raffle_description: null, raffle_suggested_amounts: null, raffle_allow_custom: false, ...guestServiceDefaults, featured_image_url: null, published: true },
    { title: "Regular Service – March", slug: "regular-service-march", description: "Monthly regular service.", event_type: "regular_service", event_date: daysAgo(15), event_time: "18:30", location: "Mark members' Hall", temple_room: "Temple 1", dress_code: "Dark lounge suit", enable_rsvp: true, rsvp_deadline: daysAgo(17), max_attendees: 60, enable_payments: true, enable_dining_rsvp: true, dining_price: 45, dining_description: "Three course fellowship meal", enable_charity_donation: true, charity_name: "MCF", charity_description: null, charity_suggested_amounts: [5, 10, 20], charity_allow_custom: true, enable_raffle_donation: true, raffle_description: "Charity raffle", raffle_suggested_amounts: [2, 5], raffle_allow_custom: true, ...guestServiceDefaults, featured_image_url: null, published: true },
    { title: "Committee of General Purposes", slug: "cgp-service-april", description: "Pre-service committee.", event_type: "committee", event_date: daysFromNow(3), event_time: "17:00", location: "Mark members' Hall", temple_room: "Committee Room", dress_code: "Lounge suit", enable_rsvp: false, rsvp_deadline: null, max_attendees: 12, enable_payments: false, enable_dining_rsvp: false, dining_price: null, dining_description: null, enable_charity_donation: false, charity_name: null, charity_description: null, charity_suggested_amounts: null, charity_allow_custom: false, enable_raffle_donation: false, raffle_description: null, raffle_suggested_amounts: null, raffle_allow_custom: false, ...guestServiceDefaults, featured_image_url: null, published: true },
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
        "Lead Pastor",
        "Senior Warden",
        "Junior Warden",
        "Secretary",
        "Treasurer",
        "Charity Steward",
        "PastoralCare",
        null,
      ][i],
      officer_sort_order: i < 7 ? i + 1 : null,
      directory_sort_order: i + 1,
      rank: ["EA", "FC", "MM", "MM", "MM", "MM", "MM", "MM"][i],
      dietary_requirements: ["Vegetarian", null, "Gluten-free", null, null, "Vegan", null, "No nuts"][i],
      date_of_membership: daysAgo(365 + i * 90),
      membership_email_sent: true,
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
      service_fee_amount: 0,
      guest_ticket_amount: 0,
      total_amount: dining + charity + raffle,
      currency: "gbp",
      charity_name: "Church Charitable Foundation",
      status: paymentStatuses[i],
      refund_amount: paymentStatuses[i] === "refunded" ? dining + charity + raffle : 0,
      completed_at: paymentStatuses[i] === "succeeded" ? daysAgo(i * 2 + 1) : null,
    });
    payments[payments.length - 1].created_at = daysAgo(i * 2 + 1);
  });

  const seedBlogPosts = [
    { title: "Welcome to St Mary's Church", slug: "welcome", excerpt: "A warm welcome to all newcomers.", content: "We are delighted to welcome you to St Mary's Church.", category: "news", author_name: "Secretary", published: true, published_at: daysAgo(10), featured_image_url: null },
    { title: "Spring Charity Drive Results", slug: "spring-charity", excerpt: "Our spring charity drive raised over £2,000.", content: "Thanks to the generosity of our members...", category: "charity", author_name: "Charity Steward", published: true, published_at: daysAgo(5), featured_image_url: null },
    { title: "Special service Preview", slug: "special_service-preview", excerpt: "Looking ahead to the special_service.", content: "The upcoming special_service service...", category: "events", author_name: "WM", published: false, published_at: null, featured_image_url: null },
  ];
  seedBlogPosts.forEach((b) => addBlogPost(b));

  addCharityCampaign({ name: "MCF Festival 2026", description: "Church festival contribution to the Church Charitable Foundation.", target_amount: 5000, raised_amount: 3250, status: "active", start_date: daysAgo(90), end_date: daysFromNow(270) });
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
