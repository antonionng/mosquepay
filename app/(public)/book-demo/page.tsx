import { BookDemoForm } from "@/components/forms/book-demo-form";

export default function BookDemoPage() {
  return (
    <div className="bg-white text-black">
      <section className="border-b border-slate-200 bg-white pt-28">
        <div className="container-full pb-16 pt-10">
          <p className="text-base">Book Demo</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-bold tracking-tight md:text-6xl">
            See LodgePay configured for your lodge.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-700">
            Tell us about your team and priorities, and we will run a focused walkthrough
            of websites, payments, candidate nurturing, and operations.
          </p>
          <div className="mt-8 grid max-w-3xl gap-3 text-sm text-slate-700 sm:grid-cols-3">
            <div className="rounded-md border border-slate-300 bg-white px-4 py-3">Tailored workflow map</div>
            <div className="rounded-md border border-slate-300 bg-white px-4 py-3">Live payment flow demo</div>
            <div className="rounded-md border border-slate-300 bg-white px-4 py-3">Launch readiness plan</div>
          </div>
        </div>
      </section>
      <section className="py-24">
        <div className="container-full max-w-4xl">
          <div className="rounded-md border border-slate-200 bg-white p-8">
            <h2 className="text-3xl font-bold text-slate-950">Request your walkthrough</h2>
            <p className="mb-8 mt-3 text-slate-600">
              We typically respond within one working day.
            </p>
            <BookDemoForm />
          </div>
        </div>
      </section>
    </div>
  );
}

