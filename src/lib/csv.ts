// Conversion import. Accepts a CSV with a header row; recognized columns
// (case-insensitive, order-free):
//   date | occurred_at | created at      → occurred_at (required)
//   code | discount_code | discount code → discount_code
//   revenue | total | subtotal | amount  → revenue (required, in currency units)
//   order | order_ref | order id | name  → order_ref (used for de-duplication)
// This covers a Shopify orders export filtered to discount-code orders.

export type ParsedConversion = {
  occurred_at: string;
  discount_code: string;
  revenue_cents: number;
  order_ref: string;
};

export type CsvParseResult = {
  rows: ParsedConversion[];
  errors: string[];
};

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const DATE_COLS = ['date', 'occurred_at', 'created at', 'created_at', 'day'];
const CODE_COLS = ['code', 'discount_code', 'discount code', 'discount codes'];
const REVENUE_COLS = ['revenue', 'total', 'subtotal', 'amount', 'total sales'];
const ORDER_COLS = ['order', 'order_ref', 'order id', 'order_id', 'name'];

function findCol(header: string[], candidates: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(c);
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // DD.MM.YYYY
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) {
    const iso = `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}T12:00:00Z`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

function parseRevenueCents(raw: string): number | null {
  const s = raw.trim().replace(/[€$£\s]/g, '');
  if (!s) return null;
  let normalized = s;
  if (/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(s)) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+(,\d{1,2})$/.test(s)) {
    normalized = s.replace(',', '.');
  } else if (!/^-?\d+(\.\d{1,4})?$/.test(s)) {
    return null;
  }
  const v = Number(normalized);
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

export function parseConversionsCsv(text: string): CsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return { rows: [], errors: ['File needs a header row and at least one data row.'] };

  const header = splitCsvLine(lines[0]);
  const dateIdx = findCol(header, DATE_COLS);
  const codeIdx = findCol(header, CODE_COLS);
  const revenueIdx = findCol(header, REVENUE_COLS);
  const orderIdx = findCol(header, ORDER_COLS);

  const errors: string[] = [];
  if (dateIdx < 0) errors.push('No date column found (expected one of: date, occurred_at, created at).');
  if (revenueIdx < 0) errors.push('No revenue column found (expected one of: revenue, total, subtotal, amount).');
  if (errors.length) return { rows: [], errors };

  const rows: ParsedConversion[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const occurred_at = parseDate(cells[dateIdx] ?? '');
    const revenue_cents = parseRevenueCents(cells[revenueIdx] ?? '');
    if (!occurred_at || revenue_cents == null) {
      errors.push(`Row ${i + 1}: could not parse date or revenue, skipped.`);
      continue;
    }
    rows.push({
      occurred_at,
      revenue_cents,
      discount_code: (codeIdx >= 0 ? (cells[codeIdx] ?? '') : '').trim(),
      order_ref: (orderIdx >= 0 ? (cells[orderIdx] ?? '') : '').trim(),
    });
  }
  return { rows, errors };
}
