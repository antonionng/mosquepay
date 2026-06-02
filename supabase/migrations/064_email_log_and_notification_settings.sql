-- 064_email_log_and_notification_settings.sql
--
-- Phase A/B/C of the email-notifications cleanup.
--
-- Until now every email sender was bespoke: each route imported Resend,
-- crafted its own subject, and forgot afterwards. There was no record
-- of "did we email Bro X about his subscription?", no idempotency
-- against Mooov's dual-emit webhooks, and no per-treasurer way to opt
-- out of "your member just enrolled" pings.
--
-- This migration introduces two small tables:
--
--   email_log
--     Append-only audit of every email LP sends. The member detail
--     page reads it as a "Recent emails" panel; the webhook senders
--     check it as an idempotency guard so a redelivered Mooov event
--     (subscription.activated + payment.captured for the same money
--     movement) cannot trigger two activation emails.
--
--   lodge_notification_settings
--     One row per (lodge_id, role, event_type) where the lodge has
--     overridden the default. Sparse — anything missing is treated as
--     "send" so the system is on by default and admins explicitly
--     mute. v1 keeps the dimensions intentionally small; we'll add
--     per-user channels and digest frequency once the table earns its
--     keep.

-- ---------------------------------------------------------------------------
-- email_log
-- ---------------------------------------------------------------------------

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  lodge_id uuid references public.lodges(id) on delete set null,

  -- Recipient identification. We keep both shapes because we send to
  -- both members and admin-users, and the same email may belong to
  -- both. Lower-cased for matching.
  to_email text not null,
  member_id uuid references public.members(id) on delete set null,
  admin_user_id uuid references public.admin_users(id) on delete set null,

  -- Free-form classifier so we can group / count / dedupe. Examples:
  --   dues_subscription_activated_member
  --   dues_subscription_activated_treasurer
  --   dues_subscription_invoice_paid_member
  --   dues_subscription_invoice_failed_member
  --   dues_subscription_invoice_failed_treasurer
  --   dues_subscription_canceled_member
  --   payment_receipt_event
  --   payment_receipt_dues
  --   payment_receipt_donation
  --   dues_method_changed_member
  email_type text not null,

  -- Optional links back to the entity the email is *about*. Lets the
  -- member detail "Recent emails" panel jump straight to the matching
  -- record, and lets the webhook handlers idempotency-check on
  -- (entity_type, entity_id, email_type, dedupe_key).
  entity_type text,
  entity_id text,

  -- Optional per-event idempotency key. For Mooov-driven sends we set
  -- this to the synthetic mooov_payment_id / invoice_id so a Mooov
  -- redeliver does not re-send the same email. NULL for sends that
  -- can legitimately fire more than once for the same entity (e.g.
  -- repeated reminder nudges).
  dedupe_key text,

  subject text not null,
  resend_message_id text,
  status text not null default 'sent'
    check (status in ('sent', 'failed', 'skipped_optout')),
  error text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_email_log_lodge_to
  on public.email_log(lodge_id, to_email);
create index if not exists idx_email_log_member
  on public.email_log(member_id) where member_id is not null;
create index if not exists idx_email_log_type_created
  on public.email_log(email_type, created_at desc);

-- The dedupe guard. A given (lodge, type, dedupe_key) tuple may only
-- exist once across all rows. NULL dedupe_key means "no dedupe" and
-- partial-unique-index semantics let those rows repeat freely.
create unique index if not exists ux_email_log_dedupe
  on public.email_log(lodge_id, email_type, dedupe_key)
  where dedupe_key is not null;

-- ---------------------------------------------------------------------------
-- lodge_notification_settings
-- ---------------------------------------------------------------------------

create table if not exists public.lodge_notification_settings (
  lodge_id uuid not null references public.lodges(id) on delete cascade,
  -- The role this rule applies to. The sentinel '__all__' is the
  -- lodge-wide kill-switch (suppress this event for every admin role).
  -- Otherwise matches admin_users.role. NOT NULL because Postgres
  -- forbids NULL in primary-key columns.
  role text not null default '__all__',
  event_type text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (lodge_id, role, event_type)
);

comment on column public.lodge_notification_settings.role is
  'admin role this rule applies to. Use the sentinel ''__all__'' for a lodge-wide kill-switch.';

-- We never delete the row when the user re-enables — we just flip
-- enabled = true. The audit trail of toggles lives in audit_logs as
-- usual.

comment on table public.email_log is
  'Append-only log of every email LP has sent. Drives the member-detail "Recent emails" panel and idempotency guards on Mooov webhook redelivers.';
comment on table public.lodge_notification_settings is
  'Per-lodge x role x event_type opt-outs. Anything not present here is treated as enabled = true (send by default).';
