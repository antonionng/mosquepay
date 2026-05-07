import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { MemberCardClient } from "./card-client";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function MemberCardPage() {
  if (!isSupabaseConfigured()) {
    redirect("/member/login");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    redirect("/member/login");
  }

  const member =
    (await db.getMemberByAuthUserId(user.id)) ??
    (await db.getMemberByEmailAcrossLodges(user.email));
  if (!member) {
    redirect("/member");
  }

  const lodge = await db.getLodgeById(member.lodge_id);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";
  const verifyUrl = `${origin}/verify/${member.portal_token}`;
  const calendarUrl = `${origin}/api/member/calendar/${member.portal_token}`;

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 512,
    margin: 1,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return (
    <MemberCardClient
      member={{
        full_name: member.full_name,
        email: member.email,
        rank: member.rank,
        office_title: member.office_title,
        membership_status: member.membership_status,
        date_of_initiation: member.date_of_initiation,
      }}
      lodge={
        lodge
          ? {
              name: lodge.name,
              lodge_number: lodge.lodge_number,
              city: lodge.city,
              primary_color: lodge.primary_color,
              logo_url: lodge.logo_url,
            }
          : null
      }
      qrDataUrl={qrDataUrl}
      verifyUrl={verifyUrl}
      calendarUrl={calendarUrl}
    />
  );
}
