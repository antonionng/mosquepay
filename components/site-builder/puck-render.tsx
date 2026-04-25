"use client";

import { Render, type Data } from "@measured/puck";
import type { LodgeSiteSection } from "@/lib/db/types";
import { mergeHeroPrimaryColor } from "@/lib/site-section-style";
import { puckConfig } from "./puck-config";

type SiteSection = LodgeSiteSection;

const SECTION_TO_COMPONENT: Record<string, string> = {
  hero: "Hero",
  about: "About",
  meeting_details: "MeetingDetails",
  officers: "Officers",
  charity: "Charity",
  events: "Events",
  faq: "FAQ",
  join: "JoinUs",
  contact: "Contact",
};

function sectionsToPuckData(sections: SiteSection[], primaryColor?: string): Data {
  return {
    root: { props: {} },
    content: sections
      .filter((s) => s.visible)
      .sort((a, b) => a.order - b.order)
      .map((section) => {
        const componentType = SECTION_TO_COMPONENT[section.type] ?? "About";
        const baseProps: Record<string, unknown> = {
          id: section.id,
          heading: section.heading,
          body: section.body ?? "",
          ctaLabel: section.cta_label ?? "",
          ctaHref: section.cta_href ?? "",
        };
        if (section.type === "hero") {
          baseProps.primaryColor = mergeHeroPrimaryColor(section, primaryColor);
          baseProps.backgroundImageUrl = section.style?.background_image_url ?? "";
          baseProps.overlayOpacity =
            typeof section.style?.overlay_opacity === "number"
              ? section.style.overlay_opacity
              : 0.45;
          baseProps.backgroundPosition = section.style?.background_position ?? "center";
        }
        return { type: componentType, props: baseProps };
      }),
    zones: {},
  };
}

export function PuckSiteRender({
  sections,
  primaryColor = "#3b82f6",
}: {
  sections: SiteSection[];
  primaryColor?: string;
}) {
  const data = sectionsToPuckData(sections, primaryColor);
  return <Render config={puckConfig} data={data} />;
}
