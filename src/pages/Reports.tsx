import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { clicksByInfluencer, useAppData } from '../lib/data';
import { formatCents } from '../lib/money';
import { formatRoas, monthKey, monthLabel, postCostCents, postSpendMonth, roas } from '../lib/stats';

type GroupBy = 'influencer' | 'month' | 'format' | 'influencer_month';

type Row = {
  key: string;
  label: string;
  link?: string;
  revenueCents: number;
  spendCents: number;
  orders: number;
  posts: number;
  clicks: number;
  views: number;
};

export default function Reports() {
  const { data, loading, error } = useAppData();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('influencer');
  const [influencerFilter, setInfluencerFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');

  const rows = useMemo(() => {
    if (!data.influencers) return [] as Row[];
    const inRange = (iso: string | null) => {
      if (!iso) return false;
      const d = iso.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };
    const infName = (id: string | null) => data.influencers.find((i) => i.id === id)?.name ?? '(unattributed)';
    const postById = new Map(data.posts.map((p) => [p.id, p]));

    const conversions = data.conversions.filter((c) => {
      if (!inRange(c.occurred_at)) return false;
      if (influencerFilter && c.influencer_id !== influencerFilter) return false;
      if (formatFilter) {
        const p = c.post_id ? postById.get(c.post_id) : null;
        if (!p || p.format !== formatFilter) return false;
      }
      return true;
    });
    const posts = data.posts.filter((p) => {
      if (p.status === 'canceled') return false;
      if (!inRange(p.posted_at || p.scheduled_at)) return false;
      if (influencerFilter && p.influencer_id !== influencerFilter) return false;
      if (formatFilter && p.format !== formatFilter) return false;
      return true;
    });
    const clicks = data.clicks.filter((c) => inRange(c.clicked_at));
    const clickMap = clicksByInfluencer(data.links, clicks);

    const keyOf = (opts: { influencerId: string | null; month: string; format: string }): { key: string; label: string; link?: string } => {
      switch (groupBy) {
        case 'influencer':
          return {
            key: opts.influencerId ?? 'none',
            label: infName(opts.influencerId),
            link: opts.influencerId ? `/influencers/${opts.influencerId}` : undefined,
          };
        case 'month':
          return { key: opts.month, label: monthLabel(opts.month) };
        case 'format':
          return { key: opts.format || 'unknown', label: opts.format || 'unknown' };
        case 'influencer_month':
          return {
            key: `${opts.influencerId ?? 'none'}|${opts.month}`,
            label: `${infName(opts.influencerId)} — ${monthLabel(opts.month)}`,
            link: opts.influencerId ? `/influencers/${opts.influencerId}` : undefined,
          };
      }
    };

    const map = new Map<string, Row>();
    const get = (k: { key: string; label: string; link?: string }): Row => {
      let r = map.get(k.key);
      if (!r) {
        r = { key: k.key, label: k.label, link: k.link, revenueCents: 0, spendCents: 0, orders: 0, posts: 0, clicks: 0, views: 0 };
        map.set(k.key, r);
      }
      return r;
    };

    for (const c of conversions) {
      const p = c.post_id ? postById.get(c.post_id) : null;
      const r = get(keyOf({ influencerId: c.influencer_id, month: monthKey(c.occurred_at), format: p?.format ?? '' }));
      r.revenueCents += c.revenue_cents;
      r.orders += 1;
    }
    for (const p of posts) {
      const m = postSpendMonth(p);
      const r = get(keyOf({ influencerId: p.influencer_id, month: m ?? 'none', format: p.format }));
      r.spendCents += postCostCents(p);
      r.posts += 1;
      r.views += p.views ?? 0;
    }
    if (groupBy === 'influencer') {
      for (const [infId, n] of clickMap) {
        if (influencerFilter && infId !== influencerFilter) continue;
        get({ key: infId, label: infName(infId), link: `/influencers/${infId}` }).clicks = n;
      }
    }

    return [...map.values()].sort((a, b) => b.revenueCents - a.revenueCents || b.spendCents - a.spendCents);
  }, [data, from, to, groupBy, influencerFilter, formatFilter]);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="error-box">{error}</div>;

  const totals = rows.reduce(
    (t, r) => ({
      revenueCents: t.revenueCents + r.revenueCents,
      spendCents: t.spendCents + r.spendCents,
      orders: t.orders + r.orders,
      posts: t.posts + r.posts,
      clicks: t.clicks + r.clicks,
      views: t.views + r.views,
    }),
    { revenueCents: 0, spendCents: 0, orders: 0, posts: 0, clicks: 0, views: 0 },
  );

  function exportCsv() {
    const header = 'group,revenue_eur,spend_eur,roas,orders,posts,clicks,views';
    const lines = rows.map((r) =>
      [
        `"${r.label.replace(/"/g, '""')}"`,
        (r.revenueCents / 100).toFixed(2),
        (r.spendCents / 100).toFixed(2),
        roas(r.revenueCents, r.spendCents)?.toFixed(2) ?? '',
        r.orders,
        r.posts,
        r.clicks,
        r.views,
      ].join(','),
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ingarden-report-${groupBy}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <div className="sub">Slice revenue, spend and activity any way you need.</div>
        </div>
        <button onClick={exportCsv} disabled={rows.length === 0}>Export CSV</button>
      </div>

      <div className="filters">
        <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
          <option value="influencer">Group by influencer</option>
          <option value="month">Group by month</option>
          <option value="format">Group by format</option>
          <option value="influencer_month">Influencer × month</option>
        </select>
        <select value={influencerFilter} onChange={(e) => setInfluencerFilter(e.target.value)}>
          <option value="">All influencers</option>
          {data.influencers.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
          <option value="">All formats</option>
          <option value="reel">Reels</option>
          <option value="story">Stories</option>
          <option value="feed">Feed</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="panel">
        <table className="data">
          <thead>
            <tr>
              <th>Group</th>
              <th className="num">Revenue</th>
              <th className="num">Spend</th>
              <th className="num">ROAS</th>
              <th className="num">Orders</th>
              <th className="num">Posts</th>
              <th className="num">Clicks</th>
              <th className="num">Views</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.link ? <Link to={r.link}>{r.label}</Link> : r.label}</td>
                <td className="num">{formatCents(r.revenueCents)}</td>
                <td className="num">{formatCents(r.spendCents)}</td>
                <td className="num">{formatRoas(roas(r.revenueCents, r.spendCents))}</td>
                <td className="num">{r.orders}</td>
                <td className="num">{r.posts}</td>
                <td className="num">{r.clicks || '—'}</td>
                <td className="num">{r.views ? r.views.toLocaleString('en-GB') : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="muted">Nothing in this range.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td className="num">{formatCents(totals.revenueCents)}</td>
                <td className="num">{formatCents(totals.spendCents)}</td>
                <td className="num">{formatRoas(roas(totals.revenueCents, totals.spendCents))}</td>
                <td className="num">{totals.orders}</td>
                <td className="num">{totals.posts}</td>
                <td className="num">{totals.clicks || '—'}</td>
                <td className="num">{totals.views ? totals.views.toLocaleString('en-GB') : '—'}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
