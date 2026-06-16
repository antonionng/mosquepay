export type MosqueFeeDefaults = {
  default_member_levy_amount: number | null;
  default_member_dining_amount: number | null;
  default_guest_dining_amount: number | null;
  currency: string;
};

export type MemberFeeProfile = {
  member_levy_amount?: number | null;
  member_dining_amount?: number | null;
  levy_waived?: boolean;
  dining_waived?: boolean;
  fee_use_custom?: boolean;
};

export type GuestFeeProfile = {
  guest_dining_amount?: number | null;
  dining_waived?: boolean;
};

export type EventFeeContext = {
  enable_service_fee?: boolean;
  service_fee_amount?: number | null;
  enable_dining_rsvp?: boolean;
  dining_price?: number | null;
  enable_guest_tickets?: boolean;
  guest_ticket_price?: number | null;
  /** Event-wide override: when true every member/guest dines complimentary. */
  dining_waived_for_all?: boolean;
};

/**
 * Per-recipient override that takes precedence over both the mosque default
 * and the profile-level levy_waived/dining_waived flags. Lets a treasurer
 * mark "for this one service only" adjustments from the recipients panel.
 */
export type EventFeeOverride = {
  levy_amount?: number | null;
  dining_amount?: number | null;
  levy_waived?: boolean;
  dining_waived?: boolean;
};

function toAmount(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value);
}

export function resolveMemberLevy(
  member: MemberFeeProfile | null | undefined,
  event: EventFeeContext,
  defaults: MosqueFeeDefaults | null | undefined,
  override?: EventFeeOverride | null
): number {
  if (override?.levy_waived) return 0;
  if (override?.levy_amount != null) return toAmount(override.levy_amount) ?? 0;
  if (member?.levy_waived) return 0;
  if (!event.enable_service_fee) return 0;

  if (member?.fee_use_custom) {
    const custom = toAmount(member.member_levy_amount);
    if (custom != null) return custom;
  }

  const eventAmount = toAmount(event.service_fee_amount);
  if (eventAmount != null) return eventAmount;

  return toAmount(defaults?.default_member_levy_amount) ?? 0;
}

export function resolveMemberDining(
  member: MemberFeeProfile | null | undefined,
  event: EventFeeContext,
  defaults: MosqueFeeDefaults | null | undefined,
  attendingDining: boolean,
  override?: EventFeeOverride | null
): number {
  if (!attendingDining || !event.enable_dining_rsvp) return 0;
  if (event.dining_waived_for_all) return 0;
  if (override?.dining_waived) return 0;
  if (override?.dining_amount != null) {
    return toAmount(override.dining_amount) ?? 0;
  }
  if (member?.dining_waived) return 0;

  if (member?.fee_use_custom) {
    const custom = toAmount(member.member_dining_amount);
    if (custom != null) return custom;
  }

  const eventAmount = toAmount(event.dining_price);
  if (eventAmount != null) return eventAmount;

  return toAmount(defaults?.default_member_dining_amount) ?? 0;
}

export function resolveGuestDining(
  guest: GuestFeeProfile | null | undefined,
  event: EventFeeContext,
  defaults: MosqueFeeDefaults | null | undefined,
  override?: EventFeeOverride | null
): number {
  if (!event.enable_guest_tickets && !event.enable_dining_rsvp) return 0;
  if (event.dining_waived_for_all) return 0;
  if (override?.dining_waived) return 0;
  if (override?.dining_amount != null) {
    return toAmount(override.dining_amount) ?? 0;
  }
  if (guest?.dining_waived) return 0;

  const custom = toAmount(guest?.guest_dining_amount);
  if (custom != null) return custom;

  const ticketPrice = toAmount(event.guest_ticket_price);
  if (ticketPrice != null) return ticketPrice;

  return toAmount(defaults?.default_guest_dining_amount) ?? 0;
}

export type FeeLineItem = {
  key: string;
  label: string;
  amount: number;
  waived?: boolean;
};

export function buildMemberFeeBreakdown(args: {
  member: MemberFeeProfile | null | undefined;
  event: EventFeeContext;
  defaults: MosqueFeeDefaults | null | undefined;
  attendingCeremony: boolean;
  attendingDining: boolean;
  memberOverride?: EventFeeOverride | null;
  guests?: Array<{
    name: string;
    profile?: GuestFeeProfile | null;
    override?: EventFeeOverride | null;
  }>;
}): { items: FeeLineItem[]; total: number } {
  const items: FeeLineItem[] = [];

  const levy = args.attendingCeremony
    ? resolveMemberLevy(args.member, args.event, args.defaults, args.memberOverride)
    : 0;
  const memberLevyWaived =
    args.memberOverride?.levy_waived === true || args.member?.levy_waived === true;
  if (levy > 0 || memberLevyWaived) {
    items.push({
      key: "levy",
      label: "Member service levy",
      amount: levy,
      waived: memberLevyWaived,
    });
  }

  const dining = resolveMemberDining(
    args.member,
    args.event,
    args.defaults,
    args.attendingDining,
    args.memberOverride
  );
  const memberDiningWaived =
    args.event.dining_waived_for_all === true ||
    args.memberOverride?.dining_waived === true ||
    args.member?.dining_waived === true;
  if (dining > 0 || memberDiningWaived) {
    items.push({
      key: "dining",
      label: "Member dining",
      amount: dining,
      waived: memberDiningWaived,
    });
  }

  for (const guest of args.guests ?? []) {
    const amount = resolveGuestDining(
      guest.profile,
      args.event,
      args.defaults,
      guest.override
    );
    const guestWaived =
      args.event.dining_waived_for_all === true ||
      guest.override?.dining_waived === true ||
      guest.profile?.dining_waived === true;
    items.push({
      key: `guest:${guest.name}`,
      label: `Guest dining – ${guest.name}`,
      amount,
      waived: guestWaived,
    });
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return { items, total };
}

export function formatFeeLabel(item: FeeLineItem): string {
  if (item.waived && item.amount === 0) {
    return `${item.label} (complimentary)`;
  }
  return item.label;
}

/**
 * Resolve the amount that will actually be charged for a fee, given a
 * possible per-event override and the mosque-level default. Returns null when
 * no value is available anywhere (caller decides whether that is an error).
 *
 * Mirrors the resolver precedence: explicit event amount → mosque default.
 * Treats `0` on the event as an intentional override (zero is still a price),
 * and only falls through to the default when the event value is null/undefined.
 */
export function resolveEffectiveAmount(
  eventAmount: number | null | undefined,
  defaultAmount: number | null | undefined
): number | null {
  const ev = toAmount(eventAmount ?? null);
  if (ev != null) return ev;
  const def = toAmount(defaultAmount ?? null);
  return def;
}
