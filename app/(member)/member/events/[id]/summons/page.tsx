import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { defaultAgendaItems, renderDefaultSummonsOpening } from "@/lib/summons/defaults";
import type { Member } from "@/lib/db/types";

type DirectoryMember = Pick<
  Member,
  | "id"
  | "full_name"
  | "rank"
  | "phone"
  | "address_line_1"
  | "address_line_2"
  | "city"
  | "county"
  | "postcode"
  | "country"
  | "country_list"
  | "royal_arch"
  | "honorary"
  | "office_title"
  | "officer_sort_order"
  | "directory_sort_order"
>;

function formatAddress(member: DirectoryMember) {
  return [
    member.address_line_1,
    member.address_line_2,
    member.city,
    member.county,
    member.postcode,
    member.country && member.country !== "United Kingdom" ? member.country : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function memberSuffix(member: DirectoryMember) {
  return [
    member.royal_arch ? "RA" : null,
    member.country_list ? "C" : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export default async function MemberMeetingSummonsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/member/login");

  const member =
    (await db.getMemberByAuthUserId(user.id)) ??
    (user.email ? await db.getMemberByEmailAcrossLodges(user.email) : null);

  if (!member || member.membership_status !== "active") notFound();

  const event = await db.getEventById(id, member.lodge_id);
  if (!event) notFound();

  const [lodge, summons, members] = await Promise.all([
    db.getLodgeById(member.lodge_id),
    db.getEventSummons(id, member.lodge_id),
    db.getMembers(member.lodge_id, { status: "active" }),
  ]);

  const officers = members
    .filter((m) => m.office_title)
    .sort(
      (a, b) =>
        (a.officer_sort_order ?? 999) - (b.officer_sort_order ?? 999) ||
        a.full_name.localeCompare(b.full_name)
    );
  const directoryMembers = members
    .filter((m) => !m.honorary)
    .sort(
      (a, b) =>
        (a.directory_sort_order ?? 999) - (b.directory_sort_order ?? 999) ||
        a.full_name.localeCompare(b.full_name)
    );
  const honoraryMembers = members
    .filter((m) => m.honorary)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const agendaItems = summons?.agenda_items?.length ? summons.agenda_items : defaultAgendaItems();
  const openingText = summons?.opening_text ?? renderDefaultSummonsOpening(event, lodge);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <article className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-950 shadow-sm">
        <header className="border-b border-slate-300 pb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Summons
          </p>
          <h1 className="mt-3 text-3xl font-bold uppercase tracking-tight">
            {lodge?.name ?? "Lodge Meeting"}
          </h1>
          <p className="mt-4 text-lg font-semibold">{event.title}</p>
        </header>

        <section className="border-b border-slate-300 py-6 text-sm leading-7">
          <div className="flex justify-between gap-6">
            <p>Dear Sir and Brother</p>
            <p>{formatDate(summons?.issue_date ?? new Date().toISOString())}</p>
          </div>
          <p className="mt-4 whitespace-pre-line">
            {openingText}
          </p>
          <p className="mt-4 font-semibold">{lodge?.secretary_name ?? "Secretary"}</p>
          <p>Secretary</p>
        </section>

        {officers.length > 0 && (
          <section className="border-b border-slate-300 py-6">
            <h2 className="text-center text-lg font-bold uppercase">Officers</h2>
            <div className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              {officers.map((officer) => (
                <div
                  key={officer.id}
                  className="flex justify-between gap-4 border-b border-slate-100 pb-1"
                >
                  <span>
                    {officer.rank ? `${officer.rank} ` : ""}
                    {officer.full_name}
                    {memberSuffix(officer) ? ` ${memberSuffix(officer)}` : ""}
                  </span>
                  <span className="font-semibold uppercase">{officer.office_title}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="border-b border-slate-300 py-6">
          <h2 className="text-lg font-semibold uppercase">Lodge Business</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {agendaItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>

        {Boolean(summons?.menu_items?.length || summons?.notices?.length) && (
          <section className="grid gap-6 border-b border-slate-300 py-6 sm:grid-cols-2">
            {Boolean(summons?.menu_items?.length) && (
              <div>
                <h2 className="text-lg font-semibold uppercase">Menu</h2>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {summons?.menu_items.map((item) => <li key={item}>{item}</li>)}
                </ul>
                {summons?.dining_time && (
                  <p className="mt-2 text-sm font-medium">Dinner at {summons.dining_time}</p>
                )}
              </div>
            )}
            {Boolean(summons?.notices?.length) && (
              <div>
                <h2 className="text-lg font-semibold uppercase">Notices</h2>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {summons?.notices.map((notice) => <p key={notice}>{notice}</p>)}
                </div>
              </div>
            )}
          </section>
        )}

        {summons?.include_member_directory !== false && (
          <section className="py-6">
            <h2 className="text-center text-lg font-bold uppercase">
              {lodge?.name ?? "Lodge"} Members
            </h2>
            <div className="mt-4 space-y-1 text-xs leading-5">
              {directoryMembers.map((m) => {
                const suffix = memberSuffix(m);
                return (
                  <div key={m.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                    <span className="font-medium">
                      {m.rank ? `${m.rank} ` : ""}
                      {m.full_name}
                      {suffix ? ` ${suffix}` : ""}
                    </span>
                    <span>{formatAddress(m) || "Address not recorded"}</span>
                    <span>{m.phone ?? ""}</span>
                  </div>
                );
              })}
            </div>
            {honoraryMembers.length > 0 && (
              <>
                <h3 className="mt-5 text-sm font-semibold uppercase">Honorary</h3>
                <div className="mt-2 space-y-1 text-xs leading-5">
                  {honoraryMembers.map((m) => (
                    <div key={m.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                      <span className="font-medium">{m.full_name}</span>
                      <span>{formatAddress(m) || "Address not recorded"}</span>
                      <span>{m.phone ?? ""}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <p className="mt-4 text-xs text-slate-500">
              RA - Member of Royal Arch. C - Country List.
            </p>
          </section>
        )}
      </article>
    </div>
  );
}
