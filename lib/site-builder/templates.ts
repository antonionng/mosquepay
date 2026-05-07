import type { LodgeSiteSection } from "@/lib/db/types";

type TemplatePreset = {
  id: string;
  name: string;
  description: string;
  buildSections: () => LodgeSiteSection[];
};

let counter = 0;
function id() {
  counter += 1;
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sec-${Date.now()}-${counter}`;
}

function s(
  type: LodgeSiteSection["type"],
  heading: string,
  body: string,
  ctaLabel: string | null,
  ctaHref: string | null,
  order: number,
  style: LodgeSiteSection["style"] = null
): LodgeSiteSection {
  return {
    id: id(),
    type,
    heading,
    body,
    cta_label: ctaLabel,
    cta_href: ctaHref,
    visible: true,
    order,
    style,
  };
}

export const SECTION_PRESETS: Array<{
  type: LodgeSiteSection["type"];
  label: string;
  description: string;
  example: () => LodgeSiteSection;
}> = [
  {
    type: "hero",
    label: "Hero banner",
    description: "Headline, brief intro, and primary call to action.",
    example: () =>
      s(
        "hero",
        "Welcome to your lodge",
        "A modern brotherhood with deep heritage. Discover meetings, charity, and fellowship.",
        "Express interest",
        "/join",
        1
      ),
  },
  {
    type: "about",
    label: "About",
    description: "Short paragraph about the lodge identity and values.",
    example: () =>
      s(
        "about",
        "About the lodge",
        "Founded in fellowship and service, we welcome members from all backgrounds.",
        null,
        null,
        2
      ),
  },
  {
    type: "meeting_details",
    label: "Meeting times",
    description: "Where and when the lodge meets.",
    example: () =>
      s(
        "meeting_details",
        "When we meet",
        "Regular meetings on the third Thursday of each month at Mark Masons' Hall.",
        "View events",
        "/events",
        3
      ),
  },
  {
    type: "officers",
    label: "Officers",
    description: "Highlight current officers and their roles.",
    example: () =>
      s(
        "officers",
        "This year's officers",
        "Our officers serve the lodge and represent our values throughout the year.",
        null,
        null,
        4
      ),
  },
  {
    type: "charity",
    label: "Charity",
    description: "Showcase charitable work and current campaigns.",
    example: () =>
      s(
        "charity",
        "Charity in action",
        "We support local and national causes through regular giving and active fundraising.",
        "Our charity work",
        "/charity",
        5
      ),
  },
  {
    type: "events",
    label: "Upcoming meetings",
    description: "Live list of upcoming meetings, pulled from the platform.",
    example: () =>
      s(
        "events",
        "Upcoming meetings",
        "See dates, dress codes, and dining arrangements.",
        "All events",
        "/events",
        6
      ),
  },
  {
    type: "join",
    label: "Join",
    description: "Invite prospective members to start a conversation.",
    example: () =>
      s(
        "join",
        "Interested in joining?",
        "Tell us a little about yourself and we will be in touch.",
        "Express interest",
        "/join",
        7
      ),
  },
  {
    type: "contact",
    label: "Contact",
    description: "Make it easy to get in touch with the secretary.",
    example: () =>
      s(
        "contact",
        "Speak with our team",
        "Whether you want to visit, join, or learn more, we are happy to hear from you.",
        "Contact us",
        "/contact",
        8
      ),
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Answer common questions for prospective members and visitors.",
    example: () =>
      s(
        "faq",
        "Frequently asked questions",
        "Answers to common questions about visiting, joining, and what to expect.",
        null,
        null,
        9
      ),
  },
];

export const TEMPLATES: TemplatePreset[] = [
  {
    id: "traditional",
    name: "Traditional",
    description: "Heritage-led layout: hero, about, meetings, charity, contact.",
    buildSections: () => [
      s(
        "hero",
        "Welcome to your lodge",
        "A heritage of fellowship, service, and meaningful ritual.",
        "Express interest",
        "/join",
        1
      ),
      s(
        "about",
        "About the lodge",
        "Founded in fellowship and service, our lodge welcomes those of good character.",
        null,
        null,
        2
      ),
      s(
        "meeting_details",
        "When we meet",
        "Regular meetings on the third Thursday of each month.",
        "View events",
        "/events",
        3
      ),
      s(
        "charity",
        "Charity and community",
        "We support local and national causes through giving and active fundraising.",
        "Our charity work",
        "/charity",
        4
      ),
      s(
        "contact",
        "Speak with our team",
        "If you are interested in joining or visiting, we are happy to hear from you.",
        "Contact us",
        "/contact",
        5
      ),
    ],
  },
  {
    id: "modern",
    name: "Modern",
    description: "Clear, concise layout focused on the visitor and prospective member journey.",
    buildSections: () => [
      s(
        "hero",
        "A modern lodge with deep roots",
        "Fellowship that fits today's lives. Meet us, visit us, join us.",
        "Get in touch",
        "/contact",
        1
      ),
      s("about", "Who we are", "A welcoming lodge open to people from all walks of life.", null, null, 2),
      s(
        "events",
        "Upcoming meetings",
        "See what's on, reserve dining, and plan visits.",
        "All events",
        "/events",
        3
      ),
      s(
        "officers",
        "Our officers",
        "Meet the team running the lodge this year.",
        null,
        null,
        4
      ),
      s(
        "join",
        "Express interest",
        "Tell us about yourself and we will follow up personally.",
        "Start the conversation",
        "/join",
        5
      ),
    ],
  },
  {
    id: "charity-led",
    name: "Charity-led",
    description: "Bring the lodge's charity work to the front.",
    buildSections: () => [
      s(
        "hero",
        "Service before self",
        "We believe Freemasonry is best lived through giving.",
        "Support our work",
        "/charity",
        1
      ),
      s(
        "charity",
        "Current charity campaigns",
        "Live campaigns and meeting collections supporting our chosen causes.",
        "View campaigns",
        "/charity",
        2
      ),
      s(
        "about",
        "Why we do this",
        "Our charity work is rooted in our core values of service and integrity.",
        null,
        null,
        3
      ),
      s(
        "events",
        "Upcoming meetings",
        "Many of our charity collections happen at our meetings.",
        "Events",
        "/events",
        4
      ),
      s(
        "contact",
        "Get in touch",
        "Want to support a campaign or learn more? We would love to hear from you.",
        "Contact us",
        "/contact",
        5
      ),
    ],
  },
  {
    id: "history-heritage",
    name: "History & heritage",
    description:
      "Deep dive into your lodge's story: founding, notable members, banner, and ritual heritage.",
    buildSections: () => [
      s(
        "hero",
        "A heritage worth honouring",
        "Founded in fellowship, sustained by service, our lodge has been a part of this community for generations.",
        "Our story",
        "#about",
        1
      ),
      s(
        "about",
        "Our founding",
        "Consecrated under the United Grand Lodge of England, we trace our origins to brothers committed to friendship, morality and brotherly love.",
        null,
        null,
        2
      ),
      s(
        "about",
        "Notable members and milestones",
        "Past Masters and benefactors who shaped our lodge. Use this space to celebrate them.",
        null,
        null,
        3
      ),
      s(
        "officers",
        "Past Masters",
        "An unbroken chain of leadership stretching back to consecration.",
        null,
        null,
        4
      ),
      s(
        "contact",
        "Visiting brethren welcome",
        "If you wish to research our records or visit, please reach out.",
        "Contact secretary",
        "/contact",
        5
      ),
    ],
  },
  {
    id: "officers-team",
    name: "Officers & ritual",
    description:
      "Foreground this year's officers, their roles, and ritual responsibilities.",
    buildSections: () => [
      s(
        "hero",
        "This year's team",
        "Meet the officers of the lodge for the current Masonic year.",
        "Meet the team",
        "#officers",
        1
      ),
      s(
        "officers",
        "Officers of the lodge",
        "Each office serves a specific role in the work of the lodge. The list below is kept up-to-date automatically from our register.",
        null,
        null,
        2
      ),
      s(
        "meeting_details",
        "When we meet",
        "Regular meetings, lodge of instruction, and rehearsal dates.",
        "View calendar",
        "/events",
        3
      ),
      s(
        "events",
        "Upcoming meetings",
        "What's on next.",
        "All events",
        "/events",
        4
      ),
      s(
        "contact",
        "Speak with an officer",
        "Get in touch with the secretary, treasurer, or charity steward directly.",
        "Contact",
        "/contact",
        5
      ),
    ],
  },
  {
    id: "charity-campaign",
    name: "Charity campaign launch",
    description:
      "Drive a single campaign with a strong call-to-action and Gift Aid story.",
    buildSections: () => [
      s(
        "hero",
        "Help us reach our goal",
        "Donate today, with Gift Aid your gift goes 25% further.",
        "Donate now",
        "/donate",
        1
      ),
      s(
        "charity",
        "About this campaign",
        "What we are raising for, why it matters, and how the funds will be used. Add photos and a target.",
        "Donate",
        "/donate",
        2
      ),
      s(
        "about",
        "Why we give",
        "Charity is at the heart of Freemasonry. This campaign continues a centuries-old tradition.",
        null,
        null,
        3
      ),
      s(
        "events",
        "Charity events",
        "Festive boards, walks, and dinners in support of the campaign.",
        "All events",
        "/events",
        4
      ),
      s(
        "contact",
        "Talk to the Charity Steward",
        "Have a story to share, or want to support in kind?",
        "Get in touch",
        "/contact",
        5
      ),
    ],
  },
  {
    id: "contact-first",
    name: "Contact first",
    description:
      "Minimal layout for lodges that want a clean home page with the contact details upfront.",
    buildSections: () => [
      s(
        "hero",
        "Welcome",
        "A short, warm welcome to your lodge.",
        "Contact us",
        "/contact",
        1
      ),
      s(
        "contact",
        "Get in touch",
        "Email, phone, and meeting venue all in one place.",
        "Email the secretary",
        "/contact",
        2
      ),
      s(
        "meeting_details",
        "Where we meet",
        "Address, parking, and accessibility information.",
        null,
        null,
        3
      ),
    ],
  },
  {
    id: "recruitment",
    name: "Recruitment focused",
    description: "Designed for lodges actively welcoming new members.",
    buildSections: () => [
      s(
        "hero",
        "Could Freemasonry be for you?",
        "If you are curious, we would love to talk. There is no obligation.",
        "Express interest",
        "/join",
        1
      ),
      s(
        "about",
        "What it means to be a Freemason",
        "Friendship, support, and a shared commitment to integrity and service.",
        null,
        null,
        2
      ),
      s(
        "faq",
        "Common questions",
        "Honest answers to the questions most people ask before reaching out.",
        null,
        null,
        3
      ),
      s(
        "meeting_details",
        "Meet us",
        "Visiting meetings and social events are the best way to get to know us.",
        "When we meet",
        "/events",
        4
      ),
      s(
        "join",
        "Take the next step",
        "Tell us about yourself and we will be in touch.",
        "Express interest",
        "/join",
        5
      ),
    ],
  },
];
