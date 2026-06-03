// Shared attendance predicate so the meeting detail screen and the printable
// treasurer report agree on who counts as "attending". A confirmed RSVP is
// one that isn't mid-checkout, isn't cancelled, and (when payment was
// required) has actually been paid.

export type RsvpLike = {
  status?: string | null;
  payment_required?: boolean | null;
  payment_completed?: boolean | null;
};

export function isConfirmedRsvp(rsvp: RsvpLike): boolean {
  if (rsvp.status === "payment_pending") return false;
  if (rsvp.status === "cancelled") return false;
  if (rsvp.payment_required && !rsvp.payment_completed) return false;
  return true;
}
