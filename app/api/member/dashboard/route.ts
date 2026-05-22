import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";

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

    const [upcomingEventRows, allEvents, payments, donations, duesRecords, lodgeDues, rsvps, summonsLinks] = await Promise.all([
      db.getEvents(member.lodge_id, { published: true, upcoming: true }),
      db.getEvents(member.lodge_id, { published: true }),
      db.getPaymentsByEmail(member.email, member.lodge_id),
      db.getDonationsByEmail(member.email, member.lodge_id),
      db.getMemberDues(member.lodge_id, { memberEmail: member.email }),
      db.getLodgeDues(member.lodge_id),
      db.getRsvpsByEmail(member.email, member.lodge_id),
      db.getSummonsAccessLinksByEmail(member.email, member.lodge_id),
    ]);

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

    const unpaidDues = duesRecords.filter((d) => d.status !== "paid");
    const paidDues = duesRecords.filter((d) => d.status === "paid");
    const outstandingDues = unpaidDues.reduce((sum, d) => sum + (d.amount ?? 0), 0);
    const currentDues = unpaidDues[0] ?? duesRecords[0] ?? null;
    const duesConfig = lodgeDues[0] ?? null;
    const paidAmount = paidDues.reduce((sum, d) => sum + (d.amount ?? 0), 0);

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
            allowInstalments: duesConfig?.allow_instalments ?? false,
            instalmentCount: duesConfig?.instalment_count ?? 12,
            instalmentFrequency: duesConfig?.instalment_frequency ?? "monthly",
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
        giftAidDeclared: false,
        donations: donations.map((d) => ({
          id: d.id,
          date: d.created_at,
          amount: d.amount ?? 0,
          fund: d.source ?? "General Fund",
          giftAid: false,
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
