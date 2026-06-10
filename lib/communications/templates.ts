// Seed library of system message templates. Church-specific copies override
// the system version (matched on template_key).

export type TemplateCategory =
  | "newsletter"
  | "notice"
  | "giving"
  | "events"
  | "milestones"
  | "pastoral";

export type SystemTemplate = {
  template_key: string;
  name: string;
  category: TemplateCategory;
  description: string;
  subject: string;
  html_body: string;
  merge_tags: string[];
};

export const SYSTEM_TEMPLATES: readonly SystemTemplate[] = [
  {
    template_key: "system.newsletter.blank",
    name: "Blank newsletter",
    category: "newsletter",
    description: "A clean starting point for any monthly update.",
    subject: "Church update",
    html_body:
      "<p>Hello {{first_name}},</p>\n<p>Write your newsletter content here. You can include <strong>bold text</strong> and links.</p>\n<p>Yours sincerely,<br/>The Secretary</p>",
    merge_tags: ["first_name", "last_name", "church_name"],
  },
  {
    template_key: "system.newsletter.monthly",
    name: "Monthly newsletter",
    category: "newsletter",
    description: "Recap of the last service plus a look ahead.",
    subject: "{{church_name}} - this month at the church",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>Here is your monthly catch-up from {{church_name}}.</p>\n<h3>Last service</h3>\n<p>Thank you to everyone who joined us at our last regular service. A short summary of the proceedings and the life shared as a church is below.</p>\n<h3>Looking ahead</h3>\n<p>Our next service is on {{event_date}}. Full details are in the notice that follows.</p>\n<h3>Charity</h3>\n<p>Our current campaign continues. If you would like to contribute, you can do so through the member portal.</p>\n<p>With every blessing,<br/>The Secretary</p>",
    merge_tags: ["first_name", "church_name", "event_date"],
  },
  {
    template_key: "system.notice.regular",
    name: "Regular notice",
    category: "notice",
    description: "Standard notice for a regular service with dining details.",
    subject: "Notice - {{event_title}} on {{event_date}}",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>You are invited to attend a regular service of {{church_name}}.</p>\n<p><strong>Date:</strong> {{event_date}}<br/><strong>Time:</strong> {{event_time}}<br/><strong>Location:</strong> {{event_location}}<br/><strong>Dress:</strong> {{event_dress_code}}</p>\n<h3>Agenda</h3>\n<ol><li>Opening of the church</li><li>Reading of minutes</li><li>Treasurer's report</li><li>Secretary's correspondence</li><li>Charity steward's report</li><li>Any other business</li><li>Closing of the church</li></ol>\n<p>Please RSVP from your member portal so the fellowship meal can be catered.</p>\n<p>With every blessing,<br/>The Secretary</p>",
    merge_tags: ["first_name", "church_name", "event_title", "event_date", "event_time", "event_location", "event_dress_code"],
  },
  {
    template_key: "system.notice.special_service",
    name: "Special service notice",
    category: "notice",
    description: "Formal notice for an special_service service.",
    subject: "Special service notice - {{event_date}}",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>You are most warmly invited to attend the special_service of the Lead Pastor Elect of {{church_name}}.</p>\n<p><strong>Date:</strong> {{event_date}}<br/><strong>Time:</strong> {{event_time}}<br/><strong>Location:</strong> {{event_location}}<br/><strong>Dress:</strong> Smart dress</p>\n<p>A fellowship meal will follow. Please RSVP from your member portal at your earliest convenience.</p>\n<p>With every blessing,<br/>The Secretary</p>",
    merge_tags: ["first_name", "church_name", "event_date", "event_time", "event_location"],
  },
  {
    template_key: "system.giving.reminder",
    name: "Giving reminder",
    category: "giving",
    description: "Polite first reminder for outstanding giving.",
    subject: "Reminder: church giving due {{due_date}}",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>This is a friendly reminder that your annual giving of {{amount}} are due on {{due_date}}.</p>\n<p>You can pay or set up instalments from the member portal.</p>",
    merge_tags: ["first_name", "amount", "due_date", "church_name"],
  },
  {
    template_key: "system.giving.final-notice",
    name: "Giving final notice",
    category: "giving",
    description: "Firm but courteous final reminder before escalation.",
    subject: "Final notice: giving outstanding",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>Our records show that your annual giving of {{amount}}, due on {{due_date}}, remain outstanding. We have written to you previously and would be grateful if you could settle this at your earliest convenience.</p>\n<p>If you are experiencing difficulty, please contact the PastoralCare in the strictest confidence so we can discuss options including instalments.</p>\n<p>With every blessing,<br/>The Treasurer</p>",
    merge_tags: ["first_name", "amount", "due_date"],
  },
  {
    template_key: "system.post-service.thank-you",
    name: "Post-service thank you",
    category: "events",
    description: "Thank members for attending; sets up the next service.",
    subject: "Thank you for attending {{event_title}}",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>Thank you for joining us at {{event_title}} on {{event_date}}. Your fellowship made the evening memorable.</p>\n<p>We look forward to seeing you again at our next service.</p>",
    merge_tags: ["first_name", "event_title", "event_date", "church_name"],
  },
  {
    template_key: "system.event.rsvp-reminder",
    name: "RSVP reminder",
    category: "events",
    description: "Nudges members who have not yet RSVP'd to an upcoming service.",
    subject: "Have you RSVP'd for {{event_title}}?",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>We have not yet received your RSVP for {{event_title}} on {{event_date}}.</p>\n<p>Please let us know your intentions through the member portal so we can finalise dining numbers.</p>",
    merge_tags: ["first_name", "event_title", "event_date"],
  },
  {
    template_key: "system.birthday.greeting",
    name: "Birthday greeting",
    category: "milestones",
    description: "Sent automatically on a member's birthday.",
    subject: "Happy birthday from {{church_name}}",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>The members of {{church_name}} send our warmest birthday wishes. We hope you have a wonderful day with family and friends.</p>",
    merge_tags: ["first_name", "church_name"],
  },
  {
    template_key: "system.membership.anniversary",
    name: "Initiation anniversary",
    category: "milestones",
    description: "Sent on the anniversary of a member's membership.",
    subject: "{{years}} years a member",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>Today marks {{years}} years since your membership into {{church_name}}. The members thank you for your continued service and fellowship.</p>",
    merge_tags: ["first_name", "church_name", "years"],
  },
  {
    template_key: "system.pastoral.checkin",
    name: "PastoralCare check-in",
    category: "pastoral",
    description: "Personal note from the PastoralCare to a member who may be unwell.",
    subject: "Thinking of you",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>The members have been thinking of you. Please know that you are in our thoughts. If there is anything practical the church can do, please reach out to me directly in confidence.</p>\n<p>With every blessing,<br/>The PastoralCare</p>",
    merge_tags: ["first_name"],
  },
  {
    template_key: "system.pastoral.bereavement",
    name: "Bereavement message",
    category: "pastoral",
    description: "Sympathy note to a member or family during bereavement.",
    subject: "With our deepest sympathies",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>The members of {{church_name}} are deeply saddened to learn of your loss. You and your family are in our thoughts and prayers at this difficult time.</p>\n<p>Please do not hesitate to reach out to the PastoralCare if there is anything we can do to support you.</p>\n<p>With every blessing,<br/>The Lead Pastor and Members</p>",
    merge_tags: ["first_name", "church_name"],
  },
];

export type MergeTagContext = {
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  church_name: string;
  event_title?: string;
  event_date?: string;
  amount?: string;
  due_date?: string;
  years?: string;
};

const TAG_PATTERN = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

export function applyMergeTags(
  template: string,
  context: Record<string, string | undefined>
): string {
  return template.replace(TAG_PATTERN, (_, tag) => {
    const value = context[tag];
    return value ?? "";
  });
}
