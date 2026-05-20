import { Card } from "@/components/ui/card";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { getDefaultLodgeSlug } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import {
  Users,
  Building2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  GuestsDirectoryClient,
  type GuestRow,
} from "@/components/admin/guests-directory-client";
import { GuestSelfRegistrationCard } from "@/components/admin/guest-self-registration-card";

type KpiAccent = "blue" | "cyan" | "amber" | "emerald";

const kpiAccentIcon: Record<KpiAccent, { wrap: string; icon: string }> = {
  blue: { wrap: "bg-blue-500/10", icon: "text-blue-600" },
  cyan: { wrap: "bg-cyan-500/10", icon: "text-cyan-600" },
  amber: { wrap: "bg-amber-500/10", icon: "text-amber-700" },
  emerald: { wrap: "bg-emerald-500/10", icon: "text-emerald-600" },
};

function toRow(guest: {
  id: string;
  full_name: string;
  email: string | null;
  mother_lodge_name: string | null;
  mother_lodge_number: string | null;
  is_mason: boolean;
  visit_count: number;
  archived_at: string | null;
  created_at: string;
  source?: string | null;
}): GuestRow {
  return {
    id: guest.id,
    full_name: guest.full_name,
    email: guest.email,
    mother_lodge_name: guest.mother_lodge_name,
    mother_lodge_number: guest.mother_lodge_number,
    is_mason: guest.is_mason,
    visit_count: guest.visit_count,
    archived_at: guest.archived_at,
    created_at: guest.created_at,
    source:
      (guest.source as GuestRow["source"]) ??
      ((guest as { source?: string | null }).source as GuestRow["source"]) ??
      "admin",
  };
}

function detectSchemaMissing(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error
        ? JSON.stringify(error)
        : String(error);
  return (
    message.includes("public.guests") ||
    message.includes("PGRST205") ||
    message.toLowerCase().includes("schema cache")
  );
}

export default async function AdminGuestsDirectoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; archived?: string }>;
}) {
  const ctx = await getAdminReadContext();
  const sp = (await searchParams) ?? {};
  const search = (sp.q ?? "").trim();
  const showArchived = sp.archived === "true";

  let guests: GuestRow[] = [];
  let schemaMissing = false;
  let acceptsSelfRegistration = false;
  let lodgeSlug = getDefaultLodgeSlug();

  if (ctx.mode === "mock") {
    guests = mockDb
      .listGuests({ search, includeArchived: showArchived })
      .map(toRow);
    const lodge = mockDb.getLodgeBySlug(getDefaultLodgeSlug());
    if (lodge) {
      acceptsSelfRegistration = lodge.accepts_self_registration ?? false;
      lodgeSlug = lodge.slug;
    }
  } else if (ctx.lodgeId) {
    lodgeSlug = ctx.lodgeSlug;
    try {
      const rows = await db.listGuests(ctx.lodgeId, {
        search,
        includeArchived: showArchived,
      });
      guests = rows.map(toRow);
      const lodge = await db.getLodgeById(ctx.lodgeId);
      acceptsSelfRegistration = lodge?.accepts_self_registration ?? false;
    } catch (error) {
      if (detectSchemaMissing(error)) {
        schemaMissing = true;
      } else {
        throw error;
      }
    }
  }

  const total = guests.filter((g) => !g.archived_at).length;
  const masons = guests.filter((g) => g.is_mason && !g.archived_at).length;
  const repeatGuests = guests.filter(
    (g) => g.visit_count > 1 && !g.archived_at
  ).length;
  const newThisMonth = (() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return guests.filter(
      (g) => !g.archived_at && new Date(g.created_at) >= cutoff
    ).length;
  })();

  const stats: Array<{
    label: string;
    value: string;
    hint: string;
    icon: typeof Users;
    accent: KpiAccent;
  }> = [
    {
      label: "Total guests",
      value: String(total),
      hint: "Distinct guests in directory",
      icon: Users,
      accent: "blue",
    },
    {
      label: "Visiting brethren",
      value: String(masons),
      hint: "Guests recorded as Masons",
      icon: Building2,
      accent: "cyan",
    },
    {
      label: "Repeat guests",
      value: String(repeatGuests),
      hint: "Visited more than once",
      icon: Sparkles,
      accent: "amber",
    },
    {
      label: "New this month",
      value: String(newThisMonth),
      hint: "Added in the last 30 days",
      icon: TrendingUp,
      accent: "emerald",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Guests directory</h1>
          <p className="admin-page-copy">
            Visiting brethren and other guests who have ever booked into a
            lodge event.
          </p>
        </div>
      </div>

      {!schemaMissing ? (
        <GuestSelfRegistrationCard
          lodgeSlug={lodgeSlug}
          initialEnabled={acceptsSelfRegistration}
        />
      ) : null}

      {schemaMissing ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">
            Guests tables not found
          </h2>
          <p className="mt-1 text-sm text-amber-900/80">
            Apply the latest database migrations to enable the guests
            directory. Open Supabase Dashboard → SQL Editor and run{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
              supabase/migrations/036_guest_invitations.sql
            </code>{" "}
            then{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
              supabase/migrations/039_guest_directory_extras.sql
            </code>{" "}
            then{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
              supabase/migrations/044_public_self_registration.sql
            </code>
            , then refresh this page.
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const ac = kpiAccentIcon[stat.accent];
          return (
            <div key={stat.label} className="min-w-0">
              <Card
                variant="kpi"
                className="dash-kpi-card h-full rounded-xl p-5 hover:border-dash-border-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-dash-muted [.dash-kpi-card_&]:text-dash-muted">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-dash-text [.dash-kpi-card_&]:text-dash-text">
                      {stat.value}
                    </p>
                    <p className="mt-2 text-xs text-dash-muted">{stat.hint}</p>
                  </div>
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                      ac.wrap
                    )}
                  >
                    <Icon className={cn("h-5 w-5", ac.icon)} aria-hidden />
                  </div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      <GuestsDirectoryClient
        guests={guests}
        search={search}
        showArchived={showArchived}
      />
    </div>
  );
}
