"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "mosque-pwa-install-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export function PwaBootstrapper() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/member" });
      } catch (error) {
        console.warn("Service worker registration failed", error);
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (Date.now() - dismissedAt > DISMISS_TTL_MS) {
        setShowPrompt(true);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => undefined);
    setInstallEvent(null);
    setShowPrompt(false);
  }

  function dismiss() {
    setShowPrompt(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore quota errors
    }
  }

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-xl lg:bottom-6 lg:left-auto lg:right-6 lg:max-w-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Download className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">
          Install Mosque Portal
        </p>
        <p className="truncate text-xs text-slate-500">
          Add to your home screen for one-tap RSVPs and your member card.
        </p>
      </div>
      <button
        type="button"
        onClick={install}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        Install
      </button>
      <button
        type="button"
        onClick={dismiss}
        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
