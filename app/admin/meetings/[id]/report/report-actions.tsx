"use client";

import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";

export function ReportActions({ backHref }: { backHref: string }) {
  return (
    <div className="report-actions flex items-center gap-2 print:hidden">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to meeting
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        <Printer className="h-4 w-4" />
        Print / Save as PDF
      </button>
    </div>
  );
}
