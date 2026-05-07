"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Clock,
  Heart,
  Mail,
  MapPin,
  Phone,
  Send,
  Shirt,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FadeIn, StaggerChildren, StaggerItem } from "@/components/motion";
import type { LodgeSiteSection } from "@/lib/db/types";
import {
  heroBackgroundLayers,
  mergeHeroPrimaryColor,
  sectionBackgroundLayers,
} from "@/lib/site-section-style";
import { resolveLodgeSlug } from "@/lib/tenant";

type SiteSection = LodgeSiteSection;

type LodgeData = {
  name: string;
  city: string | null;
  tagline: string | null;
  support_email: string | null;
  support_phone: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

type SitePayload = {
  lodge: LodgeData | null;
  site: {
    page_title: string;
    page_description: string | null;
    sections: SiteSection[];
  };
};

function withQuery(href: string, lodgeSlug: string) {
  if (href.startsWith("#")) return href;
  return `${href}?lodge=${encodeURIComponent(lodgeSlug)}`;
}

function formModeFor(section: SiteSection): NonNullable<NonNullable<SiteSection["style"]>["form_mode"]> {
  if (section.style?.form_mode) return section.style.form_mode;
  if (section.type === "contact") return "contact";
  if (section.type === "join") return "lead";
  return "none";
}

function imageShapeClass(shape: NonNullable<SiteSection["style"]>["image_shape"]) {
  if (shape === "circle") return "rounded-full";
  if (shape === "arch") return "rounded-t-full rounded-b-[2rem]";
  if (shape === "square") return "rounded-none";
  return "rounded-[2rem]";
}

function InlineSectionImage({
  section,
  className = "",
}: {
  section: SiteSection;
  className?: string;
}) {
  if (!section.style?.image_url) return null;
  return (
    <div className={`overflow-hidden border border-slate-200 bg-slate-100 shadow-card ${imageShapeClass(section.style.image_shape)} ${className}`}>
      <img
        src={section.style.image_url}
        alt={section.style.image_alt ?? ""}
        className="h-full min-h-72 w-full object-cover"
      />
    </div>
  );
}

function SectionBackground({ section }: { section: SiteSection }) {
  const background = sectionBackgroundLayers(section);
  if (!background.imageUrl) return null;
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: `url(${background.imageUrl})`,
          backgroundPosition: background.backgroundPosition,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-white"
        style={{ opacity: 1 - background.overlayOpacity }}
        aria-hidden
      />
    </>
  );
}

function sectionContentClass(section: SiteSection) {
  return section.style?.background_image_url ? "relative z-10" : "";
}

function ContactEnquiryForm({
  lodgeSlug,
  lodge,
  dark = false,
}: {
  lodgeSlug: string;
  lodge: LodgeData | null;
  dark?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/contact?lodge=${encodeURIComponent(lodgeSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          subject: form.get("subject") || `Website enquiry for ${lodge?.name ?? "the lodge"}`,
          message: form.get("message"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send enquiry.");
      event.currentTarget.reset();
      setStatus("Thanks. Your message has been sent to the lodge secretary.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send enquiry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id="contact-form" className="space-y-5" onSubmit={submit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-name">Full name</Label>
          <Input id="contact-name" name="name" required placeholder="John Smith" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" name="email" required type="email" placeholder="john@example.com" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-phone">Phone</Label>
          <Input id="contact-phone" name="phone" placeholder="Optional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-subject">Subject</Label>
          <Input id="contact-subject" name="subject" placeholder="Visiting, membership, or general enquiry" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          name="message"
          required
          placeholder="Tell us how the lodge can help..."
          rows={5}
        />
      </div>
      <Button
        type="submit"
        disabled={submitting}
        className={
          dark
            ? "bg-white text-slate-950 hover:bg-white/90"
            : "bg-slate-950 text-white hover:bg-slate-800"
        }
      >
        {submitting ? "Sending..." : "Send to secretary"}
        <Send className="ml-2 h-4 w-4" />
      </Button>
      {status ? (
        <p className={dark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>
          {status}
        </p>
      ) : null}
    </form>
  );
}

function LeadIntakeForm({
  lodgeSlug,
  dark = false,
}: {
  lodgeSlug: string;
  dark?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/leads?lodge=${encodeURIComponent(lodgeSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.get("first_name"),
          last_name: form.get("last_name"),
          email: form.get("email"),
          phone: form.get("phone"),
          location: form.get("location"),
          how_heard: form.get("how_heard"),
          message: form.get("message"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send lead intake.");
      event.currentTarget.reset();
      setStatus("Thanks. Your enquiry has been added and sent to the lodge secretary.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send lead intake.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id="lead-intake" className="space-y-5" onSubmit={submit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lead-first-name">First name</Label>
          <Input id="lead-first-name" name="first_name" required placeholder="John" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-last-name">Last name</Label>
          <Input id="lead-last-name" name="last_name" required placeholder="Smith" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lead-email">Email</Label>
          <Input id="lead-email" name="email" required type="email" placeholder="john@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-phone">Phone</Label>
          <Input id="lead-phone" name="phone" placeholder="Optional" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lead-location">Location</Label>
          <Input id="lead-location" name="location" placeholder="Town or city" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lead-how-heard">How did you hear about us?</Label>
          <Input id="lead-how-heard" name="how_heard" placeholder="Friend, search, event..." />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="lead-message">Message</Label>
        <Textarea
          id="lead-message"
          name="message"
          placeholder="Tell us a little about your interest in visiting or joining..."
          rows={5}
        />
      </div>
      <Button
        type="submit"
        disabled={submitting}
        className={
          dark
            ? "bg-white text-slate-950 hover:bg-white/90"
            : "bg-slate-950 text-white hover:bg-slate-800"
        }
      >
        {submitting ? "Sending..." : "Send membership enquiry"}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
      {status ? (
        <p className={dark ? "text-sm text-slate-300" : "text-sm text-slate-600"}>
          {status}
        </p>
      ) : null}
    </form>
  );
}

function SectionFormCard({
  mode,
  lodgeSlug,
  lodge,
  dark = false,
}: {
  mode: "contact" | "lead";
  lodgeSlug: string;
  lodge: LodgeData | null;
  dark?: boolean;
}) {
  return (
    <div
      className={
        dark
          ? "mx-auto mt-10 max-w-3xl rounded-3xl border border-white/10 bg-white/10 p-6 text-left text-white backdrop-blur"
          : "mx-auto mt-10 max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-card"
      }
    >
      <div className="mb-6">
        <p className={dark ? "text-xs font-semibold uppercase tracking-[0.18em] text-blue-200" : "section-label"}>
          {mode === "lead" ? "Lead intake" : "Contact form"}
        </p>
        <h3 className={dark ? "mt-2 text-2xl font-semibold text-white" : "mt-2 text-2xl font-semibold text-slate-950"}>
          {mode === "lead" ? "Start a membership conversation" : "Send a message to the secretary"}
        </h3>
        <p className={dark ? "mt-2 text-sm text-slate-300" : "mt-2 text-sm text-slate-600"}>
          {mode === "lead"
            ? "This creates a lead in the lodge CRM and notifies the lodge secretary."
            : "This sends your message directly to the lodge secretary or support contact."}
        </p>
      </div>
      {mode === "lead" ? (
        <LeadIntakeForm lodgeSlug={lodgeSlug} dark={dark} />
      ) : (
        <ContactEnquiryForm lodgeSlug={lodgeSlug} lodge={lodge} dark={dark} />
      )}
    </div>
  );
}

function StandaloneSectionForm({
  section,
  lodgeSlug,
  lodge,
}: {
  section: SiteSection;
  lodgeSlug: string;
  lodge: LodgeData | null;
}) {
  const mode = formModeFor(section);
  if (mode === "none" || section.type === "contact" || section.type === "join") {
    return null;
  }
  return (
    <section className="border-y border-slate-200 bg-slate-50 py-16">
      <div className="container-full">
        <SectionFormCard mode={mode} lodgeSlug={lodgeSlug} lodge={lodge} />
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
 *  HERO: Full-bleed dark section with gradient, pattern, CTA
 * ──────────────────────────────────────────────────────────── */
function HeroSection({
  section,
  lodge,
  lodgeSlug,
}: {
  section: SiteSection;
  lodge: LodgeData | null;
  lodgeSlug: string;
}) {
  const layers = heroBackgroundLayers(section);
  const primaryHex = mergeHeroPrimaryColor(section, lodge?.primary_color);
  const hasCustomBg = Boolean(layers.imageUrl);

  return (
    <section
      className="public-hero"
      aria-label="Hero"
      data-has-custom-bg={hasCustomBg ? "true" : undefined}
    >
      {hasCustomBg ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-slate-950 bg-cover bg-no-repeat"
            style={{
              backgroundImage: `url(${layers.imageUrl})`,
              backgroundPosition: layers.backgroundPosition,
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-black"
            style={{ opacity: layers.overlayOpacity }}
            aria-hidden
          />
        </>
      ) : null}
      <div className="public-hero-shell !lg:grid-cols-1 !lg:items-center">
        <div className="public-hero-copy mx-auto text-center lg:text-center">
          <FadeIn delay={0.1}>
            <p className="public-kicker mx-auto inline-flex">{lodge?.name ?? "Welcome"}</p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <h1 className="public-hero-title mx-auto max-w-4xl">
              {section.heading}
            </h1>
          </FadeIn>
          {section.body && (
            <FadeIn delay={0.3}>
              <p className="public-hero-body mx-auto max-w-2xl text-center">
                {section.body}
              </p>
            </FadeIn>
          )}
          {section.style?.image_url ? (
            <FadeIn delay={0.35}>
              <InlineSectionImage section={section} className="mx-auto mt-8 max-w-3xl" />
            </FadeIn>
          ) : null}
          <FadeIn delay={0.4}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              {section.cta_href && section.cta_label && (
                <Button
                  asChild
                  size="lg"
                  className="rounded-xl text-white shadow-lg transition hover:opacity-95"
                  style={{ backgroundColor: primaryHex }}
                >
                  <Link href={withQuery(section.cta_href, lodgeSlug)}>
                    {section.cta_label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="rounded-xl border-white/10 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href={withQuery("/charity", lodgeSlug)}>Our Charity</Link>
              </Button>
            </div>
          </FadeIn>
          <FadeIn delay={0.5}>
            <div className="public-hero-meta mt-12 justify-center">
              {lodge?.city && <span className="public-hero-meta-chip">{lodge.city}</span>}
              <span className="public-hero-meta-chip">Established Tradition</span>
              <span className="public-hero-meta-chip">Powered by Covenant</span>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
 *  ABOUT: Two-column with decorative accent
 * ──────────────────────────────────────────────────────────── */
function AboutSection({ section }: { section: SiteSection }) {
  return (
    <section className="relative overflow-hidden bg-white py-20 lg:py-28" aria-label="About">
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`}>
        <div className="grid gap-12 lg:grid-cols-[1fr_0.6fr] lg:items-center">
          <FadeIn>
            <div>
              <p className="section-label">About the lodge</p>
              <h2 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                {section.heading}
              </h2>
              {section.body && (
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                  {section.body}
                </p>
              )}
              {section.cta_href && section.cta_label && (
                <Button asChild className="mt-8" variant="outline">
                  <Link href={section.cta_href}>
                    {section.cta_label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="relative mx-auto w-full max-w-sm">
              {section.style?.image_url ? (
                <InlineSectionImage section={section} className="aspect-square" />
              ) : (
                <div className="aspect-square rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-8 shadow-card">
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Users className="h-10 w-10" />
                    </div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Fellowship
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      Brotherhood & Service
                    </p>
                  </div>
                </div>
              )}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
 *  MEETING DETAILS: Structured card with icons
 * ──────────────────────────────────────────────────────────── */
function MeetingDetailsSection({
  section,
  lodgeSlug,
}: {
  section: SiteSection;
  lodgeSlug: string;
}) {
  return (
    <section className="relative overflow-hidden border-y border-slate-200 bg-slate-50 py-20 lg:py-28" aria-label="Meeting details">
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`}>
        <FadeIn>
          <div className="mb-14 max-w-2xl">
            <p className="section-label">Meetings</p>
            <h2 className="section-title">{section.heading}</h2>
            {section.body && <p className="section-description">{section.body}</p>}
          </div>
        </FadeIn>
        <InlineSectionImage section={section} className="mb-12 max-h-[28rem]" />

        <StaggerChildren className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.08}>
          {[
            {
              icon: <Calendar className="h-6 w-6" />,
              label: "Schedule",
              value: "Regular meetings throughout the season",
            },
            {
              icon: <MapPin className="h-6 w-6" />,
              label: "Location",
              value: "Mark Masons' Hall, London",
            },
            {
              icon: <Clock className="h-6 w-6" />,
              label: "Timing",
              value: "Evenings, with festive board dining after",
            },
            {
              icon: <Shirt className="h-6 w-6" />,
              label: "Dress Code",
              value: "Dark lounge suit",
            },
          ].map((item) => (
            <StaggerItem key={item.label}>
              <div className="public-grid-card h-full">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white">
                  {item.icon}
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-2 text-base font-medium text-slate-950">{item.value}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerChildren>

        {section.cta_href && section.cta_label && (
          <FadeIn delay={0.3}>
            <div className="mt-10 text-center">
              <Button asChild variant="outline">
                <Link href={withQuery(section.cta_href, lodgeSlug)}>
                  {section.cta_label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </FadeIn>
        )}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
 *  OFFICERS: Grid of cards
 * ──────────────────────────────────────────────────────────── */
function OfficersSection({ section }: { section: SiteSection }) {
  return (
    <section className="relative overflow-hidden bg-white py-20 lg:py-28" aria-label="Officers">
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`}>
        <FadeIn>
          <div className="mb-14 max-w-2xl">
            <p className="section-label">Leadership</p>
            <h2 className="section-title">{section.heading}</h2>
            {section.body && <p className="section-description">{section.body}</p>}
          </div>
        </FadeIn>
        <InlineSectionImage section={section} className="mb-12 max-h-[28rem]" />

        <StaggerChildren className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.08}>
          {[
            { role: "Worshipful Master", name: "Leading the lodge" },
            { role: "Senior Warden", name: "Assisting in governance" },
            { role: "Junior Warden", name: "Overseeing the Festive Board" },
            { role: "Secretary", name: "Managing administration" },
            { role: "Treasurer", name: "Managing finances" },
            { role: "Director of Ceremonies", name: "Directing ritual" },
          ].map((officer) => (
            <StaggerItem key={officer.role}>
              <div className="public-grid-card h-full">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-950">{officer.role}</h3>
                <p className="mt-1 text-sm text-slate-500">{officer.name}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
 *  CHARITY: Warm impact section with progress
 * ──────────────────────────────────────────────────────────── */
function CharitySection({
  section,
  lodgeSlug,
}: {
  section: SiteSection;
  lodgeSlug: string;
}) {
  return (
    <section className="relative overflow-hidden border-y border-slate-200 bg-slate-50 py-20 lg:py-28" aria-label="Charity">
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`}>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <FadeIn>
            <div>
              <p className="section-label">Charity &amp; Giving</p>
              <h2 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                {section.heading}
              </h2>
              {section.body && (
                <p className="mt-6 text-lg leading-relaxed text-slate-600">
                  {section.body}
                </p>
              )}
              {section.cta_href && section.cta_label && (
                <Button
                  asChild
                  className="mt-8 bg-slate-950 text-white hover:bg-slate-800"
                >
                  <Link href={withQuery(section.cta_href, lodgeSlug)}>
                    {section.cta_label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            {section.style?.image_url ? (
              <InlineSectionImage section={section} />
            ) : (
              <div className="public-grid-card">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Heart className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-semibold text-slate-950">Annual Fundraising</h3>
                <p className="mt-3 text-sm text-slate-600">
                  Supporting local and national causes through events, dining donations, and direct giving.
                </p>
                <div className="mt-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">2024 Target</span>
                    <span className="font-semibold text-slate-950">£5,000</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-1000"
                      style={{ width: "68%" }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">£3,400 raised so far</p>
                </div>
              </div>
            )}
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
 *  EVENTS: Grid of event cards
 * ──────────────────────────────────────────────────────────── */
function EventsSection({
  section,
  lodgeSlug,
}: {
  section: SiteSection;
  lodgeSlug: string;
}) {
  return (
    <section className="relative overflow-hidden bg-white py-20 lg:py-28" aria-label="Events">
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`}>
        <FadeIn>
          <div className="mb-14 max-w-2xl">
            <p className="section-label">Events</p>
            <h2 className="section-title">{section.heading}</h2>
            {section.body && <p className="section-description">{section.body}</p>}
          </div>
        </FadeIn>
        <InlineSectionImage section={section} className="mb-12 max-h-[28rem]" />

        <StaggerChildren className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.08}>
          {[
            {
              title: "Regular Meeting",
              date: "Monthly",
              desc: "Ceremony, lodge business, and Festive Board",
            },
            {
              title: "Installation Meeting",
              date: "Annual",
              desc: "Installation of the new Worshipful Master",
            },
            {
              title: "Ladies' Festival",
              date: "Annual",
              desc: "A social celebration with partners and guests",
            },
          ].map((event) => (
            <StaggerItem key={event.title}>
              <div className="public-grid-card h-full">
                <div className="mb-3 inline-flex rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  {event.date}
                </div>
                <h3 className="text-xl font-semibold text-slate-950">{event.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{event.desc}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerChildren>

        {section.cta_href && section.cta_label && (
          <FadeIn delay={0.3}>
            <div className="mt-10 text-center">
              <Button asChild variant="outline">
                <Link href={withQuery(section.cta_href, lodgeSlug)}>
                  {section.cta_label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </FadeIn>
        )}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
 *  FAQ: Radix Accordion
 * ──────────────────────────────────────────────────────────── */
function FaqSection({ section }: { section: SiteSection }) {
  const defaultFaqs = [
    {
      q: "What is Freemasonry?",
      a: "Freemasonry is one of the world's oldest social and charitable organisations. It is based on the principles of integrity, kindness, honesty, and fairness.",
    },
    {
      q: "How do I join?",
      a: "You need to be over 21, believe in a Supreme Being, and be of good character. Contact us to begin a conversation about membership.",
    },
    {
      q: "What happens at meetings?",
      a: "Meetings include ceremonial work, lodge business, and a Festive Board (formal dinner) afterwards. Dress code is dark lounge suit.",
    },
    {
      q: "Is Freemasonry a religion?",
      a: "No. Freemasonry is not a religion, nor a substitute for religion. Members are encouraged to continue practising their own faith.",
    },
    {
      q: "What does it cost?",
      a: "Annual dues vary by lodge. There is an initiation fee and yearly subscription, plus dining costs for events attended.",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-white py-20 lg:py-28" aria-label="Frequently asked questions">
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`}>
        <div className="grid gap-12 lg:grid-cols-[0.4fr_1fr]">
          <FadeIn>
            <div>
              <p className="section-label">FAQ</p>
              <h2 className="section-title">{section.heading}</h2>
              {section.body && <p className="section-description">{section.body}</p>}
              <InlineSectionImage section={section} className="mt-8" />
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <Accordion type="single" collapsible className="w-full">
              {defaultFaqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left font-semibold text-slate-950">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
 *  JOIN: Dark CTA section
 * ──────────────────────────────────────────────────────────── */
function JoinSection({
  section,
  lodgeSlug,
  lodge,
}: {
  section: SiteSection;
  lodgeSlug: string;
  lodge: LodgeData | null;
}) {
  const mode = formModeFor(section);
  return (
    <section className="relative overflow-hidden bg-slate-950 py-24 lg:py-32" aria-label="Join us">
      <SectionBackground section={section} />
      <div className="absolute inset-0 bg-grid-overlay bg-[size:28px_28px] opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/90 to-slate-950" />
      <div className="container-full relative z-10 text-center">
        <FadeIn>
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200">
            Become a member
          </p>
          <h2 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
            {section.heading}
          </h2>
          {section.body && (
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              {section.body}
            </p>
          )}
          <InlineSectionImage section={section} className="mx-auto mt-10 max-w-3xl" />
          {mode !== "none" ? (
            <SectionFormCard mode={mode} lodgeSlug={lodgeSlug} lodge={lodge} dark />
          ) : null}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {section.cta_href && section.cta_label && (
              <Button
                asChild
                size="lg"
                className="rounded-xl bg-white text-slate-950 hover:bg-white/90"
              >
                <Link href={withQuery(section.cta_href, lodgeSlug)}>
                  {section.cta_label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="rounded-xl border-white/10 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href={withQuery("/contact", lodgeSlug)}>Contact Us</Link>
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
 *  CONTACT: Form + Lodge details
 * ──────────────────────────────────────────────────────────── */
function ContactSection({
  section,
  lodge,
  lodgeSlug,
}: {
  section: SiteSection;
  lodge: LodgeData | null;
  lodgeSlug: string;
}) {
  const mode = formModeFor(section);
  return (
    <section className="relative overflow-hidden border-t border-slate-200 bg-white py-20 lg:py-28" aria-label="Contact">
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`}>
        <div className="grid gap-14 lg:grid-cols-[1fr_0.8fr]">
          <FadeIn>
            <div>
              <p className="section-label">Contact</p>
              <h2 className="section-title">{section.heading}</h2>
              {section.body && <p className="section-description">{section.body}</p>}
              <InlineSectionImage section={section} className="mt-8" />

              {mode !== "none" ? (
                <div className="mt-10">
                  {mode === "lead" ? (
                    <LeadIntakeForm lodgeSlug={lodgeSlug} />
                  ) : (
                    <ContactEnquiryForm lodgeSlug={lodgeSlug} lodge={lodge} />
                  )}
                </div>
              ) : null}
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="public-grid-card-muted h-fit lg:mt-20">
              <h3 className="text-lg font-semibold text-slate-950">Lodge Details</h3>
              <div className="mt-6 space-y-5">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-950">Meeting Location</p>
                    <p className="text-sm text-slate-600">
                      Mark Masons&apos; Hall, 86 St James&apos;s Street, London SW1A 1PL
                    </p>
                  </div>
                </div>
                {lodge?.support_email && (
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-950">Email</p>
                      <a
                        href={`mailto:${lodge.support_email}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        {lodge.support_email}
                      </a>
                    </div>
                  </div>
                )}
                {lodge?.support_phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-950">Phone</p>
                      <a
                        href={`tel:${lodge.support_phone}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        {lodge.support_phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
 *  GENERIC FALLBACK: for unknown section types
 * ──────────────────────────────────────────────────────────── */
function GenericSection({ section }: { section: SiteSection }) {
  return (
    <section className="relative overflow-hidden bg-white py-20 lg:py-28" aria-label={section.heading}>
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`}>
        <FadeIn>
          <div className="public-grid-card max-w-3xl">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              {section.type.replaceAll("_", " ")}
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">{section.heading}</h2>
            {section.body && (
              <p className="mt-3 leading-relaxed text-slate-600">{section.body}</p>
            )}
            <InlineSectionImage section={section} className="mt-8" />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
 *  Section dispatcher
 * ──────────────────────────────────────────────────────────── */
function SectionRenderer({
  section,
  lodge,
  lodgeSlug,
}: {
  section: SiteSection;
  lodge: LodgeData | null;
  lodgeSlug: string;
}) {
  let rendered: ReactNode;
  switch (section.type) {
    case "hero":
      rendered = <HeroSection section={section} lodge={lodge} lodgeSlug={lodgeSlug} />;
      break;
    case "about":
      rendered = <AboutSection section={section} />;
      break;
    case "meeting_details":
      rendered = <MeetingDetailsSection section={section} lodgeSlug={lodgeSlug} />;
      break;
    case "officers":
      rendered = <OfficersSection section={section} />;
      break;
    case "charity":
      rendered = <CharitySection section={section} lodgeSlug={lodgeSlug} />;
      break;
    case "events":
      rendered = <EventsSection section={section} lodgeSlug={lodgeSlug} />;
      break;
    case "faq":
      rendered = <FaqSection section={section} />;
      break;
    case "join":
      rendered = <JoinSection section={section} lodgeSlug={lodgeSlug} lodge={lodge} />;
      break;
    case "contact":
      rendered = <ContactSection section={section} lodge={lodge} lodgeSlug={lodgeSlug} />;
      break;
    default:
      rendered = <GenericSection section={section} />;
      break;
  }
  return (
    <>
      {rendered}
      <StandaloneSectionForm section={section} lodgeSlug={lodgeSlug} lodge={lodge} />
    </>
  );
}

/* ────────────────────────────────────────────────────────────
 *  MAIN COMPONENT: LodgeHomepage
 * ──────────────────────────────────────────────────────────── */
export function LodgeHomepage() {
  const searchParams = useSearchParams();
  const rawLodgeQuery = searchParams.get("lodge");
  const lodgeSlug = useMemo(() => resolveLodgeSlug(rawLodgeQuery), [rawLodgeQuery]);
  const [payload, setPayload] = useState<SitePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/lodges/${lodgeSlug}/site`);
        if (!res.ok) return;
        const data = (await res.json()) as SitePayload;
        if (active) setPayload(data);
      } catch {
        // Graceful fallback
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [lodgeSlug]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />
          <p className="mt-4 text-sm text-slate-500">Loading lodge website...</p>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-white">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-slate-950">Lodge not found</h2>
          <p className="mt-2 text-slate-600">We couldn&apos;t load this lodge website.</p>
          <Button asChild className="mt-6" variant="outline">
            <Link href="/">Return Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const sections = [...payload.site.sections]
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  const heroSection = sections.find((s) => s.type === "hero");
  const otherSections = sections.filter((s) => s.type !== "hero");

  const hasJoinSection = sections.some((s) => s.type === "join");

  return (
    <div className="bg-white text-slate-950">
      {heroSection && (
        <SectionRenderer
          section={heroSection}
          lodge={payload.lodge}
          lodgeSlug={lodgeSlug}
        />
      )}

      {otherSections.map((section) => (
        <SectionRenderer
          key={section.id}
          section={section}
          lodge={payload.lodge}
          lodgeSlug={lodgeSlug}
        />
      ))}

      {!hasJoinSection && (
        <section className="relative overflow-hidden bg-slate-950 py-20" aria-label="Get involved">
          <div className="absolute inset-0 bg-grid-overlay bg-[size:28px_28px] opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 to-slate-950" />
          <div className="container-full relative z-10 text-center">
            <FadeIn>
              <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Interested in Freemasonry?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
                Whether you&apos;re curious about membership or want to attend an event, we&apos;d love to hear from you.
              </p>
              <Button
                asChild
                size="lg"
                className="mt-8 rounded-xl bg-white text-slate-950 hover:bg-white/90"
              >
                <Link href={withQuery("/join", lodgeSlug)}>
                  Express Interest
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </FadeIn>
          </div>
        </section>
      )}
    </div>
  );
}
