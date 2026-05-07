"use client";

import { useState } from "react";
import Image from "next/image";
import { Calendar, Check, Copy, Download, ShieldCheck } from "lucide-react";

type Member = {
  full_name: string;
  email: string;
  rank: string | null;
  office_title: string | null;
  membership_status: string;
  date_of_initiation: string | null;
};

type Lodge = {
  name: string;
  lodge_number: string | null;
  city: string | null;
  primary_color: string | null;
  logo_url: string | null;
} | null;

export function MemberCardClient({
  member,
  lodge,
  qrDataUrl,
  verifyUrl,
  calendarUrl,
}: {
  member: Member;
  lodge: Lodge;
  qrDataUrl: string;
  verifyUrl: string;
  calendarUrl: string;
}) {
  const primary = lodge?.primary_color ?? "#1d4ed8";
  const [copiedField, setCopiedField] = useState<"verify" | "calendar" | null>(null);

  function copy(value: string, field: "verify" | "calendar") {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My membership card</h1>
        <p className="mt-1 text-sm text-slate-500">
          Show this card when visiting other lodges. Scanning the QR confirms your
          current membership.
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${shade(primary, -25)} 100%)`,
        }}
      >
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 h-48 w-48 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            {lodge?.logo_url ? (
              <Image
                src={lodge.logo_url}
                alt={lodge.name}
                width={48}
                height={48}
                className="h-12 w-12 rounded-xl bg-white/10 object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-sm font-bold">
                {(lodge?.name ?? "L").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                {lodge?.lodge_number ? `Lodge No. ${lodge.lodge_number}` : "Member"}
              </p>
              <p className="truncate text-base font-semibold">
                {lodge?.name ?? "Lodge"}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            {member.membership_status}
          </span>
        </div>

        <div className="relative mt-8 flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.18em] text-white/70">
              Member
            </p>
            <p className="truncate text-2xl font-semibold">{member.full_name}</p>
            {member.office_title && (
              <p className="text-sm text-white/80">{member.office_title}</p>
            )}
            {member.rank && (
              <p className="text-xs text-white/70">{member.rank}</p>
            )}
            {member.date_of_initiation && (
              <p className="mt-2 text-xs text-white/70">
                Initiated {new Date(member.date_of_initiation).toLocaleDateString("en-GB", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            )}
          </div>
          <div className="shrink-0 rounded-2xl bg-white p-2 shadow-lg">
            <Image
              src={qrDataUrl}
              alt="Membership verification QR"
              width={120}
              height={120}
              className="h-28 w-28"
              unoptimized
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href={qrDataUrl}
          download={`${member.full_name.replace(/\s+/g, "-").toLowerCase()}-card.png`}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Download QR image
        </a>
        <a
          href={calendarUrl}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        >
          <Calendar className="h-4 w-4" />
          Subscribe to calendar
        </a>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Verification link
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Anyone scanning the QR sees a public page confirming your current
          membership. No personal data beyond name, lodge, and status is shown.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <code className="flex-1 truncate font-mono text-slate-700">
            {verifyUrl}
          </code>
          <button
            type="button"
            onClick={() => copy(verifyUrl, "verify")}
            className="rounded-md bg-white p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Copy verification URL"
          >
            {copiedField === "verify" ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Calendar className="h-4 w-4 text-blue-600" />
          Calendar feed
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Add this URL in Google Calendar, Apple Calendar, or Outlook to keep
          your lodge meetings synced.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <code className="flex-1 truncate font-mono text-slate-700">
            {calendarUrl}
          </code>
          <button
            type="button"
            onClick={() => copy(calendarUrl, "calendar")}
            className="rounded-md bg-white p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Copy calendar URL"
          >
            {copiedField === "calendar" ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function shade(hex: string, percent: number): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return hex;
  const num = parseInt(cleaned, 16);
  const amount = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
