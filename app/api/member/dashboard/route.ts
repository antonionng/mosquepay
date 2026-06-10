import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";
import { computeYearPosition } from "@/lib/giving/year-position";
import { givingSubscriptionEnabled } from "@/lib/giving/feature-flags";
import { sweepAbandonedPendingSchedules } from "@/lib/giving/abandoned-pending-sweep";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberEmail = user.email;
    if (!memberEmail) {
      return NextResponse.json({ error: "Member email missing" }, { status: 400 });
    }

    const member =
      (await db.getMemberByAuthUserId(user.id)) ??
      (await db.getMemberByEmailAcrossChurches(memberEmail));

    if (!member) {
      return NextResponse.json({
        user: {
          full_name: user.user_metadata?.full_name ?? null,
          email: user.email,
        },
        churchSlug: null,
        upcomingEvents: 0,
        outstandingGiving: 0,
        recentPaymentsTotal: 0,
        donationTotal: 0,
        recentActivity: [],
        giving: null,
        payments: [],
        donationData: {
          totalThisYear: 0,
          giftAidDeclared: false,
          donations: [],
        },
      });
    }

    // Look up the church slug so the client can build cross-tenant URLs
    // (e.g. /donate?church=<slug>) that work whether the member is on the
    // church subdomain or the bare host. Tolerate a lookup failure --
    // the dashboard doesn't depend on this and the donate page will fall
    // back to host/cookie resolution.
    let churchSlug: string | null = null;
    try {
      const church = await db.getChurchById(member.church_id);
      churchSlug = church?.slug ?? null;
    } catch {
      // non-fatal
    }

    // Self-heal stale pending schedules from abandoned Mooov checkouts
    // before we read. Cheap and best-effort: if the sweep fails, the
    // dashboard still renders correctly because the read-side filters
    // also exclude pending rows from the "active subscription" card.
    await sweepAbandonedPendingSchedules(member.church_id).catch(() => 0);

    const [upcomingEventRows, allEvents, payments, donations, givingRecords, churchGiving, rsvps, noticeLinks, activeGiftAidDeclaration, currentChurchYear, allChurchYears, givingSchedules] = await Promise.all([
      db.getEvents(member.church_id, { published: true, upcoming: true }),
      db.getEvents(member.church_id, { published: true }),
      db.getPaymentsByEmail(member.email, member.church_id),
      db.getDonationsByEmail(member.email, member.church_id),
      db.getMemberGiving(member.church_id, { memberEmail: member.email }),
      db.getChurchGiving(member.church_id),
      db.getRsvpsByEmail(member.email, member.church_id),
      db.getNoticeAccessLinksByEmail(member.email, member.church_id),
      db
        .getActiveGiftAidDeclarationByMember(member.church_id, {
          id: member.id,
          email: member.email,
        })
        .catch(() => null),
      db.getCurrentChurchYear(member.church_id).catch(() => null),
      db.listChurchGivingYears(member.church_id).catch(() => []),
      db.getGivingSchedulesForMember(member.church_id, member.email).catch(() => []),
    ]);
    const giftAidDeclarationId = activeGiftAidDeclaration?.id ?? null;

    const eventById = new Map(allEvents.map((event) => [event.id, event]));
    const upcomingEvents = upcomingEventRows.length;
    const rsvpsByEventId = new Map(rsvps.map((r) => [r.event_id, r]));
    const sortedUpcoming = upcomingEventRows
      .slice()
      .sort(
        (a, b) =>
          new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
      );
    const nextEvent = sortedUpcoming[0] ?? null;
    const nextEventRsvp = nextEvent ? rsvpsByEventId.get(nextEvent.id) : null;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPaymentsTotal = payments
      .filter(
        (p) =>
          p.created_at && new Date(p.created_at) >= thirtyDaysAgo
      )
      .reduce((sum, p) => sum + (p.total_amount ?? 0), 0);

    const currentYear = new Date().getFullYear();
    const donationTotal = donations
      .filter(
        (d) =>
          d.created_at && new Date(d.created_at).getFullYear() === currentYear
      )
      .reduce((sum, d) => sum + (d.amount ?? 0), 0);

    const unpaidGiving = givingRecords.filter(
      (d) => d.status !== "paid" && !d.is_advance
    );
    const paidGiving = givingRecords.filter((d) => d.status === "paid");
    const advanceGiving = givingRecords.filter((d) => d.is_advance);
    const outstandingGiving = unpaidGiving.reduce((sum, d) => sum + (d.amount ?? 0), 0);
    const currentGiving = unpaidGiving[0] ?? givingRecords.find((d) => !d.is_advance) ?? null;
    const givingConfig = churchGiving[0] ?? null;
    const paidAmount = paidGiving.reduce((sum, d) => sum + (d.amount ?? 0), 0);

    // Resolve year position for the giving UX router on the member portal.
    // Defaults are safe for churches that haven't configured a giving year:
    // we omit `yearPosition` and the portal falls back to the legacy view.
    const yearPosition = currentChurchYear
      ? computeYearPosition({
          yearStartDate: currentChurchYear.start_date,
          yearEndDate: currentChurchYear.end_date,
          dateOfInitiation: member.date_of_membership ?? null,
          hasPaidCurrentYear:
            !!currentGiving && currentGiving.status === "paid",
          hasOutstandingCurrentYear:
            !!currentGiving &&
            currentGiving.status !== "paid" &&
            currentGiving.status !== "waived",
        })
      : null;

    // Resolve next giving year for the pay-in-advance card. Only surfaced
    // when (a) the church has more than one giving year row configured or
    // we can synthesise next year's bounds from the current one, AND (b)
    // the member is paid up for current year.
    const nextChurchYear = currentChurchYear
      ? allChurchYears.find(
          (y) =>
            y.start_date.slice(0, 10) >
            currentChurchYear.end_date.slice(0, 10)
        ) ?? null
      : null;
    const advanceForNextYear = nextChurchYear
      ? advanceGiving.find((d) => d.advance_for_year_id === nextChurchYear.id) ??
        null
      : null;
    const advanceCardEligible =
      !!yearPosition &&
      yearPosition.quadrant === "paid_up_current_year" &&
      !!givingConfig &&
      givingConfig.active === true;
    const advanceBaseAmount =
      nextChurchYear?.annual_giving_amount ??
      givingConfig?.amount ??
      currentChurchYear?.annual_giving_amount ??
      null;
    const advanceDiscountPct = givingConfig?.advance_discount_percent ?? 0;
    const advanceDiscountedAmount =
      advanceBaseAmount != null
        ? Math.round(advanceBaseAmount * (1 - advanceDiscountPct / 100) * 100) /
          100
        : null;

    // Active giving schedule (saved-charge subscription OR Mooov-branded
    // subscription_checkout). Surfaced as a status card with a cancel
    // button + an SCA resume CTA when the last cycle returned
    // requires_action. We only consider schedules tied to the
    // current-year giving record so a paused/cancelled last-year schedule
    // doesn't pollute the dashboard.
    //
    // We also EXCLUDE 'pending' here. Pending = "schedule row written,
    // member redirected to Mooov, but cycle 1 not yet captured by the
    // activation webhook". If we surface those we end up showing
    // "Active subscription · 0 of 0 paid" while the member's outstanding
    // balance is still £full — which is what bug-fix
    // post-2026-06-01-T19:30 was reverting. The "Set Up Instalments"
    // CTA stays visible until Mooov confirms cycle 1, so members can
    // retry cleanly.
    const activeSchedule =
      currentGiving != null
        ? givingSchedules.find(
            (s) =>
              s.member_giving_id === currentGiving.id &&
              s.cancelled_at == null &&
              s.status !== "cancelled" &&
              s.status !== "completed" &&
              s.status !== "pending"
          ) ?? null
        : null;
    let scheduleCard: {
      id: string;
      status: string;
      cadence: string;
      splitStrategy: string;
      autoRenew: boolean;
      cyclesTotal: number;
      cyclesPaid: number;
      cyclesOutstanding: number;
      nextChargeAt: string | null;
      nextAmount: number | null;
      lastChargedAt: string | null;
      consecutiveFailures: number;
      lastFailureCode: string | null;
      requiresAction: boolean;
      currency: string;
    } | null = null;
    if (activeSchedule && currentGiving) {
      const instalments = await db
        .getInstalmentsForGiving(currentGiving.id, member.church_id)
        .catch(() => []);
      const scoped = instalments.filter(
        (i) => i.schedule_id === activeSchedule.id
      );
      const paid = scoped.filter((i) => i.status === "paid");
      const outstanding = scoped
        .filter(
          (i) => i.status === "outstanding" || i.status === "overdue"
        )
        .sort((a, b) => a.sequence - b.sequence);
      scheduleCard = {
        id: activeSchedule.id,
        status: activeSchedule.status,
        cadence: activeSchedule.cadence,
        splitStrategy: activeSchedule.split_strategy,
        autoRenew: activeSchedule.auto_renew,
        cyclesTotal: scoped.length,
        cyclesPaid: paid.length,
        cyclesOutstanding: outstanding.length,
        nextChargeAt: activeSchedule.next_charge_at,
        nextAmount: outstanding[0]?.amount ?? null,
        lastChargedAt: activeSchedule.last_charged_at,
        consecutiveFailures: activeSchedule.consecutive_failures ?? 0,
        lastFailureCode: activeSchedule.last_failure_code ?? null,
        requiresAction: activeSchedule.status === "action_required",
        currency: (currentGiving.currency ?? "gbp").toUpperCase(),
      };
    }

    type ActivityItem = {
      id: string;
      type: "payment" | "event" | "donation";
      description: string;
      date: string;
      amount?: number;
      sortDate: string;
    };

    function formatDate(value: string | null): string {
      return value
        ? new Date(value).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Unknown";
    }

    const recentActivity: ActivityItem[] = [];

    payments.slice(0, 3).forEach((p) => {
      recentActivity.push({
        id: p.id,
        type: "payment",
        description: p.event_id ? "Event payment" : "Payment",
        date: formatDate(p.created_at),
        amount: p.total_amount,
        sortDate: p.created_at,
      });
    });

    donations.slice(0, 3).forEach((d) => {
      recentActivity.push({
        id: d.id,
        type: "donation",
        description: "Donation",
        date: formatDate(d.created_at),
        amount: d.amount,
        sortDate: d.created_at,
      });
    });

    rsvps.slice(0, 3).forEach((rsvp) => {
      const event = eventById.get(rsvp.event_id);
      recentActivity.push({
        id: rsvp.id,
        type: "event",
        description: `RSVP ${rsvp.status} for ${event?.title ?? "service"}`,
        date: formatDate(rsvp.created_at),
        sortDate: rsvp.created_at,
      });
    });

    recentActivity.sort((a, b) => {
      const da = new Date(a.sortDate).getTime() || 0;
      const db = new Date(b.sortDate).getTime() || 0;
      return db - da;
    });

    return NextResponse.json({
      user: {
        full_name: member.full_name,
        email: member.email,
        phone: member.phone,
        dietary_requirements: member.dietary_requirements,
        rank: member.rank,
        membership_status: member.membership_status,
        portal_token: member.portal_token,
      },
      churchSlug,
      nextEvent: nextEvent
        ? {
            id: nextEvent.id,
            title: nextEvent.title,
            slug: nextEvent.slug,
            event_date: nextEvent.event_date,
            event_time: nextEvent.event_time,
            location: nextEvent.location,
            dress_code: nextEvent.dress_code,
            enable_rsvp: nextEvent.enable_rsvp,
            enable_dining_rsvp: nextEvent.enable_dining_rsvp,
            dining_price: nextEvent.dining_price,
            current_rsvp: nextEventRsvp
              ? {
                  id: nextEventRsvp.id,
                  status: nextEventRsvp.status,
                  attending_ceremony: nextEventRsvp.attending_ceremony,
                  attending_dining: nextEventRsvp.attending_dining,
                }
              : null,
          }
        : null,
      upcomingEvents,
      outstandingGiving,
      recentPaymentsTotal,
      donationTotal,
      recentActivity: recentActivity.slice(0, 5).map((item) => ({
        id: item.id,
        type: item.type,
        description: item.description,
        date: item.date,
        amount: item.amount,
      })),
      noticeLinks: noticeLinks.slice(0, 6).map((link) => {
        const event = eventById.get(link.event_id);
        return {
          id: link.id,
          eventId: link.event_id,
          title: event?.title ?? "Service notice",
          eventDate: event?.event_date ?? null,
          sentAt: link.created_at,
          accessedAt: link.accessed_at,
          accessCount: link.access_count,
        };
      }),
      rsvps: rsvps.slice(0, 8).map((rsvp) => {
        const event = eventById.get(rsvp.event_id);
        return {
          id: rsvp.id,
          eventId: rsvp.event_id,
          eventTitle: event?.title ?? "Service",
          eventDate: event?.event_date ?? null,
          status: rsvp.status,
          attendingDining: rsvp.attending_dining,
          guests: rsvp.number_of_guests,
          dietary: rsvp.dietary_requirements,
          paymentRequired: rsvp.payment_required,
          paymentCompleted: rsvp.payment_completed,
        };
      }),
      notices: upcomingEventRows.slice(0, 4).map((event) => ({
        id: event.id,
        title: event.title,
        date: event.event_date,
        text: event.description ?? "Upcoming church service.",
      })),
      giving: currentGiving
        ? {
            annualAmount: currentGiving.amount,
            status: currentGiving.status,
            paidAmount: currentGiving.status === "paid" ? currentGiving.amount : paidAmount,
            dueDate: currentGiving.period_end,
            givingId: currentGiving.id,
            memberEmail: currentGiving.member_email,
            memberName: currentGiving.member_name ?? member.full_name,
            // allowInstalments is the AND of (church configured them) AND
            // (the platform-level subscription path is enabled). Hides
            // the "Set up instalments" CTA in the portal until Mooov has
            // shipped the saved-charge subscription contract to prod.
            allowInstalments:
              (givingConfig?.allow_instalments ?? false) &&
              givingSubscriptionEnabled(),
            instalmentCount: givingConfig?.instalment_count ?? 12,
            instalmentFrequency: givingConfig?.instalment_frequency ?? "monthly",
            yearPosition,
            yearLabel: currentChurchYear?.label ?? null,
            yearStart: currentChurchYear?.start_date ?? null,
            yearEnd: currentChurchYear?.end_date ?? null,
            strategies: givingConfig
              ? {
                  catch_up_lump_then_monthly:
                    givingConfig.enable_strategy_catch_up_lump,
                  monthly_then_balloon:
                    givingConfig.enable_strategy_balloon,
                  reslice_remaining: givingConfig.enable_strategy_reslice,
                }
              : null,
            catchUpMaxMonths: givingConfig?.catch_up_max_months ?? 6,
            advance: advanceCardEligible
              ? {
                  alreadyPaid: !!advanceForNextYear,
                  memberGivingId: advanceForNextYear?.id ?? null,
                  nextYearLabel: nextChurchYear?.label ?? null,
                  baseAmount: advanceBaseAmount,
                  discountPercent: advanceDiscountPct,
                  amount: advanceDiscountedAmount,
                  currency: givingConfig?.currency ?? "gbp",
                }
              : null,
            schedule: scheduleCard,
            history: paidGiving.map((d) => ({
              id: d.id,
              date: d.paid_at ?? d.updated_at,
              amount: d.amount,
              period: `${d.period_start} to ${d.period_end}`,
              method: d.stripe_subscription_id ? "Instalment" : "Card",
            })),
          }
        : null,
      payments: payments.map((p) => ({
        id: p.id,
        date: p.created_at,
        description: p.event_id ? "Event payment" : "Payment",
        amount: p.total_amount ?? 0,
        status: p.status ?? "completed",
        type: "event",
      })),
      donationData: {
        totalThisYear: donationTotal,
        giftAidDeclared: Boolean(activeGiftAidDeclaration),
        giftAidEvidenceSource: activeGiftAidDeclaration?.evidence_source ?? null,
        giftAidConsentStatus: member.gift_aid_consent_status ?? "unknown",
        giftAidPrompted: Boolean(member.gift_aid_prompted_at),
        donations: donations.map((d) => ({
          id: d.id,
          date: d.created_at,
          amount: d.amount ?? 0,
          fund: d.source ?? "General Fund",
          // Donation is Gift Aided when it was explicitly linked to a
          // declaration at projection time, or when an active declaration
          // exists for this member today (covers in-person cash entries
          // attributed to the member where the donation row may have been
          // inserted before the declaration was captured).
          giftAid:
            Boolean(d.gift_aid_declaration_id) ||
            (Boolean(giftAidDeclarationId) && d.gift_aid_status !== "declined"),
        })),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
