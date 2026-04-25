import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const full_name = body.full_name?.trim();
    const work_email = body.work_email?.trim();
    const lodge_name = body.lodge_name?.trim();
    const role = body.role?.trim();
    const lodge_count = Number(body.lodge_count ?? 1);
    const priorities = body.priorities?.trim();

    if (!full_name || !work_email || !lodge_name || !role) {
      return NextResponse.json(
        { error: "Name, work email, lodge name, and role are required." },
        { status: 400 }
      );
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      const to = process.env.CONTACT_EMAIL ?? "hello@lodgepay.com";
      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? "LodgePay <noreply@lodgepay.com>",
        to,
        replyTo: work_email,
        subject: `[LodgePay Demo Request] ${lodge_name}`,
        text: [
          `Name: ${full_name}`,
          `Email: ${work_email}`,
          `Lodge: ${lodge_name}`,
          `Role: ${role}`,
          `Lodges managed: ${Number.isFinite(lodge_count) ? lodge_count : 1}`,
          "",
          "Priorities:",
          priorities || "Not provided",
        ].join("\n"),
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Demo request API error:", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

