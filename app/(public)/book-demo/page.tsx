import { CalendarCheck, Check, Clock3, MonitorSmartphone } from "lucide-react";
import { BookDemoForm } from "@/components/forms/book-demo-form";
import {
  MarketingShell,
  MarketingSection,
  MarketingKicker,
} from "@/components/marketing/marketing-shell";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Book a MosquePay Demo | Mosque Platform Walkthrough",
  description:
    "Book a MosquePay demo for your mosque or network. See giving, Gift Aid and GASDS, mosque websites, service notices, member portals, newcomer follow-up, and treasurer reporting in action.",
  path: "/book-demo",
  keywords: [
    "book mosque software demo",
    "mosque giving platform demo",
    "mosque website demo",
    "Gift Aid software demo",
  ],
});

const EXPECTATIONS = [
  {
    Icon: Clock3,
    title: "30 minutes, online",
    body: "A focused video call. No slides, just the product. Bring your treasurer, administrator, or anyone curious.",
  },
  {
    Icon: MonitorSmartphone,
    title: "Tailored to your mosque",
    body: "Tell us your priorities and we'll demo those first: giving and Gift Aid, newcomers, services, or reporting.",
  },
  {
    Icon: CalendarCheck,
    title: "No pressure follow-up",
    body: "Afterwards you'll get a summary, pricing for your size, and time to decide. We don't do hard sells.",
  },
];

const DEMO_COVERS = [
  "Online giving and QR code collections",
  "Gift Aid declarations and HMRC claim exports",
  "GASDS service collection tracking",
  "Congregation records and member portal",
  "Service notices and event RSVPs",
  "Newcomer pipeline and follow-ups",
  "Welfare with private access",
  "Treasurer reconciliation and reports",
];

export default function BookDemoPage() {
  return (
    <MarketingShell>
      <section className="px-5 pb-4 pt-16 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <MarketingKicker>Book a demo</MarketingKicker>
            <h1 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              See MosquePay working for a mosque like yours.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              A 30-minute walkthrough with someone who understands mosque administration, not a
              generic sales pitch.
            </p>
          </div>
        </div>
      </section>

      <MarketingSection>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.95fr)] lg:gap-14">
          <div>
            <div className="grid gap-5">
              {EXPECTATIONS.map(({ Icon, title, body }) => (
                <div key={title} className="flex gap-4 rounded-3xl border border-[#e9e2d4] bg-white p-6">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-heading text-base font-semibold text-slate-900">{title}</h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-3xl border border-[#e9e2d4] bg-[#f4f0e7] p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                What we can cover
              </p>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {DEMO_COVERS.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-3xl border border-[#e9e2d4] bg-white p-8 shadow-sm lg:p-10">
            <h2 className="font-heading text-2xl font-semibold text-slate-900">
              Request your walkthrough
            </h2>
            <p className="mb-8 mt-3 text-slate-600">
              Tell us a little about your mosque and we&apos;ll be in touch to arrange a time.
            </p>
            <BookDemoForm />
          </div>
        </div>
      </MarketingSection>
    </MarketingShell>
  );
}
