"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Globe,
  Loader2,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DomainState = {
  custom_domain: string | null;
  custom_domain_verified_at: string | null;
  custom_domain_verification_token: string | null;
  cname_target: string;
};

function recordName(domain: string) {
  return domain.startsWith("www.") ? "www" : domain;
}

function isLikelySubdomain(domain: string) {
  return domain.split(".").length > 2;
}

export function CustomDomainCard() {
  const router = useRouter();
  const [state, setState] = useState<DomainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "verify" | "remove" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/domain")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setState(data);
        setDraft(data.custom_domain ?? "");
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function call(
    body: Record<string, unknown>,
    label: "save" | "verify" | "remove"
  ) {
    setBusy(label);
    try {
      const res = await fetch("/api/admin/domain", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      setFeedback(label === "save" ? "Domain saved." : label === "verify" ? "Domain verified." : "Domain removed.");
      const refreshed = await fetch("/api/admin/domain").then((r) => r.json());
      setState(refreshed);
      setDraft(refreshed.custom_domain ?? "");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!state) return null;

  const verified = Boolean(state.custom_domain_verified_at);
  const savedDomain = state.custom_domain;
  const isSubdomain = savedDomain ? isLikelySubdomain(savedDomain) : true;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-slate-500" />
        <h2 className="text-base font-semibold text-slate-900">Custom domain</h2>
        {verified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Verified
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Point a church-owned domain at ChurchPay and we will serve this church&apos;s
        public site from it. The platform app stays on <code>churchpay.co.uk</code>.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Label htmlFor="custom-domain">Domain</Label>
          <Input
            id="custom-domain"
            value={draft}
            placeholder="church.your-domain.org"
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => call({ action: "save", domain: draft }, "save")}
            disabled={busy !== null || !draft.trim()}
          >
            {busy === "save" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
          {state.custom_domain && (
            <>
              <Button
                variant="outline"
                onClick={() => call({ action: "verify" }, "verify")}
                disabled={busy !== null}
              >
                {busy === "verify" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="mr-1 h-4 w-4" />
                )}
                Verify
              </Button>
              <Button
                variant="ghost"
                className="text-red-600 hover:bg-red-50"
                onClick={() => call({ action: "remove" }, "remove")}
                disabled={busy !== null}
              >
                {busy === "remove" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-1 h-4 w-4" />
                )}
                Remove
              </Button>
            </>
          )}
        </div>
      </div>

      {feedback && (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          {feedback}
        </div>
      )}

      {savedDomain && (
        <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">DNS instructions</p>
          <ol className="list-decimal space-y-2 pl-5 text-slate-700">
            <li>
              In your DNS provider, add a <strong>CNAME</strong> record for{" "}
              <code className="rounded bg-white px-1 py-0.5">
                {recordName(savedDomain)}
              </code>{" "}
              pointing to{" "}
              <code className="rounded bg-white px-1 py-0.5">
                {state.cname_target}
              </code>
              .
            </li>
            {!isSubdomain ? (
              <li>
                This looks like an apex/root domain. If your DNS provider does not
                allow CNAME records at the root, use <strong>ALIAS</strong>,
                <strong> ANAME</strong>, or CNAME flattening to point it at{" "}
                <code className="rounded bg-white px-1 py-0.5">
                  {state.cname_target}
                </code>
                . Otherwise use a subdomain such as{" "}
                <code className="rounded bg-white px-1 py-0.5">www.{savedDomain}</code>.
              </li>
            ) : null}
            <li>
              Add the verification record (TXT) below if your DNS provider
              requires it. Some providers can verify the CNAME alone.
              <pre className="mt-1 overflow-auto rounded bg-white p-2 text-xs text-slate-600">
                TXT _churchpay-verify.{savedDomain} = {state.custom_domain_verification_token ?? "(generated on save)"}
              </pre>
            </li>
            <li>
              Wait 5-10 minutes for DNS to propagate, then click <em>Verify</em>.
              Once verified and added to the live hosting project, newcomers can use
              the new domain.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
