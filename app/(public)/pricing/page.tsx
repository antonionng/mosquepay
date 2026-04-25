import Link from "next/link";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Starter",
    price: "£79/mo",
    points: ["1 lodge tenant", "Website + events", "Payments + RSVPs"],
  },
  {
    name: "Growth",
    price: "£179/mo",
    points: ["Up to 3 lodges", "Candidate CRM", "AI content drafting"],
  },
  {
    name: "Platform",
    price: "Custom",
    points: ["Multi-lodge portfolio", "Advanced reporting", "Priority onboarding"],
  },
];

export default function PricingPage() {
  return (
    <div className="bg-white text-black">
      <section className="border-b border-slate-200 bg-white pt-28">
        <div className="container-full pb-16 pt-10">
          <p className="text-base">Pricing</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-bold tracking-tight md:text-6xl">
            Transparent plans for single-lodge and multi-lodge teams.
          </h1>
        </div>
      </section>
      <section className="py-24">
        <div className="container-full grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.name} className="rounded-md border border-slate-200 bg-white p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{tier.name}</p>
              <p className="mt-4 text-5xl font-bold tracking-tight text-slate-950">{tier.price}</p>
              <ul className="mt-6 space-y-3 text-base text-slate-700">
                {tier.points.map((point) => (
                  <li key={point}>- {point}</li>
                ))}
              </ul>
              <Button asChild className="mt-8 w-full rounded-md bg-black text-white hover:bg-slate-800">
                <Link href="/book-demo">Get walkthrough</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

