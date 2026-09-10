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
import { COLLECT_ZAKAT_GUIDE_FAQS } from "./faqs";

const GUIDE = getMarketingGuide("collect-zakat-online-uk-mosque")!;

const GOV = {
  faithTrustees:
    "https://www.gov.uk/government/publications/faith-based-charities/managing-faith-charities-as-trustees",
  hmrcRecognition: "https://www.gov.uk/charity-recognition-hmrc",
} as const;

const PUBLIC = {
  masjidConnect:
    "https://www.masjidconnect.co.uk/mosque-donation-platform",
  mohidUk: "https://mohid.net/uk/",
  salahMate: "https://salahmate.com/",
  ummah: "https://theummah.io/mosque-accounting-software/",
  halalWealth: "https://halalwealth.uk/",
  icharmsGiftAid: "https://technoservesolutions.com/products/icharms/gift-aid/",
  icharms: "https://icharms.app/",
  pledgeNow: "https://pledgenow.co/for/mosques",
  hibabox: "https://hibabox.com/",
  donateDirectly:
    "https://www.donatedirectly.com/blogs/zakat/how-to-pay-zakat-online",
  eastLondon:
    "https://www.eastlondonmosque.org.uk/donate/giving-zakah",
  banbury: "https://banburymadnimasjid.com/appeals/zakat/",
} as const;

export const metadata: Metadata = marketingMetadata({
  title: "Collect Zakat online UK mosque: a treasurer field guide | MosquePay",
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
  mainEntity: COLLECT_ZAKAT_GUIDE_FAQS.map((item) => ({
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

export default function CollectZakatOnlineUkMosqueGuidePage() {
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
              Collect Zakat online UK mosque
            </p>
            <MarketingKicker>Collect Zakat online UK mosque</MarketingKicker>
            <h1 className="mt-4 font-heading text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              UK mosque treasurers need a collection path that takes Zakat
              online, keeps it apart from Sadaqah and Lillah, and shows the
              committee the restricted fund without rebuilding Ramadan in
              Excel.
            </h1>
            <p className="mt-4 text-sm font-medium text-slate-500">
              Published 10 September 2026
            </p>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              This is a field guide for the person who counts Zakat envelopes
              after Jumu&apos;ah, matches bank transfers that only say
              &quot;Zakat&quot; in the reference, and still has to keep QR,
              card, and recorded cash out of the building fund. Public
              product claims below were read from live vendor pages on{" "}
              {CHECKED_ON}. MosquePay product claims are taken only from
              public pages on mosque-pay.com.
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
              If you are buying a way to collect Zakat online for a UK
              mosque, you are not buying a calculator that tells a giver
              what they owe. You are buying an operating path that can take
              the same restricted gift from an envelope, a bank transfer, a
              QR code, a card tap, and a cash line your team types in after
              the count, keep that gift out of Sadaqah and Lillah, issue a
              receipt the giver can keep, and show the committee the
              ring-fenced pot when Ramadan is over. Searchers looking up
              collect Zakat online UK mosque, or Zakat collection UK mosque,
              are usually doing that mosque-side job with a phrase the
              search results still treat as a donor question.
            </P>
            <P>
              This page stays on your side of the counter. It splits the
              jobs a donate button hides, walks a Zakat month and a Ramadan
              week as operations, and maps public tools to those jobs using
              only what their own pages say. It is not a donor Zakat
              calculator, not a national-charity appeal, and not a thin
              product splash. The reclaim rules for ordinary Gift Aid and
              GASDS already live in the{" "}
              <InternalLink href="/guides/gift-aid-for-uk-mosque-treasurers">
                Gift Aid field guide for UK mosque treasurers
              </InternalLink>
              . The wider stack of funds, bank rec, and the committee pack
              already lives in the{" "}
              <InternalLink href="/guides/mosque-treasurer-software-uk">
                mosque treasurer software UK
              </InternalLink>{" "}
              field guide. Read those when the job is reclaim or the whole
              stack. Read this one when the job is taking Zakat in and
              keeping it tagged.
            </P>
            <P>
              Use it as a single-scroll field guide. Read the job first,
              then the SERP mismatch, then what the path must actually do,
              then the month, then the public approaches table. The
              MosquePay section comes late on purpose. If a demo cannot
              answer the puncture questions, you do not need a longer demo.
            </P>

            <ArticleH2>
              This page is for the treasurer who has to bank Friday&apos;s
              Zakat envelopes, not for a donor looking up a calculator.
            </ArticleH2>
            <P>
              Read this if you sign off the books, hold the keys to the
              donate flow, or have to put a restricted-fund line in front
              of trustees after Ramadan. Read it if you inherited a QR
              poster, a card-machine total, a pile of envelopes marked
              Zakat, and a bank statement full of references that may or
              may not name the pot. If you are calculating your own nisab,
              this is not your explainer. If you want the short product
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
              restricted is part of that duty. Tax advantages still sit
              with HMRC rather than with a Charity Commission number alone.
              You still need{" "}
              <GovLink href={GOV.hmrcRecognition}>
                recognition from HMRC
              </GovLink>{" "}
              before Gift Aid or GASDS becomes a repayment. This page does
              not rewrite those reclaim tests. It only needs you to see
              that a Zakat tag that later appears in a claim still has to
              match a written mosque policy.
            </P>
            <P>
              This page does not cover a giver asking which national
              charity to pay. It does not cover a prayer-time screen except
              where a vendor also publishes a money claim. It does not
              cover Scotland or Northern Ireland regulator differences
              beyond the obvious point that HMRC recognition is still the
              tax gate. If you are a network treasurer looking after
              several mosques, treat each legal entity as its own Zakat
              pot, its own donate flow, and its own pack. Do not merge
              restricted funds across entities because a dashboard can
              print one total.
            </P>

            <ArticleH2>
              Search results for collect Zakat online UK mosque are mostly
              the wrong job: donor calculators and one-mosque donate pages.
            </ArticleH2>
            <P>
              Type the phrase into a search box and you will land on
              pages that help a Muslim pay Zakat, not pages that help a
              mosque collect it. That is a different counter. A donor
              how-to walks nisab, a calculator, a checkout, and sometimes
              Gift Aid from the giver&apos;s side. A single-mosque appeal
              page takes one payment into that mosque&apos;s named pot. Neither
              one answers how you keep Friday&apos;s envelopes, Tuesday&apos;s
              transfers, and the QR tap in the foyer on the same restricted
              line.
            </P>
            <P>
              <GovLink href={PUBLIC.donateDirectly}>
                DonateDirectly&apos;s public how-to on paying Zakat online
              </GovLink>{" "}
              is a clear example of the donor job. It walks calculation,
              choosing a charity, completing a payment, and keeping a
              receipt, written for the person who owes Zakat. It is useful
              to that reader. It does not give you a fund tag for cash you
              counted after Jumu&apos;ah, and it does not build your trustee
              pack. Treat it as the wrong search result for this page, not
              as a competitor row.
            </P>
            <P>
              Individual mosque donate pages do the same swap in the other
              direction.{" "}
              <GovLink href={PUBLIC.eastLondon}>
                East London Mosque&apos;s public Zakah page
              </GovLink>{" "}
              tells a giver that the mosque holds a Zakah account so the
              money is used as prescribed.{" "}
              <GovLink href={PUBLIC.banbury}>
                Banbury Madni Masjid&apos;s public Zakat appeal
              </GovLink>{" "}
              asks a giver to choose an amount and pay that mosque. Those
              pages are honest donor intake for one institution. They are
              not a treasurer operating manual, and they are not a product
              you can buy to run your own collection week.
            </P>
            <P>
              Some vendor homepages mix the two jobs on purpose. Halal
              Wealth&apos;s public site publishes a personal Zakat calculator
              in its consumer-app copy and, separately, masjid finance,
              donations, and Gift Aid copy for institutions. Salah Mate
              publishes a worshipper app with one-tap giving beside a
              mosque kiosk. When you evaluate those names later in the
              table, stay on the mosque-side sentence. A calculator that
              helps a giver is not a ring-fence that helps you.
            </P>

            <ArticleH2>
              Collecting Zakat online has to take every intake channel, tag
              the fund, issue a receipt, and show the restricted pot.
            </ArticleH2>
            <P>
              Online is only one door. The congregation still brings
              envelopes after Jumu&apos;ah. Standing orders and one-off
              transfers still arrive with a reference that may say Zakat,
              Zakat ALM, fitrana, or only the mosque&apos;s name. Someone
              scans a QR on the way out. Someone taps a card and walks away.
              Someone gives cash in the office on Monday and wants it
              written down. If any of those doors can empty into the
              building fund, you do not have a collection path. You have a
              donate button and a mess.
            </P>
            <P>
              The path has four jobs that have to finish in the same
              record. Intake has to accept every channel, including cash
              your team records after the count. Fund tags have to keep
              Zakat apart from Sadaqah, Lillah, and an appeal. Receipts
              have to name the pot and the date so a giver can see what
              they paid this mosque. Restricted reporting has to show
              trustees the ring-fence without a Ramadan rebuild in Excel.
              Miss one job and the other three start lying.
            </P>

            <GuideTable
              caption="What collect Zakat online must actually do for a UK mosque treasurer"
              headers={[
                "Job",
                "What arrives",
                "What the path must keep",
                "What a donate page usually drops",
              ]}
              rows={[
                [
                  "Intake channels",
                  "Envelopes after Jumu'ah, transfers that say Zakat in the reference, QR, card, and cash you type in later",
                  "The same Zakat tag on every door, including recorded cash",
                  "A web form that never saw Friday's tin",
                ],
                [
                  "Fund tags",
                  "Zakat, Sadaqah, Lillah, and a building appeal in the same week",
                  "A ring-fenced pot the committee can open without guessing",
                  "One donations total that looks tidy and hides the restriction",
                ],
                [
                  "Receipts",
                  "A giver who wants proof they paid Zakat to this mosque",
                  "A receipt that names the fund, the date, and the mosque",
                  "A payment-provider email that cannot tell Zakat from the building fund",
                ],
                [
                  "Restricted reporting",
                  "Trustees who will ask where Ramadan's Zakat went",
                  "Income by fund from the same record the bank rec used",
                  "A screenshot of the donate-page total pasted into last year's agenda",
                ],
              ]}
            />
            <P>
              Those jobs overlap on purpose. A transfer that hits the bank
              with no fund tag fails intake and reporting in the same week.
              A QR tap that collected only an amount fails the receipt and,
              if you later drop it into general Sadaqah, fails the
              ring-fence. A beautiful appeal page that never exports a
              committee pack leaves you in Excel the night before the
              meeting. Buy the jobs. Do not buy the phrase.
            </P>
            <P>
              MosquePay&apos;s public{" "}
              <InternalLink href="/features">features</InternalLink> page
              describes online, QR, card, and recorded cash giving in the
              same record, Gift Aid declarations at the point of giving,
              GASDS logged per service, HMRC-ready exports with evidence,
              bank import and reconciliation, and treasurer reports.
              Public MosquePay copy also describes Zakat, Sadaqah, Lillah,
              and appeal fund tags kept separate. Those are bookkeeping
              sentences. They are not a ruling on who may receive Zakat,
              and they are not a reason to Gift Aid a Zakat line by
              default.
            </P>

            <ArticleH2>
              A UK mosque&apos;s Zakat month is envelopes after Jumu&apos;ah,
              transfers midweek, and a Ramadan week that must not rebuild
              itself in Excel.
            </ArticleH2>
            <P>
              Start with an ordinary Friday, because Ramadan only makes
              the same week louder. The tin holds notes, coins, and
              envelopes that someone has already labelled Zakat. Those
              envelopes must not be mixed with general Sadaqah, and they
              must not quietly fund the building. The contactless total is
              a number that may not name a pot. A QR poster on the way out
              may have been printed for last year&apos;s appeal. A regular
              giver tells you they have already transferred, so they did
              not put anything in the tin. You still have to count, you
              still have to bank, and you still have to know which pot
              each line belongs to before anyone writes the khutbah recap.
            </P>
            <P>
              The day after Jumu&apos;ah is when the count becomes a record.
              Two people should ideally check the cash. You bank the tin.
              You type recorded cash into whatever system you have, and
              you put a Zakat tag on the lines that were Zakat. You do not
              wait until the end of Ramadan to decide. A gift that landed
              without a tag will look like ordinary income until someone
              asks where the Zakat pot went.
            </P>
            <P>
              Midweek is bank transfers and card settlement. Amounts arrive
              with a reference that may say Zakat and nothing else. Some
              say the mosque&apos;s initials. Some say fitrana. Some say
              nothing useful. If your stack cannot import a bank file and
              put a fund on the match, you will rebuild that week in Excel
              before the next Jumu&apos;ah. QR and card settlement land on a
              different day from the tin. The committee does not care
              which Tuesday the money moved. They care that the Zakat pot
              still matches what people thought they gave.
            </P>
            <P>
              Ramadan week is the same jobs with less sleep. Nightly
              collections sit beside the Friday tin. A live total on a
              screen can help a campaign, and it can also hide a
              restriction if Zakat and a building appeal share one number.
              Someone will ask for a receipt before they leave. Someone
              else will give cash in the office because they do not want
              to tap a phone. Zakat al-Fitr, if your mosque collects it,
              is an operational pot you should name in the mosque&apos;s
              written policy. This page does not tell you how to treat it
              in fiqh. It tells you not to let it land in the building
              fund because the poster was handy.
            </P>
            <P>
              Month end, and the week after Eid, is the trustee pack.
              Trustees need income by fund, not a single donations number
              for &quot;Ramadan&quot;. They need to see that Zakat stayed in
              Zakat, that Sadaqah and Lillah were not used as a plug, and
              that an appeal did not swallow a restricted line. They need
              receipts you can stand behind if a giver asks again in
              November. If you can only tell that story by opening last
              year&apos;s spreadsheet and hoping the tabs still agree, you
              do not have a collection path. You have archaeology.
            </P>

            <ArticleH2>
              Public approaches to mosque-side Zakat collection, read from
              their own pages, not scored against each other.
            </ArticleH2>
            <P>
              This is a jobs table, not a bake-off. No row wins. No feature
              is invented. Pages were read on {CHECKED_ON}. Where a public
              page is silent on fund tags, receipts, Gift Aid, or a
              committee pack, the table says so. The MosquePay row uses
              only claims printed on mosque-pay.com. Other names are
              public players you will hear in the same search. Confirm
              their live pages before you treat a sentence here as a
              contract.
            </P>
            <P>
              The named public pages are{" "}
              <GovLink href={PUBLIC.masjidConnect}>
                MasjidConnect donations
              </GovLink>
              , <GovLink href={PUBLIC.mohidUk}>MOHID UK</GovLink>,{" "}
              <GovLink href={PUBLIC.salahMate}>Salah Mate</GovLink>,{" "}
              <GovLink href={PUBLIC.ummah}>Ummah mosque accounting</GovLink>,{" "}
              <GovLink href={PUBLIC.halalWealth}>Halal Wealth</GovLink>,{" "}
              <GovLink href={PUBLIC.icharmsGiftAid}>
                iCHARMS Gift Aid
              </GovLink>{" "}
              and the{" "}
              <GovLink href={PUBLIC.icharms}>iCHARMS product site</GovLink>,{" "}
              <GovLink href={PUBLIC.pledgeNow}>
                PledgeNow for mosques
              </GovLink>
              , and <GovLink href={PUBLIC.hibabox}>Hibabox</GovLink>. Donor
              how-tos sit above the table as the wrong job, not as rows.
            </P>

            <GuideTable
              caption="Public approaches to collecting Zakat on the mosque side of the counter"
              headers={[
                "Approach",
                "What public pages say it does",
                "Fund tags and ring-fence",
                "What you still do",
              ]}
              rows={[
                [
                  "Spreadsheet",
                  "Holds the envelope count, the Zakat-reference list, and last Ramadan's pack if you rebuild it",
                  "Only if you keep separate columns and never paste a total over them",
                  "Own every match: tin, transfer, QR, receipt, and the trustee narrative",
                ],
                [
                  "MasjidConnect",
                  "The donations page describes Zakat, Sadaqah, Lillah, and Qurbani funds, recurring gifts, campaign pages, and Stripe or SumUp records",
                  "Public copy shows donations broken out by those funds, including a building fund in the example analytics",
                  "That donations page does not publish Gift Aid declarations, GASDS, or Charities Online submission. It also prints a platform fee on top of Stripe or SumUp. Do not import their comparison of other brands as a MosquePay fact.",
                ],
                [
                  "MOHID",
                  "The UK page describes cloud mosque management with donation kiosks, handheld receipt devices, Zakat management, fundraising, and signage",
                  "Public UK copy names Zakat management and fundraising. The page read for this guide does not publish a Zakat / Sadaqah / Lillah ledger model in those words",
                  "Ask what UK Gift Aid evidence the kiosk actually stores, who still files Charities Online, and whether a handheld receipt names the restricted fund",
                ],
                [
                  "Salah Mate",
                  "The public homepage describes a free donation kiosk, smart TV display, and worshipper app, with Stripe or SumUp and instant digital receipts",
                  "Public copy describes cashless Zakat and Sadaqah and transparent Zakat tracking",
                  "That homepage does not publish a Gift Aid, GASDS, or HMRC submission claim. Own the declaration file, the bank rec, and the committee pack if you adopt the kiosk as a channel.",
                ],
                [
                  "Ummah",
                  "Mosque accounting pages describe named funds, member giving history, and board-ready reports in place of a shared spreadsheet",
                  "Public copy describes separate ledgers for Zakat, Sadaqah, Waqf, and general operations, tagged at collection, and says Zakat must not fund general operations",
                  "That accounting page does not publish a Gift Aid, GASDS, or Charities Online claim. Confirm how intake channels and UK reclaim actually run before you treat it as the whole path.",
                ],
                [
                  "Halal Wealth",
                  "Public site describes finance, donations, Gift Aid, donor management, and Charity Commission-format statements for UK masjids",
                  "Islamic-charity copy describes restricted-fund tracking. Consumer-app copy on the same site also publishes a personal Zakat calculator, which is a donor job",
                  "Public copy describes Gift Aid calculations, HMRC-format ODS exports, GASDS tracking, and direct XML submission to HMRC. Confirm that path against your own examiner.",
                ],
                [
                  "iCHARMS",
                  "Public pages describe donors, donations, Zakat and Sadaqah categorisation, Xero sync, and trustee-ready reports",
                  "Gift Aid FAQ copy says Islamic donation types such as Zakat, Sadaqah, and Qurbani are handled as their own funds, with Gift Aid applied only where it is eligible",
                  "iCHARMS claims HMRC-listed Charities Online submission, declaration capture, and GASDS on its own Gift Aid pages. That is not a MosquePay claim. Confirm funds before anyone presses submit.",
                ],
                [
                  "PledgeNow",
                  "The mosque page describes Jumu'ah pledges, Ramadan nights, and building-fund drives, with QR in the foyer, WhatsApp reminders, and a CSV for the committee",
                  "Public copy describes Zakat, Sadaqah, and Lillah tracked in their own columns, with a per-campaign Zakat toggle",
                  "Gift Aid is described as captured with HMRC model wording and exported as a CSV you file. The same page says no card is required and that it works with your existing bank account. You still collect the money and keep the ring-fence in the books.",
                ],
                [
                  "Hibabox",
                  "Public homepage describes contactless, online, and in-person donations with instant receipts and Gift Aid, plus reports and Gift Aid tracking",
                  "The homepage read for this guide does not publish a Zakat / Sadaqah / Lillah ledger model",
                  "Confirm what evidence the box actually stores, whether a receipt names the restricted fund, and who still files Charities Online",
                ],
                [
                  "MosquePay",
                  "Public pages describe online, QR, card, and recorded cash giving, bank import and reconciliation, treasurer reports, and settlement to the mosque bank account",
                  "Public claims describe Zakat, Sadaqah, Lillah, and appeal fund tags kept separate",
                  "Gift Aid declarations at the point of giving, GASDS logged per service, HMRC-ready exports with evidence. Not Charities Online listed submission. Write the Gift Aid-on-Zakat policy yourself. Read live pricing for the currency actually printed.",
                ],
              ]}
            />
            <P>
              Read the table sideways. A kiosk row that is strong on
              collection and silent on the ring-fence is a channel. An
              accounting row that is strong on ledgers and silent on intake
              is a book. A pledge row that captures Zakat as a checkbox
              still needs the money to hit a tagged pot you can show
              trustees. The treasurer&apos;s path is the set of jobs that
              still have an owner after you sign. If two tools both claim a
              job, you still need one place the committee can open.
            </P>
            <P>
              MasjidConnect&apos;s donations page publishes its own
              comparison table and names MosquePay in that table. This
              guide does not adopt their fee ranking, their feature ticks,
              or their wording. MosquePay&apos;s{" "}
              <InternalLink href="/pricing">pricing page</InternalLink> says
              the mosque pays the payment provider&apos;s standard card
              rates, that MosquePay adds no markup, and that gifts settle
              to the mosque&apos;s own bank account. The named payment
              partner on that page is Mooov. The live pricing page prints
              its subscription figures in the currency shown there. This
              guide does not convert those figures.
            </P>

            <ArticleH2>
              Gift Aid on Zakat is a written mosque policy, not a default
              this page will demonstrate.
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
              What this collection guide needs you to remember is narrower.
              Do not Gift Aid Zakat as a default example. This page does
              not write new fiqh. It does not tell you that Gift Aid on
              Zakat is allowed, and it does not tell you that it is
              forbidden. It does not show Gift Aid topping up a Zakat line
              as a worked example, and it does not reproduce any marketing
              mock that treats a Zakat amount as Gift Aid eligible. A mock
              is not a policy.
            </P>
            <P>
              One public MosquePay page,{" "}
              <InternalLink href="/charity">/charity</InternalLink>, is
              recorded on the Gift Aid guide as saying Gift Aid is not
              claimed on Zakat paid as an obligation. Treat that as a
              product position to respect, not as a ruling this page
              adopts, and not as a reason to leave the congregation
              guessing. The live marketing site is not consistent on this
              point. Your written policy is what the giver and the auditor
              can trust.
            </P>
            <P>
              Write the mosque&apos;s Gift Aid-on-Zakat policy down where
              the treasurer, the imam, and the accountant can all find it.
              Show that policy on the donate flow so a giver can see how
              the mosque will treat their gift before they give. Confirm
              the religious treatment with your imam and the tax treatment
              with your accountant before any Zakat line appears in a Gift
              Aid export. Software can tag the fund and, where the written
              policy allows, capture a declaration. It cannot decide the
              policy for you.
            </P>

            <ArticleH2>
              Zakat collection sits inside a wider treasurer stack, and
              that stack already has its own field guide.
            </ArticleH2>
            <P>
              Taking Zakat in is one job. Matching the bank, capturing
              Gift Aid evidence on eligible gifts, logging GASDS only when
              no declaration exists, issuing giving statements, and
              printing a committee pack are the jobs around it. Those jobs
              are mapped, with a public-approaches table of their own, in
              the{" "}
              <InternalLink href="/guides/mosque-treasurer-software-uk">
                mosque treasurer software UK
              </InternalLink>{" "}
              field guide. Read that guide when you are deciding what has
              to sit in the stack before the Zakat pot exists. Read this
              one when the pot is the thing you are trying to keep clean.
            </P>
            <P>
              The short version for this page is operational, not
              commercial. A kiosk, a pledge QR, or a donate page can be a
              useful door. None of those is the stack. If last Friday&apos;s
              Zakat envelope, Tuesday&apos;s transfer, and the foyer tap
              cannot sit in one ledger with the same tag, you will still
              rebuild Ramadan in Excel. The software guide is where that
              wider buying question lives. This page only needs you not to
              confuse a channel with a treasurer record.
            </P>
            <P>
              MosquePay&apos;s public{" "}
              <InternalLink href="/features">features</InternalLink> and{" "}
              <InternalLink href="/faq">FAQ</InternalLink> pages describe
              HMRC-ready exports with the evidence behind every line, for
              England and Wales charities working through HMRC. They do
              not say MosquePay submits the claim. If your mosque is
              recognised by HMRC and files from another UK regulator,
              confirm the same export against your own examiner and the
              live GOV.UK pages. Until HMRC recognises you, a Friday
              declaration file is evidence you cannot yet turn into a
              repayment.
            </P>

            <ArticleH2>
              Questions that puncture a Zakat-collection demo before you
              sign anything.
            </ArticleH2>
            <P>
              Ask these out loud. The answers sort a donate button from a
              collection path, a tagged fund from a single giving total,
              and an export tool from a Charities Online submit product.
            </P>
            <ol className="mt-6 list-decimal space-y-4 pl-6 text-base leading-7 text-slate-700">
              <li>
                Can last Friday&apos;s Zakat envelopes, a transfer that only
                says Zakat in the reference, a QR tap, a card gift, and
                cash your team recorded after the count all sit on the same
                Zakat tag?
              </li>
              <li>
                Can Sadaqah, Lillah, and a building appeal stay in their
                own pots when someone taps the nearest button? Does the
                committee pack still show the restriction after Eid?
              </li>
              <li>
                Does the product Gift Aid a Zakat line by default, or does
                it follow a written mosque policy that you can also show
                on the donate flow?
              </li>
              <li>
                Can you print a receipt that names the fund, the date, and
                the mosque, or only a payment-provider email?
              </li>
              <li>
                Can you import a bank file and match it to tagged gifts,
                or are you still reconciling Ramadan in Excel after the
                dashboard looks green?
              </li>
              <li>
                Does the product submit a Gift Aid claim through Charities
                Online, export a schedule you attach yourself, or only
                store a receipt? MosquePay&apos;s honest answer is export.
                Public{" "}
                <InternalLink href="/faq">FAQ</InternalLink> and{" "}
                <InternalLink href="/features">features</InternalLink> copy
                says HMRC-ready exports with evidence. It does not say
                MosquePay is on HMRC&apos;s Charities Online commercial
                software suppliers list. iCHARMS does claim listed
                submission on its own Gift Aid pages.
              </li>
              <li>
                Who writes the mosque&apos;s Zakat distribution policy and
                the Gift Aid-on-Zakat policy: the software, the vendor, or
                the mosque? The only honest product answer is the mosque.
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
              a 30-minute call. Bring last Friday&apos;s Zakat envelopes,
              one transfer that only says Zakat in the reference, the QR
              or card total, and last Ramadan&apos;s committee note if you
              still have it. The walkthrough should stay inside claims
              printed on mosque-pay.com.
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
              should not be quoted a converted subscription price. Read
              the figures in the currency the live page prints.
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
              This page does not calculate anyone&apos;s nisab. It does not
              invent how much your mosque would have held if last Ramadan
              had been tagged correctly. It does not award MosquePay a
              first-place badge against MasjidConnect, MOHID, Salah Mate,
              Ummah, Halal Wealth, iCHARMS, PledgeNow, or Hibabox. It does
              not reprint HMRC supplier lists. It does not rewrite the Gift
              Aid reclaim guide. It does not write fiqh. It does not
              convert the currency printed on the{" "}
              <InternalLink href="/pricing">live pricing page</InternalLink>
              . It does not treat /news as a home for this guide. /news is
              the product changelog. It does not use /charity or /donate,
              which are demo mosque pages, as the place this guide lives.
              It does not open a /blog. It does not use the
              mosquepay.co.uk directory&apos;s mosque count or fee model.
              It does not run paid ads and it does not ask you to send
              cold outbound. It does not reproduce any marketing mock that
              Gift Aids a Zakat line.
            </P>

            <ArticleH2>
              Zakat has to stay in its own pot from the envelope to the
              trustee pack.
            </ArticleH2>
            <P>
              If you remember one line, remember that. Take the gift on
              every door the congregation actually uses. Tag Zakat apart
              from Sadaqah, Lillah, and the building appeal when the money
              arrives. Issue a receipt that names the fund. Show the
              committee the restricted pot from that record, not from a
              Thursday-night spreadsheet. Write the mosque&apos;s policy
              down and put it on the donate flow. Then check that Friday,
              the bank, and the pack still tell the same story.
            </P>

            <ArticleH2>
              Questions treasurers ask when they search collect Zakat
              online UK mosque.
            </ArticleH2>
            <dl className="mt-8 space-y-8">
              {COLLECT_ZAKAT_GUIDE_FAQS.map((item) => (
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
        title="Bring last Friday's Zakat envelopes to a 30-minute walkthrough."
        body="We will stay on intake channels, fund tags, receipts, and the restricted report. You still write the mosque's policy."
        ctaLabel="Book a demo"
        ctaHref="/book-demo"
        secondaryLabel="Read the treasurer software guide"
        secondaryHref="/guides/mosque-treasurer-software-uk"
      />
    </MarketingShell>
  );
}
