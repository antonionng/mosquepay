export type GuideFaq = {
  question: string;
  answer: string;
};

export const CONTACTLESS_QR_GUIDE_FAQS: GuideFaq[] = [
  {
    question: "What does contactless donations mosque UK actually mean for a treasurer?",
    answer:
      "It means Friday can take a card or phone tap, a QR scan on the giver's phone, recorded cash from the tin, and a standing order that arrived midweek, tag the fund when the gift is given, capture a Gift Aid declaration when it applies, log GASDS only on small anonymous taps that have no declaration, and still leave a record the committee can open on Monday. It is not a hardware catalogue, and it is not a thin product splash.",
  },
  {
    question: "Is a card terminal enough after Jumu'ah?",
    answer:
      "A terminal can take a tap. It is not enough if the total has no name, if Zakat and a building appeal share one pot, if Gift Aid is only a tick with no full name and postcode, if small anonymous taps are later dropped into GASDS without a collection log, or if you still rebuild Friday in Excel. Hardware vendors already rank this search. The job you are buying is the Friday record, not the device.",
  },
  {
    question: "Do QR code donations mosque UK replace the cash tin?",
    answer:
      "No. Envelopes after Jumu'ah remain a normal mosque collection. QR sits beside the tin, the tap, and the standing order. A poster that dumps every scan into one pot still leaves you the ring-fence. MosquePay's public pages describe online, QR, card, and recorded cash giving in the same record, with a QR and giving page per appeal. They do not tell you to stop cash.",
  },
  {
    question: "Can we claim GASDS on small contactless taps?",
    answer:
      "GOV.UK's small-donations scheme page says you may be able to claim 25 percent on contactless card donations of £30 or less collected on or after 6 April 2019, where you do not have a Gift Aid declaration. Do not put a declared gift through GASDS. Do not take a slice of a larger tap and call it a small donation. The Gift Aid field guide on this site walks the reclaim tests. This page only needs you to keep the evidence on the same Friday as the tap.",
  },
  {
    question: "Does MosquePay submit the Gift Aid claim?",
    answer:
      "No. MosquePay's public features, FAQ, and pricing pages say Gift Aid declarations are captured at the point of giving, GASDS cash collections are logged per service, and the product produces HMRC-ready exports with evidence. You still attach the schedule and submit the claim from the mosque's own HMRC account. MosquePay does not claim to appear on HMRC's Charities Online commercial software suppliers list.",
  },
  {
    question: "What is mosquepay.co.uk, and is it the same as MosquePay?",
    answer:
      "No. mosque-pay.com is operations software for a mosque's own giving, Gift Aid, and treasurer records. mosquepay.co.uk is a UK donor directory. This guide does not describe that directory, does not use its mosque count, and does not claim its fee model.",
  },
  {
    question: "Do we have to buy a branded kiosk to take contactless or QR gifts?",
    answer:
      "Not on MosquePay's public pages. The homepage describes turning any tablet into a giving terminal, with the giver paying on their own phone after a QR is shown, and Gift Aid signed on screen. Features copy describes online, QR, card, and recorded cash giving. Other public players sell their own boxes and stands. Ask whether you are buying a device, a phone QR, or a Friday record that can hold both.",
  },
  {
    question: "What should we bring to a MosquePay demo?",
    answer:
      "Book a 30-minute walkthrough and bring last Friday's cash sheet, the contactless total, the QR poster if you have one, one standing-order line with no fund tag, and last month's committee note if you still have it. Ask the puncture questions on this page out loud. The walkthrough should stay inside claims printed on mosque-pay.com: any tablet as a giving terminal; pay on the giver's phone; Gift Aid on screen; QR per appeal; online, QR, card, and recorded cash giving; Zakat, Sadaqah, Lillah, and appeal fund tags; GASDS per service; HMRC-ready exports; bank import and reconciliation; treasurer reports; settlement to the mosque bank account; and no MosquePay markup, with Mooov named on the pricing page.",
  },
];
