export type GuideFaq = {
  question: string;
  answer: string;
};

export const TREASURER_SOFTWARE_GUIDE_FAQS: GuideFaq[] = [
  {
    question: "What does mosque treasurer software UK actually need to do?",
    answer:
      "It has to tag restricted funds such as Zakat separately from general Sadaqah, capture Gift Aid declarations and GASDS evidence when money is given, reconcile what hit the bank, issue donor statements you can stand behind, and produce a committee or trustee pack without you rebuilding Friday in Excel. A kiosk, a prayer-time screen, or a donation page can be useful. None of those is the whole treasurer job.",
  },
  {
    question: "Is a spreadsheet enough for a registered mosque charity?",
    answer:
      "A spreadsheet can hold a cash count and a standing-order list. It starts to fail when Zakat sits in the same column as the building fund, when a Gift Aid tick has no full name and postcode, when the bank total does not match the tin, and when the committee pack is a Thursday-night rebuild. Johnsons' public mosque-audit pages describe Charities SORP, Charity Commission compliance, and a risk-based check for misstatements. That is the pack your spreadsheet has to survive, not a reason to buy the first logo that says mosque.",
  },
  {
    question: "Does mosque software include Gift Aid submission to HMRC?",
    answer:
      "Not by default. Some public products say they export a schedule you attach in Charities Online. Halal Wealth's public site describes HMRC-format ODS exports and direct XML submission. iCHARMS' public Gift Aid pages say it is an HMRC-listed Charities Online supplier and submits the claim. MosquePay's public pages say HMRC-ready exports with evidence. They do not say MosquePay submits the claim or that MosquePay is on HMRC's commercial software suppliers list. Ask which of those three answers you are buying.",
  },
  {
    question: "Does MosquePay submit the Gift Aid claim?",
    answer:
      "No. MosquePay's public features, FAQ, and pricing pages say Gift Aid declarations are captured at the point of giving, GASDS cash collections are logged per service, and the product produces HMRC-ready exports with evidence. You, or the person who holds the mosque's HMRC Charities Online account, still attach the schedule and submit the claim. Read the Gift Aid field guide on this site for the reclaim rules.",
  },
  {
    question: "How should Zakat be treated in the books?",
    answer:
      "This page does not write new fiqh. Keep Zakat tagged separately from Sadaqah, Lillah, and appeal funds so the congregation can see the restriction. MosquePay's public pages describe those fund tags as bookkeeping. They do not decide whether Gift Aid can sit on a Zakat line. Write the mosque's policy down, show it on the donate flow, and confirm the religious and tax treatment with your imam and accountant before any Zakat line appears in a claim.",
  },
  {
    question: "What is mosquepay.co.uk, and is it the same as MosquePay?",
    answer:
      "No. mosque-pay.com is operations software for a mosque's own giving, Gift Aid, and treasurer records. mosquepay.co.uk is a UK donor directory. This guide does not describe that directory, does not use its mosque count, and does not claim its fee model.",
  },
  {
    question: "Do we have to stop cash and standing orders?",
    answer:
      "No. Friday cash, contactless taps, and standing orders are normal mosque collections. Software has to record cash, tag the fund, decide whether a gift is ordinary Gift Aid, GASDS, or neither, and match the bank line. A cashless kiosk that only stores an amount still leaves you the declaration, the GASDS log, and the restricted-fund trail.",
  },
  {
    question: "What should we bring to a MosquePay demo?",
    answer:
      "Book a 30-minute walkthrough and bring last Friday's cash sheet, the contactless total, one standing-order line with no fund tag, and last month's committee pack. Ask the puncture questions on this page out loud. The walkthrough should stay inside claims printed on mosque-pay.com: online, QR, card, and recorded cash giving; Zakat, Sadaqah, Lillah, and appeal fund tags; Gift Aid declarations; GASDS per service; HMRC-ready exports; bank import and reconciliation; treasurer reports; settlement to the mosque bank account; and no MosquePay markup, with Mooov named on the pricing page.",
  },
];
