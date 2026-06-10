import type {
  ChurchSiteCustomPage,
  ChurchSiteFooterLink,
  ChurchSiteFooterLinkGroup,
  ChurchSiteFooterSettings,
  ChurchSiteHeaderNavItem,
  ChurchSiteHeaderSettings,
  ChurchSiteSection,
  ChurchSiteSectionStyle,
} from "@/lib/db/types";

const SECTION_TYPES: ChurchSiteSection["type"][] = [
  "hero",
  "about",
  "service_details",
  "officers",
  "charity",
  "events",
  "faq",
  "join",
  "contact",
];

export const DEFAULT_HERO_PRIMARY = "#3b82f6";

const MAX_IMAGE_URL_LENGTH = 2048;
const HEX_6 = /^#[0-9A-Fa-f]{6}$/;
const HEX_3 = /^#[0-9A-Fa-f]{3}$/;
const TEMPLATE_IMAGE_PREFIX = "/site-template-images/";
const LEGACY_TEMPLATE_IMAGE_REPLACEMENTS: Record<string, string> = {
  "/site-template-images/website-portal-feature.png": "/site-template-images/newcomersor-contact.png",
  "/site-template-images/services-notice-feature.png": "/site-template-images/officers-formal.png",
  "/site-template-images/gift-aid-giving.png": "/site-template-images/charity-pastoral.png",
};

/** Allowed CSS background-position keywords (single or two-token subset). */
const BG_POS = new Set([
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top left",
  "top right",
  "top center",
  "bottom left",
  "bottom right",
  "bottom center",
  "center left",
  "center right",
]);

const IMAGE_POS = new Set(["left", "right", "top", "bottom", "full"]);
const IMAGE_SHAPE = new Set(["rounded", "square", "circle", "arch"]);
const FORM_MODES = new Set(["none", "contact", "newcomer"]);
const BACKGROUND_TONES = new Set(["default", "soft", "brand", "dark"]);
const CONTENT_WIDTHS = new Set(["narrow", "standard", "wide", "full"]);
const SPACING_OPTIONS = new Set(["compact", "normal", "spacious"]);
const BUTTON_VARIANTS = new Set(["solid", "outline", "ghost"]);
const FORM_FIELDS = new Set([
  "name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "subject",
  "location",
  "how_heard",
  "message",
  "consent",
]);

function normalizeHex(color: string | null | undefined): string | null {
  if (!color || typeof color !== "string") return null;
  const t = color.trim();
  if (!t) return null;
  if (HEX_6.test(t)) return t.toLowerCase();
  if (HEX_3.test(t)) {
    const r = t[1];
    const g = t[2];
    const b = t[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const t = url.trim();
  if (!t || t.length > MAX_IMAGE_URL_LENGTH) return null;
  if (t.startsWith(TEMPLATE_IMAGE_PREFIX)) {
    return LEGACY_TEMPLATE_IMAGE_REPLACEMENTS[t] ?? t;
  }
  if (t.startsWith("data:image/")) return t;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    return u.href;
  } catch {
    return null;
  }
}

function clampOpacity(n: unknown): number | null {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  const x = Math.min(1, Math.max(0, n));
  return x;
}

function sanitizeBackgroundPosition(pos: string | null | undefined): string | null {
  if (!pos || typeof pos !== "string") return null;
  const t = pos.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t || t.length > 32) return null;
  return BG_POS.has(t) ? t : null;
}

function sanitizeShortText(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const t = value.trim().replace(/\s+/g, " ");
  return t.length > 0 ? t.slice(0, 160) : null;
}

function sanitizeSlug(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!slug || ["admin", "api", "member", "operator"].includes(slug)) return null;
  return slug;
}

function sanitizeHref(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const href = value.trim();
  if (!href || href.length > 240) return null;
  if (href.startsWith("/") || href.startsWith("#")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function sanitizeLongText(value: string | null | undefined, max = 1200): string | null {
  if (!value || typeof value !== "string") return null;
  const t = value.trim().replace(/\s+/g, " ");
  return t.length > 0 ? t.slice(0, max) : null;
}

function sanitizeEmailList(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const emails = value
    .split(/[,\n;]/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))
    .slice(0, 5);
  return emails.length > 0 ? emails.join(", ") : null;
}

function sanitizeFieldList(value: unknown): string[] | null {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const fields = Array.from(
    new Set(
      raw
        .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
        .filter((item) => FORM_FIELDS.has(item))
    )
  );
  return fields.length > 0 ? fields : null;
}

function sanitizeImagePosition(value: string | null | undefined): ChurchSiteSectionStyle["image_position"] {
  if (!value || typeof value !== "string") return null;
  const t = value.trim().toLowerCase();
  return IMAGE_POS.has(t) ? (t as NonNullable<ChurchSiteSectionStyle["image_position"]>) : null;
}

function sanitizeImageShape(value: string | null | undefined): ChurchSiteSectionStyle["image_shape"] {
  if (!value || typeof value !== "string") return null;
  const t = value.trim().toLowerCase();
  return IMAGE_SHAPE.has(t) ? (t as NonNullable<ChurchSiteSectionStyle["image_shape"]>) : null;
}

function sanitizeFormMode(value: string | null | undefined): ChurchSiteSectionStyle["form_mode"] {
  if (!value || typeof value !== "string") return null;
  const t = value.trim().toLowerCase();
  return FORM_MODES.has(t) ? (t as NonNullable<ChurchSiteSectionStyle["form_mode"]>) : null;
}

function sanitizeToken<T extends string>(
  value: string | null | undefined,
  allowed: Set<string>
): T | null {
  if (!value || typeof value !== "string") return null;
  const t = value.trim().toLowerCase();
  return allowed.has(t) ? (t as T) : null;
}

/** Server-safe normalization for persisted section.style */
export function sanitizeSectionStyle(
  raw: unknown
): ChurchSiteSectionStyle | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: ChurchSiteSectionStyle = {};

  const primary = normalizeHex(typeof o.primary_color === "string" ? o.primary_color : null);
  if (primary) out.primary_color = primary;

  const bg = sanitizeImageUrl(typeof o.background_image_url === "string" ? o.background_image_url : null);
  if (bg) out.background_image_url = bg;

  const op = clampOpacity(o.overlay_opacity);
  if (op !== null) out.overlay_opacity = op;

  const bp = sanitizeBackgroundPosition(
    typeof o.background_position === "string" ? o.background_position : null
  );
  if (bp) out.background_position = bp;

  const image = sanitizeImageUrl(typeof o.image_url === "string" ? o.image_url : null);
  if (image) out.image_url = image;

  const imageAlt = sanitizeShortText(typeof o.image_alt === "string" ? o.image_alt : null);
  if (imageAlt) out.image_alt = imageAlt;

  const imagePosition = sanitizeImagePosition(
    typeof o.image_position === "string" ? o.image_position : null
  );
  if (imagePosition) out.image_position = imagePosition;

  const imageShape = sanitizeImageShape(
    typeof o.image_shape === "string" ? o.image_shape : null
  );
  if (imageShape) out.image_shape = imageShape;

  const formMode = sanitizeFormMode(typeof o.form_mode === "string" ? o.form_mode : null);
  if (formMode) out.form_mode = formMode;

  const backgroundTone = sanitizeToken<NonNullable<ChurchSiteSectionStyle["background_tone"]>>(
    typeof o.background_tone === "string" ? o.background_tone : null,
    BACKGROUND_TONES
  );
  if (backgroundTone) out.background_tone = backgroundTone;

  const contentWidth = sanitizeToken<NonNullable<ChurchSiteSectionStyle["content_width"]>>(
    typeof o.content_width === "string" ? o.content_width : null,
    CONTENT_WIDTHS
  );
  if (contentWidth) out.content_width = contentWidth;

  const spacing = sanitizeToken<NonNullable<ChurchSiteSectionStyle["spacing"]>>(
    typeof o.spacing === "string" ? o.spacing : null,
    SPACING_OPTIONS
  );
  if (spacing) out.spacing = spacing;

  const buttonVariant = sanitizeToken<NonNullable<ChurchSiteSectionStyle["button_variant"]>>(
    typeof o.button_variant === "string" ? o.button_variant : null,
    BUTTON_VARIANTS
  );
  if (buttonVariant) out.button_variant = buttonVariant;

  const formFields = sanitizeFieldList(o.form_fields);
  if (formFields) out.form_fields = formFields;

  const requiredFields = sanitizeFieldList(o.form_required_fields);
  if (requiredFields) out.form_required_fields = requiredFields;

  const consentText = sanitizeLongText(
    typeof o.form_consent_text === "string" ? o.form_consent_text : null,
    360
  );
  if (consentText) out.form_consent_text = consentText;

  const thankYou = sanitizeLongText(
    typeof o.form_thank_you === "string" ? o.form_thank_you : null,
    360
  );
  if (thankYou) out.form_thank_you = thankYou;

  const recipients = sanitizeEmailList(
    typeof o.form_notification_recipients === "string"
      ? o.form_notification_recipients
      : null
  );
  if (recipients) out.form_notification_recipients = recipients;

  const responderSubject = sanitizeShortText(
    typeof o.form_autoresponder_subject === "string"
      ? o.form_autoresponder_subject
      : null
  );
  if (responderSubject) out.form_autoresponder_subject = responderSubject;

  const responderBody = sanitizeLongText(
    typeof o.form_autoresponder_body === "string"
      ? o.form_autoresponder_body
      : null
  );
  if (responderBody) out.form_autoresponder_body = responderBody;

  if (Array.isArray(o.faq_entries)) {
    const entries = o.faq_entries
      .slice(0, 30)
      .map((raw) => {
        if (!raw || typeof raw !== "object") return null;
        const row = raw as Record<string, unknown>;
        const question = sanitizeLongText(
          typeof row.question === "string" ? row.question : null,
          240
        );
        const answer = sanitizeLongText(
          typeof row.answer === "string" ? row.answer : null,
          1200
        );
        if (!question || !answer) return null;
        return { question, answer };
      })
      .filter(
        (entry): entry is { question: string; answer: string } => entry != null
      );
    if (entries.length > 0) out.faq_entries = entries;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export type SiteSectionLike = {
  style?: ChurchSiteSectionStyle | null;
};

export function mergeHeroPrimaryColor(
  section: SiteSectionLike | null | undefined,
  churchPrimaryColor: string | null | undefined
): string {
  const fromSection = normalizeHex(section?.style?.primary_color ?? null);
  if (fromSection) return fromSection;
  const fromChurch = normalizeHex(churchPrimaryColor ?? null);
  if (fromChurch) return fromChurch;
  return DEFAULT_HERO_PRIMARY;
}

export function heroBackgroundLayers(section: SiteSectionLike | null | undefined): {
  imageUrl: string | null;
  overlayOpacity: number;
  backgroundPosition: string;
} {
  const style = section?.style;
  const imageUrl = sanitizeImageUrl(style?.background_image_url ?? null);
  const rawOp = style?.overlay_opacity;
  let overlayOpacity = 0;
  if (imageUrl) {
    if (typeof rawOp === "number" && !Number.isNaN(rawOp)) {
      overlayOpacity = Math.min(1, Math.max(0, rawOp));
    } else {
      overlayOpacity = 0.45;
    }
  }
  const bp = sanitizeBackgroundPosition(style?.background_position ?? null);
  return {
    imageUrl,
    overlayOpacity,
    backgroundPosition: bp ?? "center",
  };
}

export function sectionBackgroundLayers(section: SiteSectionLike | null | undefined): {
  imageUrl: string | null;
  overlayOpacity: number;
  backgroundPosition: string;
} {
  return heroBackgroundLayers(section);
}

export function sectionDesignStyle(section: SiteSectionLike | null | undefined): {
  backgroundColor?: string;
  color?: string;
  paddingTop?: string;
  paddingBottom?: string;
} {
  const tone = section?.style?.background_tone;
  const spacing = section?.style?.spacing;
  const design: {
    backgroundColor?: string;
    color?: string;
    paddingTop?: string;
    paddingBottom?: string;
  } = {};

  if (tone === "soft") design.backgroundColor = "#f8fafc";
  if (tone === "brand") design.backgroundColor = "#eff6ff";
  if (tone === "dark") {
    design.backgroundColor = "#0f172a";
    design.color = "#ffffff";
  }

  if (spacing === "compact") {
    design.paddingTop = "3rem";
    design.paddingBottom = "3rem";
  }
  if (spacing === "spacious") {
    design.paddingTop = "7rem";
    design.paddingBottom = "7rem";
  }

  return design;
}

export function sectionToneClass(section: SiteSectionLike | null | undefined): string {
  return section?.style?.background_tone === "dark" ? "site-section-tone-dark" : "";
}

export function sectionContentWidthStyle(section: SiteSectionLike | null | undefined): {
  maxWidth?: string;
} {
  const width = section?.style?.content_width;
  if (width === "narrow") return { maxWidth: "52rem" };
  if (width === "wide") return { maxWidth: "88rem" };
  if (width === "full") return { maxWidth: "none" };
  return {};
}

function parseSectionType(v: unknown): ChurchSiteSection["type"] {
  if (typeof v !== "string") return "about";
  return SECTION_TYPES.includes(v as ChurchSiteSection["type"])
    ? (v as ChurchSiteSection["type"])
    : "about";
}

/** Normalize and sanitize sections from PATCH body before persistence. */
export function sanitizeSiteSections(input: unknown): ChurchSiteSection[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return input.map((item, idx) => {
    const o = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
    const style = sanitizeSectionStyle(o.style);
    const section: ChurchSiteSection = {
      id: typeof o.id === "string" && o.id.length > 0 ? o.id : `section-${idx}`,
      type: parseSectionType(o.type),
      heading: typeof o.heading === "string" ? o.heading : "",
      body: typeof o.body === "string" ? o.body : null,
      cta_label: typeof o.cta_label === "string" ? o.cta_label : null,
      cta_href: typeof o.cta_href === "string" ? o.cta_href : null,
      visible: o.visible !== false,
      order: typeof o.order === "number" && o.order >= 0 ? o.order : idx + 1,
    };
    if (style) section.style = style;
    return section;
  });
}

/** Preserve per-section style for non-hero blocks when the editor payload omits `style`. */
export function mergeSectionStylesPreserve(
  incoming: ChurchSiteSection[],
  previous: ChurchSiteSection[] | undefined | null
): ChurchSiteSection[] {
  if (!previous?.length) return incoming;
  return incoming.map((s) => {
    const prev = previous.find((p) => p.id === s.id);
    if (!prev) return s;
    if (s.type === "hero") return s;
    if (!("style" in s) && prev.style) {
      return { ...s, style: prev.style };
    }
    return s;
  });
}

export function sanitizeCustomPages(input: unknown): ChurchSiteCustomPage[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const seen = new Set<string>();
  const pages: ChurchSiteCustomPage[] = [];

  input.slice(0, 24).forEach((item, idx) => {
    const o =
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
    const slug = sanitizeSlug(typeof o.slug === "string" ? o.slug : null);
    if (!slug || slug === "home" || seen.has(slug)) return;
    seen.add(slug);
    const title = sanitizeShortText(typeof o.title === "string" ? o.title : null);
    const sections = sanitizeSiteSections(o.sections) ?? [];

    pages.push({
      id: typeof o.id === "string" && o.id.length > 0 ? o.id.slice(0, 120) : `page-${idx}`,
      slug,
      title: title ?? "Untitled page",
      description:
        sanitizeLongText(typeof o.description === "string" ? o.description : null, 360) ??
        null,
      seo_title:
        sanitizeShortText(typeof o.seo_title === "string" ? o.seo_title : null) ?? null,
      seo_description:
        sanitizeLongText(typeof o.seo_description === "string" ? o.seo_description : null, 360) ??
        null,
      social_image_url:
        sanitizeImageUrl(typeof o.social_image_url === "string" ? o.social_image_url : null) ??
        null,
      sections,
      published: o.published === true,
      show_in_nav: o.show_in_nav !== false,
      nav_label:
        sanitizeShortText(typeof o.nav_label === "string" ? o.nav_label : null) ?? null,
      order: typeof o.order === "number" && o.order >= 0 ? o.order : idx + 1,
    });
  });

  return pages
    .sort((a, b) => a.order - b.order)
    .map((page, idx) => ({ ...page, order: idx + 1 }));
}

export function defaultHeaderNavItems(): ChurchSiteHeaderNavItem[] {
  return [
    { id: "home", label: "Home", href: "/", visible: true, order: 1 },
    { id: "events", label: "Events", href: "/events", visible: true, order: 2 },
    { id: "charity", label: "Charity", href: "/charity", visible: true, order: 3 },
    { id: "news", label: "News", href: "/news", visible: true, order: 4 },
    { id: "contact", label: "Contact", href: "/contact", visible: true, order: 5 },
  ];
}

export function defaultHeaderSettings(): ChurchSiteHeaderSettings {
  return {
    show_logo: true,
    show_church_name: true,
    show_church_number: true,
    nav_items: defaultHeaderNavItems(),
    cta_label: "Join Us",
    cta_href: "/join",
  };
}

export function sanitizeHeaderSettings(input: unknown): ChurchSiteHeaderSettings | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const o = input as Record<string, unknown>;
  const defaults = defaultHeaderSettings();
  const rawItems = Array.isArray(o.nav_items) ? o.nav_items : defaults.nav_items;
  const navItems = rawItems
    .slice(0, 12)
    .map((item, idx): ChurchSiteHeaderNavItem | null => {
      const row =
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : {};
      const label = sanitizeShortText(typeof row.label === "string" ? row.label : null);
      const href = sanitizeHref(typeof row.href === "string" ? row.href : null);
      if (!label || !href) return null;
      return {
        id:
          typeof row.id === "string" && row.id.trim()
            ? row.id.trim().slice(0, 80)
            : `nav-${idx + 1}`,
        label,
        href,
        visible: row.visible !== false,
        order: typeof row.order === "number" && row.order >= 0 ? row.order : idx + 1,
      };
    })
    .filter((item): item is ChurchSiteHeaderNavItem => Boolean(item))
    .sort((a, b) => a.order - b.order)
    .map((item, idx) => ({ ...item, order: idx + 1 }));

  return {
    show_logo: o.show_logo !== false,
    show_church_name: o.show_church_name !== false,
    show_church_number: o.show_church_number !== false,
    nav_items: navItems.length ? navItems : defaults.nav_items,
    cta_label:
      sanitizeShortText(typeof o.cta_label === "string" ? o.cta_label : null) ??
      null,
    cta_href: sanitizeHref(typeof o.cta_href === "string" ? o.cta_href : null),
  };
}

function sanitizeFooterLinks(input: unknown): ChurchSiteFooterLink[] {
  const rawLinks = Array.isArray(input) ? input : [];
  return rawLinks
    .slice(0, 12)
    .map((item, idx): ChurchSiteFooterLink | null => {
      const row =
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : {};
      const label = sanitizeShortText(typeof row.label === "string" ? row.label : null);
      const href = sanitizeHref(typeof row.href === "string" ? row.href : null);
      if (!label || !href) return null;
      return {
        id:
          typeof row.id === "string" && row.id.trim()
            ? row.id.trim().slice(0, 80)
            : `footer-link-${idx + 1}`,
        label,
        href,
        visible: row.visible !== false,
        order: typeof row.order === "number" && row.order >= 0 ? row.order : idx + 1,
      };
    })
    .filter((item): item is ChurchSiteFooterLink => Boolean(item))
    .sort((a, b) => a.order - b.order)
    .map((item, idx) => ({ ...item, order: idx + 1 }));
}

export function defaultFooterSettings(): ChurchSiteFooterSettings {
  return {
    show_logo: true,
    show_church_name: true,
    show_church_number: true,
    show_contact_details: true,
    tagline: null,
    badge_text: "Member website",
    powered_by_text: null,
    show_powered_by: true,
    link_groups: [
      {
        id: "explore",
        title: "Explore",
        order: 1,
        links: [
          { id: "home", label: "Home", href: "/", visible: true, order: 1 },
          { id: "events", label: "Events", href: "/events", visible: true, order: 2 },
          { id: "charity", label: "Charity", href: "/charity", visible: true, order: 3 },
          { id: "join", label: "Join Us", href: "/join", visible: true, order: 4 },
        ],
      },
      {
        id: "more",
        title: "More",
        order: 2,
        links: [
          { id: "news", label: "News", href: "/news", visible: true, order: 1 },
          { id: "contact", label: "Contact", href: "/contact", visible: true, order: 2 },
          { id: "faq", label: "FAQ", href: "/faq", visible: true, order: 3 },
        ],
      },
    ],
  };
}

export function sanitizeFooterSettings(input: unknown): ChurchSiteFooterSettings | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const o = input as Record<string, unknown>;
  const defaults = defaultFooterSettings();
  const rawGroups = Array.isArray(o.link_groups) ? o.link_groups : defaults.link_groups;
  const linkGroups = rawGroups
    .slice(0, 4)
    .map((item, idx): ChurchSiteFooterLinkGroup | null => {
      const row =
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : {};
      const title = sanitizeShortText(typeof row.title === "string" ? row.title : null);
      const links = sanitizeFooterLinks(row.links);
      if (!title || links.length === 0) return null;
      return {
        id:
          typeof row.id === "string" && row.id.trim()
            ? row.id.trim().slice(0, 80)
            : `footer-group-${idx + 1}`,
        title,
        links,
        order: typeof row.order === "number" && row.order >= 0 ? row.order : idx + 1,
      };
    })
    .filter((item): item is ChurchSiteFooterLinkGroup => Boolean(item))
    .sort((a, b) => a.order - b.order)
    .map((item, idx) => ({ ...item, order: idx + 1 }));

  return {
    show_logo: o.show_logo !== false,
    show_church_name: o.show_church_name !== false,
    show_church_number: o.show_church_number !== false,
    show_contact_details: o.show_contact_details !== false,
    tagline:
      sanitizeLongText(typeof o.tagline === "string" ? o.tagline : null, 360) ?? null,
    badge_text:
      sanitizeShortText(typeof o.badge_text === "string" ? o.badge_text : null) ?? null,
    powered_by_text:
      sanitizeShortText(
        typeof o.powered_by_text === "string" ? o.powered_by_text : null
      ) ?? null,
    show_powered_by: o.show_powered_by !== false,
    link_groups: linkGroups.length ? linkGroups : defaults.link_groups,
  };
}
