import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { sendWebsiteNotification } from "@/lib/email/website-notifications";

const leadSchema = {
  first_name: (v: unknown) => typeof v === "string" && v.trim().length > 0,
  last_name: (v: unknown) => typeof v === "string" && v.trim().length > 0,
  email: (v: unknown) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  phone: (v: unknown) => v == null || typeof v === "string",
  location: (v: unknown) => v == null || typeof v === "string",
  how_heard: (v: unknown) => v == null || typeof v === "string",
  message: (v: unknown) => v == null || typeof v === "string",
};

export async function POST(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const body = await request.json();
    const first_name = body.first_name?.trim();
    const last_name = body.last_name?.trim();
    const email = body.email?.trim();
    const phone = body.phone?.trim() ?? null;
    const location = body.location?.trim() ?? null;
    const how_heard = body.how_heard?.trim() ?? null;
    const message = body.message?.trim() ?? null;

    if (
      !leadSchema.first_name(first_name) ||
      !leadSchema.last_name(last_name) ||
      !leadSchema.email(email)
    ) {
      return NextResponse.json(
        { error: "First name, last name, and a valid email are required." },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const lodge = await db.getLodgeBySlug(lodgeSlug);
      if (!lodge) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const lead = await db.addLead(lodge.id, {
        first_name: first_name!,
        last_name: last_name!,
        email: email!,
        phone,
        location,
        source: how_heard ?? "Website",
        how_heard_about_us: how_heard,
        initial_message: message,
        stage: "expression_of_interest",
        assigned_to: null,
        proposer_member_id: null,
        proposer_name: null,
        seconder_member_id: null,
        seconder_name: null,
        next_step: null,
        next_step_due_date: null,
        proposal_date: null,
        ballot_date: null,
        interview_completed_at: null,
        consent_given_at: null,
        notes: null,
        converted_member_id: null,
        converted_at: null,
      });
      await sendWebsiteNotification({
        lodge,
        replyTo: email,
        subject: `[Lead intake] ${first_name} ${last_name}`,
        eyebrow: "Lead intake",
        title: "New membership lead",
        preview: `New lead from ${first_name} ${last_name}.`,
        intro: "A prospective member has submitted the lodge website lead intake form.",
        rows: [
          { label: "Name", value: `${first_name} ${last_name}` },
          { label: "Email", value: email },
          { label: "Phone", value: phone },
          { label: "Location", value: location },
          { label: "How heard", value: how_heard },
          { label: "CRM lead ID", value: lead.id },
        ],
        message,
      });
      return NextResponse.json({ id: lead.id, success: true });
    }

    const lodge = mockDb.getLodgeBySlug(lodgeSlug);
    const lead = mockDb.addLead({
      lodge_slug: lodgeSlug,
      first_name: first_name!,
      last_name: last_name!,
      email: email!,
      phone,
      location,
      source: how_heard ?? "Website",
      how_heard_about_us: how_heard,
      initial_message: message,
      stage: "expression_of_interest",
      assigned_to: null,
    });

    await sendWebsiteNotification({
      lodge,
      replyTo: email,
      subject: `[Lead intake] ${first_name} ${last_name}`,
      eyebrow: "Lead intake",
      title: "New membership lead",
      preview: `New lead from ${first_name} ${last_name}.`,
      intro: "A prospective member has submitted the lodge website lead intake form.",
      rows: [
        { label: "Name", value: `${first_name} ${last_name}` },
        { label: "Email", value: email },
        { label: "Phone", value: phone },
        { label: "Location", value: location },
        { label: "How heard", value: how_heard },
        { label: "CRM lead ID", value: lead.id },
      ],
      message,
    });

    return NextResponse.json({ id: lead.id, success: true });
  } catch (e) {
    console.error("Leads API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
