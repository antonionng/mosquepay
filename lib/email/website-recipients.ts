import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import type { Lodge } from "@/lib/db/types";

const CONTACT_NOTIFICATION_EMAIL = "ag@experrt.com";

export async function getLodgeAdminNotificationRecipients(
  lodge: Pick<Lodge, "id" | "support_email"> | null,
  configuredRecipients?: string[] | null
) {
  const recipients = new Set<string>();

  configuredRecipients?.forEach((email) => recipients.add(email.trim().toLowerCase()));

  if (lodge?.id && isSupabaseConfigured()) {
    const admins = await db.listAdminUsersForLodge(lodge.id);
    admins
      .filter((admin) => admin.active && admin.lodge_id === lodge.id)
      .forEach((admin) => recipients.add(admin.email.trim().toLowerCase()));
  }

  if (lodge?.support_email) {
    recipients.add(lodge.support_email.trim().toLowerCase());
  }

  if (recipients.size === 0) {
    recipients.add(CONTACT_NOTIFICATION_EMAIL);
  }

  return Array.from(recipients);
}
