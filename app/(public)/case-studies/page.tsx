import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CaseStudiesPage() {
  return (
    <div className="bg-white text-black">
      <section className="border-b border-slate-200 bg-white pt-28">
        <div className="container-full pb-16 pt-10">
          <p className="text-base">Case Studies</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-bold tracking-tight md:text-6xl">
            Real lodges running on LodgePay.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-700">
            Covenant Lodge is our reference implementation for website publishing, event
            management, and payment operations.
          </p>
        </div>
      </section>
      <section className="py-24">
        <div className="container-full max-w-4xl">
          <div className="rounded-md border border-slate-200 bg-white p-8">
            <h2 className="text-3xl font-bold text-slate-950">Covenant Lodge No. 4344</h2>
            <p className="mt-3 text-slate-600">
              Demonstrates AI-assisted one-pager editing, Stripe RSVP payments, and
              tenant-scoped public and admin workflows.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="secondary" className="rounded-md border border-slate-900 bg-white text-slate-900">
                <Link href="/?lodge=covenant-4344">Open live showcase</Link>
              </Button>
              <Button asChild className="rounded-md bg-black text-white hover:bg-slate-800">
                <Link href="/book-demo">Discuss your lodge setup</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

