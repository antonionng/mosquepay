-- 065_member_notification_preferences.sql
--
-- Per-member email opt-outs. v1 covers the optional-but-friendly
-- emails: receipts, BACS confirmation, paid-in-full confirmation,
-- waiver confirmation, and the per-cycle subscription receipts.
--
-- Critical alerts (subscription failed, subscription cancelled, etc.)
-- are intentionally NOT user-mutable — they're how we keep the
-- subscription healthy and avoid bouncing members. The sender layer
-- (`lib/email/preferences.ts`) enforces that policy.
--
-- A row with enabled=false is the only way to suppress an email; a
-- missing row falls through to "send" so the system stays on by
-- default.

create table if not exists public.member_notification_preferences (
  member_id uuid not null references public.members(id) on delete cascade,
  event_type text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (member_id, event_type)
);

create index if not exists idx_member_prefs_event
  on public.member_notification_preferences(event_type)
  where enabled = false;

comment on table public.member_notification_preferences is
  'Per-member opt-outs for non-critical emails. Sparse — a missing row means "send". The sender layer treats certain critical event_types as unmutable.';
