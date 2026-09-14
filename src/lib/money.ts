export function formatCents(cents: number | null | undefined, currency = 'EUR'): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-DE', { style: 'currency', currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

// "1234.56", "1.234,56", "1234" → cents. Returns null on garbage.
export function parseMoneyToCents(input: string): number | null {
  const s = input.trim().replace(/[€$£\s]/g, '');
  if (!s) return null;
  let normalized = s;
  // German style 1.234,56
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(s)) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+(,\d{1,2})$/.test(s)) {
    normalized = s.replace(',', '.');
  } else if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return null;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}
