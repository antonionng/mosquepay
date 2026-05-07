/**
 * CSV utilities for member import.
 * Pure functions, used both for preview and import in admin members UI.
 */

export type ParsedMemberRow = {
  rowIndex: number;
  data: Record<string, string>;
  email: string;
  full_name: string;
  errors: string[];
  isDuplicate: boolean;
  isExisting: boolean;
};

export const KNOWN_HEADERS = [
  "full_name",
  "email",
  "phone",
  "rank",
  "membership_status",
  "address_line_1",
  "address_line_2",
  "city",
  "county",
  "postcode",
  "country",
  "office_title",
  "officer_sort_order",
  "directory_sort_order",
  "royal_arch",
  "country_list",
  "honorary",
  "dietary_requirements",
  "date_of_initiation",
];

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

export function parseMembersCsv(
  text: string,
  existingEmails: Set<string>
): { headers: string[]; rows: ParsedMemberRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());

  const rows: ParsedMemberRow[] = [];
  const seenEmails = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const data = Object.fromEntries(
      headers.map((h, idx) => [h, values[idx] ?? ""])
    );
    const email = (data.email ?? "").trim().toLowerCase();
    const full_name = (data.full_name ?? "").trim();
    const errors: string[] = [];

    if (!full_name) errors.push("Missing full_name");
    if (!email) errors.push("Missing email");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.push("Invalid email");

    const isDuplicate = email.length > 0 && seenEmails.has(email);
    const isExisting = email.length > 0 && existingEmails.has(email);
    if (isDuplicate) errors.push("Duplicate within file");

    if (email) seenEmails.add(email);

    rows.push({
      rowIndex: i,
      data,
      email,
      full_name,
      errors,
      isDuplicate,
      isExisting,
    });
  }
  return { headers, rows };
}

export function buildImportPayload(row: ParsedMemberRow) {
  const r = row.data;
  return {
    full_name: row.full_name,
    email: row.email,
    phone: r.phone || null,
    rank: r.rank || null,
    membership_status: r.membership_status || "active",
    address_line_1: r.address_line_1 || null,
    address_line_2: r.address_line_2 || null,
    city: r.city || null,
    county: r.county || null,
    postcode: r.postcode || null,
    country: r.country || "United Kingdom",
    office_title: r.office_title || null,
    officer_sort_order: r.officer_sort_order
      ? Number(r.officer_sort_order)
      : null,
    directory_sort_order: r.directory_sort_order
      ? Number(r.directory_sort_order)
      : null,
    royal_arch: r.royal_arch === "true" || r.royal_arch === "yes",
    country_list: r.country_list === "true" || r.country_list === "yes",
    honorary: r.honorary === "true" || r.honorary === "yes",
    dietary_requirements: r.dietary_requirements || null,
    date_of_initiation: r.date_of_initiation || null,
  };
}
