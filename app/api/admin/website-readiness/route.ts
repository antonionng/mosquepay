import { NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { createServiceClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";

const BUCKET = "site-assets";

function countFormSections(site: Awaited<ReturnType<typeof db.getLodgeSite>>) {
  const sections = [
    ...(site?.sections ?? []),
    ...((site?.custom_pages ?? []).flatMap((page) => page.sections) ?? []),
  ];
  return sections.filter((section) => {
    const mode = section.style?.form_mode;
    return mode === "contact" || mode === "lead";
  }).length;
}

export async function GET() {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return NextResponse.json({
      supabaseConfigured: isSupabaseConfigured(),
      databaseMode: false,
      selectedLodge: false,
      checks: [],
    });
  }

  const forbidden = await requireAdminApiPermission("website:write", ctx.lodgeId);
  if (forbidden) return forbidden;

  const [lodge, site] = await Promise.all([
    db.getLodgeById(ctx.lodgeId),
    db.getLodgeSite(ctx.lodgeId),
  ]);

  let schemaReady = false;
  let schemaError: string | null = null;
  let storageReady = false;
  let storageMessage = "Supabase Storage is not configured.";

  if (isSupabaseConfigured()) {
    try {
      const service = createServiceClient();
      const { error } = await service
        .from("lodge_site_pages")
        .select("custom_pages,header_settings,footer_settings")
        .limit(1);
      schemaReady = !error;
      schemaError = error?.message ?? null;

      const bucket = await service.storage.getBucket(BUCKET);
      storageReady = !bucket.error && bucket.data?.public === true;
      storageMessage = bucket.error
        ? bucket.error.message
        : `Bucket ${BUCKET} is public and ready.`;
    } catch (error) {
      schemaError = error instanceof Error ? error.message : "Could not verify schema.";
      storageMessage =
        error instanceof Error ? error.message : "Could not verify storage bucket.";
    }
  }

  const customPages = site?.custom_pages ?? [];
  const headerSettings = site?.header_settings ?? null;
  const footerSettings = site?.footer_settings ?? null;
  const formSections = countFormSections(site);

  const checks = [
    {
      id: "database",
      label: "Supabase database connected",
      ready: isSupabaseConfigured() && Boolean(lodge),
      detail: lodge ? `Editing ${lodge.name}.` : "No lodge is selected.",
    },
    {
      id: "migrations",
      label: "Website page, header, and footer migrations applied",
      ready: schemaReady,
      detail: schemaReady
        ? "custom_pages, header_settings, and footer_settings are available."
        : schemaError ?? "Could not verify website columns.",
    },
    {
      id: "storage",
      label: "Media bucket ready",
      ready: storageReady,
      detail: storageMessage,
    },
    {
      id: "logo",
      label: "Lodge logo uploaded",
      ready: Boolean(lodge?.logo_url),
      detail: lodge?.logo_url
        ? "Logo is saved and feeds the site header, footer, member card, and summons."
        : "Upload a logo in Website > Brand.",
    },
    {
      id: "header",
      label: "Header settings configured",
      ready: Boolean(headerSettings),
      detail: headerSettings
        ? `${headerSettings.nav_items.filter((item) => item.visible).length} visible header links.`
        : "Open Website > Header and save the default header settings.",
    },
    {
      id: "footer",
      label: "Footer settings configured",
      ready: Boolean(footerSettings),
      detail: footerSettings
        ? `${footerSettings.link_groups.length} footer link group${
            footerSettings.link_groups.length === 1 ? "" : "s"
          } configured.`
        : "Open Website > Footer and save the default footer settings.",
    },
    {
      id: "pages",
      label: "Custom pages ready",
      ready: customPages.length > 0,
      detail:
        customPages.length > 0
          ? `${customPages.length} custom page${customPages.length === 1 ? "" : "s"} configured.`
          : "Optional. Add About, Join, Charity, or campaign pages in Website > Pages.",
    },
    {
      id: "forms",
      label: "Contact and lead forms present",
      ready: formSections > 0,
      detail:
        formSections > 0
          ? `${formSections} form block${formSections === 1 ? "" : "s"} configured.`
          : "Add a contact or pipeline lead form block to a page.",
    },
    {
      id: "published",
      label: "Homepage published",
      ready: Boolean(site?.published),
      detail: site?.published ? "Public homepage is live." : "Publish when ready.",
    },
  ];

  return NextResponse.json({
    supabaseConfigured: isSupabaseConfigured(),
    databaseMode: true,
    selectedLodge: true,
    checks,
  });
}
