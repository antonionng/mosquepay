import type { LodgeSiteSection, LodgeSiteSectionStyle } from "@/lib/db/types";

const SECTION_TYPES: LodgeSiteSection["type"][] = [
  "hero",
  "about",
  "meeting_details",
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

/** Server-safe normalization for persisted section.style */
export function sanitizeSectionStyle(
  raw: unknown
): LodgeSiteSectionStyle | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: LodgeSiteSectionStyle = {};

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

  return Object.keys(out).length > 0 ? out : undefined;
}

export type SiteSectionLike = {
  style?: LodgeSiteSectionStyle | null;
};

export function mergeHeroPrimaryColor(
  section: SiteSectionLike | null | undefined,
  lodgePrimaryColor: string | null | undefined
): string {
  const fromSection = normalizeHex(section?.style?.primary_color ?? null);
  if (fromSection) return fromSection;
  const fromLodge = normalizeHex(lodgePrimaryColor ?? null);
  if (fromLodge) return fromLodge;
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

function parseSectionType(v: unknown): LodgeSiteSection["type"] {
  if (typeof v !== "string") return "about";
  return SECTION_TYPES.includes(v as LodgeSiteSection["type"])
    ? (v as LodgeSiteSection["type"])
    : "about";
}

/** Normalize and sanitize sections from PATCH body before persistence. */
export function sanitizeSiteSections(input: unknown): LodgeSiteSection[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return input.map((item, idx) => {
    const o = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
    const style = sanitizeSectionStyle(o.style);
    const section: LodgeSiteSection = {
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
  incoming: LodgeSiteSection[],
  previous: LodgeSiteSection[] | undefined | null
): LodgeSiteSection[] {
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
