import Link from "next/link";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Single Lodge",
    price: "From £79/mo",
    points: ["One lodge website and member portal", "Meetings, summons, RSVPs, dues, and donations", "Officer roles, payments, receipts, and core reporting"],
  },
  {
    name: "Lodge Group",
    price: "From £179/mo",
    points: ["Up to 3 lodges with separate records", "Candidate CRM, mentoring, Almoner, and communications", "Shared support, setup guidance, and reporting"],
  },
  {
    name: "Province",
    price: "Custom",
    points: ["Multi-lodge rollout and portfolio oversight", "Feature flags, lodge context switching, and support desk", "Onboarding plan for secretaries, treasurers, and central teams"],
  },
];

export default function PricingPage() {
  return (
    <div className="bg-dash-bg text-dash-text">
      <section className="border-b border-dash-border bg-dash-surface pt-28">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">Pricing</p>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-dash-text sm:text-5xl lg:text-6xl">
            Clear plans for lodges, groups, and Provinces.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-dash-muted sm:text-lg">
            Start with the workflows your officers need now. Add more modules as the lodge moves from paper, email,
            and spreadsheets into one trusted system.
          </p>
        </div>
      </section>
      <section className="border-b border-dash-border bg-dash-surface py-20 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 lg:grid-cols-3 lg:px-8">
          {tiers.map((tier) => (
            <div key={tier.name} className="flex rounded-[1.25rem] border border-dash-border bg-dash-surface p-8 shadow-dash">
              <div className="flex w-full flex-col">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dash-faint">{tier.name}</p>
                <p className="mt-4 font-heading text-4xl font-semibold tracking-tight text-dash-text">{tier.price}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm leading-relaxed text-dash-muted">
                {tier.points.map((point) => (
                  <li key={point} className="border-l-2 border-dash-border pl-4">{point}</li>
                ))}
                </ul>
                <Button asChild className="mt-8 w-full" variant="primary">
                  <Link href="/book-demo">Get a walkthrough</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-12 max-w-6xl px-5 lg:px-8">
          <div className="rounded-[1.25rem] border border-dash-border bg-dash-surface-subtle p-7 text-sm leading-relaxed text-dash-muted">
            Need a different rollout shape? We can price for halls, groups, pilot lodges, and Province-wide onboarding.
          </div>
        </div>
      </section>
    </div>
  );
}

