import * as db from "@/lib/db";
import type { Event } from "@/lib/db/types";
import {
  buildMemberFeeBreakdown,
  resolveGuestDining,
  type MosqueFeeDefaults,
} from "@/lib/fees/resolve";

export async function resolveCheckoutFeesForMember(args: {
  mosqueId: string;
  event: Event;
  memberEmail: string;
  attendingCeremony: boolean;
  attendingDining: boolean;
  guests: Array<{ guest_name: string }>;
}) {
  const [member, defaults, overrides] = await Promise.all([
    db.getMemberByEmail(args.memberEmail, args.mosqueId),
    db.getMosqueFeeDefaults(args.mosqueId),
    db.listEventFeeOverrides(args.mosqueId, args.event.id),
  ]);

  const memberOverride = member
    ? overrides.find(
        (o) => o.subject_type === "member" && o.subject_id === member.id
      ) ?? null
    : null;

  const guestProfiles = args.guests.map((g) => ({
    name: g.guest_name,
    profile: null as { dining_waived?: boolean; guest_dining_amount?: number | null } | null,
  }));

  const breakdown = buildMemberFeeBreakdown({
    member: member ?? undefined,
    event: args.event,
    defaults: defaults as MosqueFeeDefaults | null,
    attendingCeremony: args.attendingCeremony,
    attendingDining: args.attendingDining,
    memberOverride,
    guests: args.attendingCeremony ? guestProfiles : [],
  });

  const serviceFee = breakdown.items.find((i) => i.key === "levy")?.amount ?? 0;
  const diningItem = breakdown.items.find((i) => i.key === "dining");
  const diningTotal = diningItem?.amount ?? 0;
  const guestTotal = breakdown.items
    .filter((i) => i.key.startsWith("guest:"))
    .reduce((s, i) => s + i.amount, 0);

  return {
    serviceFee,
    diningTotal,
    guestTotal,
    total: breakdown.total,
    items: breakdown.items,
    perGuestDefault: resolveGuestDining(null, args.event, defaults),
  };
}
