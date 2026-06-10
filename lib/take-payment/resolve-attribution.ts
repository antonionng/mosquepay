// Resolve payer attribution for a take-payment entry.
//
// Used by both /api/admin/take-payment (QR) and /api/admin/take-payment/cash.
// Handles three flavours of payer:
//
//   1. Member         — `member_id` set; resolves Churchpay member + GA decl.
//   2. Existing guest — `guest_id` set; resolves the guest directory row.
//   3. Inline guest   — `guest_inline = { full_name, email?, phone?, … }`;
//                       upserts into the guest directory (matches by email
//                       first, then name + mother church) so repeated visits
//                       attach to the same record.
//   4. Anonymous      — none of the above; payer attribution is null.
//
// Returns a single shape so the downstream projector + receipt code don't
// need to care which path produced the data. Best-effort: any lookup failing
// returns nulls so the treasurer can still take the payment and re-attach
// attribution later.

import * as db from "@/lib/db";

export type AttributionKind = "member" | "guest" | "anonymous";

export type Attribution = {
  kind: AttributionKind;
  memberId: string | null;
  guestId: string | null;
  payerName: string | null;
  payerEmail: string | null;
  payerPhone: string | null;
  motherChurchName: string | null;
  motherChurchNumber: string | null;
  giftAidDeclarationId: string | null;
  giftAidEligible: boolean;
  giftAidRefused: boolean;
};

export type GuestInlineInput = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  mother_church_name?: string | null;
  mother_church_number?: string | null;
};

export type ResolveInput = {
  memberId?: string | null;
  guestId?: string | null;
  guestInline?: GuestInlineInput | null;
};

const EMPTY: Attribution = {
  kind: "anonymous",
  memberId: null,
  guestId: null,
  payerName: null,
  payerEmail: null,
  payerPhone: null,
  motherChurchName: null,
  motherChurchNumber: null,
  giftAidDeclarationId: null,
  giftAidEligible: false,
  giftAidRefused: false,
};

async function resolveGiftAid(
  churchId: string,
  email: string | null,
): Promise<{
  giftAidDeclarationId: string | null;
  giftAidEligible: boolean;
}> {
  if (!email) {
    return { giftAidDeclarationId: null, giftAidEligible: false };
  }
  try {
    const declaration = await db.getActiveGiftAidDeclarationByEmail(
      churchId,
      email,
    );
    if (declaration) {
      return {
        giftAidDeclarationId: declaration.id,
        giftAidEligible: true,
      };
    }
  } catch (err) {
    console.warn(
      "take-payment attribution: gift aid declaration lookup failed",
      {
        church_id: churchId,
        email,
        message: err instanceof Error ? err.message : String(err),
      },
    );
  }
  return { giftAidDeclarationId: null, giftAidEligible: false };
}

export async function resolveTakePaymentAttribution(
  churchId: string,
  input: ResolveInput | string | null | undefined,
): Promise<Attribution> {
  // Backwards-compatible signature: callers used to pass a raw memberId
  // string. New callers pass an object with the richer payload.
  const normalised: ResolveInput =
    typeof input === "string"
      ? { memberId: input }
      : input ?? {};

  // 1. Member path.
  if (normalised.memberId) {
    try {
      const member = await db.getMemberById(normalised.memberId, churchId);
      if (member) {
        const giftAidRefused = member.gift_aid_consent_status === "declined";
        const ga = giftAidRefused
          ? { giftAidDeclarationId: null, giftAidEligible: false }
          : await resolveGiftAid(churchId, member.email ?? null);
        return {
          kind: "member",
          memberId: normalised.memberId,
          guestId: null,
          payerName: member.full_name ?? null,
          payerEmail: member.email ?? null,
          payerPhone: null,
          motherChurchName: null,
          motherChurchNumber: null,
          giftAidRefused,
          ...ga,
        };
      }
    } catch (err) {
      console.warn("take-payment attribution: member lookup failed", {
        church_id: churchId,
        member_id: normalised.memberId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return { ...EMPTY, memberId: normalised.memberId };
  }

  // 2. Existing guest path.
  if (normalised.guestId) {
    try {
      const guest = await db.getGuestById(normalised.guestId, churchId);
      if (guest) {
        const giftAidRefused = guest.gift_aid_consent_status === "declined";
        const ga = giftAidRefused
          ? { giftAidDeclarationId: null, giftAidEligible: false }
          : await resolveGiftAid(churchId, guest.email ?? null);
        return {
          kind: "guest",
          memberId: null,
          guestId: guest.id,
          payerName: guest.full_name,
          payerEmail: guest.email ?? null,
          payerPhone: guest.phone ?? null,
          motherChurchName: guest.mother_church_name ?? null,
          motherChurchNumber: guest.mother_church_number ?? null,
          giftAidRefused,
          ...ga,
        };
      }
    } catch (err) {
      console.warn("take-payment attribution: guest lookup failed", {
        church_id: churchId,
        guest_id: normalised.guestId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return { ...EMPTY, guestId: normalised.guestId };
  }

  // 3. Inline guest — find-or-create, then attribute. Find-by-email first
  // because a single guest can change name styling but rarely changes email;
  // fall back to name + mother church so a repeat in-person newcomer without
  // an email doesn't get duplicated each time.
  if (normalised.guestInline && normalised.guestInline.full_name) {
    const inline = normalised.guestInline;
    try {
      let guest = null;
      if (inline.email) {
        guest = await db.findGuestByEmail(churchId, inline.email);
      }
      if (!guest) {
        guest = await db.findGuestByNameAndChurch(
          churchId,
          inline.full_name,
          inline.mother_church_name ?? null,
        );
      }
      if (!guest) {
        guest = await db.createGuest(churchId, {
          full_name: inline.full_name,
          email: inline.email ?? null,
          phone: inline.phone ?? null,
          mother_church_name: inline.mother_church_name ?? null,
          mother_church_number: inline.mother_church_number ?? null,
          is_member: true,
          source: "admin",
          guest_category: "guest",
        });
      }
      if (guest) {
        const giftAidRefused = guest.gift_aid_consent_status === "declined";
        const ga = giftAidRefused
          ? { giftAidDeclarationId: null, giftAidEligible: false }
          : await resolveGiftAid(churchId, guest.email ?? null);
        return {
          kind: "guest",
          memberId: null,
          guestId: guest.id,
          payerName: guest.full_name,
          payerEmail: guest.email ?? null,
          payerPhone: guest.phone ?? null,
          motherChurchName: guest.mother_church_name ?? null,
          motherChurchNumber: guest.mother_church_number ?? null,
          giftAidRefused,
          ...ga,
        };
      }
    } catch (err) {
      console.warn("take-payment attribution: inline guest upsert failed", {
        church_id: churchId,
        full_name: inline.full_name,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    // Couldn't upsert — fall back to a name-only anonymous so the payment
    // can still record SOMETHING attributable on the row.
    return {
      ...EMPTY,
      payerName: inline.full_name,
      payerEmail: inline.email ?? null,
      payerPhone: inline.phone ?? null,
      motherChurchName: inline.mother_church_name ?? null,
      motherChurchNumber: inline.mother_church_number ?? null,
    };
  }

  // 4. Anonymous.
  return { ...EMPTY };
}
