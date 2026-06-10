"use client";

import { useState } from "react";
import { Monitor, Tablet, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChurchSiteSection } from "@/lib/db/types";
import { SectionPreview } from "./section-preview";

type SiteSection = ChurchSiteSection;

type Viewport = "desktop" | "tablet" | "phone";

const viewportConfig: Record<Viewport, { width: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  desktop: { width: "100%", icon: Monitor, label: "Desktop" },
  tablet: { width: "768px", icon: Tablet, label: "Tablet" },
  phone: { width: "375px", icon: Smartphone, label: "Phone" },
};

export function SitePreview({
  sections,
  pageTitle,
  pageDescription,
  primaryColor = "#3b82f6",
}: {
  sections: SiteSection[];
  pageTitle: string;
  pageDescription?: string | null;
  primaryColor?: string;
}) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const visibleSections = sections.filter((s) => s.visible);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2.5">
        <span className="text-xs font-medium text-slate-400 truncate max-w-[180px]">
          {pageTitle || "Church Preview"}
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
      <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_32%),#020617] p-4">
        <div
          className="mx-auto overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-black/40 transition-all duration-500"
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
            <>
              <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 shadow-sm backdrop-blur">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-bold tracking-[0.18em] text-white shadow-lg"
                    style={{ backgroundColor: primaryColor }}
                  >
                    LG
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {pageTitle || "Church website"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      Draft site preview
                    </p>
                  </div>
                </div>
                <div className="hidden items-center gap-5 text-xs font-medium text-slate-600 sm:flex">
                  <span>Home</span>
                  <span>About</span>
                  <span>Events</span>
                  <span>Charity</span>
                  <span className="rounded-full px-3 py-1 text-white" style={{ backgroundColor: primaryColor }}>
                    Contact
                  </span>
                </div>
              </div>
              {visibleSections.map((section) => (
                <SectionPreview
                  key={section.id}
                  section={section}
                  primaryColor={primaryColor}
                />
              ))}
              <footer className="border-t border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-10 text-white">
                <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
                  <div>
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold tracking-[0.18em] text-white" style={{ backgroundColor: primaryColor }}>
                      LG
                    </div>
                    <p className="text-base font-semibold">{pageTitle || "Church website"}</p>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                      {pageDescription ||
                        "A public church website with services, charity, newcomer enquiries, and contact details."}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Explore
                    </p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-400">
                      <span>Services</span>
                      <span>Charity</span>
                      <span>Join</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Contact
                    </p>
                    <p className="mt-3 text-sm text-slate-400">
                      Footer details pull from church settings on the published site.
                    </p>
                  </div>
                </div>
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
