// Seed library of system message templates. Lodge-specific copies override
// the system version (matched on template_key).

export type TemplateCategory =
  | "newsletter"
  | "summons"
  | "dues"
  | "events"
  | "milestones"
  | "welfare";

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
    subject: "Lodge update",
    html_body:
      "<p>Hello {{first_name}},</p>\n<p>Write your newsletter content here. You can include <strong>bold text</strong> and links.</p>\n<p>Yours sincerely,<br/>The Secretary</p>",
    merge_tags: ["first_name", "last_name", "lodge_name"],
  },
  {
    template_key: "system.newsletter.monthly",
    name: "Monthly newsletter",
    category: "newsletter",
    description: "Recap of the last meeting plus a look ahead.",
    subject: "{{lodge_name}} - this month at the lodge",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>Here is your monthly catch-up from {{lodge_name}}.</p>\n<h3>Last meeting</h3>\n<p>Thank you to everyone who joined us at our last regular meeting. A short summary of the proceedings and the work conducted in the temple is below.</p>\n<h3>Looking ahead</h3>\n<p>Our next meeting is on {{event_date}}. Full details are in the summons that follows.</p>\n<h3>Charity</h3>\n<p>Our current campaign continues. If you would like to contribute, you can do so through the member portal.</p>\n<p>Yours fraternally,<br/>The Secretary</p>",
    merge_tags: ["first_name", "lodge_name", "event_date"],
  },
  {
    template_key: "system.summons.regular",
    name: "Regular summons",
    category: "summons",
    description: "Standard summons for a regular meeting with dining details.",
    subject: "Summons - {{event_title}} on {{event_date}}",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>You are summoned to attend a regular meeting of {{lodge_name}}.</p>\n<p><strong>Date:</strong> {{event_date}}<br/><strong>Time:</strong> {{event_time}}<br/><strong>Location:</strong> {{event_location}}<br/><strong>Dress:</strong> {{event_dress_code}}</p>\n<h3>Agenda</h3>\n<ol><li>Opening of the lodge</li><li>Reading of minutes</li><li>Treasurer's report</li><li>Secretary's correspondence</li><li>Charity steward's report</li><li>Any other business</li><li>Closing of the lodge</li></ol>\n<p>Please RSVP from your member portal so the festive board can be catered.</p>\n<p>Yours fraternally,<br/>The Secretary</p>",
    merge_tags: ["first_name", "lodge_name", "event_title", "event_date", "event_time", "event_location", "event_dress_code"],
  },
  {
    template_key: "system.summons.installation",
    name: "Installation summons",
    category: "summons",
    description: "Formal summons for an installation meeting.",
    subject: "Installation summons - {{event_date}}",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>You are most cordially summoned to attend the installation of the Worshipful Master Elect of {{lodge_name}}.</p>\n<p><strong>Date:</strong> {{event_date}}<br/><strong>Time:</strong> {{event_time}}<br/><strong>Location:</strong> {{event_location}}<br/><strong>Dress:</strong> Morning dress with full regalia</p>\n<p>A festive board will follow. Please RSVP from your member portal at your earliest convenience.</p>\n<p>Yours fraternally,<br/>The Secretary</p>",
    merge_tags: ["first_name", "lodge_name", "event_date", "event_time", "event_location"],
  },
  {
    template_key: "system.dues.reminder",
    name: "Dues reminder",
    category: "dues",
    description: "Polite first reminder for outstanding dues.",
    subject: "Reminder: lodge dues due {{due_date}}",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>This is a friendly reminder that your annual dues of {{amount}} are due on {{due_date}}.</p>\n<p>You can pay or set up instalments from the member portal.</p>",
    merge_tags: ["first_name", "amount", "due_date", "lodge_name"],
  },
  {
    template_key: "system.dues.final-notice",
    name: "Dues final notice",
    category: "dues",
    description: "Firm but courteous final reminder before escalation.",
    subject: "Final notice: dues outstanding",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>Our records show that your annual dues of {{amount}}, due on {{due_date}}, remain outstanding. We have written to you previously and would be grateful if you could settle this at your earliest convenience.</p>\n<p>If you are experiencing difficulty, please contact the Almoner in the strictest confidence so we can discuss options including instalments.</p>\n<p>Yours fraternally,<br/>The Treasurer</p>",
    merge_tags: ["first_name", "amount", "due_date"],
  },
  {
    template_key: "system.post-meeting.thank-you",
    name: "Post-meeting thank you",
    category: "events",
    description: "Thank brethren for attending; sets up the next meeting.",
    subject: "Thank you for attending {{event_title}}",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>Thank you for joining us at {{event_title}} on {{event_date}}. Your fellowship made the evening memorable.</p>\n<p>We look forward to seeing you again at our next meeting.</p>",
    merge_tags: ["first_name", "event_title", "event_date", "lodge_name"],
  },
  {
    template_key: "system.event.rsvp-reminder",
    name: "RSVP reminder",
    category: "events",
    description: "Nudges members who have not yet RSVP'd to an upcoming meeting.",
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
    subject: "Happy birthday from {{lodge_name}}",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>The brethren of {{lodge_name}} send our warmest birthday wishes. We hope you have a wonderful day with family and friends.</p>",
    merge_tags: ["first_name", "lodge_name"],
  },
  {
    template_key: "system.initiation.anniversary",
    name: "Initiation anniversary",
    category: "milestones",
    description: "Sent on the anniversary of a brother's initiation.",
    subject: "{{years}} years a brother",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>Today marks {{years}} years since your initiation into {{lodge_name}}. The brethren thank you for your continued service and fellowship.</p>",
    merge_tags: ["first_name", "lodge_name", "years"],
  },
  {
    template_key: "system.welfare.checkin",
    name: "Welfare check-in",
    category: "welfare",
    description: "Personal note from the Almoner to a brother who may be unwell.",
    subject: "Thinking of you",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>The brethren have been thinking of you. Please know that you are in our thoughts. If there is anything practical the lodge can do, please reach out to me directly in confidence.</p>\n<p>Yours fraternally,<br/>The Almoner</p>",
    merge_tags: ["first_name"],
  },
  {
    template_key: "system.welfare.bereavement",
    name: "Bereavement message",
    category: "welfare",
    description: "Sympathy note to a brother or family during bereavement.",
    subject: "With our deepest sympathies",
    html_body:
      "<p>Dear {{first_name}},</p>\n<p>The brethren of {{lodge_name}} are deeply saddened to learn of your loss. You and your family are in our thoughts and prayers at this difficult time.</p>\n<p>Please do not hesitate to reach out to the Almoner if there is anything we can do to support you.</p>\n<p>Yours fraternally,<br/>The Worshipful Master and Brethren</p>",
    merge_tags: ["first_name", "lodge_name"],
  },
];

export type MergeTagContext = {
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  lodge_name: string;
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
