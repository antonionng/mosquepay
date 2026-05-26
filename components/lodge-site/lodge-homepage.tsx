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
import type { LodgeSiteFooterSettings, LodgeSiteHeaderSettings } from "@/lib/db/types";
import {
  heroBackgroundLayers,
  mergeHeroPrimaryColor,
  sectionContentWidthStyle,
  sectionBackgroundLayers,
  sectionDesignStyle,
  sectionToneClass,
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
  meeting_schedule: string | null;
  secretary_address: string | null;
  loi_contact: string | null;
  current_charity_campaign_id: string | null;
  meeting_location: string | null;
  meeting_location_url: string | null;
  accessibility_notes: string | null;
  default_dress_code: string | null;
};

type PublicUpcomingEvent = {
  id: string;
  slug: string;
  title: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  event_type: string;
};

type PublicOfficerSummary = {
  rung_id: string;
  rung_label: string;
  sort_order: number;
  member_id: string;
  full_name: string;
  rank: string | null;
  public_bio: string | null;
  public_photo_url: string | null;
};

type PublicCharityCampaign = {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  raised_amount: number;
  start_date: string;
  end_date: string | null;
};

type SitePayload = {
  lodge: LodgeData | null;
  site: {
    page_title: string;
    page_description: string | null;
    sections: SiteSection[];
    header_settings?: LodgeSiteHeaderSettings | null;
    footer_settings?: LodgeSiteFooterSettings | null;
    upcoming_public_events?: PublicUpcomingEvent[] | null;
    public_officers?: PublicOfficerSummary[] | null;
    charity_campaign?: PublicCharityCampaign | null;
    custom_pages?: Array<{
      id: string;
      slug: string;
      title: string;
      description: string | null;
      sections: SiteSection[];
      published: boolean;
      show_in_nav: boolean;
      nav_label: string | null;
      order: number;
    }>;
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

function formFieldVisible(section: SiteSection, field: string) {
  const configured = section.style?.form_fields;
  if (!configured || configured.length === 0) {
    return ["phone", "subject", "location", "how_heard", "message"].includes(field);
  }
  return configured.includes(field);
}

function formFieldRequired(section: SiteSection, field: string, core = false) {
  return core || Boolean(section.style?.form_required_fields?.includes(field));
}

function formThankYou(section: SiteSection, fallback: string) {
  return section.style?.form_thank_you?.trim() || fallback;
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

function sectionShellClass(section: SiteSection, className: string) {
  return `${className} ${sectionToneClass(section)}`;
}

function sectionShellStyle(section: SiteSection) {
  return sectionDesignStyle(section);
}

function sectionContainerStyle(section: SiteSection) {
  return sectionContentWidthStyle(section);
}

function ctaButtonProps(
  section: SiteSection,
  opts: { className?: string; dark?: boolean } = {}
) {
  const variant = section.style?.button_variant ?? "solid";
  if (variant === "outline") {
    return {
      variant: "outline" as const,
      className: opts.className,
    };
  }
  if (variant === "ghost") {
    return {
      variant: "ghost" as const,
      className: opts.className,
    };
  }
  return {
    className:
      opts.className ??
      (opts.dark
        ? "rounded-xl bg-white text-slate-950 hover:bg-white/90"
        : "bg-slate-950 text-white hover:bg-slate-800"),
  };
}

function ContactEnquiryForm({
  lodgeSlug,
  lodge,
  section,
  dark = false,
}: {
  lodgeSlug: string;
  lodge: LodgeData | null;
  section: SiteSection;
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
          section_id: section.id,
          website: form.get("website"),
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          subject: form.get("subject") || `Website enquiry for ${lodge?.name ?? "the lodge"}`,
          message: form.get("message"),
          consent: form.get("consent") === "on",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send enquiry.");
      event.currentTarget.reset();
      setStatus(formThankYou(section, "Thanks. Your message has been sent to the lodge secretary."));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send enquiry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id="contact-form" className="space-y-5" onSubmit={submit}>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />
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
      {formFieldVisible(section, "phone") || formFieldVisible(section, "subject") ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {formFieldVisible(section, "phone") ? (
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                name="phone"
                required={formFieldRequired(section, "phone")}
                placeholder="Optional"
              />
            </div>
          ) : null}
          {formFieldVisible(section, "subject") ? (
            <div className="space-y-2">
              <Label htmlFor="contact-subject">Subject</Label>
              <Input
                id="contact-subject"
                name="subject"
                required={formFieldRequired(section, "subject")}
                placeholder="Visiting, membership, or general enquiry"
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {formFieldVisible(section, "message") ? (
        <div className="space-y-2">
          <Label htmlFor="contact-message">Message</Label>
          <Textarea
            id="contact-message"
            name="message"
            required={formFieldRequired(section, "message", true)}
            placeholder="Tell us how the lodge can help..."
            rows={5}
          />
        </div>
      ) : null}
      {formFieldVisible(section, "consent") ? (
        <label className={dark ? "flex gap-2 text-sm text-slate-300" : "flex gap-2 text-sm text-slate-600"}>
          <input name="consent" type="checkbox" required className="mt-1" />
          {section.style?.form_consent_text ?? "I agree to be contacted about my enquiry."}
        </label>
      ) : null}
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
  section,
  dark = false,
}: {
  lodgeSlug: string;
  section: SiteSection;
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
          section_id: section.id,
          website: form.get("website"),
          first_name: form.get("first_name"),
          last_name: form.get("last_name"),
          email: form.get("email"),
          phone: form.get("phone"),
          location: form.get("location"),
          how_heard: form.get("how_heard"),
          message: form.get("message"),
          consent: form.get("consent") === "on",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send lead intake.");
      event.currentTarget.reset();
      setStatus(formThankYou(section, "Thanks. Your enquiry has been added and sent to the lodge secretary."));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send lead intake.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id="lead-intake" className="space-y-5" onSubmit={submit}>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />
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
        {formFieldVisible(section, "phone") ? (
          <div className="space-y-2">
            <Label htmlFor="lead-phone">Phone</Label>
            <Input
              id="lead-phone"
              name="phone"
              required={formFieldRequired(section, "phone")}
              placeholder="Optional"
            />
          </div>
        ) : null}
      </div>
      {formFieldVisible(section, "location") || formFieldVisible(section, "how_heard") ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {formFieldVisible(section, "location") ? (
            <div className="space-y-2">
              <Label htmlFor="lead-location">Location</Label>
              <Input
                id="lead-location"
                name="location"
                required={formFieldRequired(section, "location")}
                placeholder="Town or city"
              />
            </div>
          ) : null}
          {formFieldVisible(section, "how_heard") ? (
            <div className="space-y-2">
              <Label htmlFor="lead-how-heard">How did you hear about us?</Label>
              <Input
                id="lead-how-heard"
                name="how_heard"
                required={formFieldRequired(section, "how_heard")}
                placeholder="Friend, search, event..."
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {formFieldVisible(section, "message") ? (
        <div className="space-y-2">
          <Label htmlFor="lead-message">Message</Label>
          <Textarea
            id="lead-message"
            name="message"
            required={formFieldRequired(section, "message")}
            placeholder="Tell us a little about your interest in visiting or joining..."
            rows={5}
          />
        </div>
      ) : null}
      {formFieldVisible(section, "consent") ? (
        <label className={dark ? "flex gap-2 text-sm text-slate-300" : "flex gap-2 text-sm text-slate-600"}>
          <input name="consent" type="checkbox" required className="mt-1" />
          {section.style?.form_consent_text ?? "I agree to be contacted about my membership enquiry."}
        </label>
      ) : null}
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
  section,
  dark = false,
}: {
  mode: "contact" | "lead";
  lodgeSlug: string;
  lodge: LodgeData | null;
  section: SiteSection;
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
        <LeadIntakeForm lodgeSlug={lodgeSlug} section={section} dark={dark} />
      ) : (
        <ContactEnquiryForm lodgeSlug={lodgeSlug} lodge={lodge} section={section} dark={dark} />
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
        <SectionFormCard mode={mode} lodgeSlug={lodgeSlug} lodge={lodge} section={section} />
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
  footerSettings,
}: {
  section: SiteSection;
  lodge: LodgeData | null;
  lodgeSlug: string;
  footerSettings: LodgeSiteFooterSettings | null;
}) {
  const layers = heroBackgroundLayers(section);
  const primaryHex = mergeHeroPrimaryColor(section, lodge?.primary_color);
  const hasCustomBg = Boolean(layers.imageUrl);
  const showPoweredBy = footerSettings?.show_powered_by !== false;
  const hasCharity = Boolean(lodge?.current_charity_campaign_id);

  return (
    <section
      className={sectionShellClass(section, "public-hero")}
      style={sectionShellStyle(section)}
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
      <div
        className="public-hero-shell lg:!grid-cols-1 lg:!items-center"
        style={sectionContainerStyle(section)}
      >
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
                  {...ctaButtonProps(section, {
                    className: "rounded-xl text-white shadow-lg transition hover:opacity-95",
                    dark: true,
                  })}
                  style={
                    section.style?.button_variant === "solid" ||
                    !section.style?.button_variant
                      ? { backgroundColor: primaryHex }
                      : undefined
                  }
                >
                  <Link href={withQuery(section.cta_href, lodgeSlug)}>
                    {section.cta_label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
              {hasCharity ? (
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="rounded-xl border-white/10 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  <Link href={withQuery("/charity", lodgeSlug)}>Our Charity</Link>
                </Button>
              ) : null}
            </div>
          </FadeIn>
          <FadeIn delay={0.5}>
            <div className="public-hero-meta mt-12 justify-center">
              {lodge?.city && <span className="public-hero-meta-chip">{lodge.city}</span>}
              <span className="public-hero-meta-chip">Established Tradition</span>
              {showPoweredBy ? (
                <Link
                  href="https://lodgepayments.co.uk"
                  target="_blank"
                  rel="noreferrer"
                  className="public-hero-meta-chip"
                >
                  Powered by LodgePay
                </Link>
              ) : null}
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
    <section
      className={sectionShellClass(section, "relative overflow-hidden bg-white py-20 lg:py-28")}
      style={sectionShellStyle(section)}
      aria-label="About"
    >
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`} style={sectionContainerStyle(section)}>
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
                <Button asChild {...ctaButtonProps(section, { className: "mt-8" })}>
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
  lodge,
  lodgeSlug,
}: {
  section: SiteSection;
  lodge: LodgeData | null;
  lodgeSlug: string;
}) {
  const venue = lodge?.meeting_location ?? lodge?.secretary_address ?? null;
  const cards: {
    icon: ReactNode;
    label: string;
    value: string;
    href?: string;
    helper?: string | null;
  }[] = [];
  if (lodge?.meeting_schedule) {
    cards.push({
      icon: <Calendar className="h-6 w-6" />,
      label: "Schedule",
      value: lodge.meeting_schedule,
    });
  }
  if (venue) {
    cards.push({
      icon: <MapPin className="h-6 w-6" />,
      label: "Where we meet",
      value: venue,
      href: lodge?.meeting_location_url ?? undefined,
      helper: lodge?.accessibility_notes ?? null,
    });
  }
  if (lodge?.default_dress_code) {
    cards.push({
      icon: <Users className="h-6 w-6" />,
      label: "Dress code",
      value: lodge.default_dress_code,
    });
  }
  if (lodge?.loi_contact) {
    cards.push({
      icon: <Clock className="h-6 w-6" />,
      label: "Lodge of Instruction",
      value: lodge.loi_contact,
    });
  }
  return (
    <section
      className={sectionShellClass(section, "relative overflow-hidden border-y border-slate-200 bg-slate-50 py-20 lg:py-28")}
      style={sectionShellStyle(section)}
      aria-label="Meeting details"
    >
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`} style={sectionContainerStyle(section)}>
        <FadeIn>
          <div className="mb-14 max-w-2xl">
            <p className="section-label">Meetings</p>
            <h2 className="section-title">{section.heading}</h2>
            {section.body && <p className="section-description">{section.body}</p>}
          </div>
        </FadeIn>
        <InlineSectionImage section={section} className="mb-12 max-h-[28rem]" />

        {cards.length > 0 ? (
          <StaggerChildren className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.08}>
            {cards.map((item) => (
              <StaggerItem key={item.label}>
                <div className="public-grid-card h-full">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white">
                    {item.icon}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {item.label}
                  </p>
                  {item.href ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 inline-flex items-start gap-2 text-base font-medium text-slate-950 hover:text-blue-700 whitespace-pre-line"
                    >
                      <span>{item.value}</span>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 -rotate-45" aria-hidden />
                    </a>
                  ) : (
                    <p className="mt-2 text-base font-medium text-slate-950 whitespace-pre-line">
                      {item.value}
                    </p>
                  )}
                  {item.helper ? (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                      {item.helper}
                    </p>
                  ) : null}
                </div>
              </StaggerItem>
            ))}
          </StaggerChildren>
        ) : null}

        {section.cta_href && section.cta_label && (
          <FadeIn delay={0.3}>
            <div className="mt-10 text-center">
              <Button asChild {...ctaButtonProps(section)}>
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
function memberInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase() || "?";
}

function OfficersSection({
  section,
  officers,
}: {
  section: SiteSection;
  officers: PublicOfficerSummary[];
}) {
  // Officer names, photos, and bios are rendered only when each member
  // has explicitly opted in via `members.show_on_website` and is still
  // an active member. When no member has opted in we keep the heading /
  // body / image so the lodge can still describe its officers in their
  // own words, but the grid collapses so we never invent a roster.
  const hasOfficers = officers.length > 0;
  const hasIntro =
    Boolean(section.body?.trim()) || Boolean(section.style?.image_url);
  if (!hasOfficers && !hasIntro) return null;
  return (
    <section
      className={sectionShellClass(section, "relative overflow-hidden bg-white py-20 lg:py-28")}
      style={sectionShellStyle(section)}
      aria-label="Officers"
    >
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`} style={sectionContainerStyle(section)}>
        <FadeIn>
          <div className="mb-10 max-w-2xl">
            <p className="section-label">Leadership</p>
            <h2 className="section-title">{section.heading}</h2>
            {section.body && <p className="section-description">{section.body}</p>}
          </div>
        </FadeIn>
        <InlineSectionImage section={section} className="mb-12 max-h-[28rem]" />

        {hasOfficers ? (
          <StaggerChildren
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            staggerDelay={0.06}
          >
            {officers.map((officer) => (
              <StaggerItem key={officer.rung_id}>
                <article className="public-grid-card flex h-full flex-col">
                  <div className="flex items-center gap-4">
                    {officer.public_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={officer.public_photo_url}
                        alt={`Headshot of ${officer.full_name}`}
                        className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-slate-100"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-950 text-base font-semibold text-white"
                        aria-hidden
                      >
                        {memberInitials(officer.full_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {officer.rung_label}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">
                        {officer.full_name}
                      </p>
                      {officer.rank ? (
                        <p className="mt-0.5 text-sm text-slate-500">
                          {officer.rank}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {officer.public_bio ? (
                    <p className="mt-5 text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                      {officer.public_bio}
                    </p>
                  ) : null}
                </article>
              </StaggerItem>
            ))}
          </StaggerChildren>
        ) : null}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
 *  CHARITY: Warm impact section with progress
 * ──────────────────────────────────────────────────────────── */
function formatGBP(value: number): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `£${Math.round(value).toLocaleString("en-GB")}`;
  }
}

function CharitySection({
  section,
  lodgeSlug,
  campaign,
}: {
  section: SiteSection;
  lodgeSlug: string;
  campaign: PublicCharityCampaign | null;
}) {
  // Real fundraising progress is shown only when an admin has pinned a
  // charity campaign via lodges.current_charity_campaign_id. Otherwise
  // we render the user-editable heading/body/image only, with no fake
  // progress bar. The hero "Our Charity" CTA is governed by the same
  // flag.
  const hasProgress = Boolean(campaign && campaign.target_amount > 0);
  const ratio =
    campaign && campaign.target_amount > 0
      ? Math.max(0, Math.min(1, campaign.raised_amount / campaign.target_amount))
      : 0;
  const percent = Math.round(ratio * 100);
  return (
    <section
      className={sectionShellClass(section, "relative overflow-hidden border-y border-slate-200 bg-slate-50 py-20 lg:py-28")}
      style={sectionShellStyle(section)}
      aria-label="Charity"
    >
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`} style={sectionContainerStyle(section)}>
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
                <Button asChild {...ctaButtonProps(section, { className: "mt-8" })}>
                  <Link href={withQuery(section.cta_href, lodgeSlug)}>
                    {section.cta_label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            {campaign ? (
              <div className="public-grid-card">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Heart className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-semibold text-slate-950">
                  {campaign.name}
                </h3>
                {campaign.description ? (
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                    {campaign.description}
                  </p>
                ) : null}
                {hasProgress ? (
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">Target</span>
                      <span className="font-semibold text-slate-950">
                        {formatGBP(campaign.target_amount)}
                      </span>
                    </div>
                    <div
                      className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percent}
                      aria-label={`${campaign.name} progress`}
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-1000"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatGBP(campaign.raised_amount)} raised so far ({percent}%)
                    </p>
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-slate-500">
                    Every donation, large or small, makes a difference.
                  </p>
                )}
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-6 w-full justify-center sm:w-auto"
                >
                  <Link href={withQuery("/donate", lodgeSlug)}>
                    Donate to this campaign
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : section.style?.image_url ? (
              <InlineSectionImage section={section} />
            ) : (
              <div className="public-grid-card">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Heart className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-semibold text-slate-950">
                  Annual Fundraising
                </h3>
                <p className="mt-3 text-sm text-slate-600">
                  Supporting local and national causes through events, dining
                  donations, and direct giving. Pin a current campaign in the
                  admin to show live progress here.
                </p>
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
  events,
}: {
  section: SiteSection;
  lodgeSlug: string;
  events: PublicUpcomingEvent[];
}) {
  // Regular lodge meetings are private. This grid is populated only with
  // events that pass `isPubliclyVisible` (socials, charity, and admin-
  // featured public meetings). When the list is empty we still render the
  // user-editable heading/body/image, but the grid and CTA collapse so the
  // lodge never advertises a fake calendar.
  const hasEvents = events.length > 0;
  return (
    <section
      className={sectionShellClass(section, "relative overflow-hidden bg-white py-20 lg:py-28")}
      style={sectionShellStyle(section)}
      aria-label="Public events"
    >
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`} style={sectionContainerStyle(section)}>
        <FadeIn>
          <div className="mb-10 max-w-2xl">
            <p className="section-label">Open events and socials</p>
            <h2 className="section-title">{section.heading}</h2>
            {section.body && <p className="section-description">{section.body}</p>}
          </div>
        </FadeIn>
        <InlineSectionImage section={section} className="mb-12 max-h-[28rem]" />

        {hasEvents ? (
          <StaggerChildren className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" staggerDelay={0.08}>
            {events.map((event) => (
              <StaggerItem key={event.id}>
                <Link
                  href={withQuery(`/events/${event.slug}`, lodgeSlug)}
                  className="group public-grid-card block h-full"
                >
                  <div className="mb-3 inline-flex rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold capitalize text-blue-700">
                    {event.event_type.replace(/_/g, " ")}
                  </div>
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-blue-600">
                    <Calendar className="h-4 w-4" />
                    {formatEventDateLine(event.event_date, event.event_time)}
                  </div>
                  <h3 className="text-xl font-semibold text-slate-950 transition-colors group-hover:text-blue-700">
                    {event.title}
                  </h3>
                  {event.location ? (
                    <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500">
                      <MapPin className="h-4 w-4" />
                      {event.location}
                    </p>
                  ) : null}
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600">
                    View details
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </StaggerChildren>
        ) : null}

        {hasEvents && section.cta_href && section.cta_label && (
          <FadeIn delay={0.3}>
            <div className="mt-10 text-center">
              <Button asChild {...ctaButtonProps(section)}>
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

function formatEventDateLine(dateIso: string, timeIso: string | null) {
  const datePart = formatPublicDate(dateIso);
  if (!timeIso) return datePart;
  return `${datePart} · ${timeIso.slice(0, 5)}`;
}

function formatPublicDate(value: string) {
  try {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

/* ────────────────────────────────────────────────────────────
 *  FAQ: Radix Accordion
 * ──────────────────────────────────────────────────────────── */
function FaqSection({ section }: { section: SiteSection }) {
  // FAQ entries are configured per-lodge (Phase 1 adds the admin editor).
  // When no entries exist we keep the heading/body/image but drop the
  // accordion so we never invent answers on behalf of the lodge.
  const entries = section.style?.faq_entries ?? [];
  const hasEntries = entries.length > 0;
  const hasIntro =
    Boolean(section.body?.trim()) || Boolean(section.style?.image_url);
  if (!hasEntries && !hasIntro) return null;
  return (
    <section
      className={sectionShellClass(section, "relative overflow-hidden bg-white py-20 lg:py-28")}
      style={sectionShellStyle(section)}
      aria-label="Frequently asked questions"
    >
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`} style={sectionContainerStyle(section)}>
        <div className="grid gap-12 lg:grid-cols-[0.4fr_1fr]">
          <FadeIn>
            <div>
              <p className="section-label">FAQ</p>
              <h2 className="section-title">{section.heading}</h2>
              {section.body && <p className="section-description">{section.body}</p>}
              <InlineSectionImage section={section} className="mt-8" />
            </div>
          </FadeIn>

          {hasEntries ? (
            <FadeIn delay={0.15}>
              <Accordion type="single" collapsible className="w-full">
                {entries.map((faq, i) => (
                  <AccordionItem key={`${faq.question}-${i}`} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left font-semibold text-slate-950">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 leading-relaxed whitespace-pre-line">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </FadeIn>
          ) : null}
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
    <section
      className={sectionShellClass(section, "relative overflow-hidden bg-slate-950 py-24 lg:py-32")}
      style={sectionShellStyle(section)}
      aria-label="Join us"
    >
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
            <SectionFormCard mode={mode} lodgeSlug={lodgeSlug} lodge={lodge} section={section} dark />
          ) : null}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {section.cta_href && section.cta_label && (
              <Button asChild size="lg" {...ctaButtonProps(section, { dark: true })}>
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
    <section
      className={sectionShellClass(section, "relative overflow-hidden border-t border-slate-200 bg-white py-20 lg:py-28")}
      style={sectionShellStyle(section)}
      aria-label="Contact"
    >
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`} style={sectionContainerStyle(section)}>
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
                    <LeadIntakeForm lodgeSlug={lodgeSlug} section={section} />
                  ) : (
                    <ContactEnquiryForm lodgeSlug={lodgeSlug} lodge={lodge} section={section} />
                  )}
                </div>
              ) : null}
            </div>
          </FadeIn>

          {(() => {
            const hasAddress = Boolean(lodge?.secretary_address);
            const hasEmail = Boolean(lodge?.support_email);
            const hasPhone = Boolean(lodge?.support_phone);
            if (!hasAddress && !hasEmail && !hasPhone) return null;
            return (
              <FadeIn delay={0.15}>
                <div className="public-grid-card-muted h-fit lg:mt-20">
                  <h3 className="text-lg font-semibold text-slate-950">Lodge details</h3>
                  <div className="mt-6 space-y-5">
                    {hasAddress && lodge?.secretary_address ? (
                      <div className="flex items-start gap-3">
                        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-950">Meeting location</p>
                          <p className="text-sm text-slate-600 whitespace-pre-line">
                            {lodge.secretary_address}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {hasEmail && lodge?.support_email ? (
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
                    ) : null}
                    {hasPhone && lodge?.support_phone ? (
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
                    ) : null}
                  </div>
                </div>
              </FadeIn>
            );
          })()}
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
    <section
      className={sectionShellClass(section, "relative overflow-hidden bg-white py-20 lg:py-28")}
      style={sectionShellStyle(section)}
      aria-label={section.heading}
    >
      <SectionBackground section={section} />
      <div className={`container-full ${sectionContentClass(section)}`} style={sectionContainerStyle(section)}>
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
  upcomingPublicEvents,
  publicOfficers,
  charityCampaign,
  footerSettings,
}: {
  section: SiteSection;
  lodge: LodgeData | null;
  lodgeSlug: string;
  upcomingPublicEvents: PublicUpcomingEvent[];
  publicOfficers: PublicOfficerSummary[];
  charityCampaign: PublicCharityCampaign | null;
  footerSettings: LodgeSiteFooterSettings | null;
}) {
  let rendered: ReactNode;
  switch (section.type) {
    case "hero":
      rendered = (
        <HeroSection
          section={section}
          lodge={lodge}
          lodgeSlug={lodgeSlug}
          footerSettings={footerSettings}
        />
      );
      break;
    case "about":
      rendered = <AboutSection section={section} />;
      break;
    case "meeting_details":
      rendered = (
        <MeetingDetailsSection
          section={section}
          lodge={lodge}
          lodgeSlug={lodgeSlug}
        />
      );
      break;
    case "officers":
      rendered = <OfficersSection section={section} officers={publicOfficers} />;
      break;
    case "charity":
      rendered = (
        <CharitySection
          section={section}
          lodgeSlug={lodgeSlug}
          campaign={charityCampaign}
        />
      );
      break;
    case "events":
      rendered = (
        <EventsSection
          section={section}
          lodgeSlug={lodgeSlug}
          events={upcomingPublicEvents}
        />
      );
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
export function LodgeHomepage({
  pageSlug = "home",
  initialLodgeSlug,
  initialPayload = null,
}: {
  pageSlug?: string;
  initialLodgeSlug?: string | null;
  initialPayload?: SitePayload | null;
}) {
  const searchParams = useSearchParams();
  const rawLodgeQuery = searchParams.get("lodge");
  const lodgeSlug = useMemo(
    () => initialLodgeSlug ?? resolveLodgeSlug(rawLodgeQuery),
    [initialLodgeSlug, rawLodgeQuery]
  );
  const [payload, setPayload] = useState<SitePayload | null>(initialPayload);
  const [loading, setLoading] = useState(!initialPayload);

  useEffect(() => {
    if (initialPayload && initialLodgeSlug === lodgeSlug) return;

    let active = true;
    async function load() {
      try {
        const res = await fetch(
          initialLodgeSlug && !rawLodgeQuery
            ? "/api/lodges/current/site"
            : `/api/lodges/${lodgeSlug}/site`
        );
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
  }, [initialPayload, initialLodgeSlug, lodgeSlug, rawLodgeQuery]);

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

  const customPage =
    pageSlug === "home"
      ? null
      : payload.site.custom_pages?.find((page) => page.slug === pageSlug) ?? null;

  if (pageSlug !== "home" && (!customPage || !customPage.published)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-white">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-slate-950">Page not found</h2>
          <p className="mt-2 text-slate-600">This lodge page is not published.</p>
          <Button asChild className="mt-6" variant="outline">
            <Link href={`/?lodge=${encodeURIComponent(lodgeSlug)}`}>Return to lodge home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const activeSections = customPage?.sections ?? payload.site.sections;
  const sections = [...activeSections]
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  const heroSection = sections.find((s) => s.type === "hero");
  const otherSections = sections.filter((s) => s.type !== "hero");

  const hasJoinSection = sections.some((s) => s.type === "join");
  const upcomingPublicEvents = payload.site.upcoming_public_events ?? [];
  const publicOfficers = payload.site.public_officers ?? [];
  const charityCampaign = payload.site.charity_campaign ?? null;
  const footerSettings = payload.site.footer_settings ?? null;

  return (
    <div className="bg-white text-slate-950">
      {heroSection && (
        <SectionRenderer
          section={heroSection}
          lodge={payload.lodge}
          lodgeSlug={lodgeSlug}
          upcomingPublicEvents={upcomingPublicEvents}
          publicOfficers={publicOfficers}
          charityCampaign={charityCampaign}
          footerSettings={footerSettings}
        />
      )}

      {otherSections.map((section) => (
        <SectionRenderer
          key={section.id}
          section={section}
          lodge={payload.lodge}
          lodgeSlug={lodgeSlug}
          upcomingPublicEvents={upcomingPublicEvents}
          publicOfficers={publicOfficers}
          charityCampaign={charityCampaign}
          footerSettings={footerSettings}
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
