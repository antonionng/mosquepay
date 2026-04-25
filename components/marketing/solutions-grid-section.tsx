import { FadeIn } from "@/components/motion";
import {
  Globe,
  CreditCard,
  CalendarDays,
  Users,
  Heart,
  BookOpen,
  BarChart3,
  Mail,
  Building2,
  Sparkles,
} from "lucide-react";

const solutions = [
  {
    icon: Globe,
    title: "Website Builder",
    description:
      "AI-assisted page builder with branded sections, visual editor, and instant publishing for every lodge.",
    tags: "All Lodges",
  },
  {
    icon: CreditCard,
    title: "Payment Processing",
    description:
      "Stripe-powered checkout for event fees, dues, and donations with webhook-verified status tracking.",
    tags: "Finance, Operations",
  },
  {
    icon: CalendarDays,
    title: "Event Management",
    description:
      "Publish meetings and festive boards with RSVP, dietary tracking, attendance lists, and fee collection.",
    tags: "Events, Hospitality",
  },
  {
    icon: Users,
    title: "Candidate Tracking",
    description:
      "Full CRM from first enquiry through proposer assignment, ballot, and initiation with pipeline views.",
    tags: "Membership, Growth",
  },
  {
    icon: Heart,
    title: "Gift Aid Capture",
    description:
      "Declarations captured at the point of donation. Automated HMRC-ready reports to maximise charity reclaim.",
    tags: "Charity, Compliance",
  },
  {
    icon: BookOpen,
    title: "Member Directory",
    description:
      "Searchable, role-aware directory with contact info, dining preferences, and attendance history.",
    tags: "Administration",
  },
  {
    icon: BarChart3,
    title: "Reporting & Analytics",
    description:
      "Financial summaries, attendance trends, candidate pipeline, and Gift Aid reclaim reports at a glance.",
    tags: "Finance, Oversight",
  },
  {
    icon: Mail,
    title: "Communications",
    description:
      "Email members about upcoming events, payment reminders, and lodge updates from one integrated hub.",
    tags: "Engagement, Outreach",
  },
  {
    icon: Building2,
    title: "Multi-Lodge Support",
    description:
      "Tenant-isolated lodges with individual branding, shared provincial oversight, and role-based admin access.",
    tags: "Provincial, District",
  },
];

export function SolutionsGridSection() {
  return (
    <section className="bg-mkt-bg px-6 py-24">
      <div className="mx-auto max-w-[1204px]">
        {/* Heading */}
        <FadeIn>
          <div className="flex flex-col items-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-mkt-border bg-white px-4 py-2 shadow-[0_0_1px_rgba(44,58,114,0.05),0_2px_6px_rgba(44,58,114,0.05),0_10px_18px_rgba(58,76,146,0.1)]">
              <Sparkles className="h-4 w-4 text-mkt-blue" />
              <span className="text-sm font-medium text-[#4b5162]">
                Applications
              </span>
            </div>
            <h2 className="mt-5 text-center font-heading text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[39px]">
              Everything your lodge needs
            </h2>
            <p className="mx-auto mt-4 max-w-[820px] text-center text-base text-mkt-text-secondary opacity-80">
              From website building and payment processing to candidate management
              and charitable reporting, LodgePay covers every aspect of modern lodge
              operations.
            </p>
          </div>
        </FadeIn>

        {/* Cards grid */}
        <FadeIn delay={0.15}>
          <div className="relative mt-16">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {solutions.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.title}
                    className="flex flex-col gap-4 rounded-xl border border-[#3a3f52] bg-mkt-bg p-8"
                  >
                    <Icon className="h-8 w-8 text-mkt-text-secondary" />
                    <div>
                      <h3 className="font-heading text-xl font-bold text-white">
                        {s.title}
                      </h3>
                      <p className="mt-1 text-base leading-relaxed text-mkt-text-secondary opacity-80">
                        {s.description}
                      </p>
                    </div>
                    <p className="text-sm text-mkt-blue">{s.tags}</p>
                  </div>
                );
              })}
            </div>

            {/* Gradient fade at bottom (like Figma) */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-mkt-bg to-transparent" />
          </div>
        </FadeIn>

        {/* Explore button */}
        <FadeIn delay={0.2}>
          <div className="mt-4 flex justify-center">
            <a
              href="/features"
              className="rounded-xl border border-mkt-border bg-transparent px-6 py-3 font-heading text-sm font-bold text-[#343844] transition-colors hover:border-mkt-text-secondary hover:text-white"
            >
              Explore all features
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
