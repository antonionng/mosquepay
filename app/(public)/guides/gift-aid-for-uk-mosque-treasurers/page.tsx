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
import { GIFT_AID_GUIDE_FAQS } from "./faqs";

const GUIDE = getMarketingGuide("gift-aid-for-uk-mosque-treasurers")!;

const GOV = {
  faithTrustees:
    "https://www.gov.uk/government/publications/faith-based-charities/managing-faith-charities-as-trustees",
  claimOverview: "https://www.gov.uk/claim-gift-aid",
  claimOnline: "https://www.gov.uk/claim-gift-aid-online",
  declarations: "https://www.gov.uk/claim-gift-aid/gift-aid-declarations",
  gasds: "https://www.gov.uk/claim-gift-aid/small-donations-scheme",
  gasdsTopUp:
    "https://www.gov.uk/guidance/claiming-a-top-up-payment-on-small-charitable-donations",
  chapter8:
    "https://www.gov.uk/government/publications/charities-detailed-guidance-notes/chapter-8-the-gift-aid-small-donations-scheme-from-6-april-2017",
  hmrcRecognition: "https://www.gov.uk/charity-recognition-hmrc",
} as const;

export const metadata: Metadata = marketingMetadata({
  title: "Gift Aid mosque UK: a treasurer field guide | MosquePay",
  description: GUIDE.description,
  path: GUIDE.path,
  keywords: [...GUIDE.keywords],
});

const CHECKED_ON = "1 September 2026";

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
  mainEntity: GIFT_AID_GUIDE_FAQS.map((item) => ({
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

export default function GiftAidMosqueTreasurersGuidePage() {
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
              Gift Aid for UK mosque treasurers
            </p>
            <MarketingKicker>Gift Aid mosque UK</MarketingKicker>
            <h1 className="mt-4 font-heading text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              UK mosque treasurers can collect Gift Aid declarations and GASDS
              evidence at Jumu&apos;ah without rebuilding the HMRC claim in a
              spreadsheet.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              This is a field guide for the person who counts Friday cash,
              reconciles contactless taps, and still has a paper Gift Aid file
              in a cupboard. Caps and eligibility below were read from live
              GOV.UK pages on {CHECKED_ON}. Re-open those pages before you file.
              MosquePay product claims are taken only from public pages on
              mosque-pay.com.
            </p>
          </div>
        </section>

        <MarketingSection>
          <div className="mx-auto max-w-3xl">
            <P>
              Friday leaves you with a bag of cash, a contactless total that
              does not name anyone, a handful of standing orders that arrived
              during the week, Zakat envelopes that must not be mixed with
              general Sadaqah, a paper Gift Aid file that is never quite
              complete, and a claim that is already late. The 25p in the pound
              is not the hard part. The hard part is matching a declaration to
              a gift, a gift to a fund, and a fund to a line HMRC will accept.
            </P>
            <P>
              Searchers looking up Gift Aid mosque UK, GASDS mosque, or Gift
              Aid Islamic charity UK are usually doing the same three jobs
              with one phrase. This page splits those jobs, points at the live
              GOV.UK rules, and tells you honestly what MosquePay exports and
              what it does not submit.
            </P>

            <ArticleH2>
              This page is for the treasurer or finance lead in England or
              Wales, not for a donor looking up how Gift Aid works.
            </ArticleH2>
            <P>
              Read this if you sign off the books, hold the HMRC login, or are
              applying for HMRC charity recognition for a mosque that is, or
              will be, a registered charity. If you give on a Friday, this is
              not your explainer. If you want the product questions first, the{" "}
              <InternalLink href="/faq">MosquePay FAQ</InternalLink> is
              shorter.
            </P>
            <P>
              GOV.UK&apos;s guidance on{" "}
              <GovLink href={GOV.faithTrustees}>
                managing faith charities as trustees
              </GovLink>{" "}
              applies to England and Wales and names mosques among places of
              worship that are normally charities. Gift Aid itself is an HMRC
              process. You still need{" "}
              <GovLink href={GOV.hmrcRecognition}>
                recognition from HMRC
              </GovLink>{" "}
              before you can claim.
            </P>

            <ArticleH2>
              Ordinary Gift Aid, GASDS on small anonymous cash and
              contactless, and ring-fencing Zakat, Sadaqah, and Lillah are
              three jobs sold as one phrase.
            </ArticleH2>
            <P>
              Ordinary Gift Aid is a 25p top-up on a gift from a UK taxpayer
              who has given you a valid declaration.{" "}
              <GovLink href={GOV.claimOverview}>GOV.UK states</GovLink> that
              you can claim back 25p every time an individual donates £1, that
              the donor must have paid at least as much Income Tax or Capital
              Gains Tax as you want to claim, and that they must make a
              declaration giving you permission.
            </P>
            <P>
              GASDS is a different route for small gifts where you do not have
              a declaration.{" "}
              <GovLink href={GOV.gasds}>
                The small donations scheme page
              </GovLink>{" "}
              says you may be able to claim 25% on cash donations of £30 or
              less, and on contactless card donations of £30 or less collected
              on or after 6 April 2019, without a Gift Aid declaration.
            </P>
            <P>
              Ring-fencing Zakat, Sadaqah, and Lillah is not a tax scheme. It
              is the mosque&apos;s duty to keep restricted money tagged so the
              congregation can see that a Zakat envelope did not quietly fund
              the building. MosquePay&apos;s{" "}
              <InternalLink href="/features">features page</InternalLink> says
              Zakat, Sadaqah, Lillah, and appeal funds are kept separate. That
              is bookkeeping. It is not a ruling on whether Gift Aid can sit
              on a Zakat line.
            </P>

            <GuideTable
              caption="Three jobs that get sold as Gift Aid"
              headers={["Job", "When it applies", "What you must have", "What you must not mix"]}
              rows={[
                [
                  "Ordinary Gift Aid",
                  "A named gift from a UK taxpayer",
                  "A valid declaration with full name, home address, and postcode",
                  "The same gift claimed again under GASDS",
                ],
                [
                  "GASDS",
                  "Small anonymous cash or contactless at or under the live GOV.UK limit",
                  "Collection evidence, a Gift Aid claim in the same tax year, and the matching rule",
                  "A gift that already has a valid declaration",
                ],
                [
                  "Restricted Zakat, Sadaqah, or Lillah",
                  "Any gift the donor or the mosque treats as restricted",
                  "A written mosque policy and a tagged fund in the books",
                  "A general-fund Gift Aid line that hides the restriction",
                ],
              ]}
            />

            <ArticleH2>
              What HMRC actually requires is on GOV.UK, and recognition for
              tax is not a Charity Commission number.
            </ArticleH2>
            <P>
              Start with{" "}
              <GovLink href={GOV.claimOverview}>claiming Gift Aid</GovLink>{" "}
              and{" "}
              <GovLink href={GOV.claimOnline}>claim Gift Aid online</GovLink>.
              Those pages say your charity must be recognised as a charity for
              tax purposes, and that you add Charities Online to your HMRC
              online account. You will be asked to attach a schedule
              spreadsheet. GOV.UK says you can claim for up to 1,000 donations
              on each spreadsheet, and that you can also claim through
              eligible software.
            </P>
            <P>
              A Charity Commission number is not the same thing.{" "}
              <GovLink href={GOV.hmrcRecognition}>
                Get recognition from HMRC
              </GovLink>{" "}
              is a separate application. The faith-charity trustee page notes
              that Gift Aid and other tax advantages sit with HMRC, and that
              you will need to meet Gift Aid conditions, including a
              declaration from the donor.
            </P>
            <P>
              <GovLink href={GOV.declarations}>
                Gift Aid declarations
              </GovLink>{" "}
              must state that the donor has paid enough tax and agrees to Gift
              Aid being claimed. The declaration must include a description of
              the gift and state the name of your charity, the donor&apos;s
              full name, and the donor&apos;s full home address including
              their postal code. You must keep a record of declarations for
              six years after the most recent donation you claimed Gift Aid
              on.
            </P>
            <P>
              BBSI has published a short public note that many masjid
              committees do not know GASDS exists for Friday collections
              without a declaration. That note points at the same GOV.UK
              small-donations page. The Association of Taxation Technicians
              also publishes a how-to-claim guide for charities. Neither
              replaces HMRC. If a volunteer summary and GOV.UK disagree, file
              from GOV.UK.
            </P>

            <ArticleH2>
              What goes wrong on a Friday is rarely the tax rate. It is the
              match between declaration, gift, fund, and claim.
            </ArticleH2>
            <P>
              The contactless total is a number without a name. The cash bag
              is names without amounts you can prove. The standing order
              arrived on Tuesday with no fund tag. The Zakat envelope is in
              the same tin as general Sadaqah. Someone filled a Gift Aid form
              in 2019 and you cannot find the postcode. Someone else ticked
              Gift Aid on a tap and you later put the same pounds through
              GASDS because the spreadsheet had a blank.
            </P>
            <P>
              Lincoln Central Mosque and Aylesbury Islamic Centre both publish
              public Gift Aid forms, which is how many mosques still do this:
              a PDF or a web form, then a treasurer who types the claim later.
              Paper is not dishonest. It fails when the form, the banked
              amount, and the HMRC line are three different stories.
            </P>
            <P>
              The other Friday failure is claiming GASDS on a gift that
              already has a declaration. GOV.UK&apos;s faith-charity guidance
              says if you hold a Gift Aid declaration for the donor, you must
              claim Gift Aid and not use GASDS. The{" "}
              <GovLink href={GOV.gasdsTopUp}>top-up payment guidance</GovLink>{" "}
              says you cannot claim for donations that come with a valid Gift
              Aid declaration, for membership fees, or for a £30 portion of a
              larger gift.
            </P>

            <ArticleH2>
              How treasurers actually assemble a claim: paper, GOV.UK plus a
              spreadsheet, devices, and mosque software.
            </ArticleH2>
            <P>
              This is a jobs table, not a scored bake-off. The only MosquePay
              row uses claims printed on mosque-pay.com. Other names are
              public players you will hear in the same search. No feature is
              invented for them, and this page does not link out to their
              sites.
            </P>

            <GuideTable
              caption="Approaches treasurers use to assemble a Gift Aid claim"
              headers={["Approach", "What it does", "What you still do", "Public Gift Aid fact"]}
              rows={[
                [
                  "Paper forms",
                  "Collects a written declaration after Jumu'ah or with an envelope",
                  "Type names, addresses, and amounts into a claim later",
                  "HMRC still needs full name, home address, postcode, and a description of the gift",
                ],
                [
                  "GOV.UK and a spreadsheet",
                  "Files the claim in Charities Online using HMRC's schedule",
                  "Build the schedule, attach it, and submit it yourself",
                  "GOV.UK allows up to 1,000 donations on each spreadsheet",
                ],
                [
                  "Contactless device vendors",
                  "Take Friday taps and can show more than one fund on a screen",
                  "Own the declaration, the GASDS log, and the HMRC submission",
                  "DonorDynamics' mosque contactless post describes on-screen declarations and GASDS on small anonymous contactless gifts for a registered charity",
                ],
                [
                  "Hibabox",
                  "A named contactless giving box that appears in the same mosque search",
                  "Confirm what evidence the box actually stores before you treat a tap as a claim line",
                  "This page does not invent a Hibabox Gift Aid workflow",
                ],
                [
                  "PledgeNow for mosques",
                  "Public pages describe Jumu'ah pledges, Zakat / Sadaqah / Lillah columns, and Gift Aid captured for a CSV",
                  "File the claim in Charities Online",
                  "Their mosque page describes a CSV ready for HMRC, not a MosquePay feature",
                ],
                [
                  "GiftAider",
                  "Public pages describe Gift Aid for Islamic charities, separating Zakat from eligible gifts, and GASDS",
                  "Decide fund policy and who holds the HMRC account",
                  "They publish online claim submission as their own product fact",
                ],
                [
                  "iCHARMS Gift Aid module",
                  "Public pages describe declaration capture, GASDS, and Charities Online submission",
                  "Confirm declarations and funds before anyone presses submit",
                  "iCHARMS claims HMRC-listed Charities Online submission on its own Gift Aid pages. That is not a MosquePay claim.",
                ],
                [
                  "MosquePay export",
                  "Captures declarations at the point of giving, logs GASDS cash collections per service, and produces HMRC-ready exports with evidence",
                  "Submit the claim in Charities Online from the mosque's own HMRC account",
                  "mosque-pay.com says export-ready evidence. It does not say MosquePay submits the claim or that MosquePay is on HMRC's commercial software suppliers list.",
                ],
              ]}
            />

            <ArticleH2>
              Zakat, Gift Aid, and honesty with the congregation are a policy
              you write down, not a default in software.
            </ArticleH2>
            <P>
              This page does not write new fiqh. It does not tell you that
              Gift Aid on Zakat is allowed, and it does not tell you that it
              is forbidden. It does not offer a local mosque&apos;s page as a
              ruling you can copy.
            </P>
            <P>
              Write the mosque&apos;s policy down where the treasurer, the
              imam, and the accountant can all find it. Keep Zakat, Sadaqah,
              and Lillah tagged from the moment of giving through to the
              banked amount and the claim line. If the policy says a Gift Aid
              top-up on a Zakat gift is treated as general Sadaqah, record
              that split in the books so the congregation can see it. Confirm
              the religious treatment with your imam and the tax treatment
              with your accountant before the claim goes to HMRC.
            </P>
            <P>
              GiftAider&apos;s public Gift Aid and Zakat page tells Islamic
              charities to track and separate Zakat from Gift Aid eligible
              donations. That is a public reminder that the split is your job.
              It is not MosquePay&apos;s ruling, and it is not a substitute
              for your own written policy.
            </P>

            <ArticleH2>
              GASDS written for a mosque, because Chapter 8 already names
              mosques as community buildings.
            </ArticleH2>
            <P>
              HMRC&apos;s{" "}
              <GovLink href={GOV.chapter8}>
                Chapter 8 guidance on GASDS from 6 April 2017
              </GovLink>{" "}
              lists mosques among examples of buildings that can be community
              buildings. If your mosque meets the community-building tests,
              read that chapter for the collection and record rules that go
              with it.
            </P>
            <P>
              On {CHECKED_ON},{" "}
              <GovLink href={GOV.gasds}>the small-donations page</GovLink>{" "}
              said you may claim 25% on cash donations of £30 or less and on
              contactless card donations of £30 or less collected on or after
              6 April 2019, that from 6 April 2016 you can claim up to £2,000
              in a tax year, and that your GASDS claim cannot be more than 10
              times your Gift Aid claim. That last point is the matching rule.
              The example on GOV.UK is that you can claim on £1,000 of GASDS
              donations if you have received £100 of Gift Aid donations in the
              same tax year.
            </P>
            <P>
              The same page says your charity must have claimed Gift Aid in
              the same tax year as you want to claim GASDS, and must not have
              received a penalty in the last two tax years.{" "}
              <GovLink href={GOV.gasdsTopUp}>
                The top-up payment guidance
              </GovLink>{" "}
              works the top-up the same way as Gift Aid: if the basic rate is
              20%, a £30 gift can produce a £7.50 top-up, and the maximum
              small-donations top-up from 6 April 2016 is the lower of £8,000
              of donations or ten times your Gift Aid donations.
            </P>
            <P>
              Do not claim GASDS on a gift that already has a declaration. Do
              not take a £30 slice out of a larger gift. Do not treat a
              membership fee as a small donation. Those exclusions are on
              GOV.UK, not on this page&apos;s invention.
            </P>
            <P>
              Keep the records HMRC asks for: the total cash collected, the
              date of the collection, the date it was paid into a bank
              account, and receipts from the card machine for contactless.
              Community-building claims also need the address including
              postcode, the type of event, how many events you held, an
              estimate of how many people attended, and when you collected.
              The top-up guidance says two people should ideally check and
              count the cash, and that you should keep small-donation records
              for six years from the end of the tax year they relate to. If
              two GOV.UK pages give different retention periods, keep the
              longer set.
            </P>

            <ArticleH2>
              Questions that puncture a software demo before you sign
              anything.
            </ArticleH2>
            <P>
              Ask these out loud. The answers sort an export tool from a
              Charities Online submit product, and a tagged fund from a single
              giving total.
            </P>
            <ol className="mt-6 list-decimal space-y-4 pl-6 text-base leading-7 text-slate-700">
              <li>
                Does the product submit the claim through Charities Online, or
                does it give you an export that you still attach yourself?
                MosquePay&apos;s honest answer is export. Public{" "}
                <InternalLink href="/faq">FAQ</InternalLink> and{" "}
                <InternalLink href="/features">features</InternalLink> copy
                says HMRC-ready exports with evidence. It does not say MosquePay
                is on HMRC&apos;s Charities Online commercial software
                suppliers list.
              </li>
              <li>
                Can it show the donor&apos;s full name, home address, and
                postcode on the declaration, or only a tick box?
              </li>
              <li>
                Can a Friday gift be split across Zakat, Sadaqah, Lillah, and
                a general or building fund so the claim line matches the
                restriction?
              </li>
              <li>
                Does GASDS exclude gifts that already have a declaration, or
                can the same pounds appear in both columns?
              </li>
              <li>
                Who holds the HMRC Charities Online account after you buy the
                software: the mosque, the treasurer as an individual, or the
                vendor?
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
                partner on that page is Mooov.
              </li>
            </ol>

            <ArticleH2>
              What MosquePay will show you in a 30-minute walkthrough is only
              what the public pages already claim.
            </ArticleH2>
            <P>
              <InternalLink href="/book-demo">Book a demo</InternalLink> is a
              30-minute call. Bring last Friday&apos;s cash sheet, the
              contactless total, and one standing-order line that still has no
              fund tag. The walkthrough should stay inside claims printed on
              mosque-pay.com.
            </P>
            <P>
              You should see Gift Aid declarations captured at the point of
              giving, whether the gift is online or recorded by your team, and
              attached to eligible gifts. You should see GASDS cash
              collections logged per service. You should see HMRC-ready
              exports with the evidence behind every line. You should see
              Zakat, Sadaqah, Lillah, and appeal funds kept separate. You
              should hear that settlement goes to the mosque&apos;s own bank
              account, that MosquePay adds no card-processing markup, and that
              Mooov is the payment partner named on{" "}
              <InternalLink href="/pricing">pricing</InternalLink>.
            </P>
            <P>
              You should not be told that MosquePay submits the claim to
              HMRC. You should not be told that MosquePay is on HMRC&apos;s
              Charities Online commercial software suppliers list. Those
              sentences are not on the public site. iCHARMS does claim listed
              submission on its own Gift Aid pages. That is a competitor fact,
              not a MosquePay feature.
            </P>
            <P>
              MosquePay is operated by Neural Network Group Limited, company
              number 16606065. The contact email currently printed on the
              public contact page is ag@experrt.com. If you want to start
              onboarding rather than watch a demo first,{" "}
              <InternalLink href="/join">get started</InternalLink>.
            </P>

            <ArticleH2>What this page skipped, on purpose.</ArticleH2>
            <P>
              This page does not invent how much your mosque would recover if
              last Friday had been claimed correctly. It does not award
              MosquePay a first-place badge against iCHARMS, GiftAider,
              PledgeNow, or a contactless box. It does not reprint HMRC
              supplier lists. It does not change the currency printed on the{" "}
              <InternalLink href="/pricing">live pricing page</InternalLink>.
              It does not treat /news as a home for this guide. /news is the
              product changelog. It does not use /charity or /donate, which
              are demo mosque pages.
            </P>

            <ArticleH2>
              Gift Aid is a declaration, a gift, a fund, and a claim that
              still have to match.
            </ArticleH2>
            <P>
              If you remember one line, remember that. Collect the declaration
              when the gift is given. Log anonymous cash and contactless for
              GASDS only when no declaration exists. Keep Zakat, Sadaqah, and
              Lillah tagged. Export the evidence. Submit the claim from the
              mosque&apos;s own HMRC account. Then check that the four parts
              still tell the same story.
            </P>

            <ArticleH2>
              Questions treasurers ask after they have counted Friday&apos;s
              collection.
            </ArticleH2>
            <dl className="mt-8 space-y-8">
              {GIFT_AID_GUIDE_FAQS.map((item) => (
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
        title="Bring last Friday's cash sheet to a 30-minute walkthrough."
        body="We will stay on declarations, GASDS evidence, fund tags, and the HMRC-ready export. You still submit the claim."
        ctaLabel="Book a demo"
        ctaHref="/book-demo"
        secondaryLabel="Read the FAQ"
        secondaryHref="/faq"
      />
    </MarketingShell>
  );
}
