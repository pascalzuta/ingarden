import type { AttributedConversion, Post } from './types';

export function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function lastMonths(n: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export function postCostCents(p: Pick<Post, 'fee_cents' | 'gifting_cost_cents'>): number {
  return (p.fee_cents || 0) + (p.gifting_cost_cents || 0);
}

// The month a post's spend belongs to: when it ran, else when it is planned to run.
export function postSpendMonth(p: Pick<Post, 'posted_at' | 'scheduled_at'>): string | null {
  const d = p.posted_at || p.scheduled_at;
  return d ? monthKey(d) : null;
}

export type MonthlyRow = {
  month: string;
  revenueCents: number;
  spendCents: number;
  conversions: number;
  posts: number;
};

export function monthlyRollup(
  conversions: Pick<AttributedConversion, 'occurred_at' | 'revenue_cents'>[],
  posts: Pick<Post, 'posted_at' | 'scheduled_at' | 'fee_cents' | 'gifting_cost_cents' | 'status'>[],
  months: string[],
): MonthlyRow[] {
  const byMonth = new Map<string, MonthlyRow>(
    months.map((m) => [m, { month: m, revenueCents: 0, spendCents: 0, conversions: 0, posts: 0 }]),
  );
  for (const c of conversions) {
    const row = byMonth.get(monthKey(c.occurred_at));
    if (row) {
      row.revenueCents += c.revenue_cents;
      row.conversions += 1;
    }
  }
  for (const p of posts) {
    if (p.status === 'canceled') continue;
    const m = postSpendMonth(p);
    const row = m ? byMonth.get(m) : undefined;
    if (row) {
      row.spendCents += postCostCents(p);
      row.posts += 1;
    }
  }
  return months.map((m) => byMonth.get(m)!);
}

export type InfluencerRollup = {
  influencerId: string;
  revenueCents: number;
  spendCents: number;
  conversions: number;
  posts: number;
  postedPosts: number;
  clicks: number;
};

export function rollupByInfluencer(
  conversions: Pick<AttributedConversion, 'influencer_id' | 'revenue_cents'>[],
  posts: Pick<Post, 'influencer_id' | 'fee_cents' | 'gifting_cost_cents' | 'status' | 'posted_at'>[],
  clicksByInfluencer: Map<string, number> = new Map(),
): Map<string, InfluencerRollup> {
  const out = new Map<string, InfluencerRollup>();
  const get = (id: string): InfluencerRollup => {
    let r = out.get(id);
    if (!r) {
      r = { influencerId: id, revenueCents: 0, spendCents: 0, conversions: 0, posts: 0, postedPosts: 0, clicks: 0 };
      out.set(id, r);
    }
    return r;
  };
  for (const c of conversions) {
    if (!c.influencer_id) continue;
    const r = get(c.influencer_id);
    r.revenueCents += c.revenue_cents;
    r.conversions += 1;
  }
  for (const p of posts) {
    if (p.status === 'canceled') continue;
    const r = get(p.influencer_id);
    r.spendCents += postCostCents(p);
    r.posts += 1;
    if (p.posted_at) r.postedPosts += 1;
  }
  for (const [id, clicks] of clicksByInfluencer) {
    get(id).clicks = clicks;
  }
  return out;
}

// Cost per 1,000 views in cents: what a post costs relative to the audience
// it reaches. Pre-deal: rate ÷ median views; post: cost ÷ actual views.
export function cpmCents(costCents: number | null | undefined, views: number | null | undefined): number | null {
  if (costCents == null || views == null || views <= 0) return null;
  return Math.round((costCents / views) * 1000);
}

// Return on spend as a multiple; null when there is no spend.
export function roas(revenueCents: number, spendCents: number): number | null {
  if (spendCents <= 0) return null;
  return revenueCents / spendCents;
}

export function formatRoas(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(2)}×`;
}
