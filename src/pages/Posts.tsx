import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppData } from '../lib/data';
import { formatCents, parseMoneyToCents } from '../lib/money';
import { formatRoas, postCostCents, roas } from '../lib/stats';
import { supabase } from '../lib/supabase';
import { POST_STATUS_LABELS, Post, PostStatus } from '../lib/types';

// Local datetime input value → ISO, and back.
function toInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromInputValue(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

export default function Posts() {
  const { data, loading, error, reload } = useAppData();
  const [statusFilter, setStatusFilter] = useState<'' | PostStatus>('');
  const [influencerFilter, setInfluencerFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="error-box">{error}</div>;

  const infName = (id: string) => data.influencers.find((i) => i.id === id)?.name ?? '(deleted)';

  const filtered = data.posts
    .filter((p) => (!statusFilter || p.status === statusFilter) && (!influencerFilter || p.influencer_id === influencerFilter))
    .sort((a, b) => ((a.scheduled_at || a.posted_at || '9999') < (b.scheduled_at || b.posted_at || '9999') ? 1 : -1));

  const revenueForPost = (postId: string) =>
    data.conversions.filter((c) => c.post_id === postId).reduce((s, c) => s + c.revenue_cents, 0);

  async function savePost(e: FormEvent<HTMLFormElement>, existing: Post | null) {
    e.preventDefault();
    setSaveError(null);
    const f = new FormData(e.currentTarget);
    const patch = {
      influencer_id: String(f.get('influencer_id')),
      title: String(f.get('title') || '').trim(),
      format: String(f.get('format')),
      status: String(f.get('status')),
      scheduled_at: fromInputValue(String(f.get('scheduled_at') || '')),
      posted_at: fromInputValue(String(f.get('posted_at') || '')),
      fee_cents: parseMoneyToCents(String(f.get('fee') || '')) ?? 0,
      gifting_cost_cents: parseMoneyToCents(String(f.get('gifting') || '')) ?? 0,
      discount_code: String(f.get('code') || '').trim(),
      post_url: String(f.get('post_url') || '').trim(),
      views: f.get('views') ? Number(f.get('views')) : null,
      saves: f.get('saves') ? Number(f.get('saves')) : null,
      link_id: String(f.get('link_id') || '') || null,
      notes: String(f.get('notes') || ''),
    };
    const q = existing
      ? supabase.from('ig_posts').update(patch).eq('id', existing.id)
      : supabase.from('ig_posts').insert(patch);
    const { error } = await q;
    if (error) {
      setSaveError(error.message);
      return;
    }
    setAdding(false);
    setEditing(null);
    reload();
  }

  const form = (existing: Post | null) => (
    <form className="panel" onSubmit={(e) => savePost(e, existing)} key={existing?.id ?? 'new'}>
      <h2>{existing ? 'Edit post' : 'New post'}</h2>
      {saveError && <div className="error-box">{saveError}</div>}
      <div className="form-grid">
        <label className="field">
          <span>Influencer *</span>
          <select name="influencer_id" defaultValue={existing?.influencer_id ?? ''} required>
            <option value="" disabled>Choose…</option>
            {data.influencers.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </label>
        <label className="field"><span>Title / campaign</span><input name="title" defaultValue={existing?.title ?? ''} placeholder="September push" /></label>
        <label className="field">
          <span>Format</span>
          <select name="format" defaultValue={existing?.format ?? 'reel'}>
            <option value="reel">Reel</option>
            <option value="story">Story</option>
            <option value="feed">Feed post</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" defaultValue={existing?.status ?? 'planned'}>
            {Object.entries(POST_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field"><span>Scheduled for</span><input name="scheduled_at" type="datetime-local" defaultValue={toInputValue(existing?.scheduled_at ?? null)} /></label>
        <label className="field"><span>Actually ran</span><input name="posted_at" type="datetime-local" defaultValue={toInputValue(existing?.posted_at ?? null)} /></label>
        <label className="field"><span>Fee</span><input name="fee" defaultValue={existing ? (existing.fee_cents / 100).toString() : ''} placeholder="500" /></label>
        <label className="field"><span>Gifting cost</span><input name="gifting" defaultValue={existing ? (existing.gifting_cost_cents / 100).toString() : ''} placeholder="0" /></label>
        <label className="field"><span>Discount code</span><input name="code" defaultValue={existing?.discount_code ?? ''} placeholder="defaults to none" /></label>
        <label className="field"><span>Post URL</span><input name="post_url" defaultValue={existing?.post_url ?? ''} placeholder="https://instagram.com/reel/…" /></label>
        <label className="field"><span>Views (reach)</span><input name="views" type="number" defaultValue={existing?.views ?? ''} /></label>
        <label className="field"><span>Saves</span><input name="saves" type="number" defaultValue={existing?.saves ?? ''} /></label>
        <label className="field">
          <span>Tracked link (for clicks)</span>
          <select name="link_id" defaultValue={existing?.link_id ?? ''}>
            <option value="">None</option>
            {data.links.map((l) => (
              <option key={l.id} value={l.id}>/go/{l.slug}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="field"><span>Notes</span><textarea name="notes" defaultValue={existing?.notes ?? ''} /></label>
      <div className="form-actions">
        <button className="primary" type="submit">{existing ? 'Save' : 'Create'}</button>
        <button type="button" onClick={() => { setAdding(false); setEditing(null); }}>Cancel</button>
      </div>
    </form>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Posts</h1>
          <div className="sub">Every deliverable: planned date, actual run date, cost, attributed revenue.</div>
        </div>
        <button className="primary" onClick={() => { setAdding(true); setEditing(null); }}>New post</button>
      </div>

      {(adding || editing) && form(editing)}

      <div className="filters">
        <select value={influencerFilter} onChange={(e) => setInfluencerFilter(e.target.value)}>
          <option value="">All influencers</option>
          {data.influencers.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | PostStatus)}>
          <option value="">All statuses</option>
          {Object.entries(POST_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="panel">
        <table className="data">
          <thead>
            <tr>
              <th>Influencer</th>
              <th>Format</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Ran</th>
              <th className="num">Cost</th>
              <th className="num">Views</th>
              <th className="num">Clicks</th>
              <th className="num">Orders</th>
              <th className="num">Saves</th>
              <th className="num">Revenue</th>
              <th className="num">ROAS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const late =
                p.scheduled_at && p.posted_at && new Date(p.posted_at).toDateString() !== new Date(p.scheduled_at).toDateString();
              const revenue = revenueForPost(p.id);
              const orders = data.conversions.filter((c) => c.post_id === p.id).length;
              const clicks = p.link_id ? data.clicks.filter((c) => c.link_id === p.link_id).length : null;
              return (
                <tr key={p.id}>
                  <td>
                    <Link to={`/influencers/${p.influencer_id}`}>{infName(p.influencer_id)}</Link>
                    {p.title && <div className="muted" style={{ fontSize: 12 }}>{p.title}</div>}
                  </td>
                  <td><span className="badge format">{p.format}</span></td>
                  <td><span className={`badge status-${p.status}`}>{POST_STATUS_LABELS[p.status]}</span></td>
                  <td>{p.scheduled_at ? new Date(p.scheduled_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                  <td>
                    {p.posted_at ? new Date(p.posted_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    {late && <span className="badge status-negotiating" title="Ran on a different day than scheduled" style={{ marginLeft: 6 }}>moved</span>}
                  </td>
                  <td className="num">{formatCents(postCostCents(p), p.currency)}</td>
                  <td className="num">{p.views?.toLocaleString('en-GB') ?? '—'}</td>
                  <td className="num">{clicks ?? '—'}</td>
                  <td className="num">{orders || '—'}</td>
                  <td className="num">{p.saves?.toLocaleString('en-GB') ?? '—'}</td>
                  <td className="num">{formatCents(revenue, p.currency)}</td>
                  <td className="num">{formatRoas(roas(revenue, postCostCents(p)))}</td>
                  <td><button className="small" onClick={() => { setEditing(p); setAdding(false); window.scrollTo(0, 0); }}>Edit</button></td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={13} className="muted">No posts match.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
