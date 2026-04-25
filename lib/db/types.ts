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
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Optional visual overrides per section (stored in JSONB). */
export type LodgeSiteSectionStyle = {
  primary_color?: string | null;
  background_image_url?: string | null;
  overlay_opacity?: number | null;
  background_position?: string | null;
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
  published: boolean;
  updated_at: string;
};

export type AdminUser = {
  id: string;
  lodge_id: string | null;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
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
  enable_meeting_fee: boolean;
  meeting_fee_amount: number | null;
  meeting_fee_description: string | null;
  enable_guest_tickets: boolean;
  guest_ticket_price: number | null;
  guest_ticket_description: string | null;
  featured_image_url: string | null;
  created_by: string | null;
  published: boolean;
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
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type Donation = {
  id: string;
  lodge_id: string;
  event_id: string | null;
  payment_id: string | null;
  donor_name: string | null;
  donor_email: string;
  amount: number;
  currency: string;
  source: string;
  status: string;
  gift_aid_declaration_id: string | null;
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
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
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
  paid_at: string | null;
  created_at: string;
  updated_at: string;
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
  created_at: string;
};

export type Member = {
  id: string;
  lodge_id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  rank: string | null;
  dietary_requirements: string | null;
  date_of_initiation: string | null;
  initiation_email_sent: boolean;
  membership_status: 'active' | 'suspended' | 'resigned' | 'excluded';
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
};
