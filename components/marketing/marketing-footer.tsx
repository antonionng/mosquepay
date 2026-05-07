import Link from "next/link";
import { Instagram, Facebook, Twitter, Linkedin } from "lucide-react";

const socialIcons: Record<string, typeof Instagram> = {
  Instagram: Instagram,
  Facebook: Facebook,
  "Twitter / X": Twitter,
  LinkedIn: Linkedin,
};

const footerColumns = [
  {
    title: "About LodgePay",
    links: [
      { href: "/about", label: "Company Overview" },
      { href: "/news", label: "Press & News" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/news", label: "Blog" },
      { href: "/faq", label: "Help Centre" },
      { href: "/events", label: "Webinars & Events" },
    ],
  },
  {
    title: "Support & Contact",
    links: [
      { href: "/contact", label: "Contact Us" },
      { href: "/faq", label: "Technical Support" },
      { href: "/contact", label: "Feedback" },
      { href: "/faq", label: "Community Forum" },
    ],
  },
  {
    title: "Connect",
    links: [
      { href: "#", label: "Instagram" },
      { href: "#", label: "Facebook" },
      { href: "#", label: "Twitter / X" },
      { href: "#", label: "LinkedIn" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="bg-mkt-bg px-6 pb-10 pt-20">
      <div className="mx-auto max-w-[1204px]">
        {/* Logo + divider */}
        <div className="flex items-center gap-5">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="font-heading text-2xl font-bold text-white">
              LodgePay
            </span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-mkt-blue">
              <path d="M8 1l2.2 4.4L15 6.3l-3.5 3.4.8 4.9L8 12.4 3.7 14.6l.8-4.9L1 6.3l4.8-.9L8 1z" fill="currentColor" />
            </svg>
          </Link>
          <div className="h-px flex-1 bg-mkt-border" />
        </div>

        {/* Link columns */}
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h3 className="font-heading text-base font-bold text-[#343844]">
                {col.title}
              </h3>
              <ul className="mt-4 flex flex-col gap-2">
                {col.links.map((link) => {
                  const Icon = col.title === "Connect" ? socialIcons[link.label] : null;
                  return (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="inline-flex items-center gap-2 font-heading text-base font-medium text-mkt-text-secondary transition-colors hover:text-white"
                      >
                        {Icon && <Icon className="h-4 w-4" />}
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-20 border-t border-mkt-border" />
        <div className="mt-5 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-[#626981]">
            &copy; {new Date().getFullYear()} LodgePay &middot; All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="#" className="font-heading text-sm font-medium text-mkt-text-secondary hover:text-white">
              Terms of Use
            </Link>
            <Link href="#" className="font-heading text-sm font-medium text-mkt-text-secondary hover:text-white">
              Privacy Policy
            </Link>
            <Link href="#" className="font-heading text-sm font-medium text-mkt-text-secondary hover:text-white">
              Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
