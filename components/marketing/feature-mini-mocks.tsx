"use client";

// Mini product-UI mocks for the homepage "How it works" cards.
//
// These replace the generic wireframe placeholder images with our actual
// admin UI, built in the same light dash theme as the HeroDashboard mock.
// Both keep the 16/9 footprint of the images they replaced so the card
// layout doesn't shift. Light whileInView stagger, honours reduced motion.

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Download,
  Shield,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const frame =
  "relative aspect-[16/9] w-full overflow-hidden bg-[radial-gradient(80%_80%_at_70%_0%,rgba(11,67,184,0.08),transparent_60%),linear-gradient(180deg,#faf7f1,#f4efe5)]";

const panel =
  "rounded-xl border border-[#e9e2d4] bg-white shadow-[0_16px_40px_-20px_rgba(30,41,59,0.35)]";

function Reveal({
  children,
  index,
  className,
}: {
  children: React.ReactNode;
  index: number;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: 0.1 + index * 0.08, duration: 0.35, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Gift Aid claim panel: recent gifts with +25% tags and an HMRC-ready total. */
export function GivingClaimMock() {
  const gifts = [
    { name: "Sarah Adeyemi", detail: "Zakat · declared", amount: "£25.00", uplift: "£6.25" },
    { name: "The Okafor family", detail: "Online giving · declared", amount: "£60.00", uplift: "£15.00" },
    { name: "Cash collection", detail: "Friday Jumu'ah · GASDS", amount: "£182.40", uplift: "£45.60" },
  ];

  return (
    <div className={frame} aria-hidden>
      <div className="absolute inset-x-6 top-5 sm:inset-x-10 sm:top-7">
        <div className={panel}>
          <div className="flex items-center justify-between border-b border-[#efe9dc] px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10">
                <Shield className="h-3 w-3 text-emerald-600" />
              </span>
              Gift Aid claim · June
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-semibold text-white">
              <Check className="h-2.5 w-2.5" />
              HMRC-ready
            </span>
          </div>
          <ul>
            {gifts.map((gift, index) => (
              <Reveal key={gift.name} index={index}>
                <li
                  className={cn(
                    "flex items-center justify-between px-3.5 py-2",
                    index > 0 && "border-t border-[#f3eee2]",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold text-slate-800">
                      {gift.name}
                    </span>
                    <span className="block text-[9px] text-slate-500">{gift.detail}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] font-bold tabular-nums text-slate-900">
                      {gift.amount}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                      +{gift.uplift}
                    </span>
                  </span>
                </li>
              </Reveal>
            ))}
          </ul>
          <Reveal index={3}>
            <div className="flex items-center justify-between border-t border-[#efe9dc] bg-[#fbf9f4] px-3.5 py-2.5">
              <span className="text-[10px] text-slate-500">
                Claimable this month
                <span className="ml-1.5 text-sm font-bold tabular-nums text-emerald-700">
                  £66.85
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-[10px] font-semibold text-white">
                <Download className="h-3 w-3" />
                Export claim
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/** Newcomer pipeline: kanban-style journey from enquiry to welcomed. */
export function NewcomerPipelineMock() {
  const columns = [
    {
      title: "Visited",
      count: 4,
      cards: [
        { name: "Ruth Bakare", note: "2nd visit · Tom following up" },
        { name: "James Kelly", note: "Came with family" },
      ],
    },
    {
      title: "Follow-up",
      count: 3,
      cards: [
        { name: "Amara Diallo", note: "Call booked · Thu" },
        { name: "Peter Hughes", note: "Invited to lunch" },
      ],
    },
    {
      title: "Welcomed",
      count: 2,
      cards: [{ name: "Grace Mensah", note: "Now a member", done: true }],
    },
  ];

  return (
    <div className={frame} aria-hidden>
      <div className="absolute inset-x-6 top-5 sm:inset-x-10 sm:top-7">
        <div className={panel}>
          <div className="flex items-center justify-between border-b border-[#efe9dc] px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand/10">
                <Sparkles className="h-3 w-3 text-brand" />
              </span>
              Newcomer journey
            </span>
            <span className="flex items-center gap-1 text-[9px] font-medium text-slate-500">
              Enquiry
              <ArrowRight className="h-2.5 w-2.5" />
              Welcomed
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 p-2.5">
            {columns.map((column, columnIndex) => (
              <Reveal key={column.title} index={columnIndex}>
                <div className="rounded-lg bg-[#f7f4ec] p-1.5">
                  <p className="flex items-center justify-between px-1 pb-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    {column.title}
                    <span className="rounded-full bg-white px-1.5 text-[8px] font-bold text-slate-600">
                      {column.count}
                    </span>
                  </p>
                  <div className="space-y-1.5">
                    {column.cards.map((card) => (
                      <div
                        key={card.name}
                        className="rounded-md border border-[#ece5d6] bg-white px-1.5 py-1.5 shadow-sm"
                      >
                        <p className="flex items-center gap-1 text-[10px] font-semibold text-slate-800">
                          {"done" in card && card.done ? (
                            <UserCheck className="h-2.5 w-2.5 shrink-0 text-emerald-600" />
                          ) : (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand/60" />
                          )}
                          <span className="truncate">{card.name}</span>
                        </p>
                        <p className="mt-0.5 truncate text-[8px] text-slate-500">{card.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
