import { describe, expect, it } from 'vitest';
import { parseConversionsCsv, splitCsvLine } from './csv';

describe('splitCsvLine', () => {
  it('handles quoted fields with commas and escaped quotes', () => {
    expect(splitCsvLine('a,"b,c","d""e"')).toEqual(['a', 'b,c', 'd"e']);
  });
});

describe('parseConversionsCsv', () => {
  it('parses a Shopify-style export', () => {
    const csv = ['Name,Created at,Discount Code,Total', '#1001,2026-08-05 10:00:00 +0200,ANNA20,59.90', '#1002,2026-08-06,MAX10,120'].join('\n');
    const { rows, errors } = parseConversionsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0].discount_code).toBe('ANNA20');
    expect(rows[0].revenue_cents).toBe(5990);
    expect(rows[0].order_ref).toBe('#1001');
  });

  it('parses German dates and decimal commas', () => {
    const csv = ['date,code,revenue,order', '05.08.2026,ANNA20,"1.234,56",A-1'].join('\n');
    const { rows, errors } = parseConversionsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0].occurred_at).toBe('2026-08-05T12:00:00Z');
    expect(rows[0].revenue_cents).toBe(123456);
  });

  it('reports missing required columns', () => {
    const { rows, errors } = parseConversionsCsv('foo,bar\n1,2');
    expect(rows).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('skips bad rows but keeps good ones', () => {
    const csv = ['date,revenue', 'not-a-date,10', '2026-08-05,10'].join('\n');
    const { rows, errors } = parseConversionsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });
});
