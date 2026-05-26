import type {
  LodgeSiteCustomPage,
  LodgeSiteFooterSettings,
  LodgeSiteHeaderSettings,
  LodgeSiteSection,
} from "@/lib/db/types";

type TemplatePreset = {
  id: string;
  name: string;
  description: string;
  category?: "heritage" | "growth" | "charity" | "operations";
  accent?: string;
  tags?: string[];
  bestFor?: string;
  buildSections: () => LodgeSiteSection[];
};

export type TemplateSitePack = {
  custom_pages: LodgeSiteCustomPage[];
  header_settings: LodgeSiteHeaderSettings;
  footer_settings: LodgeSiteFooterSettings;
};

export type SectionVariantPreset = {
  id: string;
  type: LodgeSiteSection["type"];
  label: string;
  description: string;
  tone: "classic" | "modern" | "conversion" | "community";
  tags: string[];
  example: () => LodgeSiteSection;
};

let counter = 0;
function id() {
  counter += 1;
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sec-${Date.now()}-${counter}`;
}

const TEMPLATE_IMAGES = {
  heritageHero: {
    src: "/site-template-images/heritage-hero.png",
    alt: "Lodge members in a traditional lodge room",
  },
  lodgeWelcome: {
    src: "/site-template-images/visitor-contact.png",
    alt: "Lodge members welcoming visitors",
  },
  lodgeMeeting: {
    src: "/site-template-images/officers-formal.png",
    alt: "Formal lodge meeting with officers",
  },
  candidateConversation: {
    src: "/site-template-images/candidate-conversation.png",
    alt: "Lodge members discussing candidate enquiries",
  },
  provinceLeadership: {
    src: "/site-template-images/province-leadership.png",
    alt: "Lodge officers in formal dress",
  },
  charityGiving: {
    src: "/site-template-images/charity-welfare.png",
    alt: "Lodge members supporting charity and welfare work",
  },
  officersFormal: {
    src: "/site-template-images/officers-formal.png",
    alt: "Formal lodge officers in the lodge room",
  },
  charityWelfare: {
    src: "/site-template-images/charity-welfare.png",
    alt: "Lodge members discussing charity and welfare support",
  },
  visitorContact: {
    src: "/site-template-images/visitor-contact.png",
    alt: "Lodge members welcoming visitors",
  },
} as const;

type TemplateImage = (typeof TEMPLATE_IMAGES)[keyof typeof TEMPLATE_IMAGES];

function heroStyle(
  image: TemplateImage,
  overlayOpacity = 0.52,
  backgroundPosition = "center"
): NonNullable<LodgeSiteSection["style"]> {
  return {
    background_image_url: image.src,
    image_alt: image.alt,
    background_position: backgroundPosition,
    overlay_opacity: overlayOpacity,
    background_tone: "dark",
    spacing: "spacious",
    content_width: "wide",
    button_variant: "solid",
  };
}

function imageStyle(
  image: TemplateImage,
  imagePosition: NonNullable<NonNullable<LodgeSiteSection["style"]>["image_position"]> = "right",
  imageShape: NonNullable<NonNullable<LodgeSiteSection["style"]>["image_shape"]> = "rounded"
): NonNullable<LodgeSiteSection["style"]> {
  return {
    image_url: image.src,
    image_alt: image.alt,
    image_position: imagePosition,
    image_shape: imageShape,
    spacing: "spacious",
    content_width: "wide",
  };
}

function styleWith(
  style: NonNullable<LodgeSiteSection["style"]>,
  overrides: NonNullable<LodgeSiteSection["style"]>
): NonNullable<LodgeSiteSection["style"]> {
  return { ...style, ...overrides };
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

function page(
  slug: string,
  title: string,
  description: string,
  order: number,
  sections: LodgeSiteSection[],
  navLabel = title
): LodgeSiteCustomPage {
  return {
    id: id(),
    slug,
    title,
    description,
    seo_title: title,
    seo_description: description,
    social_image_url: sections[0]?.style?.background_image_url ?? sections[0]?.style?.image_url ?? null,
    sections,
    published: true,
    show_in_nav: true,
    nav_label: navLabel,
    order,
  };
}

function packHeader(
  navItems: Array<{ id: string; label: string; href: string }>,
  ctaLabel: string,
  ctaHref: string
): LodgeSiteHeaderSettings {
  return {
    show_logo: true,
    show_lodge_name: true,
    show_lodge_number: true,
    nav_items: navItems.map((item, index) => ({
      ...item,
      visible: true,
      order: index + 1,
    })),
    cta_label: ctaLabel,
    cta_href: ctaHref,
  };
}

function packFooter(
  tagline: string,
  ctaLabel = "Join Us",
  ctaHref = "/site/join"
): LodgeSiteFooterSettings {
  return {
    show_logo: true,
    show_lodge_name: true,
    show_lodge_number: true,
    show_contact_details: true,
    tagline,
    badge_text: "Official lodge website",
    powered_by_text: null,
    show_powered_by: true,
    link_groups: [
      {
        id: "explore",
        title: "Explore",
        order: 1,
        links: [
          { id: "home", label: "Home", href: "/", visible: true, order: 1 },
          { id: "about", label: "About", href: "/site/about", visible: true, order: 2 },
          { id: "events", label: "Events", href: "/events", visible: true, order: 3 },
          { id: "charity", label: "Charity", href: "/site/charity", visible: true, order: 4 },
        ],
      },
      {
        id: "membership",
        title: "Membership",
        order: 2,
        links: [
          { id: "join", label: ctaLabel, href: ctaHref, visible: true, order: 1 },
          { id: "contact", label: "Contact", href: "/site/contact", visible: true, order: 2 },
          { id: "faq", label: "Questions", href: "/site/join", visible: true, order: 3 },
        ],
      },
    ],
  };
}

function buildCorePages(kind: TemplatePreset["category"] = "heritage"): LodgeSiteCustomPage[] {
  const aboutTone = kind === "growth" ? TEMPLATE_IMAGES.candidateConversation : TEMPLATE_IMAGES.heritageHero;
  const charityTone = kind === "charity" ? TEMPLATE_IMAGES.charityGiving : TEMPLATE_IMAGES.charityWelfare;
  return [
    page(
      "about",
      "About the lodge",
      "Learn about the lodge, its values, meeting rhythm, charity, and welcome for visitors.",
      1,
      [
        s(
          "hero",
          "About our lodge",
          "A public introduction to our history, fellowship, charitable work, and place in the community.",
        "Plan a visit",
        "/events",
          1,
          heroStyle(aboutTone, 0.55)
        ),
        s(
          "about",
          "Our story and values",
          "Use this page to tell visitors what makes the lodge distinctive: its history, character, members, and charitable aims.",
          null,
          null,
          2,
          imageStyle(TEMPLATE_IMAGES.visitorContact, "right", "arch")
        ),
        s(
          "meeting_details",
          "Meetings and visiting",
          "Explain when the lodge meets, who to contact before visiting, dress expectations, dining, and venue details.",
          "View events",
          "/events",
          3,
          imageStyle(TEMPLATE_IMAGES.lodgeMeeting, "left", "rounded")
        ),
      ]
    ),
    page(
      "join",
      "Join or visit",
      "A friendly page for prospective members to learn more and submit an enquiry to the lodge pipeline.",
      2,
      [
        s(
          "hero",
          "Could Freemasonry be for you?",
          "If you are curious about visiting or joining, start a conversation with the lodge.",
          "Start an enquiry",
          "#lead-intake",
          1,
          heroStyle(TEMPLATE_IMAGES.candidateConversation, 0.5)
        ),
        s(
          "faq",
          "Common questions before you visit",
          "Answer practical questions about visiting, joining, costs, time commitment, dress code, and what happens next.",
          null,
          null,
          2,
          { background_tone: "soft", spacing: "spacious" }
        ),
        s(
          "join",
          "Start a membership conversation",
          "Tell us a little about yourself and the lodge team will follow up personally.",
          "Express interest",
          "#lead-intake",
          3,
          {
            form_mode: "lead",
            image_url: TEMPLATE_IMAGES.lodgeWelcome.src,
            image_alt: TEMPLATE_IMAGES.lodgeWelcome.alt,
            image_position: "right",
            image_shape: "rounded",
            background_tone: "brand",
            form_fields: ["phone", "location", "how_heard", "message", "consent"],
            form_required_fields: ["consent"],
            form_consent_text: "I agree to be contacted by the lodge about my membership enquiry.",
            form_thank_you: "Thanks. Your enquiry has been added to the lodge pipeline.",
          }
        ),
      ],
      "Join"
    ),
    page(
      "contact",
      "Contact the lodge",
      "Send a message to the lodge admin team about visiting, joining, dining, charity, or general enquiries.",
      3,
      [
        s(
          "hero",
          "Contact the lodge",
          "Reach the secretary and lodge admin team for visiting, joining, dining, or general questions.",
          "Send a message",
          "#contact-form",
          1,
          heroStyle(TEMPLATE_IMAGES.visitorContact, 0.54)
        ),
        s(
          "contact",
          "Send a message",
          "Your message will go to the active lodge admins and configured lodge contact email.",
          "Contact the secretary",
          "#contact-form",
          2,
          {
            form_mode: "contact",
            image_url: TEMPLATE_IMAGES.candidateConversation.src,
            image_alt: TEMPLATE_IMAGES.candidateConversation.alt,
            image_position: "left",
            image_shape: "rounded",
            background_tone: "soft",
            form_fields: ["phone", "subject", "message", "consent"],
            form_required_fields: ["message", "consent"],
            form_consent_text: "I agree to be contacted by the lodge about my enquiry.",
            form_thank_you: "Thanks. Your message has been sent to the lodge admin team.",
          }
        ),
      ],
      "Contact"
    ),
    page(
      "charity",
      "Charity and community",
      "Show the lodge's charitable work, community support, campaigns, and fundraising activity.",
      4,
      [
        s(
          "hero",
          "Charity and community",
          "Our charitable work connects lodge values with practical support for good causes.",
          "Support our work",
          "/site/charity",
          1,
          heroStyle(charityTone, 0.52)
        ),
        s(
          "charity",
          "Our charitable impact",
          "Use this page to explain current campaigns, supported charities, fundraising events, and Gift Aid.",
          "View campaigns",
          "/site/charity",
          2,
          imageStyle(TEMPLATE_IMAGES.charityGiving, "right", "rounded")
        ),
      ],
      "Charity"
    ),
  ];
}

export function buildTemplateSitePack(template: TemplatePreset): TemplateSitePack {
  const navItems = [
    { id: "home", label: "Home", href: "/" },
    { id: "about", label: "About", href: "/site/about" },
    { id: "events", label: "Events", href: "/events" },
    { id: "charity", label: "Charity", href: "/site/charity" },
    { id: "join", label: "Join", href: "/site/join" },
    { id: "contact", label: "Contact", href: "/site/contact" },
  ];
  const isCharity = template.category === "charity";
  const ctaLabel = isCharity ? "Donate" : "Join Us";
  const ctaHref = isCharity ? "/donate" : "/site/join";

  return {
    custom_pages: buildCorePages(template.category),
    header_settings: packHeader(navItems, ctaLabel, ctaHref),
    footer_settings: packFooter(
      "A complete lodge website with visitor information, meetings, charity, membership enquiries, and lodge contact details.",
      ctaLabel,
      ctaHref
    ),
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
        "/site/join",
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
        "/site/charity",
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
        "/site/join",
        7,
        {
          form_mode: "lead",
          form_fields: ["phone", "location", "how_heard", "message", "consent"],
          form_required_fields: ["consent"],
          form_consent_text: "I agree to be contacted by the lodge about my membership enquiry.",
        }
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
        "/site/contact",
        8,
        {
          form_mode: "contact",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the lodge about my enquiry.",
        }
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

export const SECTION_VARIANTS: SectionVariantPreset[] = [
  {
    id: "hero-heritage",
    type: "hero",
    label: "Heritage hero",
    description: "A formal opening with a strong image background and visitor CTA.",
    tone: "classic",
    tags: ["Image background", "Visitor CTA"],
    example: () =>
      s(
        "hero",
        "A lodge with history, fellowship, and purpose",
        "Discover meetings, charity, and fellowship in a lodge rooted in tradition and open to good men of character.",
        "Contact the secretary",
        "#contact-form",
        1,
        { background_position: "center", overlay_opacity: 0.45 }
      ),
  },
  {
    id: "hero-recruitment",
    type: "hero",
    label: "Recruitment hero",
    description: "A direct lead intake section for lodges focused on growth.",
    tone: "conversion",
    tags: ["Lead intake", "Growth"],
    example: () =>
      s(
        "hero",
        "Could Freemasonry be for you?",
        "If you are curious about visiting or joining, start a conversation with our lodge today.",
        "Start enquiry",
        "#lead-intake",
        1,
        { form_mode: "lead", overlay_opacity: 0.5 }
      ),
  },
  {
    id: "about-story",
    type: "about",
    label: "Story and values",
    description: "A polished about section for history, values, and lodge identity.",
    tone: "classic",
    tags: ["Story", "Values"],
    example: () =>
      s(
        "about",
        "Our story",
        "Founded in fellowship and service, our lodge brings members together through ritual, charity, and lasting friendship.",
        "Learn more",
        "/about",
        2,
        { image_position: "right", image_shape: "arch" }
      ),
  },
  {
    id: "about-modern",
    type: "about",
    label: "Modern welcome",
    description: "A concise section for visitors who need quick context.",
    tone: "modern",
    tags: ["Short copy", "Visitor friendly"],
    example: () =>
      s(
        "about",
        "A welcoming lodge for today",
        "We combine tradition with friendship, charitable service, and a practical rhythm that fits modern life.",
        null,
        null,
        2,
        { image_position: "left", image_shape: "rounded" }
      ),
  },
  {
    id: "meeting-visitor",
    type: "meeting_details",
    label: "Visitor meeting guide",
    description: "Clear meeting details for visiting brethren and prospective members.",
    tone: "classic",
    tags: ["Visitors", "Venue"],
    example: () =>
      s(
        "meeting_details",
        "Plan your visit",
        "Find meeting dates, venue details, dress code, dining information, and the best way to contact the secretary before attending.",
        "View events",
        "/events",
        3
      ),
  },
  {
    id: "officers-showcase",
    type: "officers",
    label: "Officer showcase",
    description: "Introduce the current officers and the work they lead.",
    tone: "community",
    tags: ["Officers", "Leadership"],
    example: () =>
      s(
        "officers",
        "This year's officers",
        "Meet the members serving the lodge this year and learn how each office supports our meetings, candidates, charity, and fellowship.",
        null,
        null,
        4
      ),
  },
  {
    id: "charity-impact",
    type: "charity",
    label: "Charity impact",
    description: "A campaign-ready block for fundraising stories and impact.",
    tone: "community",
    tags: ["Campaign", "Impact"],
    example: () =>
      s(
        "charity",
        "Charity in action",
        "Share the causes your lodge supports, the impact already made, and how visitors or members can contribute.",
        "Support our charity",
        "/site/charity",
        5,
        { image_position: "right", image_shape: "rounded" }
      ),
  },
  {
    id: "events-whats-on",
    type: "events",
    label: "What's on",
    description: "A lively events section for meetings, dinners, and charity dates.",
    tone: "modern",
    tags: ["Events", "Calendar"],
    example: () =>
      s(
        "events",
        "Upcoming meetings and events",
        "See our next regular meetings, social evenings, and charity events.",
        "View all events",
        "/events",
        6
      ),
  },
  {
    id: "faq-prospects",
    type: "faq",
    label: "Prospective member FAQ",
    description: "Answers the questions candidates often ask before enquiring.",
    tone: "conversion",
    tags: ["Candidates", "Trust"],
    example: () =>
      s(
        "faq",
        "Questions before you visit",
        "Practical answers about joining, visiting, dress code, costs, and what happens at a lodge meeting.",
        null,
        null,
        7
      ),
  },
  {
    id: "join-lead-intake",
    type: "join",
    label: "Pipeline lead form",
    description: "A complete enquiry block that creates a CRM lead for the lodge pipeline.",
    tone: "conversion",
    tags: ["Lead form", "CRM"],
    example: () =>
      s(
        "join",
        "Start a membership conversation",
        "Tell us a little about yourself and the lodge team will be in touch.",
        "Open enquiry form",
        "#lead-intake",
        8,
        {
          form_mode: "lead",
          form_fields: ["phone", "location", "how_heard", "message", "consent"],
          form_required_fields: ["consent"],
          form_consent_text: "I agree to be contacted by the lodge about my membership enquiry.",
          form_thank_you: "Thanks. Your enquiry has been added to the lodge pipeline.",
        }
      ),
  },
  {
    id: "contact-secretary",
    type: "contact",
    label: "Lodge admin contact form",
    description: "A contact block routed to active lodge admins and the lodge support email.",
    tone: "classic",
    tags: ["Secretary", "Email notification"],
    example: () =>
      s(
        "contact",
        "Contact the lodge secretary",
        "For visiting, joining, dining, or general questions, send a message directly to the lodge admin team.",
        "Send message",
        "#contact-form",
        9,
        {
          form_mode: "contact",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the lodge about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the lodge admin team.",
        }
      ),
  },
];

export const TEMPLATES: TemplatePreset[] = [
  {
    id: "traditional",
    name: "Heritage welcome",
    description: "A polished lodge homepage with a grand hero, clear visiting path, charity story, and contact form.",
    category: "heritage",
    accent: "#1e3a8a",
    tags: ["Heritage", "Balanced", "Visitor friendly"],
    bestFor: "Lodges that want a dignified public site with minimal editing.",
    buildSections: () => [
      s(
        "hero",
        "Welcome to our lodge",
        "A warm public welcome rooted in fellowship, service, and a tradition that still matters today.",
        "Express interest",
        "/site/join",
        1,
        heroStyle(TEMPLATE_IMAGES.heritageHero, 0.58)
      ),
      s(
        "about",
        "A place of friendship, purpose, and service",
        "Introduce your lodge with a short story about who you are, where you meet, and why visitors and candidates receive a warm welcome.",
        null,
        null,
        2,
        styleWith(imageStyle(TEMPLATE_IMAGES.visitorContact, "right", "arch"), {
          background_tone: "soft",
        })
      ),
      s(
        "meeting_details",
        "When we meet",
        "Give visitors the confidence to attend by showing when you meet, what to expect, and how to arrange a visit.",
        "View events",
        "/events",
        3,
        imageStyle(TEMPLATE_IMAGES.lodgeMeeting, "left", "rounded")
      ),
      s(
        "charity",
        "Charity and community",
        "Show the causes you support, the impact members make, and how visitors can learn more or contribute.",
        "Our charity work",
        "/site/charity",
        4,
        styleWith(imageStyle(TEMPLATE_IMAGES.charityWelfare, "right", "rounded"), {
          background_tone: "brand",
        })
      ),
      s(
        "contact",
        "Speak with our team",
        "Route every visitor enquiry straight to the lodge team, with a simple form that feels approachable.",
        "Contact us",
        "/site/contact",
        5,
        {
          form_mode: "contact",
          image_url: TEMPLATE_IMAGES.candidateConversation.src,
          image_alt: TEMPLATE_IMAGES.candidateConversation.alt,
          image_position: "left",
          image_shape: "rounded",
          background_tone: "soft",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the lodge about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the lodge admin team.",
        }
      ),
    ],
  },
  {
    id: "modern",
    name: "Modern visitor journey",
    description: "A clean contemporary site for lodges that want visitors and prospective members to take action.",
    category: "growth",
    accent: "#0f766e",
    tags: ["Modern", "Recruitment", "Events"],
    bestFor: "Lodges that want a modern public presence and more suitable enquiries.",
    buildSections: () => [
      s(
        "hero",
        "A modern lodge with deep roots",
        "Fellowship, charity, and personal growth presented in a clear journey for today's visitors.",
        "Get in touch",
        "/site/contact",
        1,
        heroStyle(TEMPLATE_IMAGES.lodgeWelcome, 0.48, "center")
      ),
      s(
        "about",
        "Who we are",
        "Explain the lodge in plain English: who you welcome, what meetings are like, and what makes the atmosphere special.",
        null,
        null,
        2,
        styleWith(imageStyle(TEMPLATE_IMAGES.candidateConversation, "left", "rounded"), {
          background_tone: "soft",
        })
      ),
      s(
        "events",
        "Upcoming meetings",
        "Help members and visitors understand what is coming up next, from regular meetings to social evenings.",
        "All events",
        "/events",
        3,
        imageStyle(TEMPLATE_IMAGES.lodgeMeeting, "right", "rounded")
      ),
      s(
        "officers",
        "Our officers",
        "Put friendly faces behind the lodge by showing the officers and their responsibilities.",
        null,
        null,
        4,
        imageStyle(TEMPLATE_IMAGES.provinceLeadership, "left", "rounded")
      ),
      s(
        "join",
        "Express interest",
        "Make the next step simple: a short enquiry form creates a lead and alerts the right lodge team.",
        "Start the conversation",
        "/site/join",
        5,
        {
          form_mode: "lead",
          image_url: TEMPLATE_IMAGES.visitorContact.src,
          image_alt: TEMPLATE_IMAGES.visitorContact.alt,
          image_position: "right",
          image_shape: "rounded",
          background_tone: "brand",
          form_fields: ["phone", "location", "how_heard", "message", "consent"],
          form_required_fields: ["consent"],
          form_consent_text: "I agree to be contacted by the lodge about my membership enquiry.",
          form_thank_you: "Thanks. Your enquiry has been added to the lodge pipeline.",
        }
      ),
    ],
  },
  {
    id: "charity-led",
    name: "Charity showcase",
    description: "A high-impact site for lodges that want their community work and campaigns to lead the story.",
    category: "charity",
    accent: "#be123c",
    tags: ["Charity", "Community", "Campaigns"],
    bestFor: "Lodges with active fundraising, visible community work, or a major appeal.",
    buildSections: () => [
      s(
        "hero",
        "Service before self",
        "A bold homepage for showing the good your lodge does, the causes you support, and how people can help.",
        "Support our work",
        "/site/charity",
        1,
        heroStyle(TEMPLATE_IMAGES.charityWelfare, 0.54)
      ),
      s(
        "charity",
        "Current charity campaigns",
        "Promote live appeals, meeting collections, Gift Aid, and the local causes your members support.",
        "View campaigns",
        "/site/charity",
        2,
        styleWith(imageStyle(TEMPLATE_IMAGES.charityGiving, "right", "rounded"), {
          background_tone: "soft",
        })
      ),
      s(
        "about",
        "Why we do this",
        "Connect the campaign back to lodge values so visitors understand that charity is part of the culture, not an add-on.",
        null,
        null,
        3,
        imageStyle(TEMPLATE_IMAGES.candidateConversation, "left", "rounded")
      ),
      s(
        "events",
        "Upcoming meetings",
        "Make meetings and social events part of the campaign journey, with clear next steps for visitors.",
        "Events",
        "/events",
        4,
        imageStyle(TEMPLATE_IMAGES.lodgeMeeting, "right", "rounded")
      ),
      s(
        "contact",
        "Get in touch",
        "Let donors, visitors, and local partners contact the lodge team directly from the page.",
        "Contact us",
        "/site/contact",
        5,
        {
          form_mode: "contact",
          image_url: TEMPLATE_IMAGES.visitorContact.src,
          image_alt: TEMPLATE_IMAGES.visitorContact.alt,
          image_position: "left",
          image_shape: "rounded",
          background_tone: "soft",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the lodge about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the lodge admin team.",
        }
      ),
    ],
  },
  {
    id: "history-heritage",
    name: "History & heritage",
    description:
      "Deep dive into your lodge's story: founding, notable members, banner, and ritual heritage.",
    category: "heritage",
    accent: "#92400e",
    tags: ["History", "Past Masters", "Visitors"],
    bestFor: "Older lodges with a strong story to tell.",
    buildSections: () => [
      s(
        "hero",
        "A heritage worth honouring",
        "Founded in fellowship, sustained by service, our lodge has been a part of this community for generations.",
        "Our story",
        "#about",
        1,
        heroStyle(TEMPLATE_IMAGES.heritageHero, 0.6)
      ),
      s(
        "about",
        "Our founding",
        "Consecrated under the United Grand Lodge of England, we trace our origins to brothers committed to friendship, morality and brotherly love.",
        null,
        null,
        2,
        imageStyle(TEMPLATE_IMAGES.heritageHero, "right", "rounded")
      ),
      s(
        "about",
        "Notable members and milestones",
        "Past Masters and benefactors who shaped our lodge. Use this space to celebrate them.",
        null,
        null,
        3,
        imageStyle(TEMPLATE_IMAGES.officersFormal, "left", "arch")
      ),
      s(
        "officers",
        "Past Masters",
        "An unbroken chain of leadership stretching back to consecration.",
        null,
        null,
        4,
        imageStyle(TEMPLATE_IMAGES.provinceLeadership, "right", "rounded")
      ),
      s(
        "contact",
        "Visiting brethren welcome",
        "If you wish to research our records or visit, please reach out.",
        "Contact secretary",
        "/site/contact",
        5,
        {
          form_mode: "contact",
          image_url: TEMPLATE_IMAGES.visitorContact.src,
          image_alt: TEMPLATE_IMAGES.visitorContact.alt,
          image_position: "left",
          image_shape: "rounded",
          background_tone: "soft",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the lodge about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the lodge admin team.",
        }
      ),
    ],
  },
  {
    id: "officers-team",
    name: "Officers & ritual",
    description:
      "Foreground this year's officers, their roles, and ritual responsibilities.",
    category: "operations",
    accent: "#047857",
    tags: ["Officers", "Meetings", "Ritual"],
    bestFor: "Lodges that want to showcase leadership and meeting rhythm.",
    buildSections: () => [
      s(
        "hero",
        "This year's team",
        "Meet the officers of the lodge for the current Masonic year.",
        "Meet the team",
        "#officers",
        1,
        heroStyle(TEMPLATE_IMAGES.officersFormal, 0.55)
      ),
      s(
        "officers",
        "Officers of the lodge",
        "Each office serves a specific role in the work of the lodge. The list below is kept up-to-date automatically from our register.",
        null,
        null,
        2,
        imageStyle(TEMPLATE_IMAGES.provinceLeadership, "right", "rounded")
      ),
      s(
        "meeting_details",
        "When we meet",
        "Regular meetings, lodge of instruction, and rehearsal dates.",
        "View calendar",
        "/events",
        3,
        imageStyle(TEMPLATE_IMAGES.lodgeMeeting, "left", "rounded")
      ),
      s(
        "events",
        "Upcoming meetings",
        "What's on next.",
        "All events",
        "/events",
        4,
        imageStyle(TEMPLATE_IMAGES.lodgeWelcome, "right", "rounded")
      ),
      s(
        "contact",
        "Speak with an officer",
        "Get in touch with the secretary, treasurer, or charity steward directly.",
        "Contact",
        "/site/contact",
        5,
        {
          form_mode: "contact",
          image_url: TEMPLATE_IMAGES.candidateConversation.src,
          image_alt: TEMPLATE_IMAGES.candidateConversation.alt,
          image_position: "left",
          image_shape: "rounded",
          background_tone: "soft",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the lodge about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the lodge admin team.",
        }
      ),
    ],
  },
  {
    id: "charity-campaign",
    name: "Charity campaign launch",
    description:
      "Drive a single campaign with a strong call-to-action and Gift Aid story.",
    category: "charity",
    accent: "#dc2626",
    tags: ["Fundraising", "Gift Aid", "Campaign"],
    bestFor: "A specific appeal or festival campaign.",
    buildSections: () => [
      s(
        "hero",
        "Help us reach our goal",
        "Donate today, with Gift Aid your gift goes 25% further.",
        "Donate now",
        "/donate",
        1,
        heroStyle(TEMPLATE_IMAGES.charityGiving, 0.52)
      ),
      s(
        "charity",
        "About this campaign",
        "What we are raising for, why it matters, and how the funds will be used. Add photos and a target.",
        "Donate",
        "/donate",
        2,
        imageStyle(TEMPLATE_IMAGES.charityWelfare, "right", "rounded")
      ),
      s(
        "about",
        "Why we give",
        "Charity is at the heart of Freemasonry. This campaign continues a centuries-old tradition.",
        null,
        null,
        3,
        imageStyle(TEMPLATE_IMAGES.candidateConversation, "left", "rounded")
      ),
      s(
        "events",
        "Charity events",
        "Festive boards, walks, and dinners in support of the campaign.",
        "All events",
        "/events",
        4,
        imageStyle(TEMPLATE_IMAGES.lodgeMeeting, "right", "rounded")
      ),
      s(
        "contact",
        "Talk to the Charity Steward",
        "Have a story to share, or want to support in kind?",
        "Get in touch",
        "/site/contact",
        5,
        {
          form_mode: "contact",
          image_url: TEMPLATE_IMAGES.visitorContact.src,
          image_alt: TEMPLATE_IMAGES.visitorContact.alt,
          image_position: "left",
          image_shape: "rounded",
          background_tone: "soft",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the lodge about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the lodge admin team.",
        }
      ),
    ],
  },
  {
    id: "contact-first",
    name: "Simple launch",
    description:
      "A quick, elegant site for lodges that need a beautiful live page without much editing.",
    category: "operations",
    accent: "#0369a1",
    tags: ["Simple", "Contact", "Venue"],
    bestFor: "Lodges that want to launch today and refine later.",
    buildSections: () => [
      s(
        "hero",
        "Welcome to the lodge",
        "A clear, friendly homepage with the essential information visitors need.",
        "Contact us",
        "/site/contact",
        1,
        heroStyle(TEMPLATE_IMAGES.visitorContact, 0.56)
      ),
      s(
        "contact",
        "Get in touch",
        "Send a message to the lodge team about visiting, joining, dining, or general enquiries.",
        "Email the secretary",
        "/site/contact",
        2,
        {
          form_mode: "contact",
          image_url: TEMPLATE_IMAGES.candidateConversation.src,
          image_alt: TEMPLATE_IMAGES.candidateConversation.alt,
          image_position: "right",
          image_shape: "rounded",
          background_tone: "soft",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the lodge about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the lodge admin team.",
        }
      ),
      s(
        "meeting_details",
        "Where we meet",
        "Show the meeting venue, parking notes, accessibility information, and what visitors should expect.",
        null,
        null,
        3,
        imageStyle(TEMPLATE_IMAGES.lodgeMeeting, "left", "rounded")
      ),
    ],
  },
  {
    id: "recruitment",
    name: "Candidate pathway",
    description: "Designed to guide curious visitors from first question to a warm lodge conversation.",
    category: "growth",
    accent: "#7c3aed",
    tags: ["Lead intake", "FAQ", "Growth"],
    bestFor: "Lodges that want more suitable candidate enquiries without overwhelming visitors.",
    buildSections: () => [
      s(
        "hero",
        "Could Freemasonry be for you?",
        "A calm, friendly introduction for people who are curious but not yet ready to commit.",
        "Express interest",
        "/site/join",
        1,
        heroStyle(TEMPLATE_IMAGES.candidateConversation, 0.5)
      ),
      s(
        "about",
        "What it means to be a Freemason",
        "Explain the values, friendships, charity, and personal growth in language a first-time visitor understands.",
        null,
        null,
        2,
        imageStyle(TEMPLATE_IMAGES.visitorContact, "right", "rounded")
      ),
      s(
        "faq",
        "Common questions",
        "Answer the practical questions most people have before they speak to a lodge.",
        null,
        null,
        3,
        {
          background_tone: "soft",
          spacing: "spacious",
        }
      ),
      s(
        "meeting_details",
        "Meet us",
        "Set expectations around visiting, informal conversations, social events, and what happens next.",
        "When we meet",
        "/events",
        4,
        imageStyle(TEMPLATE_IMAGES.lodgeMeeting, "left", "rounded")
      ),
      s(
        "join",
        "Take the next step",
        "A short form routes the candidate into the lodge pipeline and alerts the right team.",
        "Express interest",
        "/site/join",
        5,
        {
          form_mode: "lead",
          image_url: TEMPLATE_IMAGES.lodgeWelcome.src,
          image_alt: TEMPLATE_IMAGES.lodgeWelcome.alt,
          image_position: "right",
          image_shape: "rounded",
          background_tone: "brand",
          form_fields: ["phone", "location", "how_heard", "message", "consent"],
          form_required_fields: ["consent"],
          form_consent_text: "I agree to be contacted by the lodge about my membership enquiry.",
          form_thank_you: "Thanks. Your enquiry has been added to the lodge pipeline.",
        }
      ),
    ],
  },
];
