import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";
import { getDefaultLodgeSlug, resolveLodgeSlug } from "@/lib/tenant";

export default async function RsvpSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string }>;
}) {
  const { lodge } = await searchParams;
  const lodgeSlug = resolveLodgeSlug(lodge);
  const defaultSlug = getDefaultLodgeSlug();
  const withLodgeQuery = (href: string) =>
    lodgeSlug === defaultSlug ? href : `${href}?lodge=${encodeURIComponent(lodgeSlug)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-24">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-blue-300/30 bg-blue-500/10">
          <CheckCircle className="h-10 w-10 text-blue-300" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Payment successful</h1>
        <p className="mt-4 leading-relaxed text-slate-300">
          Your RSVP and payment have been confirmed. You will receive a confirmation email shortly.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Button asChild variant="primary">
            <Link href={withLodgeQuery("/events")}>
              View Events
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" className="border-white/10 bg-white/10 text-white hover:bg-white/10 hover:text-white">
            <Link href={withLodgeQuery("/")}>Return Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
