import { FadeIn } from "@/components/motion";

const partners = [
  { name: "Provincial Office", style: "font-heading text-lg font-bold tracking-wide" },
  { name: "Craft Lodge", style: "font-heading text-lg font-medium italic" },
  { name: "Chapter Teams", style: "font-heading text-lg font-bold uppercase tracking-[0.2em]" },
  { name: "Dining Stewards", style: "font-heading text-base font-medium tracking-widest" },
  { name: "DISTRICT TEAMS", style: "font-heading text-sm font-bold uppercase tracking-[0.35em]" },
  { name: "charity stewards", style: "font-heading text-lg font-medium italic tracking-wide" },
  { name: "SECRETARIES", style: "font-heading text-2xl font-bold uppercase tracking-widest" },
  { name: "Research Lodges", style: "font-heading text-base font-bold tracking-wide" },
  { name: "Membership Teams", style: "font-heading text-lg font-medium" },
  { name: "TREASURERS", style: "font-heading text-sm font-bold uppercase tracking-[0.25em] italic" },
];

export function SocialProofSection() {
  return (
    <section className="bg-mkt-bg px-6 pb-16 pt-10">
      <div className="mx-auto max-w-[1204px]">
        <FadeIn>
          <p className="text-center text-base text-mkt-text-secondary opacity-80">
            Trusted by lodges and provincial offices across the country
          </p>
        </FadeIn>
        <FadeIn delay={0.15}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
            {partners.map((partner) => (
              <div
                key={partner.name}
                className="flex h-12 items-center"
              >
                <span
                  className={`whitespace-nowrap text-mkt-text-secondary/40 ${partner.style}`}
                >
                  {partner.name}
                </span>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
