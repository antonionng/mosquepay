export type Lodge = {
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
  /**
   * Public-facing meeting venue (e.g. "Mark Masons Hall, 86 St James's
   * Street, London"). Distinct from `secretary_address` (used on
   * summons). Falls back to `secretary_address` on the public site if
   * not set, but admins are nudged to fill this in cleanly so visitors
   * see a venue rather than a correspondence address.
   */
  meeting_location: string | null;
  /**
   * Optional URL for the meeting venue, typically a Google Maps /
   * What3Words / venue page link. When set the public Meeting Details
   * card renders the venue as a tappable link.
   */
  meeting_location_url: string | null;
  /**
   * Short note about wheelchair access, hearing loops, parking, or
   * other accessibility considerations for visitors. Rendered on the
   * public Meeting Details card when set.
   */
  accessibility_notes: string | null;
  /**
   * Default lodge dress code shown on the public site Meeting Details
   * card and used as a fallback when an individual event has no
   * `dress_code` set.
   */
  default_dress_code: string | null;
  is_active: boolean;
  province_id: string | null;
  custom_domain: string | null;
  custom_domain_verified_at: string | null;
  custom_domain_verification_token: string | null;
  accepts_self_registration: boolean;
  current_charity_campaign_id: string | null;
  /**
   * Gift Aid capture mode for this lodge (migration 059).
   *   - `digital`: member portal self-serve only.
   *   - `paper`:   admin captures paper declarations, members are pointed at
   *                the printable form.
   *   - `both`:    member portal AND admin paper-upload paths are surfaced.
   */
  gift_aid_default_mode: "digital" | "paper" | "both";
  /** Where to email the per-meeting Gift Aid claim pack (Relief Chest). */
  relief_chest_email: string | null;
  relief_chest_charity_number: string | null;
  hmrc_charity_reference: string | null;
  created_at: string;
  updated_at: string;
};

/** Optional visual overrides per section (stored in JSONB). */
export type LodgeSiteSectionStyle = {
  primary_color?: string | null;
  background_image_url?: string | null;
  overlay_opacity?: number | null;
  background_position?: string | null;
  image_url?: string | null;
  image_alt?: string | null;
  image_position?: "left" | "right" | "top" | "bottom" | "full" | null;
  image_shape?: "rounded" | "square" | "circle" | "arch" | null;
  form_mode?: "none" | "contact" | "lead" | null;
  background_tone?: "default" | "soft" | "brand" | "dark" | null;
  content_width?: "narrow" | "standard" | "wide" | "full" | null;
  spacing?: "compact" | "normal" | "spacious" | null;
  button_variant?: "solid" | "outline" | "ghost" | null;
  form_fields?: string[] | null;
  form_required_fields?: string[] | null;
  form_consent_text?: string | null;
  form_thank_you?: string | null;
  form_notification_recipients?: string | null;
  form_autoresponder_subject?: string | null;
  form_autoresponder_body?: string | null;
  /**
   * Optional list of FAQ entries shown on a `faq` section. When absent the
   * FAQ accordion is hidden; the section keeps any user-edited heading,
   * body, and image. Populated from the admin FAQ editor (Phase 1) or
   * imported by an AI draft.
   */
  faq_entries?: { question: string; answer: string }[] | null;
};

export type LodgeSiteSection = {
  id: string;
  type:
    | "hero"
    | "about"
    | "meeting_details"
    | "officers"
    | "charity"
    | "events"
    | "faq"
    | "join"
    | "contact";
  heading: string;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  visible: boolean;
  order: number;
  style?: LodgeSiteSectionStyle | null;
};

export type LodgeSitePage = {
  id: string;
  lodge_id: string;
  page_key: string;
  page_title: string;
  page_description: string | null;
  sections: LodgeSiteSection[];
  custom_pages?: LodgeSiteCustomPage[] | null;
  header_settings?: LodgeSiteHeaderSettings | null;
  footer_settings?: LodgeSiteFooterSettings | null;
  published: boolean;
  updated_at: string;
};

export type LodgeSiteHeaderNavItem = {
  id: string;
  label: string;
  href: string;
  visible: boolean;
  order: number;
};

export type LodgeSiteHeaderSettings = {
  show_logo: boolean;
  show_lodge_name: boolean;
  show_lodge_number: boolean;
  nav_items: LodgeSiteHeaderNavItem[];
  cta_label: string | null;
  cta_href: string | null;
};

export type LodgeSiteFooterLink = {
  id: string;
  label: string;
  href: string;
  visible: boolean;
  order: number;
};

export type LodgeSiteFooterLinkGroup = {
  id: string;
  title: string;
  links: LodgeSiteFooterLink[];
  order: number;
};

export type LodgeSiteFooterSettings = {
  show_logo: boolean;
  show_lodge_name: boolean;
  show_lodge_number: boolean;
  show_contact_details: boolean;
  tagline: string | null;
  badge_text: string | null;
  powered_by_text: string | null;
  /**
   * Whether to render the "Powered by LodgePay" chip in the public site
   * hero meta strip and the footer powered-by text. Defaults to true. Set
   * to false from the admin footer settings panel on paid plans that want
   * an unbranded public surface.
   */
  show_powered_by: boolean;
  link_groups: LodgeSiteFooterLinkGroup[];
};

export type LodgeSiteCustomPage = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  social_image_url?: string | null;
  sections: LodgeSiteSection[];
  published: boolean;
  show_in_nav: boolean;
  nav_label: string | null;
  order: number;
};

export type AdminUser = {
  id: string;
  lodge_id: string | null;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  role: string;
  permissions: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
  mfa_enabled: boolean;
  mfa_secret: string | null;
  mfa_backup_codes: string[] | null;
  mfa_enrolled_at: string | null;
};

export type AuditLog = {
  id: string;
  lodge_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/**
 * Append-only record of an email send. See
 * supabase/migrations/064_email_log_and_notification_settings.sql.
 *
 * The dedupe_key is set when a webhook redeliver could legitimately
 * fire the same send twice (Mooov dual-emits subscription.activated +
 * payment.captured for the same money, etc.). Senders MUST consult
 * countEmailLogByDedupe before delivering, otherwise members get
 * duplicate receipts.
 */
export type EmailLog = {
  id: string;
  lodge_id: string | null;
  to_email: string;
  member_id: string | null;
  admin_user_id: string | null;
  email_type: string;
  entity_type: string | null;
  entity_id: string | null;
  dedupe_key: string | null;
  subject: string;
  resend_message_id: string | null;
  status: "sent" | "failed" | "skipped_optout";
  error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type LodgeNotificationSetting = {
  lodge_id: string;
  /** admin_users.role or the sentinel '__all__' for a lodge-wide rule. */
  role: string;
  event_type: string;
  enabled: boolean;
  updated_at: string;
};

export type Lead = {
  id: string;
  lodge_id: string | null;
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

export type LeadActivity = {
  id: string;
  lodge_id: string | null;
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

export type Event = {
  id: string;
  lodge_id: string | null;
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
  /**
   * Non-cash "bring a bottle for the raffle" pledge. Independent of
   * enable_raffle_donation: a lodge can run a cash raffle, a wine raffle,
   * both, or neither. See migration 057.
   */
  enable_raffle_wine_pledge: boolean;
  raffle_wine_description: string | null;
  enable_meeting_fee: boolean;
  meeting_fee_amount: number | null;
  meeting_fee_description: string | null;
  enable_guest_tickets: boolean;
  guest_ticket_price: number | null;
  guest_ticket_description: string | null;
  guest_policy: "blue_table" | "white_table" | "closed";
  dining_waived_for_all: boolean;
  featured_image_url: string | null;
  created_by: string | null;
  published: boolean;
  /**
   * Opt-in flag that promotes this event onto the public lodge website even
   * when its `event_type` is not naturally public. See
   * `lib/events/public-visibility.ts` for the full visibility rule.
   */
  feature_on_website: boolean;
  sequence_id: string | null;
  sequence_position: number | null;
  summons_status: SummonsStatus;
  summons_auto_drafted_at: string | null;
  summons_approved_at: string | null;
  summons_approved_by_email: string | null;
  summons_last_sent_at: string | null;
  /**
   * Per-meeting close (migration 059). When a treasurer hits "Close
   * meeting and send Gift Aid" we stamp these and create a same-day
   * Gift Aid claim batch for everything attributed to this event_id.
   */
  meeting_closed_at: string | null;
  meeting_closed_by_email: string | null;
  meeting_close_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SummonsStatus = "none" | "draft" | "approved" | "sent";

/**
 * Per-event override of fee resolution for a single member or honorary
 * guest. Used when a recipient should pay a different amount (or
 * complimentary) for one specific meeting only, distinct from their
 * profile-level levy_waived/dining_waived flags.
 *
 * Resolution order is: event_fee_overrides -> event.dining_waived_for_all
 * -> profile waivers -> profile custom amount -> event price -> lodge default.
 */
export type EventFeeOverride = {
  id: string;
  lodge_id: string;
  event_id: string;
  subject_type: "member" | "guest";
  subject_id: string;
  levy_amount: number | null;
  dining_amount: number | null;
  levy_waived: boolean;
  dining_waived: boolean;
  note: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A recurring meeting recipe for a lodge. The sequence captures the
 * standard "third Saturday in Jan/Mar/Jun/Sep/Nov" rhythm so the
 * secretary can generate a year of regular meetings in one go and have
 * draft summons auto-created within the configured lead window.
 *
 * Sends are NEVER automatic. The send route checks summons_status on
 * the event and refuses to dispatch unless an admin has explicitly
 * approved the draft.
 */
export type MeetingSequence = {
  id: string;
  lodge_id: string;
  name: string;
  description: string | null;
  event_type: string;
  /** ISO weekday: 1 = Monday, 7 = Sunday. */
  day_of_week: number;
  /** 1..5 for nth occurrence of the weekday in the month, -1 for last. */
  week_of_month: number;
  /** Calendar months 1..12 the sequence runs in. */
  months: number[];
  /**
   * Per-month overrides keyed by month number as a string ("1".."12"). Each
   * entry may override week_of_month and/or day_of_week. Anything unset
   * falls back to the sequence default. Lets lodges express patterns like
   * "3rd Saturday most months but 2nd Saturday in June".
   */
  month_overrides: Record<
    string,
    { week_of_month?: number; day_of_week?: number }
  >;
  default_event_time: string | null;
  default_location: string | null;
  default_temple_room: string | null;
  default_dress_code: string | null;
  default_dining_price: number | null;
  default_meeting_fee_amount: number | null;
  default_enable_dining_rsvp: boolean;
  default_enable_meeting_fee: boolean;
  default_enable_charity_donation: boolean;
  default_charity_name: string | null;
  default_enable_raffle_donation: boolean;
  default_raffle_description: string | null;
  default_enable_raffle_wine_pledge: boolean;
  default_raffle_wine_description: string | null;
  /** Max lead time in weeks for auto-creating a draft summons. */
  summons_lead_weeks: number;
  /** UI warning threshold: anything inside this is overdue. */
  summons_min_lead_weeks: number;
  auto_draft_summons: boolean;
  active: boolean;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type Rsvp = {
  id: string;
  lodge_id: string | null;
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
  /**
   * Non-cash raffle wine pledge. `raffle_wine_pledged` is the boolean
   * gate; when true `raffle_wine_bottles` is >= 1 and `raffle_wine_note`
   * is optional free text (e.g. "Chianti Riserva"). When false bottles
   * is 0 and the note is null. See migration 057.
   */
  raffle_wine_pledged: boolean;
  raffle_wine_bottles: number;
  raffle_wine_note: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  lodge_id: string | null;
  rsvp_id: string | null;
  event_id: string | null;
  user_email: string;
  user_name: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_customer_id: string | null;
  // Mooov-side caller-generated payment id (e.g. don_<lodge>_<rand>). Set on
  // payments projected from Mooov webhook events. Mutually exclusive in
  // practice with stripe_payment_intent_id during the Stripe -> Mooov cutover.
  mooov_payment_id?: string | null;
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
  refund_reason: string | null;
  // How the money arrived. card_qr is the default for online/QR rows; cash,
  // cheque, bacs are treasurer-recorded manual entries (see migration 054).
  payment_method?:
    | "card_qr"
    | "card_online"
    | "cash"
    | "cheque"
    | "bacs"
    | "other"
    | null;
  payment_method_note?: string | null;
  recorded_by_email?: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type Donation = {
  id: string;
  lodge_id: string;
  event_id: string | null;
  payment_id: string | null;
  campaign_id: string | null;
  donor_name: string | null;
  donor_email: string;
  amount: number;
  currency: string;
  source: string;
  status: string;
  gift_aid_declaration_id: string | null;
  gift_aid_status: "unknown" | "eligible" | "declared" | "declined";
  gift_aid_eligible_amount: number | null;
  gift_aid_claimed_at: string | null;
  gift_aid_claim_batch_id: string | null;
  gasds_eligible: boolean;
  gasds_claimed_at: string | null;
  tax_year: string | null;
  created_at: string;
};

export type GiftAidDeclaration = {
  id: string;
  lodge_id: string;
  donor_name: string;
  donor_email: string;
  donor_address_line_1: string | null;
  donor_address_line_2: string | null;
  donor_city: string | null;
  donor_postcode: string | null;
  donor_country: string | null;
  declaration_text: string;
  declaration_confirmed: boolean;
  confirmation_method: string;
  hmrc_eligible: boolean;
  declaration_source: string;
  retained_until: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  // Tamper-evident evidence (migration 059). Both digital and paper
  // declarations carry an artefact: paper is the scanned wet-ink slip,
  // digital is a server-rendered HTML/PDF snapshot of the e-signed form.
  // The SHA-256 lets an auditor verify the stored file has not been
  // swapped after the fact.
  evidence_source: "digital" | "paper" | "verbal" | "import_legacy";
  evidence_storage_bucket: string | null;
  evidence_storage_path: string | null;
  evidence_sha256: string | null;
  evidence_size_bytes: number | null;
  evidence_mime_type: string | null;
  evidence_uploaded_at: string | null;
  evidence_uploaded_by_email: string | null;
  paper_received_date: string | null;
  paper_filing_reference: string | null;
  digital_signature_ip: string | null;
  digital_signature_user_agent: string | null;
  digital_declaration_text_snapshot: string | null;
  member_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Append-only audit event for a Gift Aid declaration. The events table has
 * no UPDATE/DELETE grants and a row-level trigger that refuses mutation, so
 * once a row lands here it is the source of truth for "what happened".
 */
export type GiftAidDeclarationEvent = {
  id: string;
  lodge_id: string;
  declaration_id: string;
  event_type:
    | "created_digital"
    | "created_paper"
    | "evidence_uploaded"
    | "evidence_replaced"
    | "evidence_downloaded"
    | "address_updated"
    | "revoked"
    | "reinstated"
    | "imported"
    | "printed_pdf";
  actor_kind: "member" | "admin" | "platform" | "system";
  actor_email: string | null;
  actor_ip: string | null;
  actor_user_agent: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  evidence_sha256: string | null;
  notes: string | null;
  created_at: string;
};

export type LodgeSubscription = {
  id: string;
  lodge_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_code: string;
  billing_cycle: string;
  seats: number;
  amount: number;
  currency: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  requested_plan_code: string | null;
  last_upgrade_requested_at: string | null;
  lodge_limit: number | null;
  created_at: string;
  updated_at: string;
};

export type BlogPost = {
  id: string;
  lodge_id: string | null;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  category: string | null;
  tags: string[] | null;
  meta_description: string | null;
  meta_keywords: string | null;
  author_id: string | null;
  author_name: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentPage = {
  id: string;
  lodge_id: string | null;
  page_key: string;
  title: string | null;
  content: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type CharityCampaign = {
  id: string;
  lodge_id: string | null;
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

export type LodgeFeeDefaults = {
  lodge_id: string;
  default_member_levy_amount: number | null;
  default_member_dining_amount: number | null;
  default_guest_dining_amount: number | null;
  currency: string;
  updated_at: string;
};

export type LodgeMasonicYear = {
  id: string;
  lodge_id: string;
  label: string;
  start_date: string;
  end_date: string;
  annual_dues_amount: number | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export type GuestCategory = "guest" | "honorary_guest";

export type LodgeDues = {
  id: string;
  lodge_id: string;
  name: string;
  amount: number;
  currency: string;
  billing_period: string;
  active: boolean;
  allow_instalments: boolean;
  instalment_count: number | null;
  instalment_frequency: string | null;
  charitable_amount: number;
  charitable_label: string;
  gift_aid_enabled: boolean;
  enable_strategy_catch_up_lump: boolean;
  enable_strategy_balloon: boolean;
  enable_strategy_reslice: boolean;
  auto_renew_default: boolean;
  year_start_prompt_days: number;
  catch_up_max_months: number;
  advance_discount_percent: number;
  created_at: string;
  updated_at: string;
};

export type MemberDues = {
  id: string;
  lodge_id: string;
  member_email: string;
  member_name: string | null;
  member_id: string | null;
  dues_id: string | null;
  amount: number;
  currency: string;
  period_start: string;
  period_end: string;
  status: string;
  payment_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
  charitable_amount: number;
  gift_aid_declaration_id: string | null;
  gift_aid_status: "unknown" | "eligible" | "declared" | "declined";
  gift_aid_eligible_amount: number;
  paid_at: string | null;
  reminder_sent_at: string | null;
  reminder_count: number;
  is_pro_rata: boolean;
  full_year_amount: number | null;
  waiver_reason: string | null;
  is_advance: boolean;
  advance_for_year_id: string | null;
  /**
   * How this member is paying this year's dues. NULL = not yet tagged
   * (treasurer dashboard counts these as "outstanding / unset"). See
   * supabase/migrations/063_member_dues_payment_method.sql.
   */
  dues_payment_method: DuesPaymentMethod | null;
  /** Standing-order amount when dues_payment_method='bacs'. */
  bacs_monthly_amount: number | null;
  /** Optional BACS reference (e.g. "BRO ANTONIO 25/26"). */
  bacs_reference: string | null;
  /** Admin email or 'system_backfill_063' for the migration backfill. */
  payment_method_set_by: string | null;
  payment_method_set_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DuesPaymentMethod =
  | "online_subscription"
  | "bacs"
  | "paid_in_full"
  | "fee_waived";

export type MemberDuesInstalment = {
  id: string;
  lodge_id: string;
  member_dues_id: string;
  sequence: number;
  due_date: string;
  amount: number;
  currency: string;
  status: 'outstanding' | 'paid' | 'waived' | 'overdue';
  paid_at: string | null;
  reminder_sent_at: string | null;
  payment_reference: string | null;
  mooov_payment_id: string | null;
  schedule_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DuesSplitStrategy =
  | "pro_rata"
  | "even_full_year"
  | "catch_up_lump_then_monthly"
  | "monthly_then_balloon"
  | "reslice_remaining";

export type DuesScheduleStatus =
  | "pending"
  | "active"
  | "action_required"
  | "past_due"
  | "paused"
  | "cancelled"
  | "completed"
  | "active_stripe";

export type DuesSchedule = {
  id: string;
  lodge_id: string;
  member_id: string | null;
  member_dues_id: string;
  member_email: string;
  customer_ref: string;
  mooov_payment_method_id: string | null;
  stripe_customer_id: string | null;
  mooov_subscription_id: string | null;
  cadence: "monthly" | "quarterly";
  split_strategy: DuesSplitStrategy;
  auto_renew: boolean;
  status: DuesScheduleStatus;
  consecutive_failures: number;
  last_failure_code: string | null;
  last_failure_category: string | null;
  last_failure_at: string | null;
  next_action_client_secret: string | null;
  next_action_connected_account_id: string | null;
  next_action_expires_at: string | null;
  next_charge_at: string | null;
  last_charged_at: string | null;
  cancelled_at: string | null;
  cancelled_by_actor: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MeetingCollection = {
  id: string;
  lodge_id: string;
  event_id: string | null;
  campaign_id: string | null;
  collection_date: string;
  collection_type: string;
  title: string;
  cash_amount: number;
  card_amount: number;
  donor_linked_amount: number;
  anonymous_cash_amount: number;
  gift_aid_reclaimable_amount: number;
  gasds_eligible_amount: number;
  gasds_tax_year: string | null;
  notes: string | null;
  recorded_by_email: string | null;
  /**
   * Set by the per-meeting close flow (migration 059) when the meeting
   * collection has been rolled into a Gift Aid claim batch for the same
   * date. Lets the meeting detail page show "submitted to Relief Chest".
   */
  gift_aid_claim_batch_id: string | null;
  relief_chest_delivered_at: string | null;
  relief_chest_delivered_to: string | null;
  created_at: string;
  updated_at: string;
};

export type GasdsClaim = {
  id: string;
  lodge_id: string;
  tax_year: string;
  eligible_cash_amount: number;
  claimed_cash_amount: number;
  reclaimable_amount: number;
  status: "draft" | "exported" | "filed" | "paid";
  exported_at: string | null;
  filed_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GiftAidClaimBatch = {
  id: string;
  lodge_id: string;
  claim_reference: string | null;
  period_start: string;
  period_end: string;
  status: "draft" | "exported" | "filed" | "paid";
  donation_count: number;
  eligible_amount: number;
  reclaimable_amount: number;
  exported_at: string | null;
  filed_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_by_email: string | null;
  /**
   * Number of Gift Aid declarations bundled into this pack (migration
   * 060). Set at batch creation by the close flow; updated only when an
   * additional declaration is manually attached afterwards. UI uses this
   * to surface "X new declarations" without joining.
   */
  declarations_count: number;
  /** Last time someone downloaded the full pack ZIP, for audit. */
  pack_generated_at: string | null;
  pack_generated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

/** Per-batch linkage of a declaration that was included in the claim pack. */
export type GiftAidClaimDeclaration = {
  id: string;
  lodge_id: string;
  claim_batch_id: string;
  gift_aid_declaration_id: string;
  inclusion_reason: "new_in_window" | "donor_in_batch" | "manual";
  created_at: string;
};

export type GiftAidClaimItem = {
  id: string;
  lodge_id: string;
  claim_batch_id: string;
  donation_id: string | null;
  gift_aid_declaration_id: string | null;
  donor_name: string | null;
  donor_email: string | null;
  donation_date: string;
  source: string;
  eligible_amount: number;
  reclaimable_amount: number;
  created_at: string;
};

export type BankStatementImport = {
  id: string;
  lodge_id: string;
  filename: string;
  account_label: string | null;
  total_rows: number;
  matched_rows: number;
  imported_by_admin_user_id: string | null;
  notes: string | null;
  created_at: string;
};

export type BankTransaction = {
  id: string;
  lodge_id: string;
  import_id: string;
  posted_date: string;
  description: string;
  amount: number;
  direction: 'credit' | 'debit';
  balance: number | null;
  reference: string | null;
  status: 'unmatched' | 'matched' | 'ignored';
  matched_source_type: 'payment' | 'dues' | 'donation' | 'manual' | null;
  matched_source_id: string | null;
  matched_confidence: number | null;
  matched_by_admin_user_id: string | null;
  matched_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProgressionSignoff = {
  id: string;
  lodge_id: string;
  member_id: string;
  degree: 'initiation' | 'passing' | 'raising';
  signed_off: boolean;
  signed_off_by_admin_user_id: string | null;
  signed_off_by_member_id: string | null;
  notes: string | null;
  created_at: string;
};

export type MentorAssignment = {
  id: string;
  lodge_id: string;
  mentor_member_id: string;
  mentee_member_id: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MentorContact = {
  id: string;
  lodge_id: string;
  assignment_id: string | null;
  mentor_member_id: string | null;
  mentee_member_id: string | null;
  contacted_at: string;
  contact_method: 'meeting' | 'phone' | 'video' | 'email' | 'visit';
  topic: string | null;
  notes: string | null;
  created_at: string;
};

export type EventRitualRole = {
  id: string;
  lodge_id: string;
  event_id: string;
  role_title: string;
  member_id: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type OfficerLadderRung = {
  id: string;
  lodge_id: string;
  rung_label: string;
  sort_order: number;
  current_member_id: string | null;
  successor_member_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Province = {
  id: string;
  slug: string;
  name: string;
  jurisdiction: string | null;
  country: string;
  contact_email: string | null;
  contact_phone: string | null;
  primary_color: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MemberRank = {
  id: string;
  lodge_id: string;
  member_id: string;
  scope: 'lodge' | 'provincial' | 'grand' | 'other';
  rank_label: string;
  conferred_on: string | null;
  conferred_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type LodgeVisit = {
  id: string;
  visiting_lodge_id: string;
  host_lodge_id: string | null;
  host_lodge_name: string | null;
  member_id: string | null;
  member_name: string | null;
  visit_date: string;
  occasion: string | null;
  notes: string | null;
  recorded_by_admin_user_id: string | null;
  created_at: string;
};

export type ProvinceOfficerDirectoryEntry = {
  province_id: string | null;
  lodge_id: string;
  lodge_name: string;
  lodge_number: string | null;
  member_id: string;
  full_name: string;
  office_title: string;
  officer_sort_order: number | null;
  email: string;
  rank: string | null;
};

export type LodgeAnnualReturn = {
  lodge_id: string;
  province_id: string | null;
  lodge_name: string;
  lodge_number: string | null;
  active_members: number;
  resigned_members: number;
  excluded_members: number;
  initiations_ytd: number;
  passings_ytd: number;
  raisings_ytd: number;
};

export type MemberConsent = {
  id: string;
  lodge_id: string;
  member_id: string;
  consent_key: string;
  granted: boolean;
  granted_at: string;
  revoked_at: string | null;
  source: 'admin' | 'member' | 'import' | 'system';
  ip_address: string | null;
  user_agent: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DataRetentionSettings = {
  id: string;
  lodge_id: string;
  resigned_member_retention_months: number;
  deceased_member_retention_months: number;
  lead_inactive_retention_months: number;
  audit_log_retention_months: number;
  archive_strategy: 'soft_delete' | 'anonymise' | 'hard_delete';
  notes: string | null;
  updated_by_admin_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SubjectAccessRequest = {
  id: string;
  lodge_id: string;
  member_id: string | null;
  requester_email: string;
  requester_name: string | null;
  status: 'received' | 'in_progress' | 'fulfilled' | 'rejected';
  fulfilled_at: string | null;
  fulfilled_by_admin_user_id: string | null;
  delivery_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type JobStatus =
  | 'queued'
  | 'in_progress'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type Job = {
  id: string;
  lodge_id: string | null;
  job_type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_by_admin_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationProvider =
  | 'google_calendar'
  | 'outlook'
  | 'mailchimp'
  | 'brevo'
  | 'xero'
  | 'quickbooks';

export type IntegrationCredentials = {
  id: string;
  lodge_id: string;
  provider: IntegrationProvider;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type MessageTemplate = {
  id: string;
  lodge_id: string | null;
  template_key: string;
  name: string;
  subject: string;
  html_body: string;
  channel: 'email' | 'sms';
  merge_tags: string[];
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  lodge_id: string;
  channel: 'email' | 'sms';
  template_key: string | null;
  subject: string | null;
  body_preview: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  recipient_member_id: string | null;
  recipient_lead_id: string | null;
  audience_label: string | null;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  error_message: string | null;
  metadata: Record<string, unknown>;
  sent_by_admin_user_id: string | null;
  sent_at: string | null;
  created_at: string;
};

export type AutomationSetting = {
  id: string;
  lodge_id: string;
  automation_key: string;
  enabled: boolean;
  last_run_at: string | null;
  config: Record<string, unknown>;
  updated_at: string;
};

export type WelfareCase = {
  id: string;
  lodge_id: string;
  member_id: string | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  case_type: 'general' | 'illness' | 'bereavement' | 'financial' | 'family' | 'isolation';
  severity: 'low' | 'standard' | 'high' | 'urgent';
  status: 'open' | 'monitoring' | 'closed';
  summary: string | null;
  next_action: string | null;
  next_action_due: string | null;
  opened_at: string;
  closed_at: string | null;
  created_by_admin_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WelfareVisit = {
  id: string;
  lodge_id: string;
  case_id: string;
  visited_at: string;
  contact_method: 'visit' | 'phone' | 'video' | 'email' | 'letter';
  outcome: string | null;
  notes: string | null;
  visited_by_admin_user_id: string | null;
  follow_up_due: string | null;
  created_at: string;
};

export type WelfareRegisterEntry = {
  id: string;
  lodge_id: string;
  member_id: string | null;
  register_type: 'bereavement' | 'widow' | 'family';
  full_name: string;
  relationship: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  date_of_event: string | null;
  last_contact_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WelfareAlert = {
  id: string;
  lodge_id: string;
  member_id: string | null;
  alert_type: 'missed_meetings' | 'overdue_dues' | 'silent' | 'manual';
  severity: 'low' | 'standard' | 'high' | 'urgent';
  message: string;
  metadata: Record<string, unknown>;
  status: 'open' | 'snoozed' | 'acknowledged' | 'resolved';
  acknowledged_by_admin_user_id: string | null;
  acknowledged_at: string | null;
  case_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LedgerEntry = {
  source_id: string;
  source_type: 'payment' | 'dues' | 'donation';
  lodge_id: string;
  occurred_at: string;
  contact_email: string | null;
  contact_name: string | null;
  amount: number;
  refund_amount: number;
  currency: string;
  status: string;
  category: string;
  metadata: Record<string, unknown>;
};

export type Settings = {
  id: string;
  lodge_id: string | null;
  setting_key: string;
  setting_value: string | null;
  setting_type: string;
  description: string | null;
  updated_at: string;
};

export type EventGuest = {
  id: string;
  lodge_id: string | null;
  rsvp_id: string | null;
  event_id: string;
  guest_name: string;
  dietary_requirements: string | null;
  email: string | null;
  phone: string | null;
  guest_id: string | null;
  guest_invitation_id: string | null;
  source: "member_party" | "self_invite" | "admin_added" | "self_register";
  welcome_email_sent_at: string | null;
  created_at: string;
};

export type Guest = {
  id: string;
  lodge_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  mother_lodge_name: string | null;
  mother_lodge_number: string | null;
  constitution: string | null;
  rank: string | null;
  dietary_requirements: string | null;
  guest_category: GuestCategory;
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

export type GuestInvitation = {
  id: string;
  lodge_id: string;
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

export type Member = {
  id: string;
  lodge_id: string;
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
  member_levy_amount: number | null;
  member_dining_amount: number | null;
  levy_waived: boolean;
  dining_waived: boolean;
  fee_use_custom: boolean;
  annual_dues_waived: boolean;
  annual_dues_waiver_reason: string | null;
  date_of_initiation: string | null;
  date_of_birth: string | null;
  date_of_passing: string | null;
  date_of_raising: string | null;
  progression_signed_off_initiation: boolean;
  progression_signed_off_passing: boolean;
  progression_signed_off_raising: boolean;
  initiation_email_sent: boolean;
  membership_status: 'active' | 'suspended' | 'resigned' | 'excluded';
  stripe_customer_id: string | null;
  portal_token: string;
  /**
   * Per-member opt-in for the public lodge website. Defaults to false.
   * Even when this member holds an officer rung in `officer_ladder`,
   * their name, photo, and bio stay private until they explicitly opt
   * in via the admin member detail page. Revocable at any time.
   */
  show_on_website: boolean;
  /**
   * Short public-facing biography (one or two paragraphs) shown
   * alongside the member on the public Officers section when
   * `show_on_website` is true.
   */
  public_bio: string | null;
  archived_at: string | null;
  archived_reason: string | null;
  /**
   * Set the first time we show a member the Gift Aid onboarding prompt
   * (migration 059). After this is non-null, the portal degrades the
   * full-screen modal to a dismissible banner.
   */
  gift_aid_prompted_at: string | null;
  /**
   * Member-level cache of Gift Aid posture. `unknown` until they answer,
   * `declared` when an active declaration exists for this member, and
   * `declined` when they have explicitly opted out (still surfaces a
   * "change your mind" link but no banner). Source of truth remains
   * `gift_aid_declarations`; this column is a denormalised hint for the
   * banner and the dashboard counters.
   */
  gift_aid_consent_status: "unknown" | "declared" | "declined";
  created_at: string;
  updated_at: string;
};

export type EventSummons = {
  id: string;
  lodge_id: string;
  event_id: string;
  issue_date: string;
  opening_text: string | null;
  agenda_items: string[];
  menu_items: string[];
  dining_time: string | null;
  notices: string[];
  include_member_directory: boolean;
  visiting_officer_name: string | null;
  visiting_officer_email: string | null;
  visiting_officer_phone: string | null;
  visiting_officers: VisitingOfficer[];
  next_meeting_date: string | null;
  next_meeting_note: string | null;
  master_elect_name: string | null;
  master_elect_qualification: string | null;
  include_honorary_guests: boolean;
  recipient_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type VisitingOfficer = {
  name: string;
  email?: string | null;
  phone?: string | null;
};

export type EventSummonsSend = {
  id: string;
  lodge_id: string;
  event_id: string;
  summons_id: string | null;
  sent_by: string | null;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  failures: Array<{ email: string; message: string }>;
  created_at: string;
};

export type EventSummonsAccessLink = {
  id: string;
  lodge_id: string;
  event_id: string;
  summons_id: string | null;
  send_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  token_hash: string;
  expires_at: string | null;
  accessed_at: string | null;
  access_count: number;
  created_at: string;
};

export type LodgeFeatureFlag = {
  id: string;
  lodge_id: string;
  flag_key: string;
  enabled: boolean;
  notes: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};
