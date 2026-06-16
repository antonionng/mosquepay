// lib/email/recipients.ts
//
// One place to resolve "who gets the treasurer / secretary email"
// for a given mosque. Every notification sender used to either
// hardcode a single address or skip the problem entirely; with the
// admin_users table already in place this can be centralised.
//
// The helper respects mosque_notification_settings (added in
// migration 064) so a treasurer can mute "new subscription enrolled"
// without losing the more critical "subscription failed" alert. The
// kill-switch row (role='__all__') is honoured first.

import * as db from "@/lib/db";
import type { AdminUser } from "@/lib/db/types";

export type TreasurerRecipient = {
  email: string;
  fullName: string | null;
  role: string;
  adminUserId: string | null;
};

/**
 * Every admin role that can be considered for finance / membership
 * notifications. Treasurer + secretary are the obvious ones; we also
 * include master and the wider leadership roles so a mosque that has
 * delegated visibility (e.g. an pastoral_care who tracks subscriptions for
 * pastoral context, or the charity steward when charitable Gift Aid
 * is involved) doesn't have to chase a treasurer for an update.
 *
 * This is the broad "could be notified" gate; per-event muting is
 * handled in mosque_notification_settings via the admin Settings UI.
 */
const ADMIN_NOTIFY_ROLES = new Set<string>([
  "treasurer",
  "secretary",
  "master",
  "charity_steward",
  "membership_officer",
  "pastoral_care",
  "super_admin",
  "operator",
  "platform_owner",
]);

/**
 * Returns the active admin users for a mosque whose role makes them a
 * newcomer for treasurer-style finance notifications. We include
 * super_admin / platform_owner as a fallback so a brand-new mosque
 * without a designated treasurer still has a human in the loop.
 *
 * Filtered to the specific mosque first (no cross-mosque leakage), then
 * enriched with the mosque's notification settings: any admin whose
 * role is muted for `eventType` (or covered by the mosque-wide
 * '__all__' kill-switch) is dropped from the list.
 */
export async function resolveTreasurerRecipients(
  mosqueId: string,
  eventType: string,
): Promise<TreasurerRecipient[]> {
  let admins: AdminUser[];
  try {
    admins = await db.listAdminUsersForMosque(mosqueId);
  } catch (err) {
    console.error("resolveTreasurerRecipients: listAdminUsersForMosque failed", {
      mosque_id: mosqueId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  // Cache notificationEnabled lookups by role for this call so we
  // don't re-hit the table per admin.
  const enabledByRole = new Map<string, boolean>();
  async function isEnabled(role: string): Promise<boolean> {
    if (enabledByRole.has(role)) return enabledByRole.get(role)!;
    const enabled = await db.notificationEnabled(mosqueId, role, eventType);
    enabledByRole.set(role, enabled);
    return enabled;
  }

  const out: TreasurerRecipient[] = [];
  for (const a of admins) {
    if (a.active === false) continue;
    if (!a.email) continue;
    if (!ADMIN_NOTIFY_ROLES.has(a.role)) continue;
    // Tenant safety: mosque-scoped admins must match this mosque. The
    // listAdminUsersForMosque query already returns either matches or
    // global-scope (mosque_id=null) rows; we keep the global ones too
    // so platform owners receive notifications when nobody else is
    // configured.
    if (a.mosque_id != null && a.mosque_id !== mosqueId) continue;
    if (!(await isEnabled(a.role))) continue;
    out.push({
      email: a.email,
      fullName: a.full_name ?? null,
      role: a.role,
      adminUserId: a.id,
    });
  }
  // Dedupe by email — a person who sits as both secretary and
  // platform_owner shouldn't get two copies.
  const seen = new Set<string>();
  return out.filter((r) => {
    const k = r.email.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
