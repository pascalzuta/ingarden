import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clicksByInfluencer, useAppData } from '../lib/data';
import { formatCents } from '../lib/money';
import { formatRoas, roas, rollupByInfluencer } from '../lib/stats';
import { supabase } from '../lib/supabase';
import { INFLUENCER_STATUS_LABELS, InfluencerStatus } from '../lib/types';

export default function Influencers() {
  const { data, loading, error, reload } = useAppData();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | InfluencerStatus>('');
  const [adding, setAdding] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const navigate = useNavigate();

  const rollup = useMemo(
    () => rollupByInfluencer(data.conversions, data.posts, clicksByInfluencer(data.links, data.clicks)),
    [data],
  );

  const filtered = data.influencers.filter((i) => {
    if (statusFilter && i.status !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      i.name.toLowerCase().includes(q) ||
      i.instagram_handle.toLowerCase().includes(q) ||
      i.discount_code.toLowerCase().includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  async function addInfluencer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError(null);
    const form = new FormData(e.currentTarget);
    const { data: row, error } = await supabase
      .from('ig_influencers')
      .insert({
        name: String(form.get('name') || '').trim(),
        instagram_handle: String(form.get('handle') || '').trim().replace(/^@/, ''),
        email: String(form.get('email') || '').trim(),
        discount_code: String(form.get('code') || '').trim(),
        status: 'prospect',
      })
      .select('id')
      .single();
    if (error) {
      setSaveError(error.message);
      return;
    }
    navigate(`/influencers/${row.id}`);
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Influencers</h1>
          <div className="sub">{data.influencers.length} in the roster. Lifetime numbers per influencer.</div>
        </div>
        <button className="primary" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Close' : 'New influencer'}
        </button>
      </div>

      {adding && (
        <form className="panel" onSubmit={addInfluencer}>
          <h2>New influencer</h2>
          {saveError && <div className="error-box">{saveError}</div>}
          <div className="form-grid">
            <label className="field"><span>Name *</span><input name="name" required /></label>
            <label className="field"><span>Instagram handle</span><input name="handle" placeholder="@handle" /></label>
            <label className="field"><span>Email</span><input name="email" type="email" /></label>
            <label className="field"><span>Discount code</span><input name="code" placeholder="ANNA20" /></label>
          </div>
          <div className="form-actions">
            <button className="primary" type="submit">Create and open</button>
          </div>
        </form>
      )}

      <div className="filters">
        <input placeholder="Search name, handle, code, tag…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 260 }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | InfluencerStatus)}>
          <option value="">All statuses</option>
          {Object.entries(INFLUENCER_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="small" onClick={reload}>Refresh</button>
      </div>

      <div className="panel">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Handle</th>
              <th>Status</th>
              <th>Code</th>
              <th className="num">Followers</th>
              <th className="num">Posts</th>
              <th className="num">Clicks</th>
              <th className="num">Spend</th>
              <th className="num">Revenue</th>
              <th className="num">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const r = rollup.get(i.id);
              return (
                <tr key={i.id} className="clickable" onClick={() => navigate(`/influencers/${i.id}`)}>
                  <td><Link to={`/influencers/${i.id}`}>{i.name}</Link></td>
                  <td className="muted">{i.instagram_handle && `@${i.instagram_handle}`}</td>
                  <td><span className={`badge status-${i.status}`}>{INFLUENCER_STATUS_LABELS[i.status]}</span></td>
                  <td className="mono">{i.discount_code}</td>
                  <td className="num">{i.follower_count?.toLocaleString('en-GB') ?? '—'}</td>
                  <td className="num">{r?.posts ?? 0}</td>
                  <td className="num">{r?.clicks ?? 0}</td>
                  <td className="num">{formatCents(r?.spendCents ?? 0, i.currency)}</td>
                  <td className="num">{formatCents(r?.revenueCents ?? 0, i.currency)}</td>
                  <td className="num">{formatRoas(roas(r?.revenueCents ?? 0, r?.spendCents ?? 0))}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="muted">No influencers match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
