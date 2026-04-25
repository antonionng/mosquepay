import Link from "next/link";
import { Button } from "@/components/ui/button";

const features = [
  ["Lodge websites", "AI-assisted one-pager generation and visual section editing."],
  ["Event operations", "Publish meetings, control RSVP flow, and manage attendance."],
  ["Payments", "Stripe checkout with webhook reconciliation and admin visibility."],
  ["Candidate CRM", "Capture enquiries, manage stages, and track activities."],
  ["Multi-tenant controls", "Lodge-scoped data boundaries with consistent context routing."],
  ["Admin reporting", "Payment and activity views for day-to-day lodge operations."],
];

export default function FeaturesPage() {
  return (
    <div className="bg-white text-black">
      <section className="border-b border-slate-200 bg-white pt-28">
        <div className="container-full pb-16 pt-10">
          <p className="text-base">Features</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-bold tracking-tight md:text-6xl">
            Purpose-built modules for lodge growth and operations.
          </h1>
        </div>
      </section>
      <section className="py-24">
        <div className="container-full grid gap-6 lg:grid-cols-3">
          {features.map(([title, description]) => (
            <div key={title} className="rounded-md border border-slate-200 bg-white p-8">
              <h3 className="text-2xl font-bold text-slate-950">{title}</h3>
              <p className="mt-4 text-base leading-relaxed text-slate-700">{description}</p>
            </div>
          ))}
        </div>
        <div className="container-full mt-12">
          <Button asChild className="rounded-md bg-black text-white hover:bg-slate-800">
            <Link href="/book-demo">See LodgePay in action</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

