"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] route error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Something went wrong loading this page
        </h1>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          The admin section hit an unexpected error. Try again in a moment, or
          jump back to the dashboard. If it keeps happening, share the error
          reference with support.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-slate-400">
            ref: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>
          <RotateCcw className="mr-1 h-4 w-4" /> Try again
        </Button>
        <Link href="/admin">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
