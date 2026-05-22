#!/usr/bin/env node
// Idempotent seed for the 2 June 2026 Covenant Lodge Installation summons.
// Creates (or updates) the draft meeting plus its event_summons row from the
// printed summons PDF. Safe to run multiple times — it upserts on
// (lodge_id, slug) for the event and (lodge_id, event_id) for the summons.
//
// Run BEFORE this script: apply supabase/migrations/043_event_summons_visiting_officer_and_next_meeting.sql
// in the Supabase SQL editor (or via your usual migration flow). The script
// will detect missing columns and stop with the SQL to run if you forget.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/seed-2026-06-02-installation.mjs
//
// Or just `node scripts/seed-2026-06-02-installation.mjs` if .env.local is set.

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const candidates = [".env.local", ".env"];
  for (const file of candidates) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadDotEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env."
  );
  process.exit(1);
}

const LODGE_SLUG = process.env.LODGE_SLUG ?? "covenant-4344";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const eventPayload = {
  title: "Installation of W Bro Lester MacKenzie",
  slug: "installation-2026-06-02",
  description:
    "Installation meeting of The Covenant Lodge No. 4344. W Bro Lester MacKenzie is installed as Worshipful Master, qualified by virtue of his service as WM of Park Street Lodge No. 8556 in 2004-05.",
  event_type: "installation",
  event_date: new Date("2026-06-02T16:45:00+01:00").toISOString(),
  event_time: "16:45",
  location: "Mark Masons' Hall, 86 St James's Street, London, SW1A 1PL",
  temple_room: null,
  dress_code: "Dark Suit, White Shirt & Gloves, Black Tie",
  enable_rsvp: true,
  rsvp_deadline: new Date("2026-05-26T23:59:59+01:00").toISOString(),
  max_attendees: null,
  enable_payments: false,
  enable_dining_rsvp: true,
  dining_price: 50.0,
  dining_description:
    "Three-course installation dinner at 7.30 pm with cheese boards, coffee and tea.",
  enable_charity_donation: true,
  charity_name: "RMBI",
  charity_description:
    "The Treasurer proposes a donation of £125 to the RMBI at this meeting. Members are welcome to add a personal donation.",
  charity_suggested_amounts: [10, 20, 50, 100],
  charity_allow_custom: true,
  enable_raffle_donation: false,
  raffle_description: "Help fund evening raffle prizes",
  raffle_suggested_amounts: [5, 10, 20, 50],
  raffle_allow_custom: true,
  enable_meeting_fee: false,
  meeting_fee_amount: null,
  meeting_fee_description: null,
  enable_guest_tickets: false,
  guest_ticket_price: null,
  guest_ticket_description: null,
  featured_image_url: null,
  created_by: null,
  published: false,
};

const summonsPayload = {
  issue_date: "2026-05-12",
  opening_text: [
    "By Command of the Worshipful Master, you are summoned to attend a regular meeting of this Lodge to be held at Mark Masons' Hall, 86 St James's Street, London, SW1A 1PL on Tuesday 2 June 2026 at 4.45 pm SHARP.",
    "Yours faithfully and fraternally",
  ].join("\n\n"),
  agenda_items: [
    "To open the Lodge.",
    "To submit for confirmation the circulated Minutes of the last regular meeting held on 10 March 2026.",
    "To install W Bro Lester MacKenzie as Worshipful Master. Qualified to serve by virtue of holding the office of WM of Park Street Lodge 8556 in the year 2004-05.",
    "To invest the Treasurer and Tyler and appoint and invest other officers of the Lodge for the ensuing year.",
    "To sign the Installation Return.",
    "The Treasurer to propose that £125 be donated to the RMBI.",
    "To receive the Almoners report.",
    "To receive the Charity Stewards report and collect alms.",
    "Risings.",
    "To close the Lodge.",
  ],
  menu_items: [
    "Gin cured salmon, celeriac remoulade, micro herb salad",
    "Sirloin steak, Cajun spiced potato, sautéed greens, red pepper and chilli salsa",
    "Normandy French apple tart, caramelised apple, vanilla ice cream",
    "Cheese Boards",
    "Coffee and Tea",
  ],
  dining_time: "7.30 pm",
  notices: [
    "All cheques for subscriptions should be made payable to The Covenant Lodge No. 4344 and sent direct to the Treasurer, W Bro Darren Sargent.",
    "Brethren wishing to donate to Lodge charities and the Masters List should contact the Charity Steward, W Bro Lester MacKenzie LGR.",
    "Brethren wishing to attend The Covenant Lodge of Instruction are welcome and should contact W Bro Lester MacKenzie LGR or W Bro Niall Corbett SLGR.",
    "Brethren travelling abroad are warned they should not visit Lodges under other jurisdictions until they have found out by application to the Grand Secretary at Freemasons Hall about the existence of Regular Masonry in the country they are visiting.",
    "UGLE Members Portal: https://desktop.portal.ugle.org.uk/ (desktop) or https://mobile.portal.ugle.org.uk/ (mobile).",
  ],
  include_member_directory: true,
  visiting_officer_name: "W Bro Jim Heatley LGR",
  visiting_officer_email: "jim_heatley_zzjlnc@yahoo.com",
  visiting_officer_phone: null,
  next_meeting_date: "2026-11-17",
  next_meeting_note: "Regular meeting",
  master_elect_name: "W Bro Lester MacKenzie",
  master_elect_qualification:
    "Qualified to serve by virtue of holding the office of WM of Park Street Lodge 8556 in the year 2004-05.",
};

function supabaseDashboardSqlUrl() {
  try {
    const host = new URL(SUPABASE_URL).host;
    const projectRef = host.split(".")[0];
    return `https://supabase.com/dashboard/project/${projectRef}/sql/new`;
  } catch {
    return null;
  }
}

const MIGRATION_HINT = `
Missing event_summons columns. Apply this migration before re-running:

  supabase/migrations/043_event_summons_visiting_officer_and_next_meeting.sql

Quickest path: open the Supabase SQL editor${
  supabaseDashboardSqlUrl() ? ` (${supabaseDashboardSqlUrl()})` : ""
} and paste:

ALTER TABLE public.event_summons
  ADD COLUMN IF NOT EXISTS visiting_officer_name text,
  ADD COLUMN IF NOT EXISTS visiting_officer_email text,
  ADD COLUMN IF NOT EXISTS visiting_officer_phone text,
  ADD COLUMN IF NOT EXISTS next_meeting_date date,
  ADD COLUMN IF NOT EXISTS next_meeting_note text,
  ADD COLUMN IF NOT EXISTS master_elect_name text,
  ADD COLUMN IF NOT EXISTS master_elect_qualification text;

Then re-run:  npm run seed:installation-2026-06-02
`;

async function main() {
  console.log(`Resolving lodge "${LODGE_SLUG}"...`);
  const { data: lodge, error: lodgeError } = await supabase
    .from("lodges")
    .select("id, name")
    .eq("slug", LODGE_SLUG)
    .maybeSingle();

  if (lodgeError) throw lodgeError;
  if (!lodge) {
    throw new Error(
      `Lodge "${LODGE_SLUG}" not found. Set LODGE_SLUG env var if your lodge uses a different slug.`
    );
  }
  console.log(`Lodge: ${lodge.name} (${lodge.id})`);

  console.log(
    `Upserting event "${eventPayload.title}" (slug=${eventPayload.slug})...`
  );

  const { data: existingEvent, error: existingError } = await supabase
    .from("events")
    .select("id")
    .eq("lodge_id", lodge.id)
    .eq("slug", eventPayload.slug)
    .maybeSingle();
  if (existingError) throw existingError;

  let eventId;
  if (existingEvent) {
    const { data: updated, error: updateError } = await supabase
      .from("events")
      .update({ ...eventPayload, updated_at: new Date().toISOString() })
      .eq("id", existingEvent.id)
      .eq("lodge_id", lodge.id)
      .select("id")
      .single();
    if (updateError) throw updateError;
    eventId = updated.id;
    console.log(`  Updated existing event ${eventId}.`);
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("events")
      .insert({ ...eventPayload, lodge_id: lodge.id })
      .select("id")
      .single();
    if (insertError) throw insertError;
    eventId = inserted.id;
    console.log(`  Created event ${eventId}.`);
  }

  console.log("Upserting event_summons...");
  const { error: summonsError } = await supabase
    .from("event_summons")
    .upsert(
      {
        ...summonsPayload,
        lodge_id: lodge.id,
        event_id: eventId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lodge_id,event_id" }
    )
    .select("id")
    .single();

  if (summonsError) {
    const msg = summonsError.message ?? "";
    const isMissingColumn =
      summonsError.code === "PGRST204" ||
      /column .+ does not exist/i.test(msg) ||
      /Could not find the .+ column/i.test(msg);
    if (isMissingColumn) {
      console.error("");
      console.error(`event_summons upsert failed: ${msg}`);
      console.error(MIGRATION_HINT);
      console.error(
        `Note: the event row was still upserted (id ${eventId}); re-running this script will update both event and summons once the migration is applied.`
      );
      process.exit(2);
    }
    throw summonsError;
  }

  console.log("Done.");
  console.log("");
  console.log(
    `Meeting (draft): http://localhost:3000/admin/meetings/${eventId}/summons/edit`
  );
  console.log(
    `Summons preview: http://localhost:3000/admin/meetings/${eventId}/summons`
  );
  console.log("");
  console.log(
    "The meeting is unpublished (published: false) and payments are disabled."
  );
  console.log(
    'When you are ready to go live, edit the meeting to set published: true and enable_payments: true, then click "Send summons".'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
