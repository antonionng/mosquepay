import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/api";
import { getAdminReadContext } from "@/lib/admin/read-context";
import {
  ADMIN_NOTIFICATION_EVENTS,
  ADMIN_NOTIFICATION_ROLES,
  listLodgeNotificationSettings,
  setLodgeNotificationSetting,
} from "@/lib/email/preferences";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function selectedLodgeId() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) return null;
  return ctx.lodgeId;
}

export async function GET() {
  const lodgeId = await selectedLodgeId();
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("admin:all", lodgeId);
  if (forbidden) return forbidden;

  const map = await listLodgeNotificationSettings(lodgeId);

  // Render the matrix the UI expects: for each event x role, true
  // unless an explicit row says otherwise.
  const matrix = ADMIN_NOTIFICATION_EVENTS.map((evt) => ({
    eventType: evt.eventType,
    label: evt.label,
    description: evt.description,
    roles: ADMIN_NOTIFICATION_ROLES.map((r) => {
      const explicit = map.get(`${r.role}::${evt.eventType}`);
      return {
        role: r.role,
        label: r.label,
        enabled: explicit ?? true,
      };
    }),
  }));

  return NextResponse.json({ events: matrix });
}

export async function POST(req: NextRequest) {
  const lodgeId = await selectedLodgeId();
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("admin:all", lodgeId);
  if (forbidden) return forbidden;

  let body: { role?: unknown; event_type?: unknown; enabled?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const role = typeof body.role === "string" ? body.role : "";
  const eventType = typeof body.event_type === "string" ? body.event_type : "";
  const enabled = body.enabled === true;

  const allowedRoles = new Set(ADMIN_NOTIFICATION_ROLES.map((r) => r.role));
  const allowedEvents = new Set(
    ADMIN_NOTIFICATION_EVENTS.map((e) => e.eventType),
  );
  if (!allowedRoles.has(role) || !allowedEvents.has(eventType)) {
    return NextResponse.json(
      { error: "Unknown role or event_type." },
      { status: 400 },
    );
  }

  await setLodgeNotificationSetting(lodgeId, role, eventType, enabled);
  await writeAuditLog({
    lodgeId,
    action: enabled ? "notification_enable" : "notification_disable",
    entityType: "lodge_notification_setting",
    entityId: `${role}::${eventType}`,
    summary: `Set ${role} notification for ${eventType} to ${enabled ? "on" : "off"}`,
    metadata: { role, event_type: eventType, enabled },
  });

  return NextResponse.json({ ok: true });
}
