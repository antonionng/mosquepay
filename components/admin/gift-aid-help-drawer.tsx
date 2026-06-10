"use client";

// Gift Aid help drawer.
//
// A pop-out reference the treasurer (and anyone covering for them) can open
// from the Gift Aid screen or the service-close panel. It explains, in
// plain English, the whole machine behind the scenes: how declarations are
// captured and kept audit-proof, the two ways to raise a claim, exactly
// what lands in the downloadable pack, and an FAQ for the questions that
// actually come up at church. Pure presentation, no data dependencies, so it
// can be dropped onto any surface.

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  HelpCircle,
  HeartHandshake,
  FileSignature,
  ShieldCheck,
  FolderArchive,
  CalendarClock,
  Coins,
  Send,
  Info,
} from "lucide-react";

type SectionBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "note"; text: string };

type Section = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  blocks: SectionBlock[];
};

const SECTIONS: Section[] = [
  {
    icon: HeartHandshake,
    title: "What Gift Aid does for the church",
    blocks: [
      {
        kind: "p",
        text: "Gift Aid lets a charity reclaim the basic-rate tax a UK taxpayer already paid on their donation. For every eligible pound a Member gives, the Gift Aid pack can reclaim 25p from HMRC at no extra cost to the donor. On a £100 charity collection that is an extra £25 toward the church's causes.",
      },
      {
        kind: "p",
        text: "We use HMRC's enduring declaration model: a member signs once and that single declaration covers this donation, future donations, and donations made in the past four years, until they tell us to stop. There is no need to re-sign at every service.",
      },
      {
        kind: "note",
        text: "Raffle ticket sales are never Gift Aid eligible (the donor receives something in return). Only genuine charitable donations qualify, which is why categories are flagged separately at the point of payment.",
      },
    ],
  },
  {
    icon: FileSignature,
    title: "How a member's declaration is captured",
    blocks: [
      {
        kind: "p",
        text: "There are two routes, and both produce a record that stands up to audit:",
      },
      {
        kind: "list",
        items: [
          "Digital: the member ticks the Gift Aid box in the portal or on a donate form. We snapshot exactly what they saw (the wording, the date, their IP address and device) into a printable HTML record.",
          "Paper: the member signs a physical slip at the service. The church team scans or photographs it and uploads it against the member's profile. This is the route for those who prefer wet ink.",
        ],
      },
      {
        kind: "p",
        text: "Either way the declaration lands on the member's profile, the member can view or revoke it at any time, and it is immediately available to include in a claim pack.",
      },
    ],
  },
  {
    icon: ShieldCheck,
    title: "Why it cannot be challenged (the audit trail)",
    blocks: [
      {
        kind: "p",
        text: "Every declaration carries a SHA-256 fingerprint of its evidence file. That fingerprint is stored on the record and printed in the pack, so anyone (including HMRC) can re-hash the file and prove it has not been altered since the day it was filed.",
      },
      {
        kind: "list",
        items: [
          "Evidence files live in a private store; downloads happen through short-lived signed links scoped to the person requesting them.",
          "Every change to a declaration (created, evidence uploaded, revoked) is written to an append-only event log that cannot be edited or deleted.",
          "Digital declarations are re-renderable from the stored record, so the exact document the member agreed to can always be reproduced bit-for-bit.",
        ],
      },
    ],
  },
  {
    icon: CalendarClock,
    title: "Two ways to raise a claim",
    blocks: [
      {
        kind: "p",
        text: "Both routes build the same thing (a claim batch) and both bundle the same declarations. Pick whichever matches how your church works:",
      },
      {
        kind: "list",
        items: [
          "Close the service: from the service page, one button rolls up that service's donations into a collection and a claim batch dated to the service. This is the after-every-service workflow.",
          "Period batch: from the Gift Aid screen, choose a start and end date and create a batch covering everything eligible in that window. Useful for catching up or claiming termly.",
        ],
      },
      {
        kind: "note",
        text: "A donation can only ever be claimed once. Whichever route claims it first marks it as claimed, so the other route will skip it. You cannot accidentally double-claim.",
      },
    ],
  },
  {
    icon: Send,
    title: "How 'new declarations' are worked out",
    blocks: [
      {
        kind: "p",
        text: "Each new batch sweeps up every declaration signed since your previous batch was created. Those are the new declarations UGLE needs to retain this cycle. The very first batch you ever create sweeps your whole back-catalogue, so nothing signed before you started is missed.",
      },
      {
        kind: "p",
        text: "If a donation in the batch is backed by a declaration that already went out in an earlier pack, that declaration is recorded as previously-supplied rather than counted as new, so your headline new count stays honest.",
      },
    ],
  },
  {
    icon: FolderArchive,
    title: "What is inside the claim pack (ZIP)",
    blocks: [
      {
        kind: "p",
        text: "Download once, forward the whole ZIP to the Gift Aid pack. Nothing else needs assembling by hand. Inside:",
      },
      {
        kind: "list",
        items: [
          "claim-pack.csv: one row per donation in HMRC's ChR1 column order, with donor name, postcode and house number. This is the figure list the Gift Aid pack works from.",
          "new-declarations/: the declarations signed since your last claim, each with its evidence file plus an INDEX.csv. These are the ones UGLE retains this cycle.",
          "previously-supplied-declarations/: donors who gave this period whose declaration was already sent before. Included so the pack is self-contained, clearly flagged, no action needed if you hold them already. Omitted when there are none.",
          "MANIFEST.txt: a plain-English summary, the counts, and instructions for verifying every file's SHA-256 fingerprint.",
        ],
      },
    ],
  },
  {
    icon: Coins,
    title: "Anonymous cash (GASDS)",
    blocks: [
      {
        kind: "p",
        text: "Small anonymous cash donations (the loose alms where no donor is recorded) cannot be Gift Aided because there is no declaration. They may instead qualify under the Gift Aid Small Donations Scheme, which lets the church reclaim a top-up on cash collections up to an annual cap. When you close a service we work out the eligible anonymous cash and track it against that cap for the tax year.",
      },
    ],
  },
];

type Faq = { q: string; a: string };

const FAQS: Faq[] = [
  {
    q: "A Member signed years ago. Why is his declaration not in every pack?",
    a: "Because he only needs to be sent to UGLE once. His declaration ships in the first pack after he signs (counted as new). In later packs, if he donates again, he appears in the donations CSV and, for completeness, his evidence is tucked into the previously-supplied folder, but he is not counted as new again.",
  },
  {
    q: "I closed services out of order. Does that break anything?",
    a: "No money or donation is ever lost or double-counted. The new-declaration sweep follows the order batches are created, not service dates, so if you close out of order the back-catalogue attaches to whichever batch you created first. Each declaration still ships exactly once. For the tidiest packs, close services in date order soon after each service.",
  },
  {
    q: "What is the difference between 'eligible amount' and 'reclaimable amount'?",
    a: "Eligible amount is the total of donations that qualify for Gift Aid. Reclaimable is the tax the charity gets back, which is 25% of the eligible amount (basic-rate tax relief). A £200 eligible collection reclaims £50.",
  },
  {
    q: "A member wants to stop Gift Aiding. What do I do?",
    a: "Open their profile or the declaration and revoke it. The revocation is timestamped in the audit log and the declaration stops applying to future donations from that date. Past valid claims are unaffected.",
  },
  {
    q: "Can I email the pack straight from here?",
    a: "Not automatically by design. You download the pack and send it yourself, so the treasurer stays in control of what goes to the Gift Aid pack and when. The pack is a single ZIP, ready to attach.",
  },
  {
    q: "A pack file is named something.HASH-MISMATCH.pdf. What does that mean?",
    a: "It means the stored evidence file no longer matches the fingerprint recorded when it was filed, which should never happen normally. Do not submit it. Re-upload the original signed declaration and regenerate the pack, and flag it so it can be investigated.",
  },
  {
    q: "Do guests and non-members count?",
    a: "Anyone who makes an eligible charitable donation and has a valid Gift Aid declaration on file counts, including guests, as long as their name, address and declaration are captured. Without a declaration their donation simply is not Gift Aided.",
  },
];

export function GiftAidHelpDrawer({
  variant = "button",
  label = "How it works",
}: {
  variant?: "button" | "link";
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  const trigger =
    variant === "link" ? (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-dash-ring underline-offset-2 hover:underline"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        {label}
      </button>
    ) : (
      <button
        type="button"
        className="flex items-center gap-2 rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm font-medium text-dash-text transition-colors hover:bg-dash-surface-subtle"
      >
        <HelpCircle className="h-4 w-4" />
        {label}
      </button>
    );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" size="xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-blue-600" />
            Gift Aid, explained
          </SheetTitle>
          <SheetDescription>
            How declarations, claims and packs work end to end, plus answers
            to the questions that come up at church.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-8">
          {/* Quick orientation strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Reclaim rate", value: "25%" },
              { label: "Re-sign needed", value: "Never" },
              { label: "Audit", value: "SHA-256" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-dash-border bg-dash-surface-subtle px-3 py-3 text-center"
              >
                <p className="text-lg font-semibold text-dash-text">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-[11px] uppercase tracking-wider text-dash-muted">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.title}>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-dash-text">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                    <Icon className="h-4 w-4 text-blue-600" />
                  </span>
                  {section.title}
                </h3>
                <div className="mt-3 space-y-3 pl-9">
                  {section.blocks.map((block, i) => {
                    if (block.kind === "p") {
                      return (
                        <p
                          key={i}
                          className="text-sm leading-relaxed text-dash-text-muted"
                        >
                          {block.text}
                        </p>
                      );
                    }
                    if (block.kind === "list") {
                      return (
                        <ul key={i} className="space-y-2">
                          {block.items.map((item, j) => (
                            <li
                              key={j}
                              className="flex gap-2 text-sm leading-relaxed text-dash-text-muted"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <div
                        key={i}
                        className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900"
                      >
                        <Info className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{block.text}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* FAQ */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-dash-text">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                <HelpCircle className="h-4 w-4 text-blue-600" />
              </span>
              Frequently asked questions
            </h3>
            <Accordion type="single" collapsible className="mt-2 pl-9">
              {FAQS.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border-dash-border"
                >
                  <AccordionTrigger className="text-left text-sm font-medium text-dash-text">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-dash-text-muted">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          <p className="border-t border-dash-border pt-4 text-xs text-dash-muted">
            Still stuck? The full audit trail for any declaration is on its
            detail page, and every claim batch keeps a record of who
            generated its pack and when.
          </p>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
