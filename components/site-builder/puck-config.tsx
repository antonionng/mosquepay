"use client";

import type { Config } from "@measured/puck";
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
  MapPin,
  Clock,
  Phone,
  ChevronDown,
  Star,
  Shield,
} from "lucide-react";
import { heroBackgroundLayers } from "@/lib/site-section-style";
import { ImageUploadField } from "./image-upload-field";

type HeroProps = {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  primaryColor: string;
  backgroundImageUrl: string;
  overlayOpacity: number;
  backgroundPosition: string;
};

type SectionProps = {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl?: string;
  imageAlt?: string;
  imagePosition?: "left" | "right" | "top" | "bottom" | "full";
  imageShape?: "rounded" | "square" | "circle" | "arch";
  backgroundImageUrl?: string;
  overlayOpacity?: number;
  backgroundPosition?: string;
  formMode?: "none" | "contact" | "newcomer";
  backgroundTone?: "default" | "soft" | "brand" | "dark";
  contentWidth?: "narrow" | "standard" | "wide" | "full";
  spacing?: "compact" | "normal" | "spacious";
  buttonVariant?: "solid" | "outline" | "ghost";
  formFields?: string;
  formRequiredFields?: string;
  formConsentText?: string;
  formThankYou?: string;
  formNotificationRecipients?: string;
  formAutoresponderSubject?: string;
  formAutoresponderBody?: string;
};

type ComponentProps = {
  Hero: HeroProps;
  About: SectionProps;
  ServiceDetails: SectionProps;
  Officers: SectionProps;
  Charity: SectionProps;
  Events: SectionProps;
  FAQ: SectionProps;
  JoinUs: SectionProps;
  Contact: SectionProps;
};

type CustomFieldRenderProps = {
  value: unknown;
  onChange: (value: string) => void;
};

function CTAButton({
  label,
  href,
  color = "#3b82f6",
  variant = "solid",
}: {
  label: string;
  href: string;
  color?: string;
  variant?: "solid" | "outline" | "ghost";
}) {
  if (!label) return null;
  return (
    <a
      href={href || "#"}
      className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5"
      style={
        variant === "outline"
          ? { border: `2px solid ${color}`, color }
          : variant === "ghost"
            ? { color }
            : { backgroundColor: color, color: "#fff" }
      }
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </a>
  );
}

function SectionContainer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`px-6 py-16 sm:px-8 md:py-20 ${className}`}>
      <div className="mx-auto max-w-4xl">{children}</div>
    </section>
  );
}

function SectionBadge({
  icon: Icon,
  label,
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function SectionImage({
  imageUrl,
  imageAlt,
  imageShape,
  className = "",
}: {
  imageUrl?: string;
  imageAlt?: string;
  imageShape?: string;
  className?: string;
}) {
  if (!imageUrl) return null;
  const shapeClass =
    imageShape === "circle"
      ? "rounded-full"
      : imageShape === "arch"
        ? "rounded-t-full rounded-b-[2rem]"
        : imageShape === "square"
          ? "rounded-none"
          : "rounded-3xl";
  return (
    <div className={`mt-8 overflow-hidden border border-slate-200 bg-slate-100 shadow-lg ${shapeClass} ${className}`}>
      <img
        src={imageUrl}
        alt={imageAlt || ""}
        className="h-full min-h-56 w-full object-cover"
      />
    </div>
  );
}

const sectionFields = {
  heading: { type: "text" as const },
  body: { type: "textarea" as const },
  ctaLabel: { type: "text" as const, label: "CTA Label" },
  ctaHref: { type: "text" as const, label: "CTA Link" },
  imageUrl: {
    type: "custom" as const,
    label: "Section image",
    render: ({ value, onChange }: CustomFieldRenderProps) => (
      <ImageUploadField
        label="Section image"
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
        compact
      />
    ),
  },
  imageAlt: { type: "text" as const, label: "Image alt text" },
  imagePosition: {
    type: "select" as const,
    label: "Image position",
    options: [
      { label: "Top", value: "top" },
      { label: "Right", value: "right" },
      { label: "Left", value: "left" },
      { label: "Bottom", value: "bottom" },
      { label: "Full width", value: "full" },
    ],
  },
  imageShape: {
    type: "select" as const,
    label: "Image shape",
    options: [
      { label: "Rounded", value: "rounded" },
      { label: "Square", value: "square" },
      { label: "Circle", value: "circle" },
      { label: "Arch", value: "arch" },
    ],
  },
  backgroundImageUrl: {
    type: "custom" as const,
    label: "Background image",
    render: ({ value, onChange }: CustomFieldRenderProps) => (
      <ImageUploadField
        label="Background image"
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
        compact
      />
    ),
  },
  overlayOpacity: {
    type: "number" as const,
    label: "Background overlay (0-1)",
    min: 0,
    max: 1,
    step: 0.05,
  },
  backgroundPosition: {
    type: "select" as const,
    label: "Background position",
    options: [
      { label: "Center", value: "center" },
      { label: "Top", value: "top" },
      { label: "Bottom", value: "bottom" },
      { label: "Top left", value: "top left" },
      { label: "Top right", value: "top right" },
    ],
  },
  formMode: {
    type: "select" as const,
    label: "Embedded form",
    options: [
      { label: "No form", value: "none" },
      { label: "Contact secretary", value: "contact" },
      { label: "Newcomer intake", value: "newcomer" },
    ],
  },
  backgroundTone: {
    type: "select" as const,
    label: "Background tone",
    options: [
      { label: "Default", value: "default" },
      { label: "Soft", value: "soft" },
      { label: "Brand tint", value: "brand" },
      { label: "Dark", value: "dark" },
    ],
  },
  contentWidth: {
    type: "select" as const,
    label: "Content width",
    options: [
      { label: "Narrow", value: "narrow" },
      { label: "Standard", value: "standard" },
      { label: "Wide", value: "wide" },
      { label: "Full", value: "full" },
    ],
  },
  spacing: {
    type: "select" as const,
    label: "Spacing",
    options: [
      { label: "Compact", value: "compact" },
      { label: "Normal", value: "normal" },
      { label: "Spacious", value: "spacious" },
    ],
  },
  buttonVariant: {
    type: "select" as const,
    label: "Button style",
    options: [
      { label: "Solid", value: "solid" },
      { label: "Outline", value: "outline" },
      { label: "Ghost", value: "ghost" },
    ],
  },
  formFields: {
    type: "text" as const,
    label: "Visible optional form fields",
  },
  formRequiredFields: {
    type: "text" as const,
    label: "Required optional form fields",
  },
  formConsentText: {
    type: "textarea" as const,
    label: "Consent text",
  },
  formThankYou: {
    type: "textarea" as const,
    label: "Thank-you message",
  },
  formNotificationRecipients: {
    type: "text" as const,
    label: "Notification recipients",
  },
  formAutoresponderSubject: {
    type: "text" as const,
    label: "Auto-reply subject",
  },
  formAutoresponderBody: {
    type: "textarea" as const,
    label: "Auto-reply body",
  },
};

export const puckConfig: Config<ComponentProps> = {
  components: {
    Hero: {
      defaultProps: {
        heading: "Welcome to Our Mosque",
        body: "Join a modern memberhood with deep heritage. Where tradition meets community, and community creates lasting bonds.",
        ctaLabel: "Express Interest",
        ctaHref: "/join",
        primaryColor: "#3b82f6",
        backgroundImageUrl: "",
        overlayOpacity: 0.45,
        backgroundPosition: "center",
      },
      fields: {
        heading: { type: "text" },
        body: { type: "textarea" },
        ctaLabel: { type: "text", label: "CTA Label" },
        ctaHref: { type: "text", label: "CTA Link" },
        primaryColor: {
          type: "custom",
          label: "Primary color (accent)",
          render: ({ value, onChange }) => {
            const hex =
              typeof value === "string" && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value.trim())
                ? value.trim()
                : "#3b82f6";
            const pickerVal = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
            return (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-14 shrink-0 cursor-pointer rounded border border-white/20 bg-transparent"
                  value={pickerVal}
                  onChange={(e) => onChange(e.target.value)}
                  aria-label="Pick primary color"
                />
                <input
                  type="text"
                  className="min-w-[7rem] flex-1 rounded border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-slate-500"
                  value={typeof value === "string" ? value : ""}
                  placeholder="#3b82f6"
                  onChange={(e) => onChange(e.target.value)}
                  aria-label="Primary color hex"
                />
              </div>
            );
          },
        },
        backgroundImageUrl: {
          type: "custom",
          label: "Background image URL (https)",
          render: ({ value, onChange }) => (
            <ImageUploadField
              label="Hero background"
              value={typeof value === "string" ? value : ""}
              onChange={onChange}
              compact
            />
          ),
        },
        overlayOpacity: {
          type: "number",
          label: "Image overlay (0–1)",
          min: 0,
          max: 1,
          step: 0.05,
        },
        backgroundPosition: {
          type: "select",
          label: "Background position",
          options: [
            { label: "Center", value: "center" },
            { label: "Top", value: "top" },
            { label: "Bottom", value: "bottom" },
            { label: "Top left", value: "top left" },
            { label: "Top right", value: "top right" },
          ],
        },
      },
      render: ({
        heading,
        body,
        ctaLabel,
        ctaHref,
        primaryColor,
        backgroundImageUrl,
        overlayOpacity,
        backgroundPosition,
      }) => {
        const layers = heroBackgroundLayers({
          style: {
            background_image_url: backgroundImageUrl?.trim() || null,
            overlay_opacity:
              typeof overlayOpacity === "number" && !Number.isNaN(overlayOpacity)
                ? overlayOpacity
                : 0.45,
            background_position: backgroundPosition || null,
          },
        });
        const accent = primaryColor?.trim() || "#3b82f6";
        return (
          <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 px-6 py-24 text-center sm:px-8 sm:py-32">
            {layers.imageUrl ? (
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
              className={`absolute inset-0 z-[1] bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:32px_32px] ${layers.imageUrl ? "opacity-40" : ""}`}
            />
            <div
              className="absolute left-1/2 top-0 z-[1] h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
              style={{ backgroundColor: accent }}
            />
            <div className="relative z-10 mx-auto max-w-3xl">
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Welcome
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                {heading}
              </h1>
              {body && (
                <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                  {body}
                </p>
              )}
              <CTAButton label={ctaLabel} href={ctaHref} color={accent} />
            </div>
          </section>
        );
      },
    },

    About: {
      defaultProps: {
        heading: "About Our Mosque",
        body: "Founded on principles of memberly love, relief, and truth, our mosque brings members together through meaningful community, personal growth, and charitable service to the community.",
        ctaLabel: "Learn More",
        ctaHref: "/about",
      },
      fields: sectionFields,
      render: ({ heading, body, ctaLabel, ctaHref, imageUrl, imageAlt, imageShape }) => (
        <SectionContainer className="bg-white">
          <div className="grid gap-10 md:grid-cols-[1fr_auto]">
            <div>
              <SectionBadge icon={BookOpen} label="About" className="bg-blue-50 text-blue-700 border-blue-200" />
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {heading}
              </h2>
              {body && (
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  {body}
                </p>
              )}
              <CTAButton label={ctaLabel} href={ctaHref} />
            </div>
            {imageUrl ? (
              <SectionImage
                imageUrl={imageUrl}
                imageAlt={imageAlt}
                imageShape={imageShape}
                className="mt-0 hidden w-72 md:block"
              />
            ) : (
              <div className="hidden md:flex flex-col justify-center gap-4">
                {[
                  { icon: Shield, text: "Integrity" },
                  { icon: Heart, text: "Community" },
                  { icon: Star, text: "Service" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <item.icon className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium text-slate-700">{item.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionContainer>
      ),
    },

    ServiceDetails: {
      defaultProps: {
        heading: "Services & Schedule",
        body: "We meet regularly throughout the year. Our services combine traditional ceremony with social community, making every gathering a meaningful experience.",
        ctaLabel: "View Calendar",
        ctaHref: "/events",
      },
      fields: sectionFields,
      render: ({ heading, body, ctaLabel, ctaHref, imageUrl, imageAlt, imageShape }) => (
        <SectionContainer className="bg-slate-50">
          <SectionBadge icon={Calendar} label="Services" className="bg-indigo-50 text-indigo-700 border-indigo-200" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {heading}
          </h2>
          {body && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
              {body}
            </p>
          )}
          <SectionImage imageUrl={imageUrl} imageAlt={imageAlt} imageShape={imageShape} />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Calendar, label: "Regular Services", detail: "Monthly gatherings" },
              { icon: Clock, label: "Community Meal", detail: "Dining after mosque" },
              { icon: MapPin, label: "Mosque Hall", detail: "Central location" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <item.icon className="h-6 w-6 text-indigo-500" />
                <h3 className="mt-3 text-sm font-semibold text-slate-900">{item.label}</h3>
                <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
              </div>
            ))}
          </div>
          <CTAButton label={ctaLabel} href={ctaHref} color="#6366f1" />
        </SectionContainer>
      ),
    },

    Officers: {
      defaultProps: {
        heading: "Mosque Officers",
        body: "Our dedicated officers volunteer their time and talents to guide the mosque, uphold traditions, and ensure every member feels welcome and supported.",
        ctaLabel: "Meet the Team",
        ctaHref: "/about",
      },
      fields: sectionFields,
      render: ({ heading, body, ctaLabel, ctaHref, imageUrl, imageAlt, imageShape }) => (
        <SectionContainer className="bg-white">
          <SectionBadge icon={Users} label="Officers" className="bg-emerald-50 text-emerald-700 border-emerald-200" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {heading}
          </h2>
          {body && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
              {body}
            </p>
          )}
          <SectionImage imageUrl={imageUrl} imageAlt={imageAlt} imageShape={imageShape} />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {["Lead Imam", "Senior Warden", "Junior Warden"].map((role) => (
              <div key={role} className="group rounded-xl border border-slate-100 bg-slate-50 p-5 text-center transition-all hover:border-emerald-200 hover:shadow-md">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">{role}</h3>
                <p className="mt-1 text-xs text-slate-500">Mosque Officer</p>
              </div>
            ))}
          </div>
          <CTAButton label={ctaLabel} href={ctaHref} color="#10b981" />
        </SectionContainer>
      ),
    },

    Charity: {
      defaultProps: {
        heading: "Charity & Community",
        body: "Charitable giving lies at the heart of our mosque. We support local causes, national charities, and global initiatives through fundraising, volunteering, and ongoing contributions.",
        ctaLabel: "Our Charity Work",
        ctaHref: "/charity",
      },
      fields: sectionFields,
      render: ({ heading, body, ctaLabel, ctaHref, imageUrl, imageAlt, imageShape }) => (
        <SectionContainer className="bg-rose-50/50">
          <SectionBadge icon={Heart} label="Charity" className="bg-rose-50 text-rose-700 border-rose-200" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {heading}
          </h2>
          {body && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
              {body}
            </p>
          )}
          <SectionImage imageUrl={imageUrl} imageAlt={imageAlt} imageShape={imageShape} />
          <div className="mt-8 flex flex-wrap gap-3">
            {["Local Community", "Youth Projects", "Medical Research", "Disaster Relief"].map((tag) => (
              <span key={tag} className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 shadow-sm">
                {tag}
              </span>
            ))}
          </div>
          <CTAButton label={ctaLabel} href={ctaHref} color="#e11d48" />
        </SectionContainer>
      ),
    },

    Events: {
      defaultProps: {
        heading: "Upcoming Events",
        body: "From regular mosque services to social evenings and community fundraisers, there is always something happening. Join us at our next event.",
        ctaLabel: "View All Events",
        ctaHref: "/events",
      },
      fields: sectionFields,
      render: ({ heading, body, ctaLabel, ctaHref, imageUrl, imageAlt, imageShape }) => (
        <SectionContainer className="bg-white">
          <SectionBadge icon={CalendarDays} label="Events" className="bg-amber-50 text-amber-700 border-amber-200" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {heading}
          </h2>
          {body && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
              {body}
            </p>
          )}
          <SectionImage imageUrl={imageUrl} imageAlt={imageAlt} imageShape={imageShape} />
          <div className="mt-8 space-y-3">
            {[
              { month: "JAN", day: "15", title: "Jumu'ah Prayer", time: "6:30 PM" },
              { month: "FEB", day: "22", title: "Ladies' Evening Dinner", time: "7:00 PM" },
              { month: "MAR", day: "08", title: "Charity Fundraiser", time: "2:00 PM" },
            ].map((event) => (
              <div key={event.title} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 transition-all hover:border-amber-200 hover:shadow-sm">
                <div className="flex h-14 w-14 flex-col items-center justify-center rounded-lg bg-amber-500 text-white">
                  <span className="text-[10px] font-bold uppercase">{event.month}</span>
                  <span className="text-lg font-bold leading-tight">{event.day}</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{event.title}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    {event.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <CTAButton label={ctaLabel} href={ctaHref} color="#f59e0b" />
        </SectionContainer>
      ),
    },

    FAQ: {
      defaultProps: {
        heading: "Frequently Asked Questions",
        body: "We understand you may have questions about mosque life. Here are answers to some of the most common ones.",
        ctaLabel: "More Questions?",
        ctaHref: "/faq",
      },
      fields: sectionFields,
      render: ({ heading, body, ctaLabel, ctaHref, imageUrl, imageAlt, imageShape }) => (
        <SectionContainer className="bg-slate-50">
          <SectionBadge icon={HelpCircle} label="FAQ" className="bg-violet-50 text-violet-700 border-violet-200" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {heading}
          </h2>
          {body && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
              {body}
            </p>
          )}
          <SectionImage imageUrl={imageUrl} imageAlt={imageAlt} imageShape={imageShape} />
          <div className="mt-8 space-y-3">
            {[
              { q: "How do I become a member?", a: "Start by expressing your interest through our form. A member will reach out to guide you." },
              { q: "Do I need to be recommended?", a: "Typically, newcomers are proposed by existing members, but enquiries from newcomers are always welcome." },
              { q: "What happens at a mosque service?", a: "Services include traditional ceremonies, discussion of mosque business, and community over dinner." },
            ].map((item) => (
              <details key={item.q} className="group rounded-xl border border-slate-200 bg-white shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between p-5 text-sm font-semibold text-slate-900">
                  {item.q}
                  <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-600">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
          <CTAButton label={ctaLabel} href={ctaHref} color="#8b5cf6" />
        </SectionContainer>
      ),
    },

    JoinUs: {
      defaultProps: {
        heading: "Ready to Take the Next Step?",
        body: "Becoming a member starts with a simple expression of interest. Our team will guide you through every step of the process with care and discretion.",
        ctaLabel: "Start Your Journey",
        ctaHref: "/join",
      },
      fields: sectionFields,
      render: ({ heading, body, ctaLabel, ctaHref, imageUrl, imageAlt, imageShape }) => (
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 px-6 py-20 text-center sm:px-8 sm:py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="relative z-10 mx-auto max-w-2xl">
            <SectionBadge icon={UserPlus} label="Join Us" className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30" />
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {heading}
            </h2>
            {body && (
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-300">
                {body}
              </p>
            )}
            <SectionImage imageUrl={imageUrl} imageAlt={imageAlt} imageShape={imageShape} />
            <CTAButton label={ctaLabel} href={ctaHref} color="#10b981" />
          </div>
        </section>
      ),
    },

    Contact: {
      defaultProps: {
        heading: "Get in Touch",
        body: "We would love to hear from you. Whether you have questions about membership, events, or anything else, our team is ready to help.",
        ctaLabel: "Send a Message",
        ctaHref: "/contact",
      },
      fields: sectionFields,
      render: ({ heading, body, ctaLabel, ctaHref, imageUrl, imageAlt, imageShape }) => (
        <SectionContainer className="bg-white">
          <SectionBadge icon={Mail} label="Contact" className="bg-sky-50 text-sky-700 border-sky-200" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {heading}
          </h2>
          {body && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
              {body}
            </p>
          )}
          <SectionImage imageUrl={imageUrl} imageAlt={imageAlt} imageShape={imageShape} />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Mail, label: "Email", detail: "secretary@mosque.org" },
              { icon: Phone, label: "Phone", detail: "Available on request" },
              { icon: MapPin, label: "Mosque Hall", detail: "Central location" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
                  <p className="text-xs text-slate-500">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <CTAButton label={ctaLabel} href={ctaHref} color="#0ea5e9" />
        </SectionContainer>
      ),
    },
  },
};
