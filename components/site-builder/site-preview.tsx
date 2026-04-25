"use client";

import { useState } from "react";
import { Monitor, Tablet, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LodgeSiteSection } from "@/lib/db/types";
import { SectionPreview } from "./section-preview";

type SiteSection = LodgeSiteSection;

type Viewport = "desktop" | "tablet" | "phone";

const viewportConfig: Record<Viewport, { width: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  desktop: { width: "100%", icon: Monitor, label: "Desktop" },
  tablet: { width: "768px", icon: Tablet, label: "Tablet" },
  phone: { width: "375px", icon: Smartphone, label: "Phone" },
};

export function SitePreview({
  sections,
  pageTitle,
  primaryColor = "#3b82f6",
}: {
  sections: SiteSection[];
  pageTitle: string;
  primaryColor?: string;
}) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const visibleSections = sections.filter((s) => s.visible);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2.5">
        <span className="text-xs font-medium text-slate-400 truncate max-w-[180px]">
          {pageTitle || "Lodge Preview"}
        </span>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {(Object.keys(viewportConfig) as Viewport[]).map((vp) => {
            const config = viewportConfig[vp];
            const Icon = config.icon;
            return (
              <button
                key={vp}
                onClick={() => setViewport(vp)}
                className={cn(
                  "rounded-md p-1.5 transition-all",
                  viewport === vp
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"
                )}
                title={config.label}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview frame */}
      <div className="flex-1 overflow-auto bg-slate-900/50 p-4">
        <div
          className="mx-auto overflow-hidden rounded-xl border border-white/10 bg-white shadow-2xl transition-all duration-500"
          style={{
            maxWidth: viewportConfig[viewport].width,
            minHeight: "400px",
          }}
        >
          {visibleSections.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">
              No visible sections to preview
            </div>
          ) : (
            visibleSections.map((section) => (
              <SectionPreview
                key={section.id}
                section={section}
                primaryColor={primaryColor}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
