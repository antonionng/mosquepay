import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  MarketingShell,
  MarketingSection,
  MarketingKicker,
  MarketingCtaBand,
} from "@/components/marketing/marketing-shell";
import { marketingMetadata, SITE_ORIGIN } from "@/lib/seo";
import { getMarketingGuide } from "@/lib/marketing/guides";
import { CONTACTLESS_QR_GUIDE_FAQS } from "./faqs";

const GUIDE = getMarketingGuide("contactless-qr-donations-uk-mosque")!;

const GOV = {
  faithTrustees:
    "https://www.gov.uk/government/publications/faith-based-charities/managing-faith-charities-as-trustees",
  hmrcRecognition: "https://www.gov.uk/charity-recognition-hmrc",
  gasds: "https://www.gov.uk/claim-gift-aid/small-donations-scheme",
} as const;

const PUBLIC = {
  hibabox: "https://hibabox.com/",
  donorDynamics:
    "https://donordynamics.net/blogs/news/contactless-giving-for-mosques",
  gwd: "https://gwd.team/contactless-donations-for-mosques/",
  donationTablet: "https://donationtablet.uk/",
  masjidConnect:
    "https://www.masjidconnect.co.uk/mosque-donation-platform",
  mohidUk: "https://mohid.net/uk/",
  salahMate: "https://salahmate.com/",
  pledgeNow: "https://pledgenow.co/for/mosques",
} as const;

export const metadata: Metadata = marketingMetadata({
  title:
    "Contactless donations mosque UK: a treasurer field guide | MosquePay",
  description: GUIDE.description,
  path: GUIDE.path,
  keywords: [...GUIDE.keywords],
});

const CHECKED_ON = "10 September 2026";

function GovLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="font-semibold text-brand underline decoration-brand/25 underline-offset-2 hover:decoration-brand"
    >
      {children}
    </a>
  );
}

function InternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-semibold text-brand underline decoration-brand/25 underline-offset-2 hover:decoration-brand"
    >
      {children}
    </Link>
  );
}

function ArticleH2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-14 font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
      {children}
    </h2>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-5 text-base leading-7 text-slate-700">{children}</p>;
}

function GuideTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-[#e9e2d4] bg-white">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm leading-6">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-[#f4f0e7] text-slate-800">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-[#efe9dc] align-top">
              {row.map((cell, index) => (
                <td
                  key={`${row[0]}-${index}`}
                  className={`px-4 py-3 text-slate-700 ${index === 0 ? "font-semibold text-slate-900" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: CONTACTLESS_QR_GUIDE_FAQS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: GUIDE.listingTitle,
  description: GUIDE.description,
  datePublished: GUIDE.publishedAt,
  dateModified: GUIDE.lastModified,
  inLanguage: "en-GB",
  mainEntityOfPage: `${SITE_ORIGIN}${GUIDE.path}`,
  author: {
    "@type": "Organization",
    name: "MosquePay",
    url: SITE_ORIGIN,
  },
  publisher: {
    "@type": "Organization",
    name: "MosquePay",
    url: SITE_ORIGIN,
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: SITE_ORIGIN,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Guides",
      item: `${SITE_ORIGIN}/guides`,
    },
    {
      "@type": "ListItem",
      position: 3,
      name: GUIDE.listingTitle,
      item: `${SITE_ORIGIN}${GUIDE.path}`,
    },
  ],
};

export default function ContactlessQrDonationsUkMosqueGuidePage() {
  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <article>
        <section className="px-5 pb-4 pt-16 lg:px-8 lg:pt-24">
          <div className="mx-auto max-w-3xl">
            <p className="text-sm text-slate-500">
              <Link href="/guides" className="font-medium text-brand hover:underline">
                Guides
              </Link>
              <span aria-hidden className="px-2 text-slate-300">
                /
              </span>
              Contactless donations mosque UK
            </p>
            <MarketingKicker>Contactless donations mosque UK</MarketingKicker>
            <h1 className="mt-4 font-heading text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              UK mosque treasurers need contactless and QR giving that tags
              the fund on the spot, captures Gift Aid when it applies, and
              still leaves a Friday record the committee can trust.
            </h1>
            <p className="mt-4 text-sm font-medium text-slate-500">
              Published 10 September 2026
            </p>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              This is a field guide for the person who still counts the tin
              after Jumu&apos;ah, reads a contactless total with no name, owns
              a QR poster that may dump every scan into one pot, matches
              standing orders that arrived on Tuesday, and rebuilds Friday in
              Excel before the committee meeting. Public product claims below
              were read from live vendor pages on {CHECKED_ON}. MosquePay
              product claims are taken only from public pages on
              mosque-pay.com.
            </p>
            <p className="mt-5 text-base leading-7 text-slate-700">
              mosque-pay.com is operations software for a mosque&apos;s own
              giving, Gift Aid, and treasurer records. It is not the UK donor
              directory at mosquepay.co.uk. This guide does not describe that
              directory, does not use its mosque count, and does not claim its
              fee model.
            </p>
          </div>
        </section>

        <MarketingSection>
          <div className="mx-auto max-w-3xl">
            <P>
              If you are buying contactless donations for a UK mosque, you
              are not buying a box that beeps at the door. You are buying an
              operating path that can take a tap, a QR scan on the
              giver&apos;s phone, cash your team still counts after
              Jumu&apos;ah, and a standing order that never saw the foyer,
              tag Zakat, Sadaqah, Lillah, or an appeal when the gift is
              given, capture a Gift Aid declaration when it applies, and
              still show the committee a Friday record that matches the
              bank. Searchers looking up contactless donations mosque UK, QR
              code donations mosque UK, or how to replace a cash collection
              with contactless after Jumu&apos;ah, are usually doing that
              treasurer job with a phrase the results still treat as a
              hardware advert.
            </P>
            <P>
              This page stays on your side of the counter. It splits what a
              device splash sells from what you still have to keep, walks
              Friday as cash, taps, QR, standing orders, Gift Aid, and
              GASDS in one week, and maps public tools to those jobs using
              only what their own pages say. It is not a hardware vendor
              bake-off, not a thin product page, and not a reclaim manual.
              The reclaim rules for ordinary Gift Aid and for GASDS on
              small contactless gifts of £30 or less already live in the{" "}
              <InternalLink href="/guides/gift-aid-for-uk-mosque-treasurers">
                Gift Aid field guide for UK mosque treasurers
              </InternalLink>
              . The ring-fence for Zakat already lives in the{" "}
              <InternalLink href="/guides/collect-zakat-online-uk-mosque">
                collect Zakat online UK mosque
              </InternalLink>{" "}
              field guide. The wider stack of funds, bank rec, and the
              committee pack already lives in the{" "}
              <InternalLink href="/guides/mosque-treasurer-software-uk">
                mosque treasurer software UK
              </InternalLink>{" "}
              field guide. Read those when the job is reclaim, ring-fence,
              or the whole stack. Read this one when the job is Friday
              taps and QR that still have to become a record.
            </P>
            <P>
              Use it as a single-scroll field guide. Read the buying
              question first, then who it is for, then what the category
              usually sells, then the Friday week, then the public
              approaches table. The MosquePay section comes late on
              purpose. If a demo cannot answer the puncture questions, you
              do not need a longer demo, and you do not need another
              terminal.
            </P>

            <ArticleH2>
              This page is for the treasurer who still has to bank Friday
              after the taps, not for a hardware vendor shopping a search
              result.
            </ArticleH2>
            <P>
              Read this if you sign off the books, hold the keys to the
              donate flow, or have to put last Jumu&apos;ah in front of
              trustees without rebuilding it in a spreadsheet. Read it if
              you inherited a card machine, a QR poster printed for last
              year&apos;s appeal, a tin that still fills, and a standing-order
              list that never saw a fund tag. If you give on a Friday, this
              is not your explainer. If you want the short product
              questions first, the{" "}
              <InternalLink href="/faq">MosquePay FAQ</InternalLink> is
              shorter.
            </P>
            <P>
              GOV.UK&apos;s guidance on{" "}
              <GovLink href={GOV.faithTrustees}>
                managing faith charities as trustees
              </GovLink>{" "}
              applies to England and Wales and names mosques among places of
              worship that are normally charities. Restricted money staying
              restricted is part of that duty. A tap that funded the wrong
              pot is still a trust failure if the screen looked modern. Tax
              advantages still sit with HMRC rather than with a Charity
              Commission number alone. You still need{" "}
              <GovLink href={GOV.hmrcRecognition}>
                recognition from HMRC
              </GovLink>{" "}
              before Gift Aid or GASDS becomes a repayment. This page does
              not rewrite those reclaim tests.
            </P>
            <P>
              This page does not cover a giver asking which national
              charity to pay. It does not cover a prayer-time screen except
              where a vendor also publishes a money claim. It does not
              cover Scotland or Northern Ireland regulator differences
              beyond the obvious point that HMRC recognition is still the
              tax gate. If you are a network treasurer looking after
              several mosques, treat each legal entity as its own foyer,
              its own donate flow, and its own Friday record. Do not merge
              restricted funds across entities because a dashboard can
              print one total.
            </P>

            <ArticleH2>
              Contactless for mosques usually sells a device at the door.
              The treasurer still needs a tagged Friday record.
            </ArticleH2>
            <P>
              Type contactless donations mosque UK into a search box and
              you will land on pages that sell a stand, a pole, a tablet,
              or a wall box. That is a real category. Hardware vendors
              already rank it. A device that takes a tap meets a
              congregation that no longer carries coins. It does not, by
              itself, tell you whose gift it was, which pot it belonged
              to, whether a Gift Aid declaration exists, or how the
              committee will read Friday on Monday.
            </P>
            <P>
              What those pages usually sell is intake at the door: a
              branded screen, a contactless reader, sometimes a QR on the
              same glass, and a total that looks tidy at the end of
              Jumu&apos;ah. What you still need is the operating path behind
              that beep. The fund has to be tagged on the spot, not guessed
              on Thursday. A Gift Aid declaration, when it applies, has to
              hold a full name, home address, and postcode, not only a
              tick. Small anonymous taps that might sit under GASDS have to
              stay out of the declared column. Cash in the tin and
              standing orders that never saw the device still have to land
              in the same week. If any of those jobs can empty into one
              pot, you have replaced the cash collection with a different
              mess.
            </P>
            <P>
              QR code donations mosque UK is the same job in another
              shape. A poster on the way out can be a cheap door. It can
              also dump every scan into last year&apos;s appeal, skip the
              declaration, and leave you matching a payment-provider email
              that cannot tell Sadaqah from the building fund. A QR that
              is not tied to a named appeal is a second tin with a worse
              audit trail.
            </P>
            <P>
              MosquePay&apos;s public homepage describes turning any tablet
              into a giving terminal, with the giver paying on their own
              phone after a QR is shown, and a Gift Aid declaration signed
              on screen. Public campaign copy says each appeal gets its
              own QR code and giving page. The{" "}
              <InternalLink href="/features">features</InternalLink> page
              describes online, QR, card, and recorded cash giving in the
              same record, Gift Aid declarations at the point of giving,
              GASDS logged per service, HMRC-ready exports with evidence,
              bank import and reconciliation, and treasurer reports. Those
              are bookkeeping sentences. They are not a reason to buy a
              branded kiosk you do not need, and they are not a reason to
              Gift Aid a Zakat line by default.
            </P>

            <GuideTable
              caption="What contactless for mosques usually sells versus what the treasurer still needs"
              headers={[
                "What the category sells",
                "What Friday actually leaves you",
                "What the path must keep",
                "What a thin splash usually drops",
              ]}
              rows={[
                [
                  "A tap at the door",
                  "A contactless total with no name, plus cash still in the tin",
                  "The same Friday record for the tap, the tin, and the standing order",
                  "A terminal total that never saw the bank file",
                ],
                [
                  "A QR poster",
                  "Scans that may still land in last year's appeal",
                  "A QR per appeal, already labelled when it arrives",
                  "One pot that looks modern and hides the restriction",
                ],
                [
                  "A Gift Aid tick on a screen",
                  "A giver who walked away, or a tick with no address",
                  "A declaration with full name, home address, and postcode when Gift Aid applies",
                  "A boost number you cannot attach to a person",
                ],
                [
                  "A cashless story",
                  "Envelopes, notes, and a regular giver who already transferred",
                  "Recorded cash and midweek standing orders on the same fund tags",
                  "A device that replaced the coins and left the week in Excel",
                ],
              ]}
            />
            <P>
              Those rows overlap on purpose. A tap with no fund tag fails
              the ring-fence and the committee pack in the same week. A QR
              that collected only an amount fails the receipt and, if you
              later drop the same pounds into GASDS after someone already
              declared, fails the claim. A beautiful stand that never
              exports Friday leaves you in Excel the night before the
              meeting. Buy the jobs. Do not buy the beep.
            </P>

            <ArticleH2>
              A Friday the committee can trust still has to carry cash,
              taps, QR, standing orders, Gift Aid, and GASDS in one week.
            </ArticleH2>
            <P>
              Start at the door after Jumu&apos;ah, because that is when the
              queue forms and the story starts to split. The tin holds
              notes, coins, and envelopes someone has already labelled.
              Those envelopes must not be mixed with general Sadaqah, and
              they must not quietly fund the building. The contactless
              total is a number that may not name anyone. Someone pressed
              a building-fund button. Someone else tapped and walked
              away. A QR poster on the way out may still be last
              year&apos;s appeal. A regular giver tells you they have already
              set up a standing order, so they did not put anything in the
              tin and they did not tap. You still have to count, you still
              have to bank, and you still have to know which pot each line
              belongs to before anyone writes the khutbah recap.
            </P>
            <P>
              The day after Jumu&apos;ah is when the count becomes a record.
              Two people should ideally check the cash, because that is
              what GOV.UK asks you to keep in mind for small-donation
              evidence. You bank the tin. You type recorded cash into
              whatever system you have, and you put a fund tag on the
              lines that had a pot. You decide, gift by gift, whether a
              named tap is ordinary Gift Aid, whether an anonymous tap at
              or under the live GOV.UK contactless limit is a GASDS
              candidate, or whether the line is neither. You do not take a
              slice of a larger tap and call it a small donation. You do
              not put a declared gift through GASDS. The{" "}
              <InternalLink href="/guides/gift-aid-for-uk-mosque-treasurers">
                Gift Aid guide
              </InternalLink>{" "}
              walks those reclaim tests. This page only needs you to see
              that the decision happens in the same week as the
              collection, not in March when the claim is already late.
            </P>
            <P>
              Midweek is standing orders and card settlement. Amounts
              arrive with a reference that may say mosque and nothing
              else. QR and card settlement land on a different day from
              the tin. A building-fund pledge lands in the general
              column because nobody tagged it. If your stack cannot import
              a bank file and put a fund on the match, you will rebuild
              that week in Excel before the next Jumu&apos;ah. The committee
              does not care which Tuesday the money moved. They care that
              Friday still matches what people thought they gave.
            </P>
            <P>
              Month end is the same week with a longer memory. Trustees
              need income by fund, not a single contactless number for
              &quot;Jumu&apos;ah&quot;. They need to see that Gift Aid
              evidence exists for the gifts you intend to claim, and that
              GASDS evidence exists for the anonymous cash and small taps
              you intend to claim another way. They need a bank
              reconciliation that explains the difference between the tin,
              the terminal, the QR settlement, and the statement. If you
              can only tell that story by opening last month&apos;s
              spreadsheet and hoping the tabs still agree, you do not have
              a contactless path. You have archaeology with a nicer
              beep.
            </P>

            <ArticleH2>
              Public approaches to contactless and QR mosque giving, read
              from their own pages, not scored against each other.
            </ArticleH2>
            <P>
              This is a jobs table, not a bake-off. No row wins. No
              feature is invented. Pages were read on {CHECKED_ON}. Where
              a public page is silent on fund tags, Gift Aid, GASDS, or a
              committee pack, the table says so. The MosquePay row uses
              only claims printed on mosque-pay.com. Other names are
              public players you will hear in the same search. Confirm
              their live pages before you treat a sentence here as a
              contract.
            </P>
            <P>
              The named public pages are{" "}
              <GovLink href={PUBLIC.hibabox}>Hibabox</GovLink>,{" "}
              <GovLink href={PUBLIC.donorDynamics}>
                DonorDynamics&apos; contactless mosque guide
              </GovLink>
              ,{" "}
              <GovLink href={PUBLIC.gwd}>
                GWD Donation Station
              </GovLink>
              ,{" "}
              <GovLink href={PUBLIC.donationTablet}>
                DonationTablet / Smart Giving
              </GovLink>
              ,{" "}
              <GovLink href={PUBLIC.masjidConnect}>
                MasjidConnect donations
              </GovLink>
              , <GovLink href={PUBLIC.mohidUk}>MOHID UK</GovLink>,{" "}
              <GovLink href={PUBLIC.salahMate}>Salah Mate</GovLink>, and{" "}
              <GovLink href={PUBLIC.pledgeNow}>
                PledgeNow for mosques
              </GovLink>
              . DonorDynamics, GWD, and DonationTablet sit together as
              the hardware-style cluster that already ranks this search.
              They are still separate rows, because their public pages do
              not say the same thing.
            </P>

            <GuideTable
              caption="Public approaches to contactless and QR donations for a UK mosque treasurer"
              headers={[
                "Approach",
                "What public pages say it does",
                "Fund tag and Gift Aid on the tap",
                "What you still do",
              ]}
              rows={[
                [
                  "Spreadsheet and a card terminal",
                  "The terminal takes a tap. The spreadsheet holds the cash count, the contactless total, and last Friday's pack if you rebuild it",
                  "Only if you type a fund and a name after the queue has gone. A tap with no declaration is not ordinary Gift Aid",
                  "Own every match: tin, terminal, QR, standing order, GASDS log, and the committee narrative",
                ],
                [
                  "Hibabox",
                  "The homepage describes contactless, online, and in-person donations with instant receipts and Gift Aid, plus reports and Gift Aid tracking. It also publishes Premium and Lite kiosk devices",
                  "The homepage read for this guide does not publish a Zakat / Sadaqah / Lillah ledger model",
                  "Confirm what evidence the box actually stores, whether a receipt names the restricted fund, and who still files Charities Online",
                ],
                [
                  "DonorDynamics",
                  "The mosque contactless guide describes a giving point for Sadaqah, Zakat, and Jumu'ah, with the giver choosing a cause and tapping a card or phone. Payment is described as Give A Little with Stripe Tap to Pay, settling to the masjid's existing bank account",
                  "Public copy describes several funds on one device, a labelled Zakat fund, on-screen Gift Aid declarations, and GASDS on small anonymous contactless gifts for a registered charity",
                  "Own the HMRC submission. Their page describes a one-time device purchase and says Give A Little applies a platform fee with Stripe's standard rate. Confirm those live terms before you treat a sentence here as a contract",
                ],
                [
                  "GWD Donation Station",
                  "The mosque page describes a contactless donation box used alongside cash, with customisable screens and on-screen causes for Zakat and Sadaqah plus seasonal appeals such as Ramadan and Eid",
                  "Public copy names Zakat and Sadaqah on screen. The page read for this guide does not publish a Gift Aid, GASDS, or Charities Online claim",
                  "Own the declaration file, the GASDS log, the bank rec, and the committee pack if you adopt the station as a channel",
                ],
                [
                  "DonationTablet / Smart Giving",
                  "The public homepage describes a contactless donation tablet for UK mosques, with a tap on the screen or a scan of the mosque's QR code on the giver's phone, plus debit or credit card, Apple Pay, and Google Pay",
                  "Public copy describes adding Gift Aid on the flow, Gift Aid automation, live donation tracking, and one-time or recurring gifts. The homepage read for this guide does not publish a Zakat / Sadaqah / Lillah ledger model",
                  "Confirm what declaration fields are stored, whether GASDS is logged apart from declared gifts, and who still files the claim. Their page also publishes tablet and mobile plans with Stripe setup",
                ],
                [
                  "MasjidConnect",
                  "The donations page describes Zakat, Sadaqah, Lillah, and Qurbani funds, recurring gifts, campaign pages, and Stripe or SumUp records",
                  "Public copy shows donations broken out by those funds, including a building fund in the example analytics. That donations page does not publish Gift Aid declarations, GASDS, or Charities Online submission",
                  "Their page also prints a platform fee on top of Stripe or SumUp. Do not import their comparison of other brands as a MosquePay fact",
                ],
                [
                  "MOHID",
                  "The UK page describes cloud mosque management with donation kiosks, handheld receipt devices, Zakat management, fundraising, and signage",
                  "Public UK copy names Zakat management and fundraising. The page read for this guide does not publish a Gift Aid or GASDS workflow, and it does not publish a Zakat / Sadaqah / Lillah ledger model in those words",
                  "Ask what UK Gift Aid evidence the kiosk actually stores, whether a handheld receipt names the restricted fund, and who still files Charities Online",
                ],
                [
                  "Salah Mate",
                  "The public homepage describes a free donation kiosk that works on any tablet, a smart TV display with donation QR codes, and a worshipper app, with Stripe or SumUp and instant digital receipts",
                  "Public copy describes cashless Zakat and Sadaqah and transparent Zakat tracking. That homepage does not publish a Gift Aid, GASDS, or HMRC submission claim",
                  "Own the declaration file, the GASDS log, the bank rec, and the committee pack if you adopt the kiosk as a channel",
                ],
                [
                  "PledgeNow",
                  "The mosque page describes Jumu'ah pledges, a foyer QR poster, WhatsApp reminders, and a CSV for the committee. Public copy says no card is required and that it works with your existing bank account",
                  "Public copy describes Zakat, Sadaqah, and Lillah tracked in their own columns, with a per-campaign Zakat toggle, and Gift Aid captured with HMRC model wording for a CSV you file",
                  "You still collect the money and keep the ring-fence in the books. A pledge QR is not the same job as a tap that settled on Friday",
                ],
                [
                  "MosquePay",
                  "Public pages describe online, QR, card, and recorded cash giving, any tablet as a giving terminal, pay on the giver's phone, Gift Aid on screen, a QR per appeal, bank import and reconciliation, treasurer reports, and settlement to the mosque bank account",
                  "Public claims describe Zakat, Sadaqah, Lillah, and appeal fund tags kept separate, Gift Aid declarations at the point of giving, and GASDS logged per service",
                  "HMRC-ready exports with evidence. Not Charities Online listed submission. Write the Gift Aid-on-Zakat policy yourself. Read live pricing for the currency actually printed",
                ],
              ]}
            />
            <P>
              Read the table sideways. A hardware row that is strong on
              the tap and silent on the ring-fence is a channel. A donate
              page that is strong on funds and silent on Gift Aid is a
              form. A pledge row that captures Zakat as a checkbox still
              needs the money to hit a tagged pot you can show trustees. The
              treasurer&apos;s path is the set of jobs that still have an
              owner after you sign. If two tools both claim a job, you
              still need one place the committee can open.
            </P>
            <P>
              MasjidConnect&apos;s donations page publishes its own
              comparison table and names MosquePay in that table. This
              guide does not adopt their fee ranking, their feature ticks,
              or their wording. MosquePay&apos;s{" "}
              <InternalLink href="/pricing">pricing page</InternalLink>{" "}
              says the mosque pays the payment provider&apos;s standard card
              rates, that MosquePay adds no markup, and that gifts settle
              to the mosque&apos;s own bank account. The named payment
              partner on that page is Mooov. The live pricing page prints
              its subscription figures in the currency shown there. This
              guide does not convert those figures.
            </P>

            <ArticleH2>
              Gift Aid and GASDS on small taps already have a reclaim
              field guide. This page does not rewrite it.
            </ArticleH2>
            <P>
              If the question is how to collect a declaration, log GASDS,
              and assemble a claim, stop here and open the{" "}
              <InternalLink href="/guides/gift-aid-for-uk-mosque-treasurers">
                Gift Aid field guide for UK mosque treasurers
              </InternalLink>
              . That page already walks ordinary Gift Aid, GASDS, HMRC
              recognition, and the records GOV.UK asks you to keep. This
              page will not rewrite it.
            </P>
            <P>
              What this contactless guide needs you to remember is
              narrower. Ordinary Gift Aid is a 25p top-up on a gift from a
              UK taxpayer who has given you a valid declaration. GASDS is
              a different route for small anonymous cash and contactless
              gifts where you do not have a declaration. GOV.UK&apos;s{" "}
              <GovLink href={GOV.gasds}>small donations scheme</GovLink>{" "}
              page says you may be able to claim 25 percent on
              contactless card donations of £30 or less collected on or
              after 6 April 2019. Keep the card-terminal evidence HMRC
              asks for. Do not put a declared tap through GASDS. Do not
              take a £30 slice out of a larger tap. Re-read the Gift Aid
              guide, then the live GOV.UK page, before you file.
            </P>
            <P>
              The software, or the device, has to capture the
              declaration at the point of giving, or give you a place to
              record a paper one against the same gift. It has to store
              the donor&apos;s full name, home address, and postcode,
              because that is what GOV.UK lists as required. It has to
              log GASDS cash and small contactless collections per
              service without dropping declared gifts into the same
              column. It has to export evidence you can attach. If a
              product also submits through Charities Online, that is a
              public claim you should verify on that product&apos;s own
              pages. MosquePay does not make that claim.
            </P>
            <P>
              MosquePay&apos;s public{" "}
              <InternalLink href="/faq">FAQ</InternalLink> and{" "}
              <InternalLink href="/features">features</InternalLink>{" "}
              pages describe HMRC-ready exports with the evidence behind
              every line, for England and Wales charities working through
              HMRC. Until HMRC recognises you, a Friday declaration file
              is evidence you cannot yet turn into a repayment.
            </P>

            <ArticleH2>
              Fund tags and Zakat are a ring-fence job. Do not treat Gift
              Aid on Zakat as a default example.
            </ArticleH2>
            <P>
              If the question is how to take Zakat online, keep it apart
              from Sadaqah and Lillah, and show the restricted pot after
              Ramadan, stop here and open the{" "}
              <InternalLink href="/guides/collect-zakat-online-uk-mosque">
                collect Zakat online UK mosque
              </InternalLink>{" "}
              field guide. That page already walks intake channels,
              receipts, and the trustee pack. This page will not rewrite
              it.
            </P>
            <P>
              What this Friday guide needs you to remember is narrower.
              A tap or a QR scan that does not name the pot will look
              like ordinary income until someone asks where the Zakat
              went. MosquePay&apos;s public pages describe Zakat, Sadaqah,
              Lillah, and appeal fund tags kept separate. Those are
              bookkeeping sentences. They are not a ruling on who may
              receive Zakat.
            </P>
            <P>
              Do not Gift Aid Zakat as a default example. This page does
              not write new fiqh. It does not tell you that Gift Aid on
              Zakat is allowed, and it does not tell you that it is
              forbidden. It does not show Gift Aid topping up a Zakat
              line as a worked example, and it does not reproduce any
              marketing mock that treats a Zakat amount as Gift Aid
              eligible. A mock is not a policy. Write the mosque&apos;s
              Gift Aid-on-Zakat policy down, show it on the donate flow,
              and confirm the religious and tax treatment with your imam
              and accountant before any Zakat line appears in a Gift Aid
              export.
            </P>

            <ArticleH2>
              Contactless and QR sit inside a wider treasurer stack, and
              that stack already has its own field guide.
            </ArticleH2>
            <P>
              Taking a tap is one job. Matching the bank, capturing Gift
              Aid evidence on eligible gifts, logging GASDS only when no
              declaration exists, issuing giving statements, and printing
              a committee pack are the jobs around it. Those jobs are
              mapped, with a public-approaches table of their own, in the{" "}
              <InternalLink href="/guides/mosque-treasurer-software-uk">
                mosque treasurer software UK
              </InternalLink>{" "}
              field guide. Read that guide when you are deciding what
              has to sit in the stack before the foyer device exists.
              Read this one when the tap and the QR are the things you
              are trying to keep honest.
            </P>
            <P>
              The short version for this page is operational, not
              commercial. A kiosk, a pledge QR, or a donate page can be a
              useful door. None of those is the stack. If last
              Friday&apos;s tin, the contactless total, the foyer scan,
              and Tuesday&apos;s standing order cannot sit in one ledger
              with the same tags, you will still rebuild Jumu&apos;ah in
              Excel. The software guide is where that wider buying
              question lives. This page only needs you not to confuse a
              channel with a treasurer record.
            </P>

            <ArticleH2>
              Questions that puncture a contactless demo before you buy a
              device or print a poster.
            </ArticleH2>
            <P>
              Ask these out loud. The answers sort a branded box from a
              phone QR, a tagged fund from a single giving total, a
              declaration from a tick, a GASDS log from a reused total,
              and an export tool from a Charities Online submit product.
            </P>
            <ol className="mt-6 list-decimal space-y-4 pl-6 text-base leading-7 text-slate-700">
              <li>
                Are you buying a device the mosque owns, or a QR the
                giver pays on their own phone? MosquePay&apos;s public
                homepage describes any tablet as a giving terminal, with
                the giver scanning a QR and paying on their phone so the
                tablet never touches card details. Other public pages
                sell their own stands and boxes. Ask which door you
                actually need after Jumu&apos;ah.
              </li>
              <li>
                Can last Friday&apos;s tin, the contactless total, a QR
                scan, and a midweek standing order all sit on the same
                fund tag, including cash your team recorded after the
                count? Can Zakat, Sadaqah, Lillah, and a building appeal
                stay in their own pots when someone taps the nearest
                button?
              </li>
              <li>
                Does the product capture the donor&apos;s full name, home
                address, and postcode on the Gift Aid declaration, or
                only a tick box? Can a paper declaration still be
                attached to the same gift?
              </li>
              <li>
                Does GASDS exclude gifts that already have a
                declaration, and does it refuse a £30 slice of a larger
                tap? Can you log small anonymous contactless collections
                per service with the card-terminal evidence HMRC asks
                for?
              </li>
              <li>
                Does the product submit the claim through Charities
                Online, export a schedule you attach yourself, or only
                store a receipt? MosquePay&apos;s honest answer is export.
                Public{" "}
                <InternalLink href="/faq">FAQ</InternalLink> and{" "}
                <InternalLink href="/features">features</InternalLink>{" "}
                copy says HMRC-ready exports with evidence. It does not
                say MosquePay is on HMRC&apos;s Charities Online
                commercial software suppliers list.
              </li>
              <li>
                Can you import a bank file and match it to tagged gifts,
                or are you still reconciling Friday in Excel after the
                dashboard looks green?
              </li>
              <li>
                Does the product Gift Aid a Zakat line by default, or
                does it follow a written mosque policy that you can also
                show on the donate flow?
              </li>
              <li>
                Where does settlement go? MosquePay&apos;s{" "}
                <InternalLink href="/pricing">pricing page</InternalLink>{" "}
                says gifts settle directly to your mosque&apos;s own bank
                account.
              </li>
              <li>
                Is there a markup on card processing? The same pricing
                page says you pay only the payment provider&apos;s
                standard card rates and that MosquePay adds no markup.
                The named payment partner on that page is Mooov. Do not
                convert the subscription currency printed on that page,
                and do not treat another vendor&apos;s comparison table
                as MosquePay pricing.
              </li>
            </ol>

            <ArticleH2>
              What MosquePay will show you in 30 minutes is only what the
              public pages already claim.
            </ArticleH2>
            <P>
              <InternalLink href="/book-demo">Book a demo</InternalLink>{" "}
              is a 30-minute call. Bring last Friday&apos;s cash sheet,
              the contactless total, the QR poster if you still have it,
              one standing-order line that still has no fund tag, and
              last month&apos;s committee note. The walkthrough should
              stay inside claims printed on mosque-pay.com.
            </P>
            <P>
              You should see any tablet opened as a giving terminal. You
              should see the giver pay on their own phone after a QR is
              shown, with Gift Aid signed on screen. You should see a QR
              and giving page per appeal. You should see online, QR,
              card, and recorded cash giving in the same record. You
              should see Zakat, Sadaqah, Lillah, and appeal funds kept
              on separate tags. You should see Gift Aid declarations
              captured at the point of giving, whether the gift is
              online or recorded by your team, and attached to eligible
              gifts. You should see GASDS cash collections logged per
              service. You should see HMRC-ready exports with the
              evidence behind every line. You should see bank statement
              import and reconciliation beside payment history. You
              should see treasurer reports, giving statements, and
              ledger views matched to that history.
            </P>
            <P>
              You should hear that settlement goes to the mosque&apos;s
              own bank account, that MosquePay adds no card-processing
              markup, and that Mooov is the payment partner named on{" "}
              <InternalLink href="/pricing">pricing</InternalLink>. You
              should not be quoted a converted subscription price. Read
              the figures in the currency the live page prints.
            </P>
            <P>
              You should not be told that MosquePay submits the claim to
              HMRC. You should not be told that MosquePay is on
              HMRC&apos;s Charities Online commercial software suppliers
              list. Those sentences are not on the public site. You
              should not be shown Gift Aid topping up a Zakat line as a
              default example. You should not be sold a device SKU
              MosquePay does not publish.
            </P>
            <P>
              MosquePay is operated by Neural Network Group Limited,
              company number 16606065. The contact email currently
              printed on the public contact page is ag@experrt.com. If
              you want the shorter product answers first, read the{" "}
              <InternalLink href="/faq">FAQ</InternalLink>. If you want
              to start onboarding rather than watch a demo first,{" "}
              <InternalLink href="/join">get started</InternalLink>.
            </P>

            <ArticleH2>What this page skipped, on purpose.</ArticleH2>
            <P>
              This page does not invent how much your mosque would have
              held if last Friday&apos;s taps had been tagged correctly.
              It does not award MosquePay a first-place badge against
              Hibabox, DonorDynamics, GWD, DonationTablet, MasjidConnect,
              MOHID, Salah Mate, or PledgeNow. It does not reprint HMRC
              supplier lists. It does not rewrite the Gift Aid reclaim
              guide. It does not write fiqh. It does not invent device
              SKUs or mosque counts. It does not convert the currency
              printed on the{" "}
              <InternalLink href="/pricing">live pricing page</InternalLink>
              . It does not treat /news as a home for this guide. /news
              is the product changelog. It does not use /charity or
              /donate, which are demo mosque pages, as the place this
              guide lives. It does not open a /blog. It does not use the
              mosquepay.co.uk directory&apos;s mosque count or fee
              model. It does not run paid ads and it does not ask you to
              send cold outbound. It does not reproduce any marketing
              mock that Gift Aids a Zakat line.
            </P>

            <ArticleH2>
              A tap is only useful if Friday still has a name, a fund,
              and a record.
            </ArticleH2>
            <P>
              If you remember one line, remember that. Take the gift on
              every door the congregation actually uses. Tag the fund
              when the money arrives. Capture a Gift Aid declaration
              when it applies. Log GASDS only when no declaration
              exists. Match the bank. Show the committee Friday from
              that record, not from a Thursday-night spreadsheet. Then
              check that the tin, the tap, the QR, and the pack still
              tell the same story.
            </P>

            <ArticleH2>
              Questions treasurers ask when they search contactless
              donations mosque UK.
            </ArticleH2>
            <dl className="mt-8 space-y-8">
              {CONTACTLESS_QR_GUIDE_FAQS.map((item) => (
                <div key={item.question}>
                  <dt className="font-heading text-lg font-semibold text-slate-900">
                    {item.question}
                  </dt>
                  <dd className="mt-2 text-base leading-7 text-slate-700">
                    {item.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </MarketingSection>
      </article>

      <MarketingCtaBand
        title="Bring last Friday's contactless total to a 30-minute walkthrough."
        body="We will stay on fund tags, Gift Aid on screen, QR per appeal, and the Friday record. You still submit the HMRC claim."
        ctaLabel="Book a demo"
        ctaHref="/book-demo"
        secondaryLabel="Read the Gift Aid guide"
        secondaryHref="/guides/gift-aid-for-uk-mosque-treasurers"
      />
    </MarketingShell>
  );
}
