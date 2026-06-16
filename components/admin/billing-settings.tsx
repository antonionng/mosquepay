"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LockKeyhole, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Plan = {
  code: string;
  name: string;
  tag: string;
  price: string;
  subPrice: string;
  description: string;
  cta: string;
  recommended?: boolean;
  upgradeTo?: string;
  featureGroups: Array<{
    title: string;
    items: string[];
  }>;
  entitlements: string[];
};

type BillingResponse = {
  plan: Plan;
  plans: Plan[];
  entitlements: Record<string, boolean>;
  locked: Array<{ key: string; requiredPlan?: string }>;
  subscription: {
    plan_code: string;
    billing_cycle: string;
    amount: number;
    status: string;
    current_period_end: string | null;
  } | null;
};

type BillingErrorResponse = {
  error?: string;
};

const FEATURE_LABELS: Record<string, string> = {
  site_builder: "Public mosque website",
  member_portal: "Member portal and PWA",
  digital_mosque_card: "Digital mosque card",
  payments: "Mooov payments and reconciliation",
  giving: "Giving and reminders",
  gift_aid: "Gift Aid reporting",
  gasds: "GASDS cash tracking",
  services: "Services and attendance",
  notice: "Notice workflow",
  events: "Events, RSVPs, guests and dining",
  treasurer_reports: "Treasurer reports",
  secretary_reports: "Secretary reports",
  newcomer_crm: "Newcomer CRM and pipeline",
  pastoral_care: "PastoralCare pastoral",
  charity_campaigns: "Charity campaigns",
  charity_reports: "Charity reporting",
  recruitment_reports: "Recruitment reports",
  audit: "Audit trail",
  bulk_import: "Bulk member import",
  advanced_members: "Advanced member fields",
  multi_mosque: "Multiple mosques",
  cross_mosque_reporting: "Cross-mosque reporting",
  central_billing: "Central billing",
  network_dashboards: "Network dashboards",
  migration_planning: "Migration planning",
  named_support: "Named network contact",
  ai: "AI-assisted drafting",
  integrations: "Integrations",
  mentor: "Mentor and discipleship",
};

export function BillingSettings() {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/billing/plan")
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as
          | BillingResponse
          | BillingErrorResponse;
        if (!res.ok || !("plan" in body)) {
          throw new Error(
            "error" in body && body.error
              ? body.error
              : "Could not load billing details."
          );
        }
        return body;
      })
      .then((body) => {
        if (active) setData(body);
      })
      .catch((error) => {
        if (active) {
          setMessage({
            type: "error",
            text:
              error instanceof Error
                ? error.message
                : "Could not load billing details.",
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const orderedPlans = useMemo(() => data?.plans ?? [], [data]);
  const currentPlanCode = data?.plan.code;
  const currentPlanIndex = orderedPlans.findIndex((plan) => plan.code === currentPlanCode);

  async function requestUpgrade(targetPlan: string) {
    setSavingPlan(targetPlan);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/billing/upgrade-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_plan: targetPlan,
          reason: "Requested from admin billing settings",
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not request upgrade.");
      setMessage({ type: "success", text: body.message ?? "Upgrade request sent." });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Could not request upgrade.",
      });
    } finally {
      setSavingPlan(null);
    }
  }

  if (loading) {
    return (
      <Card variant="panel" className="p-6">
        <div className="h-6 w-48 rounded bg-dash-surface-subtle" />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="h-28 rounded-xl bg-dash-surface-subtle" />
          <div className="h-28 rounded-xl bg-dash-surface-subtle" />
          <div className="h-28 rounded-xl bg-dash-surface-subtle" />
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card variant="panel" className="p-6">
        <p className="text-sm text-dash-muted">Billing details are not available.</p>
      </Card>
    );
  }

  const included = Object.entries(data.entitlements)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key)
    .filter((key) => key !== "charity");
  const locked = data.locked.filter((item) => item.key !== "charity");

  return (
    <div className="space-y-6">
      {message ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            message.type === "success"
              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
              : "border-rose-100 bg-rose-50 text-rose-800"
          )}
        >
          {message.text}
        </div>
      ) : null}

      <Card variant="panel" className="overflow-hidden">
        <div className="border-b border-dash-border bg-dash-surface-subtle p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
                Current package
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-dash-text">{data.plan.name}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dash-muted">
                {data.plan.description}
              </p>
            </div>
            <Badge variant={data.subscription?.status === "active" ? "success" : "warning"}>
              {data.subscription?.status ?? "not connected"}
            </Badge>
          </div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <Metric label="Price" value={data.plan.price} hint={data.plan.subPrice} />
          <Metric
            label="Billing cycle"
            value={data.subscription?.billing_cycle ?? "Not recorded"}
            hint="Managed by the platform operator"
          />
          <Metric
            label="Included modules"
            value={String(included.length)}
            hint="Plan entitlements plus operator overrides"
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureList
          title="Included now"
          icon="included"
          items={included.map((key) => FEATURE_LABELS[key] ?? key)}
        />
        <FeatureList
          title="Upgrade unlocks"
          icon="locked"
          items={locked.map((item) => FEATURE_LABELS[item.key] ?? item.key)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {orderedPlans.map((plan, index) => {
          const isCurrent = plan.code === currentPlanCode;
          const canUpgrade = currentPlanIndex >= 0 && index > currentPlanIndex;
          return (
            <Card
              key={plan.code}
              variant="panel"
              className={cn(
                "flex flex-col p-5",
                plan.recommended && "border-dash-ring shadow-dash-raised"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
                  {plan.tag}
                </p>
                {isCurrent ? <Badge variant="success">Current</Badge> : null}
                {!isCurrent && plan.recommended ? <Badge>Recommended</Badge> : null}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-dash-text">{plan.name}</h3>
              <p className="mt-3 text-2xl font-semibold text-dash-text">{plan.price}</p>
              <p className="mt-1 text-xs text-dash-muted">{plan.subPrice}</p>
              <p className="mt-4 text-sm leading-relaxed text-dash-muted">
                {plan.description}
              </p>
              <div className="mt-5 flex-1 space-y-5 border-t border-dash-border pt-5">
                {plan.featureGroups.map((group) => (
                  <div key={group.title}>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
                      {group.title}
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-dash-muted">
                      {group.items.map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant={isCurrent ? "dashboard" : "primary"}
                className="mt-5 w-full"
                disabled={isCurrent || !canUpgrade || savingPlan === plan.code}
                onClick={() => requestUpgrade(plan.code)}
              >
                {isCurrent ? (
                  "Your current package"
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {savingPlan === plan.code ? "Sending..." : "Request upgrade"}
                  </>
                )}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-dash-border bg-dash-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-dash-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-dash-text">{value}</p>
      <p className="mt-1 text-xs text-dash-faint">{hint}</p>
    </div>
  );
}

function FeatureList({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: "included" | "locked";
}) {
  const Icon = icon === "included" ? CheckCircle2 : LockKeyhole;
  return (
    <Card variant="panel" className="p-5">
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4",
            icon === "included" ? "text-emerald-600" : "text-amber-600"
          )}
        />
        <h3 className="text-base font-semibold text-dash-text">{title}</h3>
      </div>
      {items.length > 0 ? (
        <ul className="mt-4 grid gap-2 text-sm text-dash-muted sm:grid-cols-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dash-faint" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-dash-muted">Nothing else is locked on this package.</p>
      )}
    </Card>
  );
}
