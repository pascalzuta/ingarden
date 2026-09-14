import { Link } from 'react-router-dom';
import MonthBars from '../components/MonthBars';
import { clicksByInfluencer, useAppData } from '../lib/data';
import { formatCents } from '../lib/money';
import { formatRoas, lastMonths, monthKey, monthlyRollup, roas, rollupByInfluencer } from '../lib/stats';
import { POST_STATUS_LABELS } from '../lib/types';

export default function Dashboard() {
  const { data, loading, error } = useAppData();
  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="error-box">{error}</div>;

  const months = lastMonths(6);
  const thisMonth = months[months.length - 1];
  const monthly = monthlyRollup(data.conversions, data.posts, months);
  const current = monthly[monthly.length - 1];

  const infRollup = rollupByInfluencer(
    data.conversions.filter((c) => monthKey(c.occurred_at) === thisMonth),
    data.posts.filter((p) => {
      const d = p.posted_at || p.scheduled_at;
      return d != null && monthKey(d) === thisMonth;
    }),
    clicksByInfluencer(data.links, data.clicks.filter((c) => monthKey(c.clicked_at) === thisMonth)),
  );
  const top = [...infRollup.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 5);
  const infName = (id: string) => data.influencers.find((i) => i.id === id)?.name ?? '(deleted)';

  const upcoming = data.posts
    .filter((p) => p.status !== 'posted' && p.status !== 'canceled' && p.scheduled_at)
    .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1))
    .slice(0, 8);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">This month at a glance, last six months below.</div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="label">Revenue (this month)</div>
          <div className="value">{formatCents(current.revenueCents)}</div>
        </div>
        <div className="stat">
          <div className="label">Spend (this month)</div>
          <div className="value">{formatCents(current.spendCents)}</div>
        </div>
        <div className="stat">
          <div className="label">ROAS</div>
          <div className="value">{formatRoas(roas(current.revenueCents, current.spendCents))}</div>
          <div className="hint">revenue ÷ spend</div>
        </div>
        <div className="stat">
          <div className="label">Orders</div>
          <div className="value">{current.conversions}</div>
        </div>
        <div className="stat">
          <div className="label">Posts running</div>
          <div className="value">{current.posts}</div>
        </div>
      </div>

      <div className="panel">
        <h2>Revenue vs spend, last 6 months</h2>
        <MonthBars rows={monthly} />
      </div>

      <div className="row-split">
        <div className="panel">
          <h2>Top influencers this month</h2>
          {top.length === 0 && <p className="muted">No attributed revenue yet this month.</p>}
          {top.length > 0 && (
            <table className="data">
              <thead>
                <tr>
                  <th>Influencer</th>
                  <th className="num">Revenue</th>
                  <th className="num">Spend</th>
                  <th className="num">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r) => (
                  <tr key={r.influencerId}>
                    <td>
                      <Link to={`/influencers/${r.influencerId}`}>{infName(r.influencerId)}</Link>
                    </td>
                    <td className="num">{formatCents(r.revenueCents)}</td>
                    <td className="num">{formatCents(r.spendCents)}</td>
                    <td className="num">{formatRoas(roas(r.revenueCents, r.spendCents))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h2>Upcoming posts</h2>
          {upcoming.length === 0 && <p className="muted">Nothing scheduled. Add posts under Posts.</p>}
          {upcoming.length > 0 && (
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Influencer</th>
                  <th>Format</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.scheduled_at!).toLocaleDateString('en-GB')}</td>
                    <td>
                      <Link to={`/influencers/${p.influencer_id}`}>{infName(p.influencer_id)}</Link>
                    </td>
                    <td><span className="badge format">{p.format}</span></td>
                    <td><span className={`badge status-${p.status}`}>{POST_STATUS_LABELS[p.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
