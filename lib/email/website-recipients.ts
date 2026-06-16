import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import type { Mosque } from "@/lib/db/types";

const CONTACT_NOTIFICATION_EMAIL = "ag@experrt.com";

export async function getMosqueAdminNotificationRecipients(
  mosque: Pick<Mosque, "id" | "support_email"> | null,
  configuredRecipients?: string[] | null
) {
  const recipients = new Set<string>();

  configuredRecipients?.forEach((email) => recipients.add(email.trim().toLowerCase()));

  if (mosque?.id && isSupabaseConfigured()) {
    const admins = await db.listAdminUsersForMosque(mosque.id);
    admins
      .filter((admin) => admin.active && admin.mosque_id === mosque.id)
      .forEach((admin) => recipients.add(admin.email.trim().toLowerCase()));
  }

  if (mosque?.support_email) {
    recipients.add(mosque.support_email.trim().toLowerCase());
  }

  if (recipients.size === 0) {
    recipients.add(CONTACT_NOTIFICATION_EMAIL);
  }

  return Array.from(recipients);
}
