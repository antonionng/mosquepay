import type {
  ChurchSiteCustomPage,
  ChurchSiteFooterSettings,
  ChurchSiteHeaderSettings,
  ChurchSiteSection,
} from "@/lib/db/types";

type TemplatePreset = {
  id: string;
  name: string;
  description: string;
  category?: "heritage" | "growth" | "charity" | "operations";
  accent?: string;
  tags?: string[];
  bestFor?: string;
  buildSections: () => ChurchSiteSection[];
};

export type TemplateSitePack = {
  custom_pages: ChurchSiteCustomPage[];
  header_settings: ChurchSiteHeaderSettings;
  footer_settings: ChurchSiteFooterSettings;
};

export type SectionVariantPreset = {
  id: string;
  type: ChurchSiteSection["type"];
  label: string;
  description: string;
  tone: "classic" | "modern" | "conversion" | "community";
  tags: string[];
  example: () => ChurchSiteSection;
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
    alt: "Church members in a traditional church room",
  },
  churchWelcome: {
    src: "/site-template-images/newcomersor-contact.png",
    alt: "Church members welcoming newcomers",
  },
  churchService: {
    src: "/site-template-images/officers-formal.png",
    alt: "Formal church service with officers",
  },
  newcomerConversation: {
    src: "/site-template-images/newcomer-conversation.png",
    alt: "Church members discussing newcomer enquiries",
  },
  networkNewcomerership: {
    src: "/site-template-images/network-newcomerership.png",
    alt: "Church officers in formal dress",
  },
  charityGiving: {
    src: "/site-template-images/charity-pastoral.png",
    alt: "Church members supporting charity and pastoral work",
  },
  officersFormal: {
    src: "/site-template-images/officers-formal.png",
    alt: "Formal church officers in the church room",
  },
  charityPastoralCare: {
    src: "/site-template-images/charity-pastoral.png",
    alt: "Church members discussing charity and pastoral support",
  },
  newcomerContact: {
    src: "/site-template-images/newcomersor-contact.png",
    alt: "Church members welcoming newcomers",
  },
} as const;

type TemplateImage = (typeof TEMPLATE_IMAGES)[keyof typeof TEMPLATE_IMAGES];

function heroStyle(
  image: TemplateImage,
  overlayOpacity = 0.52,
  backgroundPosition = "center"
): NonNullable<ChurchSiteSection["style"]> {
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
  imagePosition: NonNullable<NonNullable<ChurchSiteSection["style"]>["image_position"]> = "right",
  imageShape: NonNullable<NonNullable<ChurchSiteSection["style"]>["image_shape"]> = "rounded"
): NonNullable<ChurchSiteSection["style"]> {
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
  style: NonNullable<ChurchSiteSection["style"]>,
  overrides: NonNullable<ChurchSiteSection["style"]>
): NonNullable<ChurchSiteSection["style"]> {
  return { ...style, ...overrides };
}

function s(
  type: ChurchSiteSection["type"],
  heading: string,
  body: string,
  ctaLabel: string | null,
  ctaHref: string | null,
  order: number,
  style: ChurchSiteSection["style"] = null
): ChurchSiteSection {
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
  sections: ChurchSiteSection[],
  navLabel = title
): ChurchSiteCustomPage {
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
): ChurchSiteHeaderSettings {
  return {
    show_logo: true,
    show_church_name: true,
    show_church_number: true,
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
): ChurchSiteFooterSettings {
  return {
    show_logo: true,
    show_church_name: true,
    show_church_number: true,
    show_contact_details: true,
    tagline,
    badge_text: "Official church website",
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

function buildCorePages(kind: TemplatePreset["category"] = "heritage"): ChurchSiteCustomPage[] {
  const aboutTone = kind === "growth" ? TEMPLATE_IMAGES.newcomerConversation : TEMPLATE_IMAGES.heritageHero;
  const charityTone = kind === "charity" ? TEMPLATE_IMAGES.charityGiving : TEMPLATE_IMAGES.charityPastoralCare;
  return [
    page(
      "about",
      "About the church",
      "Learn about the church, its values, service rhythm, charity, and welcome for newcomers.",
      1,
      [
        s(
          "hero",
          "About our church",
          "A public introduction to our history, fellowship, charitable work, and place in the community.",
        "Plan a visit",
        "/events",
          1,
          heroStyle(aboutTone, 0.55)
        ),
        s(
          "about",
          "Our story and values",
          "Use this page to tell newcomers what makes the church distinctive: its history, character, members, and charitable aims.",
          null,
          null,
          2,
          imageStyle(TEMPLATE_IMAGES.newcomerContact, "right", "arch")
        ),
        s(
          "service_details",
          "Services and newcomer",
          "Explain when the church meets, who to contact before newcomer, dress expectations, dining, and venue details.",
          "View events",
          "/events",
          3,
          imageStyle(TEMPLATE_IMAGES.churchService, "left", "rounded")
        ),
      ]
    ),
    page(
      "join",
      "Join or visit",
      "A friendly page for prospective members to learn more and submit an enquiry to the church pipeline.",
      2,
      [
        s(
          "hero",
          "Could church life be for you?",
          "If you are curious about newcomer or joining, start a conversation with the church.",
          "Start an enquiry",
          "#newcomer-intake",
          1,
          heroStyle(TEMPLATE_IMAGES.newcomerConversation, 0.5)
        ),
        s(
          "faq",
          "Common questions before you visit",
          "Answer practical questions about newcomer, joining, costs, time commitment, dress code, and what happens next.",
          null,
          null,
          2,
          { background_tone: "soft", spacing: "spacious" }
        ),
        s(
          "join",
          "Start a membership conversation",
          "Tell us a little about yourself and the church team will follow up personally.",
          "Express interest",
          "#newcomer-intake",
          3,
          {
            form_mode: "newcomer",
            image_url: TEMPLATE_IMAGES.churchWelcome.src,
            image_alt: TEMPLATE_IMAGES.churchWelcome.alt,
            image_position: "right",
            image_shape: "rounded",
            background_tone: "brand",
            form_fields: ["phone", "location", "how_heard", "message", "consent"],
            form_required_fields: ["consent"],
            form_consent_text: "I agree to be contacted by the church about my membership enquiry.",
            form_thank_you: "Thanks. Your enquiry has been added to the church pipeline.",
          }
        ),
      ],
      "Join"
    ),
    page(
      "contact",
      "Contact the church",
      "Send a message to the church admin team about newcomer, joining, dining, charity, or general enquiries.",
      3,
      [
        s(
          "hero",
          "Contact the church",
          "Reach the secretary and church admin team for newcomer, joining, dining, or general questions.",
          "Send a message",
          "#contact-form",
          1,
          heroStyle(TEMPLATE_IMAGES.newcomerContact, 0.54)
        ),
        s(
          "contact",
          "Send a message",
          "Your message will go to the active church admins and configured church contact email.",
          "Contact the secretary",
          "#contact-form",
          2,
          {
            form_mode: "contact",
            image_url: TEMPLATE_IMAGES.newcomerConversation.src,
            image_alt: TEMPLATE_IMAGES.newcomerConversation.alt,
            image_position: "left",
            image_shape: "rounded",
            background_tone: "soft",
            form_fields: ["phone", "subject", "message", "consent"],
            form_required_fields: ["message", "consent"],
            form_consent_text: "I agree to be contacted by the church about my enquiry.",
            form_thank_you: "Thanks. Your message has been sent to the church admin team.",
          }
        ),
      ],
      "Contact"
    ),
    page(
      "charity",
      "Charity and community",
      "Show the church's charitable work, community support, campaigns, and fundraising activity.",
      4,
      [
        s(
          "hero",
          "Charity and community",
          "Our charitable work connects church values with practical support for good causes.",
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
      "A complete church website with newcomer information, services, charity, membership enquiries, and church contact details.",
      ctaLabel,
      ctaHref
    ),
  };
}

export const SECTION_PRESETS: Array<{
  type: ChurchSiteSection["type"];
  label: string;
  description: string;
  example: () => ChurchSiteSection;
}> = [
  {
    type: "hero",
    label: "Hero banner",
    description: "Headline, brief intro, and primary call to action.",
    example: () =>
      s(
        "hero",
        "Welcome to your church",
        "A modern memberhood with deep heritage. Discover services, charity, and fellowship.",
        "Express interest",
        "/site/join",
        1
      ),
  },
  {
    type: "about",
    label: "About",
    description: "Short paragraph about the church identity and values.",
    example: () =>
      s(
        "about",
        "About the church",
        "Founded in fellowship and service, we welcome members from all backgrounds.",
        null,
        null,
        2
      ),
  },
  {
    type: "service_details",
    label: "Service times",
    description: "Where and when the church meets.",
    example: () =>
      s(
        "service_details",
        "When we meet",
        "Regular services on the third Thursday of each month at Mark members' Hall.",
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
        "Our officers serve the church and represent our values throughout the year.",
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
    label: "Upcoming services",
    description: "Live list of upcoming services, pulled from the platform.",
    example: () =>
      s(
        "events",
        "Upcoming services",
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
          form_mode: "newcomer",
          form_fields: ["phone", "location", "how_heard", "message", "consent"],
          form_required_fields: ["consent"],
          form_consent_text: "I agree to be contacted by the church about my membership enquiry.",
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
          form_consent_text: "I agree to be contacted by the church about my enquiry.",
        }
      ),
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Answer common questions for prospective members and newcomers.",
    example: () =>
      s(
        "faq",
        "Frequently asked questions",
        "Answers to common questions about newcomer, joining, and what to expect.",
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
    description: "A formal opening with a strong image background and newcomer CTA.",
    tone: "classic",
    tags: ["Image background", "Newcomer CTA"],
    example: () =>
      s(
        "hero",
        "A church with history, fellowship, and purpose",
        "Discover services, charity, and fellowship in a church rooted in tradition and open to good men of character.",
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
    description: "A direct newcomer intake section for churches focused on growth.",
    tone: "conversion",
    tags: ["Newcomer intake", "Growth"],
    example: () =>
      s(
        "hero",
        "Could church life be for you?",
        "If you are curious about newcomer or joining, start a conversation with our church today.",
        "Start enquiry",
        "#newcomer-intake",
        1,
        { form_mode: "newcomer", overlay_opacity: 0.5 }
      ),
  },
  {
    id: "about-story",
    type: "about",
    label: "Story and values",
    description: "A polished about section for history, values, and church identity.",
    tone: "classic",
    tags: ["Story", "Values"],
    example: () =>
      s(
        "about",
        "Our story",
        "Founded in fellowship and service, our church brings members together through ritual, charity, and lasting friendship.",
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
    description: "A concise section for newcomers who need quick context.",
    tone: "modern",
    tags: ["Short copy", "Newcomer friendly"],
    example: () =>
      s(
        "about",
        "A welcoming church for today",
        "We combine tradition with friendship, charitable service, and a practical rhythm that fits modern life.",
        null,
        null,
        2,
        { image_position: "left", image_shape: "rounded" }
      ),
  },
  {
    id: "service-newcomer",
    type: "service_details",
    label: "Newcomer service guide",
    description: "Clear service details for newcomer members and prospective members.",
    tone: "classic",
    tags: ["Newcomers", "Venue"],
    example: () =>
      s(
        "service_details",
        "Plan your visit",
        "Find service dates, venue details, dress code, dining information, and the best way to contact the secretary before attending.",
        "View events",
        "/events",
        3
      ),
  },
  {
    id: "officers-showcase",
    type: "officers",
    label: "Officer showcase",
    description: "Introduce the current officers and the work they newcomer.",
    tone: "community",
    tags: ["Officers", "Newcomerership"],
    example: () =>
      s(
        "officers",
        "This year's officers",
        "Meet the members serving the church this year and learn how each office supports our services, newcomers, charity, and fellowship.",
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
        "Share the causes your church supports, the impact already made, and how newcomers or members can contribute.",
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
    description: "A lively events section for services, dinners, and charity dates.",
    tone: "modern",
    tags: ["Events", "Calendar"],
    example: () =>
      s(
        "events",
        "Upcoming services and events",
        "See our next regular services, social evenings, and charity events.",
        "View all events",
        "/events",
        6
      ),
  },
  {
    id: "faq-prospects",
    type: "faq",
    label: "Prospective member FAQ",
    description: "Answers the questions newcomers often ask before enquiring.",
    tone: "conversion",
    tags: ["Newcomers", "Trust"],
    example: () =>
      s(
        "faq",
        "Questions before you visit",
        "Practical answers about joining, newcomer, dress code, costs, and what happens at a church service.",
        null,
        null,
        7
      ),
  },
  {
    id: "join-newcomer-intake",
    type: "join",
    label: "Pipeline newcomer form",
    description: "A complete enquiry block that creates a CRM newcomer for the church pipeline.",
    tone: "conversion",
    tags: ["Newcomer form", "CRM"],
    example: () =>
      s(
        "join",
        "Start a membership conversation",
        "Tell us a little about yourself and the church team will be in touch.",
        "Open enquiry form",
        "#newcomer-intake",
        8,
        {
          form_mode: "newcomer",
          form_fields: ["phone", "location", "how_heard", "message", "consent"],
          form_required_fields: ["consent"],
          form_consent_text: "I agree to be contacted by the church about my membership enquiry.",
          form_thank_you: "Thanks. Your enquiry has been added to the church pipeline.",
        }
      ),
  },
  {
    id: "contact-secretary",
    type: "contact",
    label: "Church admin contact form",
    description: "A contact block routed to active church admins and the church support email.",
    tone: "classic",
    tags: ["Secretary", "Email notification"],
    example: () =>
      s(
        "contact",
        "Contact the church secretary",
        "For newcomer, joining, dining, or general questions, send a message directly to the church admin team.",
        "Send message",
        "#contact-form",
        9,
        {
          form_mode: "contact",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the church about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the church admin team.",
        }
      ),
  },
];

export const TEMPLATES: TemplatePreset[] = [
  {
    id: "traditional",
    name: "Heritage welcome",
    description: "A polished church homepage with a grand hero, clear newcomer path, charity story, and contact form.",
    category: "heritage",
    accent: "#1e3a8a",
    tags: ["Heritage", "Balanced", "Newcomer friendly"],
    bestFor: "Churches that want a dignified public site with minimal editing.",
    buildSections: () => [
      s(
        "hero",
        "Welcome to our church",
        "A warm public welcome rooted in fellowship, service, and a tradition that still matters today.",
        "Express interest",
        "/site/join",
        1,
        heroStyle(TEMPLATE_IMAGES.heritageHero, 0.58)
      ),
      s(
        "about",
        "A place of friendship, purpose, and service",
        "Introduce your church with a short story about who you are, where you meet, and why newcomers and newcomers receive a warm welcome.",
        null,
        null,
        2,
        styleWith(imageStyle(TEMPLATE_IMAGES.newcomerContact, "right", "arch"), {
          background_tone: "soft",
        })
      ),
      s(
        "service_details",
        "When we meet",
        "Give newcomers the confidence to attend by showing when you meet, what to expect, and how to arrange a visit.",
        "View events",
        "/events",
        3,
        imageStyle(TEMPLATE_IMAGES.churchService, "left", "rounded")
      ),
      s(
        "charity",
        "Charity and community",
        "Show the causes you support, the impact members make, and how newcomers can learn more or contribute.",
        "Our charity work",
        "/site/charity",
        4,
        styleWith(imageStyle(TEMPLATE_IMAGES.charityPastoralCare, "right", "rounded"), {
          background_tone: "brand",
        })
      ),
      s(
        "contact",
        "Speak with our team",
        "Route every newcomer enquiry straight to the church team, with a simple form that feels approachable.",
        "Contact us",
        "/site/contact",
        5,
        {
          form_mode: "contact",
          image_url: TEMPLATE_IMAGES.newcomerConversation.src,
          image_alt: TEMPLATE_IMAGES.newcomerConversation.alt,
          image_position: "left",
          image_shape: "rounded",
          background_tone: "soft",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the church about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the church admin team.",
        }
      ),
    ],
  },
  {
    id: "modern",
    name: "Modern newcomer journey",
    description: "A clean contemporary site for churches that want newcomers and prospective members to take action.",
    category: "growth",
    accent: "#0f766e",
    tags: ["Modern", "Recruitment", "Events"],
    bestFor: "Churches that want a modern public presence and more suitable enquiries.",
    buildSections: () => [
      s(
        "hero",
        "A modern church with deep roots",
        "Fellowship, charity, and personal growth presented in a clear journey for today's newcomers.",
        "Get in touch",
        "/site/contact",
        1,
        heroStyle(TEMPLATE_IMAGES.churchWelcome, 0.48, "center")
      ),
      s(
        "about",
        "Who we are",
        "Explain the church in plain English: who you welcome, what services are like, and what makes the atmosphere special.",
        null,
        null,
        2,
        styleWith(imageStyle(TEMPLATE_IMAGES.newcomerConversation, "left", "rounded"), {
          background_tone: "soft",
        })
      ),
      s(
        "events",
        "Upcoming services",
        "Help members and newcomers understand what is coming up next, from regular services to social evenings.",
        "All events",
        "/events",
        3,
        imageStyle(TEMPLATE_IMAGES.churchService, "right", "rounded")
      ),
      s(
        "officers",
        "Our officers",
        "Put friendly faces behind the church by showing the officers and their responsibilities.",
        null,
        null,
        4,
        imageStyle(TEMPLATE_IMAGES.networkNewcomerership, "left", "rounded")
      ),
      s(
        "join",
        "Express interest",
        "Make the next step simple: a short enquiry form creates a newcomer and alerts the right church team.",
        "Start the conversation",
        "/site/join",
        5,
        {
          form_mode: "newcomer",
          image_url: TEMPLATE_IMAGES.newcomerContact.src,
          image_alt: TEMPLATE_IMAGES.newcomerContact.alt,
          image_position: "right",
          image_shape: "rounded",
          background_tone: "brand",
          form_fields: ["phone", "location", "how_heard", "message", "consent"],
          form_required_fields: ["consent"],
          form_consent_text: "I agree to be contacted by the church about my membership enquiry.",
          form_thank_you: "Thanks. Your enquiry has been added to the church pipeline.",
        }
      ),
    ],
  },
  {
    id: "charity-led",
    name: "Charity showcase",
    description: "A high-impact site for churches that want their community work and campaigns to newcomer the story.",
    category: "charity",
    accent: "#be123c",
    tags: ["Charity", "Community", "Campaigns"],
    bestFor: "Churches with active fundraising, visible community work, or a major appeal.",
    buildSections: () => [
      s(
        "hero",
        "Service before self",
        "A bold homepage for showing the good your church does, the causes you support, and how people can help.",
        "Support our work",
        "/site/charity",
        1,
        heroStyle(TEMPLATE_IMAGES.charityPastoralCare, 0.54)
      ),
      s(
        "charity",
        "Current charity campaigns",
        "Promote live appeals, service collections, Gift Aid, and the local causes your members support.",
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
        "Connect the campaign back to church values so newcomers understand that charity is part of the culture, not an add-on.",
        null,
        null,
        3,
        imageStyle(TEMPLATE_IMAGES.newcomerConversation, "left", "rounded")
      ),
      s(
        "events",
        "Upcoming services",
        "Make services and social events part of the campaign journey, with clear next steps for newcomers.",
        "Events",
        "/events",
        4,
        imageStyle(TEMPLATE_IMAGES.churchService, "right", "rounded")
      ),
      s(
        "contact",
        "Get in touch",
        "Let donors, newcomers, and local partners contact the church team directly from the page.",
        "Contact us",
        "/site/contact",
        5,
        {
          form_mode: "contact",
          image_url: TEMPLATE_IMAGES.newcomerContact.src,
          image_alt: TEMPLATE_IMAGES.newcomerContact.alt,
          image_position: "left",
          image_shape: "rounded",
          background_tone: "soft",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the church about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the church admin team.",
        }
      ),
    ],
  },
  {
    id: "history-heritage",
    name: "History & heritage",
    description:
      "Deep dive into your church's story: founding, notable members, banner, and ritual heritage.",
    category: "heritage",
    accent: "#92400e",
    tags: ["History", "Past Masters", "Newcomers"],
    bestFor: "Older churches with a strong story to tell.",
    buildSections: () => [
      s(
        "hero",
        "A heritage worth honouring",
        "Founded in fellowship, sustained by service, our church has been a part of this community for generations.",
        "Our story",
        "#about",
        1,
        heroStyle(TEMPLATE_IMAGES.heritageHero, 0.6)
      ),
      s(
        "about",
        "Our founding",
        "Consecrated under the United Grand Church of England, we trace our origins to members committed to friendship, morality and memberly love.",
        null,
        null,
        2,
        imageStyle(TEMPLATE_IMAGES.heritageHero, "right", "rounded")
      ),
      s(
        "about",
        "Notable members and milestones",
        "Past Masters and benefactors who shaped our church. Use this space to celebrate them.",
        null,
        null,
        3,
        imageStyle(TEMPLATE_IMAGES.officersFormal, "left", "arch")
      ),
      s(
        "officers",
        "Past Masters",
        "An unbroken chain of newcomerership stretching back to consecration.",
        null,
        null,
        4,
        imageStyle(TEMPLATE_IMAGES.networkNewcomerership, "right", "rounded")
      ),
      s(
        "contact",
        "Newcomer members welcome",
        "If you wish to research our records or visit, please reach out.",
        "Contact secretary",
        "/site/contact",
        5,
        {
          form_mode: "contact",
          image_url: TEMPLATE_IMAGES.newcomerContact.src,
          image_alt: TEMPLATE_IMAGES.newcomerContact.alt,
          image_position: "left",
          image_shape: "rounded",
          background_tone: "soft",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the church about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the church admin team.",
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
    tags: ["Officers", "Services", "Ritual"],
    bestFor: "Churches that want to showcase newcomerership and service rhythm.",
    buildSections: () => [
      s(
        "hero",
        "This year's team",
        "Meet the officers of the church for the current Giving year.",
        "Meet the team",
        "#officers",
        1,
        heroStyle(TEMPLATE_IMAGES.officersFormal, 0.55)
      ),
      s(
        "officers",
        "Officers of the church",
        "Each office serves a specific role in the work of the church. The list below is kept up-to-date automatically from our register.",
        null,
        null,
        2,
        imageStyle(TEMPLATE_IMAGES.networkNewcomerership, "right", "rounded")
      ),
      s(
        "service_details",
        "When we meet",
        "Regular services, church of instruction, and rehearsal dates.",
        "View calendar",
        "/events",
        3,
        imageStyle(TEMPLATE_IMAGES.churchService, "left", "rounded")
      ),
      s(
        "events",
        "Upcoming services",
        "What's on next.",
        "All events",
        "/events",
        4,
        imageStyle(TEMPLATE_IMAGES.churchWelcome, "right", "rounded")
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
          image_url: TEMPLATE_IMAGES.newcomerConversation.src,
          image_alt: TEMPLATE_IMAGES.newcomerConversation.alt,
          image_position: "left",
          image_shape: "rounded",
          background_tone: "soft",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the church about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the church admin team.",
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
        imageStyle(TEMPLATE_IMAGES.charityPastoralCare, "right", "rounded")
      ),
      s(
        "about",
        "Why we give",
        "Charity is at the heart of church life. This campaign continues a centuries-old tradition.",
        null,
        null,
        3,
        imageStyle(TEMPLATE_IMAGES.newcomerConversation, "left", "rounded")
      ),
      s(
        "events",
        "Charity events",
        "Festive boards, walks, and dinners in support of the campaign.",
        "All events",
        "/events",
        4,
        imageStyle(TEMPLATE_IMAGES.churchService, "right", "rounded")
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
          image_url: TEMPLATE_IMAGES.newcomerContact.src,
          image_alt: TEMPLATE_IMAGES.newcomerContact.alt,
          image_position: "left",
          image_shape: "rounded",
          background_tone: "soft",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the church about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the church admin team.",
        }
      ),
    ],
  },
  {
    id: "contact-first",
    name: "Simple launch",
    description:
      "A quick, elegant site for churches that need a beautiful live page without much editing.",
    category: "operations",
    accent: "#0369a1",
    tags: ["Simple", "Contact", "Venue"],
    bestFor: "Churches that want to launch today and refine later.",
    buildSections: () => [
      s(
        "hero",
        "Welcome to the church",
        "A clear, friendly homepage with the essential information newcomers need.",
        "Contact us",
        "/site/contact",
        1,
        heroStyle(TEMPLATE_IMAGES.newcomerContact, 0.56)
      ),
      s(
        "contact",
        "Get in touch",
        "Send a message to the church team about newcomer, joining, dining, or general enquiries.",
        "Email the secretary",
        "/site/contact",
        2,
        {
          form_mode: "contact",
          image_url: TEMPLATE_IMAGES.newcomerConversation.src,
          image_alt: TEMPLATE_IMAGES.newcomerConversation.alt,
          image_position: "right",
          image_shape: "rounded",
          background_tone: "soft",
          form_fields: ["phone", "subject", "message", "consent"],
          form_required_fields: ["message", "consent"],
          form_consent_text: "I agree to be contacted by the church about my enquiry.",
          form_thank_you: "Thanks. Your message has been sent to the church admin team.",
        }
      ),
      s(
        "service_details",
        "Where we meet",
        "Show the service venue, parking notes, accessibility information, and what newcomers should expect.",
        null,
        null,
        3,
        imageStyle(TEMPLATE_IMAGES.churchService, "left", "rounded")
      ),
    ],
  },
  {
    id: "recruitment",
    name: "Newcomer pathway",
    description: "Designed to guide curious newcomers from first question to a warm church conversation.",
    category: "growth",
    accent: "#7c3aed",
    tags: ["Newcomer intake", "FAQ", "Growth"],
    bestFor: "Churches that want more suitable newcomer enquiries without overwhelming newcomers.",
    buildSections: () => [
      s(
        "hero",
        "Could church life be for you?",
        "A calm, friendly introduction for people who are curious but not yet ready to commit.",
        "Express interest",
        "/site/join",
        1,
        heroStyle(TEMPLATE_IMAGES.newcomerConversation, 0.5)
      ),
      s(
        "about",
        "What it means to be a church member",
        "Explain the values, friendships, charity, and personal growth in language a first-time newcomer understands.",
        null,
        null,
        2,
        imageStyle(TEMPLATE_IMAGES.newcomerContact, "right", "rounded")
      ),
      s(
        "faq",
        "Common questions",
        "Answer the practical questions most people have before they speak to a church.",
        null,
        null,
        3,
        {
          background_tone: "soft",
          spacing: "spacious",
        }
      ),
      s(
        "service_details",
        "Meet us",
        "Set expectations around newcomer, informal conversations, social events, and what happens next.",
        "When we meet",
        "/events",
        4,
        imageStyle(TEMPLATE_IMAGES.churchService, "left", "rounded")
      ),
      s(
        "join",
        "Take the next step",
        "A short form routes the newcomer into the church pipeline and alerts the right team.",
        "Express interest",
        "/site/join",
        5,
        {
          form_mode: "newcomer",
          image_url: TEMPLATE_IMAGES.churchWelcome.src,
          image_alt: TEMPLATE_IMAGES.churchWelcome.alt,
          image_position: "right",
          image_shape: "rounded",
          background_tone: "brand",
          form_fields: ["phone", "location", "how_heard", "message", "consent"],
          form_required_fields: ["consent"],
          form_consent_text: "I agree to be contacted by the church about my membership enquiry.",
          form_thank_you: "Thanks. Your enquiry has been added to the church pipeline.",
        }
      ),
    ],
  },
];
