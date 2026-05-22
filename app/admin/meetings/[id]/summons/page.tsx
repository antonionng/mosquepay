import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminReadContext } from "@/lib/admin/read-context";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { formatDate } from "@/lib/utils";
import { defaultAgendaItems, renderDefaultSummonsOpening } from "@/lib/summons/defaults";
import { SummonsPrintButton } from "./print-button";
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

export default async function MeetingSummonsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;

  const event = useMock
    ? mockDb.getEventById(id)
    : lodgeId
      ? await db.getEventById(id, lodgeId)
      : null;

  if (!event) notFound();

  const lodge = useMock
    ? mockDb.listLodges()[0] ?? null
    : lodgeId
      ? await db.getLodgeById(lodgeId)
      : null;
  const rsvps = useMock
    ? mockDb.getRsvpsByEventId(id)
    : lodgeId
      ? await db.getRsvpsByEventId(id, lodgeId)
      : [];
  const members = useMock
    ? mockDb.getMembers({ status: "active" })
    : lodgeId
      ? await db.getMembers(lodgeId, { status: "active" })
      : [];
  const summons = !useMock && lodgeId ? await db.getEventSummons(id, lodgeId) : null;

  const summonsItems = summons?.agenda_items?.length ? summons.agenda_items : defaultAgendaItems();
  const menuItems = summons?.menu_items?.length ? summons.menu_items : [];
  const notices = summons?.notices?.length
    ? summons.notices
    : [
        lodge?.meeting_schedule,
        lodge?.data_protection_notice,
        lodge?.visiting_notice,
        lodge?.loi_contact,
      ].filter((notice): notice is string => Boolean(notice));
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
  const issueDate = summons?.issue_date ?? new Date().toISOString();
  const secretaryName = lodge?.secretary_name ?? "Secretary";
  const openingText = summons?.opening_text ?? renderDefaultSummonsOpening(event, lodge);
  const visitingOfficers = summons?.visiting_officers?.length
    ? summons.visiting_officers
    : summons?.visiting_officer_name
      ? [
          {
            name: summons.visiting_officer_name,
            email: summons.visiting_officer_email,
            phone: summons.visiting_officer_phone,
          },
        ]
      : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:max-w-none print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/meetings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to meetings
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="dashboard" size="sm">
            <Link href={`/admin/meetings/${id}/summons/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit summons
            </Link>
          </Button>
          <SummonsPrintButton />
        </div>
      </div>

      <article className="rounded-2xl border border-dash-border bg-white p-8 text-slate-950 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-slate-300 pb-6 text-center">
          {lodge?.logo_url ? (
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:h-16 print:w-16">
              <Image
                src={lodge.logo_url}
                alt={`${lodge.name} logo`}
                width={96}
                height={96}
                className="h-full w-full object-contain p-2"
              />
            </div>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Summons
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight uppercase">
            {lodge?.name ?? "Lodge Meeting"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {lodge?.lodge_number ? `No. ${lodge.lodge_number}` : null}
            {lodge?.lodge_number && (lodge?.consecrated_at || lodge?.governing_body)
              ? " · "
              : null}
            {lodge?.consecrated_at
              ? `Consecrated ${formatDate(lodge.consecrated_at)}`
              : null}
            {lodge?.governing_body ? ` · ${lodge.governing_body}` : null}
          </p>
          <p className="mt-4 text-lg font-semibold">{event.title}</p>
        </header>

        <section className="border-b border-slate-300 py-6 text-sm leading-7">
          <div className="flex justify-between gap-6">
            <p>Dear Sir and Brother</p>
            <p>{formatDate(issueDate)}</p>
          </div>
          <p className="mt-4 whitespace-pre-line">
            {openingText}
          </p>
          <p className="mt-4 font-semibold">{secretaryName}</p>
          <p>Secretary</p>
          {lodge?.secretary_address && (
            <p className="mt-2 whitespace-pre-line text-slate-700">
              {lodge.secretary_address}
            </p>
          )}
          {lodge?.secretary_phone && (
            <p className="text-slate-700">Telephone: {lodge.secretary_phone}</p>
          )}
        </section>

        {officers.length > 0 && (
          <section className="break-inside-avoid border-b border-slate-300 py-6">
            <h2 className="text-center text-lg font-bold uppercase">
              Officers
            </h2>
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

        <section className="break-inside-avoid border-b border-slate-300 py-6">
          <h2 className="text-lg font-semibold uppercase">Lodge Business</h2>
          {event.description && (
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
              {event.description}
            </p>
          )}
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {summonsItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          {(summons?.master_elect_name || summons?.master_elect_qualification) && (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
              {summons?.master_elect_name && (
                <p>
                  <span className="font-semibold">Master Elect:</span>{" "}
                  {summons.master_elect_name}
                </p>
              )}
              {summons?.master_elect_qualification && (
                <p className="mt-1 text-slate-600">
                  {summons.master_elect_qualification}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="grid break-inside-avoid gap-6 border-b border-slate-300 py-6 sm:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold uppercase">Dining and payments</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Dining</dt>
                <dd className="font-medium">
                  {event.enable_dining_rsvp
                    ? `£${Number(event.dining_price ?? 0).toFixed(2)}`
                    : "Not configured"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Meeting fee</dt>
                <dd className="font-medium">
                  {event.enable_meeting_fee
                    ? `£${Number(event.meeting_fee_amount ?? 0).toFixed(2)}`
                    : "None"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Charity</dt>
                <dd className="font-medium">
                  {event.enable_charity_donation
                    ? event.charity_name ?? "Optional donation"
                    : "Not configured"}
                </dd>
              </div>
            </dl>
            {menuItems.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold uppercase">Menu</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {menuItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {summons?.dining_time && (
                  <p className="mt-2 text-sm font-medium">
                    Dinner at {summons.dining_time}
                  </p>
                )}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold uppercase">Attendance</h2>
            <div className="mt-3 text-sm text-slate-700">
              {rsvps.length} RSVP{rsvps.length === 1 ? "" : "s"} received
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {members.length} active member{members.length === 1 ? "" : "s"} on lodge records.
            </p>
            {event.dress_code && (
              <p className="mt-4 text-sm font-medium">Dress: {event.dress_code}</p>
            )}
            {lodge?.charity_donation_url && (
              <p className="mt-4 text-sm text-slate-700">
                Charity donations: {lodge.charity_donation_url}
              </p>
            )}
            {visitingOfficers.length > 0 && (
              <div className="mt-4 text-sm text-slate-700">
                <p className="font-semibold uppercase tracking-wide text-slate-500">
                  Visiting Officer{visitingOfficers.length === 1 ? "" : "s"}
                </p>
                <div className="mt-2 space-y-3">
                  {visitingOfficers.map((officer, index) => (
                    <div key={`${officer.name}-${index}`}>
                      {officer.name && <p>{officer.name}</p>}
                      {officer.email && (
                        <p className="text-slate-600">Email: {officer.email}</p>
                      )}
                      {officer.phone && (
                        <p className="text-slate-600">Tel: {officer.phone}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summons?.next_meeting_date && (
              <p className="mt-4 text-sm text-slate-700">
                <span className="font-semibold">Next regular meeting:</span>{" "}
                {formatDate(summons.next_meeting_date)}
                {summons.next_meeting_note ? ` — ${summons.next_meeting_note}` : ""}
              </p>
            )}
          </div>
        </section>

        {notices.length > 0 && (
          <section className="break-inside-avoid border-b border-slate-300 py-6">
            <h2 className="text-lg font-semibold uppercase">
              {lodge?.name ?? "Lodge"} Members
            </h2>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {notices.map((notice) => (
                <p key={notice}>{notice}</p>
              ))}
              {lodge?.wifi_details && <p>WiFi: {lodge.wifi_details}</p>}
            </div>
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
                const address = formatAddress(member);
                return (
                  <div key={member.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                    <span className="font-medium">
                      {member.rank ? `${member.rank} ` : ""}
                      {member.full_name}
                      {suffix ? ` ${suffix}` : ""}
                    </span>
                    <span>{address || "Address not recorded"}</span>
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
    </div>
  );
}
