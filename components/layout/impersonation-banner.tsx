"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type Scope = {
  kind: "none" | "dummy" | "platform" | "lodge";
};

type LodgeContext = {
  selectedSlug: string;
  selectedLodge: { name: string } | null;
  isPlatform: boolean;
};

export function ImpersonationBanner() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [lodgeName, setLodgeName] = useState<string>("");
  const [actorEmail, setActorEmail] = useState<string>("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [sessionRes, ctxRes] = await Promise.all([
          fetch("/api/auth/session"),
          fetch("/api/admin/lodge-context"),
        ]);
        if (!active) return;
        if (!sessionRes.ok || !ctxRes.ok) return;
        const session = await sessionRes.json();
        const ctx: LodgeContext = await ctxRes.json();
        const scope: Scope | undefined = session.scope;
        if (!scope) return;
        if (scope.kind !== "platform" && scope.kind !== "dummy") return;
        if (!ctx.selectedLodge) return;
        setLodgeName(ctx.selectedLodge.name);
        setActorEmail(session.admin?.email ?? "");
        setShow(true);
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  if (!show) return null;

  async function stop() {
    try {
      await fetch("/api/admin/lodge-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lodge_slug: "" }),
      });
    } catch {
      // ignore
    }
    setShow(false);
    router.refresh();
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          <span>
            <strong>Acting as {lodgeName}.</strong>{" "}
            {actorEmail ? (
              <span className="text-amber-800">
                Operator session: {actorEmail}. All actions are audited.
              </span>
            ) : (
              <span className="text-amber-800">
                Operator session. All actions are audited.
              </span>
            )}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={stop}
          className="border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
        >
          Return to platform
        </Button>
      </div>
    </div>
  );
}
