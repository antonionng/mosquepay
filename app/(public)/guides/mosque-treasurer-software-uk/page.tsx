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
import { TREASURER_SOFTWARE_GUIDE_FAQS } from "./faqs";

const GUIDE = getMarketingGuide("mosque-treasurer-software-uk")!;

const GOV = {
  faithTrustees:
    "https://www.gov.uk/government/publications/faith-based-charities/managing-faith-charities-as-trustees",
  claimOverview: "https://www.gov.uk/claim-gift-aid",
  declarations: "https://www.gov.uk/claim-gift-aid/gift-aid-declarations",
  gasds: "https://www.gov.uk/claim-gift-aid/small-donations-scheme",
  hmrcRecognition: "https://www.gov.uk/charity-recognition-hmrc",
} as const;

const PUBLIC = {
  ummah: "https://theummah.io/mosque-accounting-software/",
  halalWealth: "https://halalwealth.uk/",
  icharmsGiftAid: "https://technoservesolutions.com/products/icharms/gift-aid/",
  icharms: "https://icharms.app/",
  salahMate: "https://salahmate.com/",
  mohidUk: "https://mohid.net/uk/",
  eMasjid: "https://e-masjid.co.uk/",
  masjidConnect:
    "https://www.masjidconnect.co.uk/mosque-donation-platform",
  johnsons:
    "https://johnsonsuk.com/accounting-and-financial-services/audit-and-assurance/mosque-audits/",
} as const;

export const metadata: Metadata = marketingMetadata({
  title: "Mosque treasurer software UK: a category field guide | MosquePay",
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
  mainEntity: TREASURER_SOFTWARE_GUIDE_FAQS.map((item) => ({
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

export default function MosqueTreasurerSoftwareUkGuidePage() {
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
              Mosque treasurer software UK
            </p>
            <MarketingKicker>Mosque treasurer software UK</MarketingKicker>
            <h1 className="mt-4 font-heading text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              UK mosque treasurers need one stack that tags Zakat separately,
              captures Gift Aid evidence, and builds the committee pack
              without rebuilding Friday in Excel.
            </h1>
            <p className="mt-4 text-sm font-medium text-slate-500">
              Published 10 September 2026
            </p>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              This is a category field guide for the person who counts the
              Friday tin, reconciles contactless taps, matches standing
              orders, keeps Zakat envelopes out of general Sadaqah, still has
              a Gift Aid file in a cupboard, and has to produce an AGM pack
              that the committee will actually read. Public product claims
              below were read from live vendor pages on {CHECKED_ON}.
              MosquePay product claims are taken only from public pages on
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
              If you are buying mosque treasurer software UK, you are not
              buying a logo that says mosque. You are buying a stack that can
              keep Friday&apos;s Zakat envelope in its own pot, attach a Gift
              Aid declaration to a named gift, log anonymous cash for GASDS
              only when no declaration exists, match what hit the bank, and
              hand the committee a pack that still tells the same story on
              Monday morning. Searchers looking up mosque treasurer software
              UK, mosque accounts donations, or software for mosque treasurers
              are usually doing those jobs with one phrase.
            </P>
            <P>
              This page splits the jobs the phrase hides, walks a real
              treasurer month, and maps public tools to those jobs using only
              what their own pages say. It is not a scored bake-off and it is
              not a thin product splash. The reclaim rules for ordinary Gift
              Aid and GASDS already live in the{" "}
              <InternalLink href="/guides/gift-aid-for-uk-mosque-treasurers">
                Gift Aid field guide for UK mosque treasurers
              </InternalLink>
              . Read that guide when you are assembling a claim. Read the{" "}
              <InternalLink href="/guides/collect-zakat-online-uk-mosque">
                collect Zakat online UK mosque
              </InternalLink>{" "}
              field guide when the job is mosque-side intake and
              ring-fencing. Read this one when you are deciding what has
              to sit in the stack before the claim exists.
            </P>
            <P>
              Use it as a single-scroll field guide. Read the job split
              first, then the month, then the public approaches table. The
              MosquePay section comes late on purpose. If a demo cannot
              answer the puncture questions, you do not need a longer demo.
            </P>

            <ArticleH2>
              This page is for the treasurer who has to explain Friday&apos;s
              tin to the committee, not for a vendor shopping a category
              list.
            </ArticleH2>
            <P>
              Read this if you sign off the books, hold the HMRC login, or
              have to put a finance pack in front of trustees before the AGM.
              Read it if you are the volunteer who inherited three
              spreadsheets, a card-machine total, and a paper Gift Aid folder
              that does not match any of them. If you give on a Friday, this
              is not your explainer. If you want the short product questions
              first, the{" "}
              <InternalLink href="/faq">MosquePay FAQ</InternalLink> is
              shorter.
            </P>
            <P>
              GOV.UK&apos;s guidance on{" "}
              <GovLink href={GOV.faithTrustees}>
                managing faith charities as trustees
              </GovLink>{" "}
              applies to England and Wales and names mosques among places of
              worship that are normally charities. The treasurer&apos;s stack
              has to survive that duty: restricted money stays restricted,
              records can be shown, and tax advantages sit with HMRC rather
              than with a Charity Commission number alone. You still need{" "}
              <GovLink href={GOV.hmrcRecognition}>
                recognition from HMRC
              </GovLink>{" "}
              before Gift Aid or GASDS becomes a repayment.
            </P>
            <P>
              This page does not cover donors asking which app to download.
              It does not cover a prayer-time screen, a nikah diary, or a
              hall-booking calendar except where those products also publish
              a money claim. It does not cover Scotland or Northern Ireland
              regulator differences beyond the obvious point that HMRC
              recognition is still the tax gate. If you are a network
              treasurer looking after several mosques, treat each legal
              entity as its own books, its own HMRC reference, and its own
              pack. Do not merge restricted funds across entities because a
              dashboard can print one total.
            </P>
            <P>
              The accountant lens on this page is public, not invented.
              Johnsons&apos;{" "}
              <GovLink href={PUBLIC.johnsons}>mosque audits</GovLink> page
              describes Chartered Accountants taking a risk-based approach to
              reduce misstatements, designing tests so the audit report is
              factually accurate, and working to Charities SORP when that
              framework applies. It also names Charity Commission
              compliance, ICAEW and Financial Reporting Council regulation,
              and a UK mosque-audit practice. Your software does not replace
              that examination. It has to give the examiner a trail.
            </P>

            <ArticleH2>
              The phrase mosque software hides five jobs that do not live in
              one spreadsheet column.
            </ArticleH2>
            <P>
              Vendors sell mosque software as if the treasurer, the imam, the
              welcome team, and the hall diary shared one problem. They do
              not. The treasurer&apos;s problem is money that arrived in
              different shapes and must leave the month in named pots. The
              five jobs below are what a UK mosque treasurer actually buys,
              whether the box on the invoice says accounting, donations,
              CRM, or kiosk.
            </P>

            <GuideTable
              caption="Five treasurer jobs sold as mosque software"
              headers={[
                "Job",
                "What Friday leaves you",
                "What the stack must keep",
                "What a thin tool usually drops",
              ]}
              rows={[
                [
                  "Restricted funds",
                  "Zakat envelopes, Sadaqah, Lillah, a building appeal, and general running costs in the same tin",
                  "A tagged fund on every gift, including cash you later type in",
                  "One giving total that looks tidy and hides the restriction",
                ],
                [
                  "Gift Aid and GASDS evidence",
                  "A named standing order, a contactless tap with no address, and anonymous cash",
                  "A valid declaration, or a GASDS collection log that does not reuse the same pounds",
                  "A Gift Aid tick box with no full name, home address, or postcode",
                ],
                [
                  "Bank reconciliation",
                  "Cash banked on Saturday, card settlement midweek, standing orders on Tuesday",
                  "A match between the tin, the terminal, the import, and the mosque bank account",
                  "A donations dashboard that never saw the bank file",
                ],
                [
                  "Donor statements",
                  "A regular giver who wants a year summary, and a one-off who wants a receipt",
                  "A statement that names the fund and the date, not a guess from memory",
                  "A payment-provider email that cannot tell Zakat from the building fund",
                ],
                [
                  "Committee and trustee pack",
                  "A monthly meeting, an AGM, and an examiner who will ask how you know",
                  "Income by fund, Gift Aid evidence, bank rec, and a written restricted-fund policy",
                  "A screenshot of last Friday's card total pasted into last year's agenda",
                ],
              ]}
            />
            <P>
              Those jobs overlap. A Zakat standing order that hits the bank
              with no fund tag fails restricted funds and bank rec in the
              same week. A contactless tap that collected only an amount
              fails Gift Aid evidence and, if you later drop the same pounds
              into GASDS, fails the claim. A beautiful kiosk that never
              exports a committee pack leaves you in Excel on Thursday
              night. Buy the jobs. Do not buy the category name.
            </P>

            <ArticleH2>
              A UK mosque treasurer&apos;s month is Friday cash, midweek
              standing orders, and a pack that still has to survive the AGM.
            </ArticleH2>
            <P>
              Start with Friday. The tin holds notes, coins, and Zakat
              envelopes that must not be mixed with general Sadaqah. The
              contactless total is a number that may not name anyone. Someone
              pressed a building-fund button. Someone else tapped and
              walked away. A regular giver tells you they have already set
              up a standing order, so they did not put anything in the tin.
              You still have to count, you still have to bank, and you still
              have to know which pot each line belongs to before anyone
              writes the khutbah recap.
            </P>
            <P>
              The day after Jumu&apos;ah is when the count becomes a record.
              Two people should ideally check the cash, because that is what
              GOV.UK asks you to keep in mind for small-donation evidence.
              You bank the tin. You type recorded cash into whatever system
              you have. You decide, gift by gift, whether a line is ordinary
              Gift Aid, a GASDS candidate, or neither. You do not take a
              slice of a larger gift and call it a small donation. You do
              not put a declared gift through GASDS. The{" "}
              <InternalLink href="/guides/gift-aid-for-uk-mosque-treasurers">
                Gift Aid guide
              </InternalLink>{" "}
              walks those reclaim tests. This page only needs you to see
              that the decision happens in the same week as the collection,
              not in March when the claim is already late.
            </P>
            <P>
              Midweek is standing orders and card settlement. Amounts arrive
              with a reference that may say &quot;mosque&quot; and nothing
              else. A building-fund pledge lands in the general column
              because nobody tagged it. A Zakat standing order looks like
              ordinary income until someone asks where the Zakat pot went.
              If your stack cannot import a bank file and put a fund on the
              match, you will rebuild that week in Excel before the next
              Jumu&apos;ah.
            </P>
            <P>
              Month end is the committee pack. Trustees need income by fund,
              not a single donations number. They need to see that Gift Aid
              evidence exists for the gifts you intend to claim, and that
              GASDS evidence exists for the anonymous cash you intend to
              claim another way. They need a bank reconciliation that
              explains the difference between the tin, the terminal, and the
              statement. They need donor statements you can send without
              rewriting names from memory. Johnsons&apos; mosque-audit pages
              are useful here as a reminder of the examiner&apos;s job:
              reduce misstatements, test the report, and work to Charities
              SORP when that is the framework you file under. Software that
              cannot print that trail is not treasurer software. It is a
              collection channel.
            </P>
            <P>
              The AGM is the same pack with a longer memory. Last
              Ramadan&apos;s appeal, the building fund, the funeral fund,
              and the general running costs have to still be separable six
              months later. If you can only tell that story by opening last
              year&apos;s spreadsheet and hoping the tabs still agree, you
              do not have a stack. You have archaeology.
            </P>

            <ArticleH2>
              Public approaches to those jobs, read from their own pages,
              not scored against each other.
            </ArticleH2>
            <P>
              This is a jobs table, not a bake-off. No row wins. No feature
              is invented. Pages were read on {CHECKED_ON}. Where a public
              page is silent on Gift Aid, GASDS, bank import, or a committee
              pack, the table says so. The MosquePay row uses only claims
              printed on mosque-pay.com. Other names are public players you
              will hear in the same search. Confirm their live pages before
              you treat a sentence here as a contract.
            </P>
            <P>
              The named public pages are{" "}
              <GovLink href={PUBLIC.ummah}>Ummah mosque accounting</GovLink>,{" "}
              <GovLink href={PUBLIC.halalWealth}>Halal Wealth</GovLink>,{" "}
              <GovLink href={PUBLIC.icharmsGiftAid}>
                iCHARMS Gift Aid
              </GovLink>{" "}
              and the{" "}
              <GovLink href={PUBLIC.icharms}>iCHARMS product site</GovLink>,{" "}
              <GovLink href={PUBLIC.salahMate}>Salah Mate</GovLink>,{" "}
              <GovLink href={PUBLIC.mohidUk}>MOHID UK</GovLink>,{" "}
              <GovLink href={PUBLIC.eMasjid}>e Masjid</GovLink>, and{" "}
              <GovLink href={PUBLIC.masjidConnect}>
                MasjidConnect donations
              </GovLink>
              . Johnsons sits in the month above as the accountant lens, not
              as a software row.
            </P>

            <GuideTable
              caption="Public approaches to the UK mosque treasurer stack"
              headers={[
                "Approach",
                "What public pages say it does",
                "Restricted funds",
                "Gift Aid and GASDS",
                "What you still do",
              ]}
              rows={[
                [
                  "Spreadsheet",
                  "Holds the cash count, the standing-order list, and last month's pack if you rebuild it",
                  "Only if you keep separate columns and never paste a total over them",
                  "You type declarations and GASDS evidence into HMRC's schedule yourself",
                  "Own every match: tin, bank, fund, declaration, and the AGM narrative",
                ],
                [
                  "Ummah",
                  "Mosque accounting pages describe named funds, member giving history, and board-ready reports in place of a shared spreadsheet",
                  "Public copy describes separate ledgers for Zakat, Sadaqah, Waqf, and general operations, tagged at collection",
                  "That accounting page does not publish a Gift Aid, GASDS, or Charities Online claim",
                  "Confirm how bank rec, HMRC evidence, and UK reclaim actually run before you treat it as the whole stack",
                ],
                [
                  "Halal Wealth",
                  "Public site describes finance, donations, Gift Aid, donor management, and Charity Commission-format statements for UK masjids",
                  "Islamic-charity copy describes restricted-fund tracking and construction-project ledgers",
                  "Public copy describes Gift Aid calculations, HMRC-format ODS exports, GASDS tracking, and direct XML submission to HMRC",
                  "Confirm Open Banking, roles, and the HMRC submission path against your own examiner's expectations",
                ],
                [
                  "iCHARMS",
                  "Public pages describe donors, donations, Zakat and Sadaqah categorisation, Xero sync, and trustee-ready reports",
                  "Gift Aid FAQ copy says Islamic donation types such as Zakat, Sadaqah, and Qurbani are handled as their own funds",
                  "iCHARMS claims HMRC-listed Charities Online submission, declaration capture, and GASDS on its own Gift Aid pages. That is not a MosquePay claim.",
                  "Confirm declarations and funds before anyone presses submit, and keep the mosque's HMRC account in mosque hands",
                ],
                [
                  "Salah Mate",
                  "Public homepage describes a free donation kiosk, smart TV display, and worshipper app, with Stripe or SumUp and instant digital receipts",
                  "Public copy describes cashless Zakat and Sadaqah and transparent Zakat tracking",
                  "That homepage does not publish a Gift Aid, GASDS, or HMRC submission claim",
                  "Own the declaration file, the GASDS log, bank rec, and the committee pack if you adopt the kiosk as a channel",
                ],
                [
                  "MOHID",
                  "The UK page describes cloud mosque management with donation kiosks, handheld receipt devices, Zakat management, fundraising, and signage",
                  "Public UK copy names Zakat management and fundraising. Broader MOHID pages describe donation types including Zakat and Sadaqah",
                  "The UK page read for this guide does not publish a Gift Aid or GASDS workflow. Other MOHID pages describe year-end donor tax summaries",
                  "Ask what UK Gift Aid evidence the kiosk actually stores, and who still files Charities Online",
                ],
                [
                  "e Masjid",
                  "Public homepage describes UK masjid SaaS for donations, memberships, nikah and hall booking, funeral funds, recurring gifts, and standing-order upload and reconcile",
                  "Funeral funds and donations are named. The public homepage does not publish a Zakat / Sadaqah / Lillah ledger model",
                  "That homepage does not publish a Gift Aid or GASDS claim",
                  "Confirm whether SO reconcile is a treasurer pack or a membership payment match, and keep HMRC evidence elsewhere if the product is silent",
                ],
                [
                  "MasjidConnect",
                  "The donations page describes Zakat, Sadaqah, Lillah, and Qurbani funds, recurring gifts, campaign pages, and Stripe or SumUp records",
                  "Public copy shows donations broken out by those funds, including a building fund in the example analytics",
                  "That donations page does not publish Gift Aid declarations, GASDS, or Charities Online submission",
                  "Their page also prints a platform fee on top of Stripe or SumUp. Do not import their comparison of other brands as a MosquePay fact",
                ],
                [
                  "MosquePay",
                  "Public pages describe online, QR, card, and recorded cash giving, bank import and reconciliation, treasurer reports, and settlement to the mosque bank account",
                  "Public claims describe Zakat, Sadaqah, Lillah, and appeal fund tags kept separate",
                  "Gift Aid declarations at the point of giving, GASDS logged per service, HMRC-ready exports with evidence. Not Charities Online listed submission",
                  "Submit the claim from the mosque's own HMRC account. Write the Gift Aid-on-Zakat policy yourself. Read live pricing for the currency actually printed",
                ],
              ]}
            />
            <P>
              Read the table sideways. A kiosk row that is strong on
              collection and silent on Gift Aid is a channel. An accounting
              row that is strong on ledgers and silent on HMRC is a book.
              A Gift Aid row that submits to Charities Online still needs
              restricted-fund tags that match the claim line. The
              treasurer&apos;s stack is the set of jobs that still have an
              owner after you sign. If two tools both claim a job, you still
              need one place the committee can open.
            </P>
            <P>
              MasjidConnect&apos;s donations page publishes its own
              comparison table and names MosquePay in that table. This guide
              does not adopt their fee ranking, their feature ticks, or
              their wording. MosquePay&apos;s{" "}
              <InternalLink href="/pricing">pricing page</InternalLink> says
              the mosque pays the payment provider&apos;s standard card
              rates, that MosquePay adds no markup, and that gifts settle to
              the mosque&apos;s own bank account. The named payment partner
              on that page is Mooov. The live pricing page prints its
              subscription figures in the currency shown there. This guide
              does not convert those figures.
            </P>

            <ArticleH2>
              Gift Aid and GASDS are a reclaim problem with their own field
              guide. This page does not rewrite it.
            </ArticleH2>
            <P>
              Ordinary Gift Aid is a 25p top-up on a gift from a UK taxpayer
              who has given you a valid declaration. GASDS is a different
              route for small anonymous cash and contactless gifts where you
              do not have a declaration. The live tests, the matching rule,
              the community-building notes that already name mosques, and
              the records HMRC asks you to keep are in the{" "}
              <InternalLink href="/guides/gift-aid-for-uk-mosque-treasurers">
                Gift Aid field guide for UK mosque treasurers
              </InternalLink>
              . Start there, then reopen{" "}
              <GovLink href={GOV.claimOverview}>claiming Gift Aid</GovLink>,{" "}
              <GovLink href={GOV.declarations}>
                Gift Aid declarations
              </GovLink>
              , and{" "}
              <GovLink href={GOV.gasds}>the small donations scheme</GovLink>{" "}
              before you file.
            </P>
            <P>
              What this stack guide needs you to remember is narrower. The
              software has to capture the declaration at the point of
              giving, or give you a place to record a paper one against the
              same gift. It has to store the donor&apos;s full name, home
              address, and postcode, because that is what GOV.UK lists as
              required. It has to log GASDS cash and small contactless
              collections per service without dropping declared gifts into
              the same column. It has to export evidence you can attach. If
              a product also submits through Charities Online, that is a
              public claim you should verify on that product&apos;s own
              pages. MosquePay does not make that claim.
            </P>
            <P>
              MosquePay&apos;s public{" "}
              <InternalLink href="/faq">FAQ</InternalLink> and{" "}
              <InternalLink href="/features">features</InternalLink> pages
              describe HMRC-ready exports with the evidence behind every
              line. The Gift Aid guide on this site is written for
              treasurers in England or Wales. If your mosque is recognised
              by HMRC and files from another UK regulator, confirm the same
              export against your own examiner and the live GOV.UK pages.
              Until HMRC recognises you, a Friday declaration file is
              evidence you cannot yet turn into a repayment.
            </P>

            <ArticleH2>
              Ring-fencing Zakat is a bookkeeping duty. It is not a fiqh
              ruling written by software.
            </ArticleH2>
            <P>
              This page does not write new fiqh. It does not tell you that
              Gift Aid on Zakat is allowed, and it does not tell you that it
              is forbidden. It does not show Gift Aid topping up a Zakat
              line as a default example, and it does not reproduce any
              marketing mock that treats a Zakat amount as Gift Aid
              eligible. A mock is not a policy.
            </P>
            <P>
              What the congregation can see is simpler. A Zakat envelope
              that funded the building is a trust failure whether or not the
              tax line looked tidy. Ummah&apos;s public accounting page
              says Zakat must not fund general operations and describes
              separate ledgers. Halal Wealth describes restricted-fund
              tracking. iCHARMS says Gift Aid is applied only where it is
              eligible on Islamic donation types. MosquePay&apos;s public
              pages say Zakat, Sadaqah, Lillah, and appeal funds are kept
              separate. Those are bookkeeping sentences. They are not a
              ruling you can point at in the musalla.
            </P>
            <P>
              Write the mosque&apos;s restricted-fund policy, and the
              mosque&apos;s Gift Aid-on-Zakat policy, where the treasurer,
              the imam, and the accountant can all find them. Show the
              giver how the mosque will treat the gift before they give.
              Confirm the religious treatment with your imam and the tax
              treatment with your accountant before any Zakat line appears
              in a Gift Aid export. Software can tag the fund and, where
              the written policy allows, capture a declaration. It cannot
              decide the policy for you.
            </P>
            <P>
              The same honesty applies to Lillah, Sadaqah, a funeral fund,
              and a building appeal. If the donor thought they were giving
              to one pot, the committee pack has to show that pot. A
              campaign page that labels the gift on the way in is useful
              only if the treasurer report still carries the label on the
              way out.
            </P>

            <ArticleH2>
              Questions that puncture a software demo before you sign
              anything.
            </ArticleH2>
            <P>
              Ask these out loud. The answers sort a collection channel
              from a treasurer stack, an export tool from a Charities
              Online submit product, and a tagged fund from a single
              giving total.
            </P>
            <ol className="mt-6 list-decimal space-y-4 pl-6 text-base leading-7 text-slate-700">
              <li>
                Can last Friday&apos;s tin, the contactless total, and the
                midweek standing orders all sit in one ledger with a fund
                tag on each line, including cash your team recorded after
                the count?
              </li>
              <li>
                Can a gift be split across Zakat, Sadaqah, Lillah, and a
                general or building fund so the committee pack matches the
                restriction? Does the product Gift Aid a Zakat line by
                default, or does it follow a written mosque policy that you
                can also show on the donate flow?
              </li>
              <li>
                Does the product capture the donor&apos;s full name, home
                address, and postcode on the Gift Aid declaration, or only
                a tick box?
              </li>
              <li>
                Does GASDS exclude gifts that already have a declaration,
                or can the same pounds appear in both columns?
              </li>
              <li>
                Does the product submit the claim through Charities Online,
                export a schedule you attach yourself, or only store a
                receipt? MosquePay&apos;s honest answer is export. Public{" "}
                <InternalLink href="/faq">FAQ</InternalLink> and{" "}
                <InternalLink href="/features">features</InternalLink> copy
                says HMRC-ready exports with evidence. It does not say
                MosquePay is on HMRC&apos;s Charities Online commercial
                software suppliers list. iCHARMS does claim listed
                submission on its own Gift Aid pages.
              </li>
              <li>
                Can you import a bank file and match it to tagged gifts, or
                are you still reconciling in Excel after the dashboard
                looks green?
              </li>
              <li>
                Can the product print donor statements and a committee pack
                from the same record the bank rec used, or is the AGM pack
                a separate rebuild?
              </li>
              <li>
                Who holds the HMRC Charities Online account after you buy
                the software: the mosque, the treasurer as an individual,
                or the vendor?
              </li>
              <li>
                Where does settlement go? MosquePay&apos;s{" "}
                <InternalLink href="/pricing">pricing page</InternalLink>{" "}
                says gifts settle directly to your mosque&apos;s own bank
                account.
              </li>
              <li>
                Is there a markup on card processing? The same pricing page
                says you pay only the payment provider&apos;s standard card
                rates and that MosquePay adds no markup. The named payment
                partner on that page is Mooov. Do not convert the
                subscription currency printed on that page, and do not
                treat another vendor&apos;s comparison table as MosquePay
                pricing.
              </li>
            </ol>

            <ArticleH2>
              What MosquePay will show you in 30 minutes is only what the
              public pages already claim.
            </ArticleH2>
            <P>
              <InternalLink href="/book-demo">Book a demo</InternalLink> is
              a 30-minute call. Bring last Friday&apos;s cash sheet, the
              contactless total, one standing-order line that still has no
              fund tag, and last month&apos;s committee pack. The
              walkthrough should stay inside claims printed on
              mosque-pay.com.
            </P>
            <P>
              You should see online, QR, card, and recorded cash giving in
              the same record. You should see Zakat, Sadaqah, Lillah, and
              appeal funds kept on separate tags. You should see Gift Aid
              declarations captured at the point of giving, whether the
              gift is online or recorded by your team, and attached to
              eligible gifts. You should see GASDS cash collections logged
              per service. You should see HMRC-ready exports with the
              evidence behind every line. You should see bank statement
              import and reconciliation beside payment history. You should
              see treasurer reports, giving statements, and ledger views
              matched to that history.
            </P>
            <P>
              You should hear that settlement goes to the mosque&apos;s own
              bank account, that MosquePay adds no card-processing markup,
              and that Mooov is the payment partner named on{" "}
              <InternalLink href="/pricing">pricing</InternalLink>. You
              should not be quoted a converted subscription price. Read the
              figures in the currency the live page prints.
            </P>
            <P>
              You should not be told that MosquePay submits the claim to
              HMRC. You should not be told that MosquePay is on HMRC&apos;s
              Charities Online commercial software suppliers list. Those
              sentences are not on the public site. iCHARMS does claim
              listed submission on its own Gift Aid pages. That is a
              competitor fact, not a MosquePay feature. You should not be
              shown Gift Aid topping up a Zakat line as a default example.
            </P>
            <P>
              MosquePay is operated by Neural Network Group Limited,
              company number 16606065. The contact email currently printed
              on the public contact page is ag@experrt.com. If you want the
              shorter product answers first, read the{" "}
              <InternalLink href="/faq">FAQ</InternalLink>. If you want to
              start onboarding rather than watch a demo first,{" "}
              <InternalLink href="/join">get started</InternalLink>.
            </P>

            <ArticleH2>What this page skipped, on purpose.</ArticleH2>
            <P>
              This page does not invent how much your mosque would recover
              if last Friday had been tagged correctly. It does not award
              MosquePay a first-place badge against Ummah, Halal Wealth,
              iCHARMS, Salah Mate, MOHID, e Masjid, or MasjidConnect. It
              does not reprint HMRC supplier lists. It does not rewrite the
              Gift Aid reclaim guide. It does not write fiqh. It does not
              convert the currency printed on the{" "}
              <InternalLink href="/pricing">live pricing page</InternalLink>
              . It does not treat /news as a home for this guide. /news is
              the product changelog. It does not use /charity or /donate,
              which are demo mosque pages. It does not open a /blog. It
              does not use the mosquepay.co.uk directory&apos;s mosque
              count or fee model. It does not run paid ads and it does not
              ask you to send cold outbound. It does not reproduce any
              marketing mock that Gift Aids a Zakat line.
            </P>

            <ArticleH2>
              One stack has to tag the fund, keep the evidence, and print
              the pack from the same Friday.
            </ArticleH2>
            <P>
              If you remember one line, remember that. Tag Zakat, Sadaqah,
              Lillah, and appeal funds when the gift is given. Capture the
              declaration, or log GASDS only when no declaration exists.
              Match the bank. Send a donor statement you can stand behind.
              Build the committee pack from that record, not from a
              Thursday-night spreadsheet. Then check that the tin, the
              claim, and the AGM still tell the same story.
            </P>

            <ArticleH2>
              Questions treasurers ask when they search mosque treasurer
              software UK.
            </ArticleH2>
            <dl className="mt-8 space-y-8">
              {TREASURER_SOFTWARE_GUIDE_FAQS.map((item) => (
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
        title="Bring last Friday's cash sheet and the committee pack to a 30-minute walkthrough."
        body="We will stay on fund tags, Gift Aid evidence, bank rec, and the treasurer report. You still submit the HMRC claim."
        ctaLabel="Book a demo"
        ctaHref="/book-demo"
        secondaryLabel="Read the Gift Aid guide"
        secondaryHref="/guides/gift-aid-for-uk-mosque-treasurers"
      />
    </MarketingShell>
  );
}
