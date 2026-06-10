// Lightweight CSV parser tuned for UK bank statement exports. Supports the
// most common shapes we see from Barclays, HSBC, Lloyds, NatWest, Santander,
// Monzo, Starling, Revolut, Tide, and generic exports.
//
// Heuristics:
// - Comma or semicolon delimiter
// - Optional quoted fields (RFC 4180-ish)
// - Header row required
// - Date formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
// - Amount conventions:
//     * Single signed amount column ("Amount")
//     * Separate "Money In" / "Money Out" columns
//     * Separate "Credit" / "Debit" columns

export type ParsedBankRow = {
  posted_date: string;
  description: string;
  amount: number;
  direction: "credit" | "debit";
  balance: number | null;
  reference: string | null;
};

export type ParsedBankCsv = {
  rows: ParsedBankRow[];
  errors: Array<{ line: number; message: string }>;
};

const DATE_HEADERS = ["date", "transaction date", "posted date", "posting date"];
const DESCRIPTION_HEADERS = [
  "description",
  "details",
  "narrative",
  "transaction description",
  "memo",
  "name",
  "merchant",
];
const AMOUNT_HEADERS = ["amount", "value"];
const CREDIT_HEADERS = ["money in", "credit", "credits", "paid in", "paid-in", "in"];
const DEBIT_HEADERS = ["money out", "debit", "debits", "paid out", "paid-out", "out"];
const BALANCE_HEADERS = ["balance", "running balance"];
const REFERENCE_HEADERS = ["reference", "ref", "transaction id", "transactionid"];

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((s) => s.trim());
}

function detectDelimiter(sample: string): string {
  const semis = (sample.match(/;/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

function parseDate(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // DD/MM/YYYY or DD-MM-YYYY
  const m = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${month}-${day}`;
  }
  // Fallback to Date parser
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function parseAmount(value: string): number | null {
  if (value == null) return null;
  const cleaned = value.replace(/[£$€,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function findHeaderIndex(headers: string[], newcomers: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase();
    for (const newcomer of newcomers) {
      if (header === newcomer || header.includes(newcomer)) {
        return i;
      }
    }
  }
  return -1;
}

export function parseBankCsv(text: string): ParsedBankCsv {
  const errors: Array<{ line: number; message: string }> = [];
  const rows: ParsedBankRow[] = [];

  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows, errors: [{ line: 0, message: "CSV must include a header row and at least one data row." }] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);

  const dateIdx = findHeaderIndex(headers, DATE_HEADERS);
  const descIdx = findHeaderIndex(headers, DESCRIPTION_HEADERS);
  const amountIdx = findHeaderIndex(headers, AMOUNT_HEADERS);
  const creditIdx = findHeaderIndex(headers, CREDIT_HEADERS);
  const debitIdx = findHeaderIndex(headers, DEBIT_HEADERS);
  const balanceIdx = findHeaderIndex(headers, BALANCE_HEADERS);
  const refIdx = findHeaderIndex(headers, REFERENCE_HEADERS);

  if (dateIdx < 0) {
    errors.push({ line: 1, message: "Could not find a date column." });
    return { rows, errors };
  }
  if (descIdx < 0) {
    errors.push({ line: 1, message: "Could not find a description column." });
    return { rows, errors };
  }
  if (amountIdx < 0 && creditIdx < 0 && debitIdx < 0) {
    errors.push({ line: 1, message: "Could not find amount/credit/debit columns." });
    return { rows, errors };
  }

  for (let li = 1; li < lines.length; li++) {
    const cells = splitCsvLine(lines[li], delimiter);
    const date = parseDate(cells[dateIdx] ?? "");
    if (!date) {
      errors.push({ line: li + 1, message: "Unparseable date." });
      continue;
    }
    const description = (cells[descIdx] ?? "").replace(/\s+/g, " ").trim();
    if (!description) {
      errors.push({ line: li + 1, message: "Empty description." });
      continue;
    }

    let signedAmount: number | null = null;
    if (amountIdx >= 0) {
      signedAmount = parseAmount(cells[amountIdx] ?? "");
    } else {
      const credit = creditIdx >= 0 ? parseAmount(cells[creditIdx] ?? "") ?? 0 : 0;
      const debit = debitIdx >= 0 ? parseAmount(cells[debitIdx] ?? "") ?? 0 : 0;
      if (credit === 0 && debit === 0) {
        errors.push({ line: li + 1, message: "No amount on row." });
        continue;
      }
      signedAmount = credit > 0 ? credit : -debit;
    }

    if (signedAmount == null || signedAmount === 0) {
      errors.push({ line: li + 1, message: "Zero or invalid amount." });
      continue;
    }

    const direction: "credit" | "debit" = signedAmount >= 0 ? "credit" : "debit";
    const amount = Number(Math.abs(signedAmount).toFixed(2));
    const balance = balanceIdx >= 0 ? parseAmount(cells[balanceIdx] ?? "") : null;
    const reference =
      refIdx >= 0 ? (cells[refIdx] ?? "").trim() || null : null;

    rows.push({
      posted_date: date,
      description,
      amount,
      direction,
      balance,
      reference,
    });
  }

  return { rows, errors };
}
