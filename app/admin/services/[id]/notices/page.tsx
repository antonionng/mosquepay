import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminReadContext } from "@/lib/admin/read-context";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { formatDate } from "@/lib/utils";
import { defaultAgendaItems, renderDefaultNoticeOpening } from "@/lib/notices/defaults";
import { NoticePrintButton } from "./print-button";
import type { Member } from "@/lib/db/types";
import { mosqueTitleFor } from "@/lib/members/rank";

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

export default async function ServiceNoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const mosqueId = ctx.mode === "database" ? ctx.mosqueId : null;

  const event = useMock
    ? mockDb.getEventById(id)
    : mosqueId
      ? await db.getEventById(id, mosqueId)
      : null;

  if (!event) notFound();

  const mosque = useMock
    ? mockDb.listMosques()[0] ?? null
    : mosqueId
      ? await db.getMosqueById(mosqueId)
      : null;
  const rsvps = useMock
    ? mockDb.getRsvpsByEventId(id)
    : mosqueId
      ? await db.getRsvpsByEventId(id, mosqueId)
      : [];
  const members = useMock
    ? mockDb.getMembers({ status: "active" })
    : mosqueId
      ? await db.getMembers(mosqueId, { status: "active" })
      : [];
  const notice = !useMock && mosqueId ? await db.getServiceNotice(id, mosqueId) : null;

  const noticeItems = notice?.agenda_items?.length ? notice.agenda_items : defaultAgendaItems();
  const menuItems = notice?.menu_items?.length ? notice.menu_items : [];
  const notices = notice?.notices?.length
    ? notice.notices
    : [
        mosque?.service_schedule,
        mosque?.data_protection_notice,
        mosque?.newcomer_notice,
        mosque?.loi_contact,
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
  const issueDate = notice?.issue_date ?? new Date().toISOString();
  const secretaryName = mosque?.secretary_name ?? "Secretary";
  const openingText = notice?.opening_text ?? renderDefaultNoticeOpening(event, mosque);
  const newcomerContacts = notice?.newcomer_contacts?.length
    ? notice.newcomer_contacts
    : notice?.newcomer_contact_name
      ? [
          {
            name: notice.newcomer_contact_name,
            email: notice.newcomer_contact_email,
            phone: notice.newcomer_contact_phone,
          },
        ]
      : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:max-w-none print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/services">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to services
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="dashboard" size="sm">
            <Link href={`/admin/services/${id}/notice/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit notice
            </Link>
          </Button>
          <NoticePrintButton />
        </div>
      </div>

      <article className="rounded-2xl border border-dash-border bg-white p-8 text-slate-950 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-slate-300 pb-6 text-center">
          {mosque?.logo_url ? (
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:h-16 print:w-16">
              <Image
                src={mosque.logo_url}
                alt={`${mosque.name} logo`}
                width={96}
                height={96}
                className="h-full w-full object-contain p-2"
              />
            </div>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            Notice
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight uppercase">
            {mosque?.name ?? "Jumu'ah Prayer"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {mosque?.mosque_number ? `No. ${mosque.mosque_number}` : null}
            {mosque?.mosque_number && (mosque?.consecrated_at || mosque?.governing_body)
              ? " · "
              : null}
            {mosque?.consecrated_at
              ? `Established ${formatDate(mosque.consecrated_at)}`
              : null}
            {mosque?.governing_body ? ` · ${mosque.governing_body}` : null}
          </p>
          <p className="mt-4 text-lg font-semibold">{event.title}</p>
        </header>

        <section className="border-b border-slate-300 py-6 text-sm leading-7">
          <div className="flex justify-between gap-6">
            <p>Dear Sir and Member</p>
            <p>{formatDate(issueDate)}</p>
          </div>
          <p className="mt-4 whitespace-pre-line">
            {openingText}
          </p>
          <p className="mt-4 font-semibold">{secretaryName}</p>
          <p>Secretary</p>
          {mosque?.secretary_address && (
            <p className="mt-2 whitespace-pre-line text-slate-700">
              {mosque.secretary_address}
            </p>
          )}
          {mosque?.secretary_phone && (
            <p className="text-slate-700">Telephone: {mosque.secretary_phone}</p>
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
                  <span className="font-semibold uppercase text-slate-800">
                    {member.office_title}
                  </span>
                  <span className="text-right text-slate-700">
                    {mosqueTitleFor(member.rank)
                      ? `${mosqueTitleFor(member.rank)} `
                      : ""}
                    {member.full_name}
                    {memberSuffix(member) ? ` ${memberSuffix(member)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="break-inside-avoid border-b border-slate-300 py-6">
          <h2 className="text-lg font-semibold uppercase">Mosque Business</h2>
          {event.description && (
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
              {event.description}
            </p>
          )}
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {noticeItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          {(notice?.service_lead_name || notice?.service_lead_role) && (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
              {notice?.service_lead_name && (
                <p>
                  <span className="font-semibold">Service lead:</span>{" "}
                  {notice.service_lead_name}
                </p>
              )}
              {notice?.service_lead_role && (
                <p className="mt-1 text-slate-600">
                  {notice.service_lead_role}
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
                <dt className="text-slate-500">Service fee</dt>
                <dd className="font-medium">
                  {event.enable_service_fee
                    ? `£${Number(event.service_fee_amount ?? 0).toFixed(2)}`
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
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Raffle tickets</dt>
                <dd className="font-medium">
                  {event.enable_raffle_donation
                    ? event.raffle_description ??
                      "Strips of raffle tickets sold on the night"
                    : "Not configured"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Wine pledge</dt>
                <dd className="font-medium">
                  {event.enable_raffle_wine_pledge
                    ? event.raffle_wine_description ??
                      "Bring a bottle for the raffle"
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
                {notice?.dining_time && (
                  <p className="mt-2 text-sm font-medium">
                    Dinner at {notice.dining_time}
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
              {members.length} active member{members.length === 1 ? "" : "s"} on mosque records.
            </p>
            {event.dress_code && (
              <p className="mt-4 text-sm font-medium">Dress: {event.dress_code}</p>
            )}
            {mosque?.charity_donation_url && (
              <p className="mt-4 text-sm text-slate-700">
                Charity donations: {mosque.charity_donation_url}
              </p>
            )}
            {newcomerContacts.length > 0 && (
              <div className="mt-4 text-sm text-slate-700">
                <p className="font-semibold uppercase tracking-wide text-slate-500">
                  Newcomer contact{newcomerContacts.length === 1 ? "" : "s"}
                </p>
                <div className="mt-2 space-y-3">
                  {newcomerContacts.map((officer, index) => (
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
            {notice?.next_service_date && (
              <p className="mt-4 text-sm text-slate-700">
                <span className="font-semibold">Next regular service:</span>{" "}
                {formatDate(notice.next_service_date)}
                {notice.next_service_note ? ` — ${notice.next_service_note}` : ""}
              </p>
            )}
          </div>
        </section>

        {notices.length > 0 && (
          <section className="break-inside-avoid border-b border-slate-300 py-6">
            <h2 className="text-lg font-semibold uppercase">
              {mosque?.name ?? "Mosque"} Members
            </h2>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {notices.map((notice) => (
                <p key={notice}>{notice}</p>
              ))}
              {mosque?.wifi_details && <p>WiFi: {mosque.wifi_details}</p>}
            </div>
          </section>
        )}

        {notice?.include_member_directory !== false && (
          <section className="py-6">
            <h2 className="text-center text-lg font-bold uppercase">
              {mosque?.name ?? "Mosque"} Members
            </h2>
            <div className="mt-4 space-y-1 text-xs leading-5">
              {directoryMembers.map((member) => {
                const suffix = memberSuffix(member);
                const address = formatAddress(member);
                return (
                  <div key={member.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                    <span className="font-medium">
                      {mosqueTitleFor(member.rank)
                        ? `${mosqueTitleFor(member.rank)} `
                        : ""}
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
