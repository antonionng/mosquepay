import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";
import { computeYearPosition } from "@/lib/dues/year-position";
import { duesSubscriptionEnabled } from "@/lib/dues/feature-flags";

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
      (await db.getMemberByEmailAcrossLodges(memberEmail));

    if (!member) {
      return NextResponse.json({
        user: {
          full_name: user.user_metadata?.full_name ?? null,
          email: user.email,
        },
        lodgeSlug: null,
        upcomingEvents: 0,
        outstandingDues: 0,
        recentPaymentsTotal: 0,
        donationTotal: 0,
        recentActivity: [],
        dues: null,
        payments: [],
        donationData: {
          totalThisYear: 0,
          giftAidDeclared: false,
          donations: [],
        },
      });
    }

    // Look up the lodge slug so the client can build cross-tenant URLs
    // (e.g. /donate?lodge=<slug>) that work whether the member is on the
    // lodge subdomain or the bare host. Tolerate a lookup failure --
    // the dashboard doesn't depend on this and the donate page will fall
    // back to host/cookie resolution.
    let lodgeSlug: string | null = null;
    try {
      const lodge = await db.getLodgeById(member.lodge_id);
      lodgeSlug = lodge?.slug ?? null;
    } catch {
      // non-fatal
    }

    const [upcomingEventRows, allEvents, payments, donations, duesRecords, lodgeDues, rsvps, summonsLinks, activeGiftAidDeclaration, currentMasonicYear, allMasonicYears, duesSchedules] = await Promise.all([
      db.getEvents(member.lodge_id, { published: true, upcoming: true }),
      db.getEvents(member.lodge_id, { published: true }),
      db.getPaymentsByEmail(member.email, member.lodge_id),
      db.getDonationsByEmail(member.email, member.lodge_id),
      db.getMemberDues(member.lodge_id, { memberEmail: member.email }),
      db.getLodgeDues(member.lodge_id),
      db.getRsvpsByEmail(member.email, member.lodge_id),
      db.getSummonsAccessLinksByEmail(member.email, member.lodge_id),
      db
        .getActiveGiftAidDeclarationByMember(member.lodge_id, {
          id: member.id,
          email: member.email,
        })
        .catch(() => null),
      db.getCurrentMasonicYear(member.lodge_id).catch(() => null),
      db.listLodgeMasonicYears(member.lodge_id).catch(() => []),
      db.getDuesSchedulesForMember(member.lodge_id, member.email).catch(() => []),
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

    const unpaidDues = duesRecords.filter(
      (d) => d.status !== "paid" && !d.is_advance
    );
    const paidDues = duesRecords.filter((d) => d.status === "paid");
    const advanceDues = duesRecords.filter((d) => d.is_advance);
    const outstandingDues = unpaidDues.reduce((sum, d) => sum + (d.amount ?? 0), 0);
    const currentDues = unpaidDues[0] ?? duesRecords.find((d) => !d.is_advance) ?? null;
    const duesConfig = lodgeDues[0] ?? null;
    const paidAmount = paidDues.reduce((sum, d) => sum + (d.amount ?? 0), 0);

    // Resolve year position for the dues UX router on the member portal.
    // Defaults are safe for lodges that haven't configured a masonic year:
    // we omit `yearPosition` and the portal falls back to the legacy view.
    const yearPosition = currentMasonicYear
      ? computeYearPosition({
          yearStartDate: currentMasonicYear.start_date,
          yearEndDate: currentMasonicYear.end_date,
          dateOfInitiation: member.date_of_initiation ?? null,
          hasPaidCurrentYear:
            !!currentDues && currentDues.status === "paid",
          hasOutstandingCurrentYear:
            !!currentDues &&
            currentDues.status !== "paid" &&
            currentDues.status !== "waived",
        })
      : null;

    // Resolve next masonic year for the pay-in-advance card. Only surfaced
    // when (a) the lodge has more than one masonic year row configured or
    // we can synthesise next year's bounds from the current one, AND (b)
    // the member is paid up for current year.
    const nextMasonicYear = currentMasonicYear
      ? allMasonicYears.find(
          (y) =>
            y.start_date.slice(0, 10) >
            currentMasonicYear.end_date.slice(0, 10)
        ) ?? null
      : null;
    const advanceForNextYear = nextMasonicYear
      ? advanceDues.find((d) => d.advance_for_year_id === nextMasonicYear.id) ??
        null
      : null;
    const advanceCardEligible =
      !!yearPosition &&
      yearPosition.quadrant === "paid_up_current_year" &&
      !!duesConfig &&
      duesConfig.active === true;
    const advanceBaseAmount =
      nextMasonicYear?.annual_dues_amount ??
      duesConfig?.amount ??
      currentMasonicYear?.annual_dues_amount ??
      null;
    const advanceDiscountPct = duesConfig?.advance_discount_percent ?? 0;
    const advanceDiscountedAmount =
      advanceBaseAmount != null
        ? Math.round(advanceBaseAmount * (1 - advanceDiscountPct / 100) * 100) /
          100
        : null;

    // Active dues schedule (saved-charge subscription OR Mooov-branded
    // subscription_checkout). Surfaced as a status card with a cancel
    // button + an SCA resume CTA when the last cycle returned
    // requires_action. We only consider schedules tied to the
    // current-year dues record so a paused/cancelled last-year schedule
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
      currentDues != null
        ? duesSchedules.find(
            (s) =>
              s.member_dues_id === currentDues.id &&
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
    if (activeSchedule && currentDues) {
      const instalments = await db
        .getInstalmentsForDues(currentDues.id, member.lodge_id)
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
        currency: (currentDues.currency ?? "gbp").toUpperCase(),
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
        description: `RSVP ${rsvp.status} for ${event?.title ?? "meeting"}`,
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
      lodgeSlug,
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
      outstandingDues,
      recentPaymentsTotal,
      donationTotal,
      recentActivity: recentActivity.slice(0, 5).map((item) => ({
        id: item.id,
        type: item.type,
        description: item.description,
        date: item.date,
        amount: item.amount,
      })),
      summonsLinks: summonsLinks.slice(0, 6).map((link) => {
        const event = eventById.get(link.event_id);
        return {
          id: link.id,
          eventId: link.event_id,
          title: event?.title ?? "Meeting summons",
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
          eventTitle: event?.title ?? "Meeting",
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
        text: event.description ?? "Upcoming lodge meeting.",
      })),
      dues: currentDues
        ? {
            annualAmount: currentDues.amount,
            status: currentDues.status,
            paidAmount: currentDues.status === "paid" ? currentDues.amount : paidAmount,
            dueDate: currentDues.period_end,
            duesId: currentDues.id,
            memberEmail: currentDues.member_email,
            memberName: currentDues.member_name ?? member.full_name,
            // allowInstalments is the AND of (lodge configured them) AND
            // (the platform-level subscription path is enabled). Hides
            // the "Set up instalments" CTA in the portal until Mooov has
            // shipped the saved-charge subscription contract to prod.
            allowInstalments:
              (duesConfig?.allow_instalments ?? false) &&
              duesSubscriptionEnabled(),
            instalmentCount: duesConfig?.instalment_count ?? 12,
            instalmentFrequency: duesConfig?.instalment_frequency ?? "monthly",
            yearPosition,
            yearLabel: currentMasonicYear?.label ?? null,
            yearStart: currentMasonicYear?.start_date ?? null,
            yearEnd: currentMasonicYear?.end_date ?? null,
            strategies: duesConfig
              ? {
                  catch_up_lump_then_monthly:
                    duesConfig.enable_strategy_catch_up_lump,
                  monthly_then_balloon:
                    duesConfig.enable_strategy_balloon,
                  reslice_remaining: duesConfig.enable_strategy_reslice,
                }
              : null,
            catchUpMaxMonths: duesConfig?.catch_up_max_months ?? 6,
            advance: advanceCardEligible
              ? {
                  alreadyPaid: !!advanceForNextYear,
                  memberDuesId: advanceForNextYear?.id ?? null,
                  nextYearLabel: nextMasonicYear?.label ?? null,
                  baseAmount: advanceBaseAmount,
                  discountPercent: advanceDiscountPct,
                  amount: advanceDiscountedAmount,
                  currency: duesConfig?.currency ?? "gbp",
                }
              : null,
            schedule: scheduleCard,
            history: paidDues.map((d) => ({
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
