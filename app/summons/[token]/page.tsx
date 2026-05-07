import { createHash } from "crypto";
import { notFound } from "next/navigation";
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

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

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

export default async function PublicSummonsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const { token } = await params;
  const accessLink = await db.getEventSummonsAccessLinkByTokenHash(hashToken(token));
  if (!accessLink) notFound();
  if (accessLink.expires_at && new Date(accessLink.expires_at) < new Date()) {
    notFound();
  }

  const [event, lodge, summons, members] = await Promise.all([
    db.getEventById(accessLink.event_id, accessLink.lodge_id),
    db.getLodgeById(accessLink.lodge_id),
    db.getEventSummons(accessLink.event_id, accessLink.lodge_id),
    db.getMembers(accessLink.lodge_id, { status: "active" }),
    db.recordEventSummonsAccess(accessLink.id, accessLink.access_count),
  ]);

  if (!event) notFound();

  const officers = members
    .filter((member) => member.office_title)
    .sort(
      (a, b) =>
        (a.officer_sort_order ?? 999) - (b.officer_sort_order ?? 999) ||
        a.full_name.localeCompare(b.full_name)
    );
  const directoryMembers = members
    .filter((member) => !member.honorary)
    .sort(
      (a, b) =>
        (a.directory_sort_order ?? 999) - (b.directory_sort_order ?? 999) ||
        a.full_name.localeCompare(b.full_name)
    );
  const honoraryMembers = members
    .filter((member) => member.honorary)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const agendaItems = summons?.agenda_items?.length ? summons.agenda_items : defaultAgendaItems();
  const openingText = summons?.opening_text ?? renderDefaultSummonsOpening(event, lodge);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <article className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 text-slate-950 shadow-sm">
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
              {officers.map((member) => (
                <div
                  key={member.id}
                  className="flex justify-between gap-4 border-b border-slate-100 pb-1"
                >
                  <span>
                    {member.rank ? `${member.rank} ` : ""}
                    {member.full_name}
                    {memberSuffix(member) ? ` ${memberSuffix(member)}` : ""}
                  </span>
                  <span className="font-semibold uppercase">{member.office_title}</span>
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
              {directoryMembers.map((member) => {
                const suffix = memberSuffix(member);
                return (
                  <div key={member.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                    <span className="font-medium">
                      {member.rank ? `${member.rank} ` : ""}
                      {member.full_name}
                      {suffix ? ` ${suffix}` : ""}
                    </span>
                    <span>{formatAddress(member) || "Address not recorded"}</span>
                    <span>{member.phone ?? ""}</span>
                  </div>
                );
              })}
            </div>
            {honoraryMembers.length > 0 && (
              <>
                <h3 className="mt-5 text-sm font-semibold uppercase">Honorary</h3>
                <div className="mt-2 space-y-1 text-xs leading-5">
                  {honoraryMembers.map((member) => (
                    <div key={member.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                      <span className="font-medium">{member.full_name}</span>
                      <span>{formatAddress(member) || "Address not recorded"}</span>
                      <span>{member.phone ?? ""}</span>
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
    </main>
  );
}
