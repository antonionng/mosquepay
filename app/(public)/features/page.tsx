import Link from "next/link";
import { Button } from "@/components/ui/button";

const features = [
  ["Lodge websites", "Section-based publishing, AI-assisted drafts, news, officers, events, charity pages, and local lodge branding."],
  ["Meetings and summons", "Create meetings, prepare summons, manage send history, collect RSVPs, and keep dining numbers visible."],
  ["Dues and payments", "Stripe checkout for dues, dining, donations, and receipts, with payment status clear to officers and members."],
  ["Treasurer tools", "Ledger views, bank import, reconciliation, payment exports, and evidence that holds up at month-end."],
  ["Charity and Gift Aid", "Run appeals, record donations, collect Gift Aid declarations, and report totals without rebuilding paperwork."],
  ["Members and digital card", "Member portal, receipts, private calendar feed, mobile app bootstrap, profile updates, and a digital lodge card."],
  ["Candidates and mentoring", "Move enquiries through stages, log activities, assign mentors, and keep sponsors clear on the next step."],
  ["Almoner and welfare", "Record cases, visits, alerts, and sensitive notes with access controlled for the officers who need them."],
  ["Province oversight", "Support multiple lodges with portfolio reporting, lodge context switching, feature flags, and platform-level support."],
];

export default function FeaturesPage() {
  return (
    <div className="bg-dash-bg text-dash-text">
      <section className="border-b border-dash-border bg-dash-surface pt-28">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">Features</p>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-dash-text sm:text-5xl lg:text-6xl">
            The work of the lodge, kept in step.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-dash-muted sm:text-lg">
            LodgePay is not just a website tool. It connects the officer work around meetings, money, membership,
            charity, welfare, and communication so the lodge runs from the same facts.
          </p>
        </div>
      </section>
      <section className="border-b border-dash-border bg-dash-surface py-20 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 lg:grid-cols-3 lg:px-8">
          {features.map(([title, description]) => (
            <div key={title} className="rounded-[1.25rem] border border-dash-border bg-dash-surface p-7 shadow-dash">
              <h2 className="font-heading text-xl font-semibold text-dash-text">{title}</h2>
              <p className="mt-4 text-sm leading-relaxed text-dash-muted">{description}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-12 max-w-6xl px-5 lg:px-8">
          <Button asChild variant="primary">
            <Link href="/book-demo">See LodgePay in action</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

