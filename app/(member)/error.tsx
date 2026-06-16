"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MemberError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[member] route error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">
        We could not load this page
      </h1>
      <p className="text-sm text-slate-500">
        Please try again. If the problem continues, contact your mosque
        secretary.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>
          <RotateCcw className="mr-1 h-4 w-4" /> Try again
        </Button>
        <Link href="/member">
          <Button variant="outline">Back to portal</Button>
        </Link>
      </div>
    </div>
  );
}
