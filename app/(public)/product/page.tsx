import Link from "next/link";
import { Button } from "@/components/ui/button";

const productAreas = [
  {
    title: "Public website and member portal",
    body: "Publish a lodge site that carries your story, then give members a secure place for summons, RSVPs, dues, receipts, and their digital lodge card.",
  },
  {
    title: "Meetings, summons, and dining",
    body: "Keep meeting dates, summons copy, attendance, guests, dining choices, and steward counts in one operational record.",
  },
  {
    title: "Payments, charity, and accounts",
    body: "Collect dues, dining, donations, and Gift Aid online, then give the Treasurer payment history and reconciliation that matches the bank.",
  },
  {
    title: "Candidates and welfare",
    body: "Track enquiries, interviews, mentoring, Almoner cases, visits, and sensitive notes with role-based access and a proper audit trail.",
  },
];

export default function ProductPage() {
  return (
    <div className="bg-dash-bg text-dash-text">
      <section className="border-b border-dash-border bg-dash-surface pt-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)] lg:items-end lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">Product</p>
            <h1 className="mt-4 max-w-4xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-dash-text sm:text-5xl lg:text-6xl">
              One working record for the lodge, from summons to bank.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-dash-muted sm:text-lg">
              LodgePay brings the public site, member portal, meetings, payments, charity, candidates, welfare, and
              reporting into one platform built around the way officers already serve the lodge.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild variant="primary">
                <Link href="/book-demo">Book a demo</Link>
              </Button>
              <Button asChild variant="dashboard">
                <Link href="/features">See the modules</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-dash-border bg-dash-surface-subtle p-7 shadow-dash">
            <p className="text-sm font-semibold text-dash-text">Built for lodge officers</p>
            <p className="mt-3 text-sm leading-relaxed text-dash-muted">
              Secretary, Treasurer, Charity Steward, Membership, Almoner, Mentor, and Province teams each get the
              context they need without maintaining separate lists.
            </p>
          </div>
        </div>
      </section>
      <section className="border-b border-dash-border bg-dash-surface py-20 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 lg:grid-cols-2 lg:px-8">
          {productAreas.map((area) => (
            <div key={area.title} className="rounded-[1.25rem] border border-dash-border bg-dash-surface p-8 shadow-dash">
              <h2 className="font-heading text-2xl font-semibold text-dash-text">{area.title}</h2>
              <p className="mt-4 text-base leading-relaxed text-dash-muted">{area.body}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-dash-ring-dark text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-14 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h2 className="font-heading text-2xl font-semibold text-white">See it with your lodge on the screen.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80">
              We will walk through the workflows that matter most to your officers and members.
            </p>
          </div>
          <Button asChild className="bg-white text-dash-ring-dark hover:bg-white/90">
            <Link href="/book-demo">Request a walkthrough</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

