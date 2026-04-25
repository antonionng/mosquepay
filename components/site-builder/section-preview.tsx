"use client";

import {
  Sparkles,
  BookOpen,
  Calendar,
  Users,
  Heart,
  CalendarDays,
  HelpCircle,
  UserPlus,
  Mail,
  ArrowRight,
} from "lucide-react";
import type { LodgeSiteSection } from "@/lib/db/types";
import { heroBackgroundLayers, mergeHeroPrimaryColor } from "@/lib/site-section-style";

type SiteSection = LodgeSiteSection;

const sectionIcons: Record<SiteSection["type"], React.ComponentType<{ className?: string }>> = {
  hero: Sparkles,
  about: BookOpen,
  meeting_details: Calendar,
  officers: Users,
  charity: Heart,
  events: CalendarDays,
  faq: HelpCircle,
  join: UserPlus,
  contact: Mail,
};

const sectionStyles: Record<
  SiteSection["type"],
  { bg: string; accent: string; badge: string }
> = {
  hero: {
    bg: "bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900",
    accent: "text-blue-300",
    badge: "bg-blue-500/20 text-blue-200 border-blue-400/30",
  },
  about: {
    bg: "bg-white",
    accent: "text-blue-600",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  meeting_details: {
    bg: "bg-slate-50",
    accent: "text-indigo-600",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  officers: {
    bg: "bg-white",
    accent: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  charity: {
    bg: "bg-rose-50/50",
    accent: "text-rose-600",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
  },
  events: {
    bg: "bg-white",
    accent: "text-amber-600",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  faq: {
    bg: "bg-slate-50",
    accent: "text-violet-600",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
  },
  join: {
    bg: "bg-gradient-to-br from-slate-900 to-slate-800",
    accent: "text-emerald-300",
    badge: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  },
  contact: {
    bg: "bg-white",
    accent: "text-sky-600",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
  },
};

function HeroPreview({ section, primaryColor }: { section: SiteSection; primaryColor: string }) {
  const layers = heroBackgroundLayers(section);
  const accent = mergeHeroPrimaryColor(section, primaryColor);
  const hasBg = Boolean(layers.imageUrl);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-8 py-16 text-center">
      {hasBg ? (
        <>
          <div
            className="absolute inset-0 z-0 bg-slate-900 bg-cover bg-no-repeat"
            style={{
              backgroundImage: `url(${layers.imageUrl})`,
              backgroundPosition: layers.backgroundPosition,
            }}
          />
          <div
            className="absolute inset-0 z-[1] bg-black"
            style={{ opacity: layers.overlayOpacity }}
            aria-hidden
          />
        </>
      ) : null}
      <div
        className={`absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:24px_24px] ${hasBg ? "z-[1] opacity-40" : ""}`}
      />
      <div className="relative z-10">
        <span className="mb-4 inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-200">
          Welcome
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {section.heading}
        </h2>
        {section.body && (
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300">
            {section.body}
          </p>
        )}
        {section.cta_label && (
          <button
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-lg"
            style={{ backgroundColor: accent }}
          >
            {section.cta_label}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function StandardPreview({
  section,
  primaryColor,
}: {
  section: SiteSection;
  primaryColor: string;
}) {
  const style = sectionStyles[section.type];
  const isDark = section.type === "join";
  const Icon = sectionIcons[section.type];

  return (
    <div className={`${style.bg} px-8 py-12`}>
      <div className="mx-auto max-w-lg">
        <span
          className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${style.badge}`}
        >
          <Icon className="h-3 w-3" />
          {section.type.replace("_", " ")}
        </span>
        <h3
          className={`text-xl font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}
        >
          {section.heading}
        </h3>
        {section.body && (
          <p
            className={`mt-2 text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}
          >
            {section.body}
          </p>
        )}
        {section.cta_label && (
          <button
            className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-md"
            style={{ backgroundColor: primaryColor || "#3b82f6" }}
          >
            {section.cta_label}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function SectionPreview({
  section,
  primaryColor = "#3b82f6",
}: {
  section: SiteSection;
  primaryColor?: string;
}) {
  if (!section.visible) return null;

  if (section.type === "hero") {
    return <HeroPreview section={section} primaryColor={primaryColor} />;
  }

  return <StandardPreview section={section} primaryColor={primaryColor} />;
}
