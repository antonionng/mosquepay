import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AiAssistantClient } from "./ai-client";

export const dynamic = "force-dynamic";

export default async function AiAssistantPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    redirect("/admin");
  }
  const events = await db.getEvents(ctx.lodgeId, { upcoming: true });
  return (
    <AiAssistantClient
      hasApiKey={Boolean(process.env.OPENAI_API_KEY)}
      events={events.map((e) => ({
        id: e.id,
        title: e.title,
        event_date: e.event_date,
      }))}
    />
  );
}
