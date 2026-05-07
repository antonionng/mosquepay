import { BookDemoForm } from "@/components/forms/book-demo-form";

export default function BookDemoPage() {
  return (
    <div className="bg-dash-bg text-dash-text">
      <section className="border-b border-dash-border bg-dash-surface pt-28">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-end lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">Book a demo</p>
            <h1 className="mt-4 max-w-4xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-dash-text sm:text-5xl lg:text-6xl">
              See LodgePay with your lodge in mind.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-dash-muted sm:text-lg">
              Tell us what your officers are trying to fix. We will shape the walkthrough around your meetings,
              payments, charity work, candidates, member portal, and reporting.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-dash-muted">
            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle px-4 py-3">A practical workflow map</div>
            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle px-4 py-3">Live member and payment flows</div>
            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle px-4 py-3">A launch plan your officers can understand</div>
          </div>
        </div>
      </section>
      <section className="border-b border-dash-border bg-dash-surface py-20 lg:py-24">
        <div className="mx-auto max-w-4xl px-5 lg:px-8">
          <div className="rounded-[1.25rem] border border-dash-border bg-dash-surface p-8 shadow-dash">
            <h2 className="font-heading text-3xl font-semibold text-dash-text">Request your walkthrough</h2>
            <p className="mb-8 mt-3 text-dash-muted">
              We typically respond within one working day. You will also receive a confirmation by email.
            </p>
            <BookDemoForm />
          </div>
        </div>
      </section>
    </div>
  );
}
