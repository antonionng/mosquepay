import type {
  Event,
  EventFeeOverride,
  Guest,
  Member,
} from "@/lib/db/types";
import type { LodgeFeeDefaults } from "@/lib/fees/resolve";
import {
  resolveGuestDining,
  resolveMemberDining,
  resolveMemberLevy,
} from "@/lib/fees/resolve";

export type RecipientOverrideSource = "none" | "event" | "profile" | "event_wide";

export type RecipientPreviewRow = {
  id: string;
  type: "member" | "honorary_guest";
  name: string;
  email: string | null;
  levy: number;
  dining: number;
  levy_waived: boolean;
  dining_waived: boolean;
  /** Where the levy resolution came from for this recipient. */
  levy_source: RecipientOverrideSource;
  /** Where the dining resolution came from for this recipient. */
  dining_source: RecipientOverrideSource;
  /** Optional treasurer note attached to a per-event override. */
  override_note: string | null;
  guest_category?: string;
};

function pickOverride(
  overrides: EventFeeOverride[] | undefined,
  subjectType: "member" | "guest",
  subjectId: string
): EventFeeOverride | null {
  if (!overrides) return null;
  return (
    overrides.find(
      (o) => o.subject_type === subjectType && o.subject_id === subjectId
    ) ?? null
  );
}

export function buildRecipientsPreview(args: {
  members: Member[];
  honoraryGuests: Guest[];
  event: Event;
  defaults: LodgeFeeDefaults | null;
  includeMembers: boolean;
  includeHonoraryGuests: boolean;
  overrides?: EventFeeOverride[];
}): {
  members: RecipientPreviewRow[];
  honoraryGuests: RecipientPreviewRow[];
  totals: { levy: number; dining: number; count: number };
} {
  const eventWide = args.event.dining_waived_for_all === true;

  const memberRows: RecipientPreviewRow[] = args.includeMembers
    ? args.members.map((member) => {
        const override = pickOverride(args.overrides, "member", member.id);
        const levy = resolveMemberLevy(member, args.event, args.defaults, override);
        const dining = resolveMemberDining(
          member,
          args.event,
          args.defaults,
          true,
          override
        );
        const levySource: RecipientOverrideSource =
          override && (override.levy_waived || override.levy_amount != null)
            ? "event"
            : member.levy_waived
              ? "profile"
              : "none";
        const diningSource: RecipientOverrideSource = eventWide
          ? "event_wide"
          : override && (override.dining_waived || override.dining_amount != null)
            ? "event"
            : member.dining_waived
              ? "profile"
              : "none";
        return {
          id: member.id,
          type: "member",
          name: member.full_name,
          email: member.email,
          levy,
          dining,
          levy_waived:
            override?.levy_waived === true || member.levy_waived === true,
          dining_waived:
            eventWide ||
            override?.dining_waived === true ||
            member.dining_waived === true,
          levy_source: levySource,
          dining_source: diningSource,
          override_note: override?.note ?? null,
        };
      })
    : [];

  const guestRows: RecipientPreviewRow[] = args.includeHonoraryGuests
    ? args.honoraryGuests.map((guest) => {
        const override = pickOverride(args.overrides, "guest", guest.id);
        const dining = resolveGuestDining(
          guest,
          args.event,
          args.defaults,
          override
        );
        const diningSource: RecipientOverrideSource = eventWide
          ? "event_wide"
          : override && (override.dining_waived || override.dining_amount != null)
            ? "event"
            : guest.dining_waived
              ? "profile"
              : "none";
        return {
          id: guest.id,
          type: "honorary_guest",
          name: guest.full_name,
          email: guest.email,
          levy: 0,
          dining,
          levy_waived: false,
          dining_waived:
            eventWide ||
            override?.dining_waived === true ||
            guest.dining_waived === true,
          levy_source: "none",
          dining_source: diningSource,
          override_note: override?.note ?? null,
          guest_category: guest.guest_category,
        };
      })
    : [];

  const all = [...memberRows, ...guestRows];
  return {
    members: memberRows,
    honoraryGuests: guestRows,
    totals: {
      levy: all.reduce((s, r) => s + r.levy, 0),
      dining: all.reduce((s, r) => s + r.dining, 0),
      count: all.length,
    },
  };
}

export function meetingFormFromLodgeDefaults(fees: {
  default_member_levy_amount?: number | null;
  default_member_dining_amount?: number | null;
  default_guest_dining_amount?: number | null;
}): {
  enable_meeting_fee: boolean;
  meeting_fee_amount: string;
  enable_guest_tickets: boolean;
  guest_ticket_price: string;
  enable_dining_rsvp: boolean;
  dining_price: string;
  enable_payments: boolean;
} {
  const fmt = (n: number | null | undefined) =>
    n != null && Number.isFinite(Number(n)) ? Number(n).toFixed(2) : "";

  const hasLevy = fees.default_member_levy_amount != null;
  const hasGuest = fees.default_guest_dining_amount != null;
  const hasDining = fees.default_member_dining_amount != null;

  return {
    enable_meeting_fee: hasLevy,
    meeting_fee_amount: fmt(fees.default_member_levy_amount),
    enable_guest_tickets: hasGuest,
    guest_ticket_price: fmt(fees.default_guest_dining_amount),
    enable_dining_rsvp: hasDining,
    dining_price: fmt(fees.default_member_dining_amount),
    enable_payments: hasLevy || hasGuest || hasDining,
  };
}
