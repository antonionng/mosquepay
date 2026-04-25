import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ProductPage() {
  return (
    <div className="bg-white text-black">
      <section className="relative min-h-[520px] overflow-hidden pt-28">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2000&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-black/70" />
        <div className="container-full relative z-10 flex min-h-[520px] items-center">
          <div className="max-w-3xl rounded-xl border border-white/20 bg-black/35 px-6 py-8 text-white backdrop-blur-sm md:px-10 md:py-10">
            <p className="text-base">Product</p>
            <h1 className="mt-4 text-5xl font-bold tracking-tight md:text-6xl">
              One operating system for lodge teams.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-white/90">
              LodgePay unifies website content, events, payments, and candidate nurturing so
              your team can run consistently across all lodge workflows.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="rounded-md bg-white text-black hover:bg-white/90">
                <Link href="/book-demo">Book Demo</Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-md border-white bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link href="/features">Explore Features</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <section className="py-24">
        <div className="container-full grid gap-6 lg:grid-cols-3">
          {[
            ["Website Builder", "Section-based editing with AI draft generation and review controls."],
            ["Payments Engine", "Stripe checkout, webhook state sync, and admin payment visibility."],
            ["Candidate CRM", "Lead pipeline, stage movement, activities, and follow-up clarity."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-md border border-slate-200 bg-white p-8">
              <h3 className="text-2xl font-bold text-slate-950">{title}</h3>
              <p className="mt-4 text-base leading-relaxed text-slate-700">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

