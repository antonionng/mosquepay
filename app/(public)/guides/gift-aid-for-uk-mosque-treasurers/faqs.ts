export type GuideFaq = {
  question: string;
  answer: string;
};

export const GIFT_AID_GUIDE_FAQS: GuideFaq[] = [
  {
    question: "Can a mosque claim Gift Aid?",
    answer:
      "Yes, if the mosque is recognised by HMRC as a charity for tax purposes and the gift meets Gift Aid rules, including a valid declaration from a UK taxpayer. A Charity Commission number on its own is not HMRC recognition. Check the live GOV.UK pages on claiming Gift Aid and on getting recognition from HMRC before you file.",
  },
  {
    question: "Do we need a Charity Commission number?",
    answer:
      "You may need to register with the Charity Commission if your organisation is based in England or Wales and meets the Commission's own tests. That is a separate step from HMRC charity recognition. GOV.UK's faith-charity trustee guidance says Gift Aid is run by HMRC. You claim Gift Aid only after HMRC recognises the mosque for tax purposes.",
  },
  {
    question: "Can we claim on Friday cash without a form?",
    answer:
      "Ordinary Gift Aid needs a Gift Aid declaration. If there is no declaration, you may still be able to claim a GASDS top-up on small cash gifts of £30 or less, provided the mosque meets the live GASDS eligibility and matching rules on GOV.UK. Do not put a gift through GASDS when you already hold a valid declaration for it.",
  },
  {
    question: "Does GASDS cover contactless?",
    answer:
      "Yes, on the live GOV.UK pages. The small-donations scheme page says you may be able to claim 25% on contactless card donations of £30 or less collected on or after 6 April 2019. The detailed top-up guidance also describes contactless from 6 April 2017. Keep the card-terminal evidence HMRC asks for, and re-read those pages before you claim.",
  },
  {
    question: "What records does HMRC expect?",
    answer:
      "For ordinary Gift Aid, GOV.UK says the declaration must include the charity name, the donor's full name, the donor's full home address including postcode, and a description of the gift, and you must keep declarations for six years after the most recent donation you claimed on. For GASDS, GOV.UK asks for the total collected, the collection date, the date the money was paid into a bank account, and contactless receipts where you used a terminal. Community-building claims need extra place and event records. Follow the longer of the published retention periods if two GOV.UK pages disagree.",
  },
  {
    question: "Can Gift Aid be claimed on Zakat?",
    answer:
      "This page does not give a fiqh ruling and does not set a MosquePay default. Write the mosque's policy down, tag Zakat, Sadaqah, and Lillah so they cannot be mixed in the books, and confirm the tax and the religious treatment with your imam and your accountant before you include any Zakat line in a Gift Aid claim.",
  },
  {
    question: "Does MosquePay submit the claim?",
    answer:
      "No. MosquePay's public pages say it produces HMRC-ready exports with the evidence behind every line. You, or the person who holds the mosque's HMRC Charities Online account, still attach the schedule and submit the claim. MosquePay does not claim to appear on HMRC's Charities Online commercial software suppliers list.",
  },
  {
    question: "Do we have to stop cash?",
    answer:
      "No. Friday cash remains a normal mosque collection. The work is to count it, bank it, decide whether each gift is ordinary Gift Aid, GASDS, or neither, and keep restricted funds tagged. Contactless and standing orders sit beside cash. They do not replace the need for a declaration, a GASDS log, or a written Zakat policy.",
  },
];
