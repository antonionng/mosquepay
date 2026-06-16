import { createHash } from "crypto";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Calendar, Clock, MapPin, Shirt } from "lucide-react";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { formatDate } from "@/lib/utils";
import { GuestInvitationForm } from "./guest-invitation-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "You're invited",
  robots: { index: false, follow: false, nocache: true },
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isUsable(invitation: {
  expires_at: string | null;
  revoked_at: string | null;
  max_uses: number | null;
  uses: number;
}) {
  if (invitation.revoked_at) return false;
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return false;
  }
  if (invitation.max_uses != null && invitation.uses >= invitation.max_uses) {
    return false;
  }
  return true;
}

export default async function GuestInvitationPage({
  params,
  expectedMosqueSlug,
}: {
  params: Promise<{ token: string }>;
  expectedMosqueSlug?: string;
}) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  let invitation:
    | {
        id: string;
        mosque_id: string | null;
        mosque_slug: string;
        event_id: string;
        inviter_member_id: string | null;
        recipient_email: string | null;
        recipient_name: string | null;
        payer: "guest" | "inviter";
        max_uses: number | null;
        uses: number;
        expires_at: string | null;
        revoked_at: string | null;
      }
    | null = null;

  if (isSupabaseConfigured()) {
    const inv = await db.getGuestInvitationByTokenHash(tokenHash);
    if (inv) {
      const mosque = await db.getMosqueById(inv.mosque_id);
      invitation = {
        id: inv.id,
        mosque_id: inv.mosque_id,
        mosque_slug: mosque?.slug ?? expectedMosqueSlug ?? "",
        event_id: inv.event_id,
        inviter_member_id: inv.inviter_member_id,
        recipient_email: inv.recipient_email,
        recipient_name: inv.recipient_name,
        payer: inv.payer,
        max_uses: inv.max_uses,
        uses: inv.uses,
        expires_at: inv.expires_at,
        revoked_at: inv.revoked_at,
      };
    }
  } else if (shouldUseInMemoryMock()) {
    const inv = mockDb.getGuestInvitationByTokenHash(tokenHash);
    if (inv) {
      invitation = {
        id: inv.id,
        mosque_id: null,
        mosque_slug: inv.mosque_slug,
        event_id: inv.event_id,
        inviter_member_id: inv.inviter_member_id,
        recipient_email: inv.recipient_email,
        recipient_name: inv.recipient_name,
        payer: inv.payer,
        max_uses: inv.max_uses,
        uses: inv.uses,
        expires_at: inv.expires_at,
        revoked_at: inv.revoked_at,
      };
    }
  }

  if (!invitation) notFound();
  if (expectedMosqueSlug && invitation.mosque_slug !== expectedMosqueSlug) {
    notFound();
  }
  if (!isUsable(invitation)) {
    return <ExpiredOrUsedScreen />;
  }

  type EventLike = {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    event_date: string;
    event_time: string | null;
    location: string | null;
    dress_code: string | null;
    enable_dining_rsvp: boolean;
    dining_price: number | null;
    dining_description: string | null;
    enable_charity_donation: boolean;
    charity_name: string | null;
    charity_suggested_amounts: number[] | null;
    charity_allow_custom: boolean;
    enable_service_fee: boolean;
    service_fee_amount: number | null;
    service_fee_description: string | null;
    enable_payments: boolean;
    guest_policy: "blue_table" | "white_table" | "closed";
  };

  let event: EventLike | null = null;
  let mosqueName: string | null = null;
  let mosqueLogo: string | null = null;
  let inviterName: string | null = null;

  if (isSupabaseConfigured() && invitation.mosque_id) {
    const [e, mosque] = await Promise.all([
      db.getEventById(invitation.event_id, invitation.mosque_id),
      db.getMosqueById(invitation.mosque_id),
    ]);
    if (e) {
      event = {
        id: e.id,
        title: e.title,
        slug: e.slug,
        description: e.description,
        event_date: e.event_date,
        event_time: e.event_time,
        location: e.location,
        dress_code: e.dress_code,
        enable_dining_rsvp: e.enable_dining_rsvp,
        dining_price: e.dining_price,
        dining_description: e.dining_description,
        enable_charity_donation: e.enable_charity_donation,
        charity_name: e.charity_name,
        charity_suggested_amounts: e.charity_suggested_amounts,
        charity_allow_custom: e.charity_allow_custom,
        enable_service_fee: e.enable_service_fee,
        service_fee_amount: e.service_fee_amount,
        service_fee_description: e.service_fee_description,
        enable_payments: e.enable_payments,
        guest_policy: e.guest_policy,
      };
    }
    mosqueName = mosque?.name ?? null;
    mosqueLogo = mosque?.logo_url ?? null;
    if (invitation.inviter_member_id) {
      const member = await db.getMemberById(
        invitation.inviter_member_id,
        invitation.mosque_id
      );
      inviterName = member?.full_name ?? null;
    }
  } else if (shouldUseInMemoryMock()) {
    const e = mockDb.getEventById(invitation.event_id, {
      mosque_slug: invitation.mosque_slug,
    });
    if (e) {
      event = {
        id: e.id,
        title: e.title,
        slug: e.slug,
        description: e.description,
        event_date: e.event_date,
        event_time: e.event_time,
        location: e.location,
        dress_code: e.dress_code,
        enable_dining_rsvp: e.enable_dining_rsvp,
        dining_price: e.dining_price,
        dining_description: e.dining_description,
        enable_charity_donation: e.enable_charity_donation,
        charity_name: e.charity_name,
        charity_suggested_amounts: e.charity_suggested_amounts,
        charity_allow_custom: e.charity_allow_custom,
        enable_service_fee: e.enable_service_fee,
        service_fee_amount: e.service_fee_amount,
        service_fee_description: e.service_fee_description,
        enable_payments: e.enable_payments,
        guest_policy: e.guest_policy,
      };
    }
    const mosque = mockDb.getMosqueBySlug(invitation.mosque_slug);
    mosqueName = mosque?.name ?? null;
    mosqueLogo = mosque?.logo_url ?? null;
  }

  if (!event) notFound();
  if (event.guest_policy === "closed") notFound();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex items-center gap-4">
            {mosqueLogo ? (
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                <Image
                  src={mosqueLogo}
                  alt={`${mosqueName ?? "Mosque"} logo`}
                  width={56}
                  height={56}
                  className="h-full w-full object-contain p-1.5"
                />
              </div>
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                {event.guest_policy === "blue_table"
                  ? "Newcomer members welcome"
                  : "You're invited"}
              </p>
              <p className="text-sm text-slate-500">{mosqueName}</p>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {inviterName
              ? `${inviterName} has invited you to ${event.title}`
              : `You're invited to ${event.title}`}
          </h1>
          {event.description ? (
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              {event.description}
            </p>
          ) : null}

          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <DetailRow icon={Calendar} label="Date">
              {formatDate(event.event_date)}
            </DetailRow>
            {event.event_time ? (
              <DetailRow icon={Clock} label="Time">
                {event.event_time}
              </DetailRow>
            ) : null}
            {event.location ? (
              <DetailRow icon={MapPin} label="Location">
                {event.location}
              </DetailRow>
            ) : null}
            {event.dress_code ? (
              <DetailRow icon={Shirt} label="Dress">
                {event.dress_code}
              </DetailRow>
            ) : null}
          </dl>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h2 className="text-xl font-semibold text-slate-950">
            Confirm your place
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            By confirming, you commit to attend. Payments are non-refundable.
          </p>
          <div className="mt-6">
            <GuestInvitationForm
              token={token}
              guestPolicy={event.guest_policy}
              payer={invitation.payer}
              recipientName={invitation.recipient_name}
              recipientEmail={invitation.recipient_email}
              enableDining={event.enable_dining_rsvp}
              diningPrice={event.dining_price}
              diningDescription={event.dining_description}
              enableServiceFee={event.enable_service_fee}
              serviceFeeAmount={event.service_fee_amount}
              serviceFeeDescription={event.service_fee_description}
              enableCharity={event.enable_charity_donation}
              charityName={event.charity_name}
              charitySuggestedAmounts={event.charity_suggested_amounts ?? [10, 20, 50, 100]}
              charityAllowCustom={event.charity_allow_custom}
              enablePayments={event.enable_payments}
            />
          </div>
        </section>

        <p className="text-center text-xs text-slate-400">
          This invitation is private. Please do not share it publicly.
        </p>
      </article>
    </main>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Calendar;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 text-blue-600" />
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </dt>
        <dd className="mt-0.5 font-medium text-slate-950">{children}</dd>
      </div>
    </div>
  );
}

function ExpiredOrUsedScreen() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">
          This invitation is no longer active
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          The link may have been revoked, expired, or already used. Please ask
          the inviting member for a fresh link.
        </p>
      </div>
    </main>
  );
}
