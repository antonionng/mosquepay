"use client";

import {
  CheckCircle2,
  Clock,
  RotateCcw,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { HistoryDerived } from "./types";

export function DerivedStatusPill({ status }: { status: HistoryDerived }) {
  switch (status) {
    case "paid":
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Paid
        </Badge>
      );
    case "open":
      return (
        <Badge variant="warning" className="gap-1">
          <Clock className="h-3 w-3" />
          Open
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="muted" className="gap-1">
          <Clock className="h-3 w-3" />
          Expired
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="muted" className="gap-1">
          <XCircle className="h-3 w-3" />
          Cancelled
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1">
          <TriangleAlert className="h-3 w-3" />
          Failed
        </Badge>
      );
    case "voided":
      return (
        <Badge variant="muted" className="gap-1">
          <RotateCcw className="h-3 w-3" />
          Voided
        </Badge>
      );
  }
}
