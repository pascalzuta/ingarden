import { describe, expect, it } from 'vitest';
import { cpmCents, lastMonths, monthKey, monthlyRollup, postSpendMonth, roas, rollupByInfluencer } from './stats';

describe('monthKey', () => {
  it('extracts YYYY-MM', () => {
    expect(monthKey('2026-09-14T10:00:00Z')).toBe('2026-09');
  });
});

describe('lastMonths', () => {
  it('returns n months ending with the current one', () => {
    const months = lastMonths(3, new Date(Date.UTC(2026, 8, 14)));
    expect(months).toEqual(['2026-07', '2026-08', '2026-09']);
  });
  it('crosses year boundaries', () => {
    const months = lastMonths(3, new Date(Date.UTC(2026, 0, 5)));
    expect(months).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});

describe('postSpendMonth', () => {
  it('prefers posted_at over scheduled_at', () => {
    expect(postSpendMonth({ posted_at: '2026-08-02T00:00:00Z', scheduled_at: '2026-07-20T00:00:00Z' })).toBe('2026-08');
  });
  it('falls back to scheduled_at', () => {
    expect(postSpendMonth({ posted_at: null, scheduled_at: '2026-07-20T00:00:00Z' })).toBe('2026-07');
  });
  it('is null with neither', () => {
    expect(postSpendMonth({ posted_at: null, scheduled_at: null })).toBeNull();
  });
});

describe('monthlyRollup', () => {
  it('sums revenue and spend per month, skipping canceled posts', () => {
    const rows = monthlyRollup(
      [
        { occurred_at: '2026-08-05T10:00:00Z', revenue_cents: 5000 },
        { occurred_at: '2026-08-20T10:00:00Z', revenue_cents: 2500 },
        { occurred_at: '2026-09-01T10:00:00Z', revenue_cents: 1000 },
      ],
      [
        { posted_at: '2026-08-01T00:00:00Z', scheduled_at: null, fee_cents: 10000, gifting_cost_cents: 500, status: 'posted' },
        { posted_at: null, scheduled_at: '2026-09-10T00:00:00Z', fee_cents: 20000, gifting_cost_cents: 0, status: 'scheduled' },
        { posted_at: null, scheduled_at: '2026-09-12T00:00:00Z', fee_cents: 99999, gifting_cost_cents: 0, status: 'canceled' },
      ],
      ['2026-08', '2026-09'],
    );
    expect(rows[0]).toEqual({ month: '2026-08', revenueCents: 7500, spendCents: 10500, conversions: 2, posts: 1 });
    expect(rows[1]).toEqual({ month: '2026-09', revenueCents: 1000, spendCents: 20000, conversions: 1, posts: 1 });
  });
});

describe('rollupByInfluencer', () => {
  it('aggregates revenue, spend and clicks per influencer', () => {
    const map = rollupByInfluencer(
      [
        { influencer_id: 'a', revenue_cents: 4000 },
        { influencer_id: 'a', revenue_cents: 1000 },
        { influencer_id: null, revenue_cents: 999 },
      ],
      [
        { influencer_id: 'a', fee_cents: 2000, gifting_cost_cents: 0, status: 'posted', posted_at: '2026-08-01T00:00:00Z' },
        { influencer_id: 'b', fee_cents: 3000, gifting_cost_cents: 100, status: 'planned', posted_at: null },
      ],
      new Map([['a', 42]]),
    );
    expect(map.get('a')).toMatchObject({ revenueCents: 5000, spendCents: 2000, conversions: 2, postedPosts: 1, clicks: 42 });
    expect(map.get('b')).toMatchObject({ revenueCents: 0, spendCents: 3100, posts: 1, postedPosts: 0 });
  });
});

describe('cpmCents', () => {
  it('is cost per thousand views', () => {
    // €250 story rate, 20k median story views → €12.50 CPM
    expect(cpmCents(25000, 20000)).toBe(1250);
  });
  it('is null without views or cost', () => {
    expect(cpmCents(25000, 0)).toBeNull();
    expect(cpmCents(25000, null)).toBeNull();
    expect(cpmCents(null, 20000)).toBeNull();
  });
});

describe('roas', () => {
  it('is revenue / spend', () => {
    expect(roas(10000, 5000)).toBe(2);
  });
  it('is null with no spend', () => {
    expect(roas(10000, 0)).toBeNull();
  });
});
