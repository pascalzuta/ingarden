import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MonthBars from '../components/MonthBars';
import { useAppData } from '../lib/data';
import { formatCents, parseMoneyToCents } from '../lib/money';
import { formatRoas, lastMonths, monthlyRollup, postCostCents, roas } from '../lib/stats';
import { TRACKED_LINK_BASE, supabase } from '../lib/supabase';
import {
  INFLUENCER_STATUS_LABELS,
  Influencer,
  InfluencerStatus,
  Interaction,
  POST_STATUS_LABELS,
  TeamMember,
} from '../lib/types';

export default function InfluencerDetail({ member }: { member: TeamMember }) {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useAppData();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const influencer = data.influencers.find((i) => i.id === id) ?? null;

  useEffect(() => {
    if (!id) return;
    supabase
      .from('ig_interactions')
      .select('*')
      .eq('influencer_id', id)
      .order('occurred_at', { ascending: false })
      .then(({ data }) => setInteractions((data as Interaction[]) ?? []));
  }, [id]);

  const posts = useMemo(
    () =>
      data.posts
        .filter((p) => p.influencer_id === id)
        .sort((a, b) => ((b.posted_at || b.scheduled_at || '') < (a.posted_at || a.scheduled_at || '') ? -1 : 1)),
    [data.posts, id],
  );
  const conversions = useMemo(() => data.conversions.filter((c) => c.influencer_id === id), [data.conversions, id]);
  const links = useMemo(() => data.links.filter((l) => l.influencer_id === id), [data.links, id]);
  const clicksForLink = (linkId: string) => data.clicks.filter((c) => c.link_id === linkId).length;

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="error-box">{error}</div>;
  if (!influencer) return <div className="error-box">Influencer not found. <Link to="/influencers">Back to list</Link></div>;

  const months = lastMonths(6);
  const monthly = monthlyRollup(conversions, posts, months);
  const totalRevenue = conversions.reduce((s, c) => s + c.revenue_cents, 0);
  const totalSpend = posts.filter((p) => p.status !== 'canceled').reduce((s, p) => s + postCostCents(p), 0);
  const revenueForPost = (postId: string) => conversions.filter((c) => c.post_id === postId).reduce((s, c) => s + c.revenue_cents, 0);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveMsg(null);
    setSaveError(null);
    const f = new FormData(e.currentTarget);
    const patch: Partial<Influencer> = {
      name: String(f.get('name') || '').trim(),
      instagram_handle: String(f.get('handle') || '').trim().replace(/^@/, ''),
      email: String(f.get('email') || '').trim(),
      phone: String(f.get('phone') || '').trim(),
      manager_contact: String(f.get('manager') || '').trim(),
      status: String(f.get('status')) as InfluencerStatus,
      discount_code: String(f.get('code') || '').trim(),
      tags: String(f.get('tags') || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      follower_count: f.get('followers') ? Number(f.get('followers')) : null,
      story_rate_cents: parseMoneyToCents(String(f.get('story_rate') || '')),
      reel_rate_cents: parseMoneyToCents(String(f.get('reel_rate') || '')),
      notes: String(f.get('notes') || ''),
    };
    const { error } = await supabase.from('ig_influencers').update(patch).eq('id', influencer!.id);
    if (error) setSaveError(error.message);
    else {
      setSaveMsg('Saved.');
      reload();
    }
  }

  async function addInteraction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const body = String(f.get('body') || '').trim();
    if (!body) return;
    const { error } = await supabase.from('ig_interactions').insert({
      influencer_id: influencer!.id,
      kind: String(f.get('kind')),
      direction: (f.get('direction') as string) || null,
      body,
      member_id: member.id,
    });
    if (!error) {
      form.reset();
      const { data } = await supabase
        .from('ig_interactions')
        .select('*')
        .eq('influencer_id', influencer!.id)
        .order('occurred_at', { ascending: false });
      setInteractions((data as Interaction[]) ?? []);
    }
  }

  async function addLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const slug = String(f.get('slug') || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const destination = String(f.get('destination') || '').trim();
    if (!slug || !destination) return;
    const { error } = await supabase.from('ig_links').insert({
      slug,
      destination_url: destination,
      influencer_id: influencer!.id,
    });
    if (error) setSaveError(error.message);
    else {
      form.reset();
      reload();
    }
  }

  const memberName = (mid: string | null) => data.members.find((m) => m.id === mid)?.name || 'Someone';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{influencer.name}</h1>
          <div className="sub">
            {influencer.instagram_handle && (
              <a href={`https://instagram.com/${influencer.instagram_handle}`} target="_blank" rel="noreferrer">
                @{influencer.instagram_handle}
              </a>
            )}{' '}
            <span className={`badge status-${influencer.status}`}>{INFLUENCER_STATUS_LABELS[influencer.status]}</span>
          </div>
        </div>
        <Link to="/influencers">← All influencers</Link>
      </div>

      <div className="stat-row">
        <div className="stat"><div className="label">Lifetime revenue</div><div className="value">{formatCents(totalRevenue, influencer.currency)}</div></div>
        <div className="stat"><div className="label">Lifetime spend</div><div className="value">{formatCents(totalSpend, influencer.currency)}</div></div>
        <div className="stat"><div className="label">ROAS</div><div className="value">{formatRoas(roas(totalRevenue, totalSpend))}</div></div>
        <div className="stat"><div className="label">Orders</div><div className="value">{conversions.length}</div></div>
        <div className="stat"><div className="label">Posts</div><div className="value">{posts.filter((p) => p.status !== 'canceled').length}</div></div>
      </div>

      <div className="panel">
        <h2>Monthly performance (last 6 months)</h2>
        <MonthBars rows={monthly} />
      </div>

      <div className="row-split">
        <div>
          <form className="panel" onSubmit={saveProfile}>
            <h2>Profile & contact</h2>
            {saveError && <div className="error-box">{saveError}</div>}
            {saveMsg && <div className="ok-box">{saveMsg}</div>}
            <div className="form-grid">
              <label className="field"><span>Name</span><input name="name" defaultValue={influencer.name} required /></label>
              <label className="field"><span>Instagram handle</span><input name="handle" defaultValue={influencer.instagram_handle} /></label>
              <label className="field"><span>Email</span><input name="email" defaultValue={influencer.email} /></label>
              <label className="field"><span>Phone</span><input name="phone" defaultValue={influencer.phone} /></label>
              <label className="field"><span>Manager / agency</span><input name="manager" defaultValue={influencer.manager_contact} /></label>
              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue={influencer.status}>
                  {Object.entries(INFLUENCER_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="field"><span>Discount code</span><input name="code" defaultValue={influencer.discount_code} /></label>
              <label className="field"><span>Tags (comma-separated)</span><input name="tags" defaultValue={influencer.tags.join(', ')} /></label>
              <label className="field"><span>Followers</span><input name="followers" type="number" defaultValue={influencer.follower_count ?? ''} /></label>
              <label className="field"><span>Story rate</span><input name="story_rate" defaultValue={influencer.story_rate_cents != null ? (influencer.story_rate_cents / 100).toString() : ''} /></label>
              <label className="field"><span>Reel rate</span><input name="reel_rate" defaultValue={influencer.reel_rate_cents != null ? (influencer.reel_rate_cents / 100).toString() : ''} /></label>
            </div>
            <label className="field"><span>Notes</span><textarea name="notes" defaultValue={influencer.notes} /></label>
            <div className="form-actions"><button className="primary" type="submit">Save</button></div>
          </form>

          <div className="panel">
            <h2>Tracked links</h2>
            {links.length > 0 && (
              <table className="data">
                <thead>
                  <tr><th>Link</th><th>Destination</th><th className="num">Clicks</th></tr>
                </thead>
                <tbody>
                  {links.map((l) => (
                    <tr key={l.id}>
                      <td className="mono">
                        <a href={`${TRACKED_LINK_BASE}${l.slug}`} target="_blank" rel="noreferrer">/go/{l.slug}</a>
                      </td>
                      <td className="muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.destination_url}</td>
                      <td className="num">{clicksForLink(l.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <form onSubmit={addLink} style={{ marginTop: 10 }}>
              <div className="form-grid">
                <label className="field"><span>Slug</span><input name="slug" placeholder="anna-sept" required /></label>
                <label className="field"><span>Destination URL</span><input name="destination" type="url" placeholder="https://shop.example.com/?utm_source=anna" required /></label>
              </div>
              <button className="small" type="submit">Create tracked link</button>
            </form>
          </div>
        </div>

        <div>
          <div className="panel">
            <h2>Conversation log</h2>
            <form onSubmit={addInteraction}>
              <div className="filters">
                <select name="kind" defaultValue="note">
                  <option value="note">Note</option>
                  <option value="email">Email</option>
                  <option value="dm">DM</option>
                  <option value="call">Call</option>
                  <option value="meeting">Meeting</option>
                </select>
                <select name="direction" defaultValue="">
                  <option value="">—</option>
                  <option value="out">Sent</option>
                  <option value="in">Received</option>
                </select>
              </div>
              <label className="field"><textarea name="body" placeholder="What was said or agreed…" /></label>
              <button className="small primary" type="submit">Log it</button>
            </form>
            <ul className="timeline" style={{ marginTop: 14 }}>
              {interactions.map((it) => (
                <li key={it.id}>
                  <div className="meta">
                    {new Date(it.occurred_at).toLocaleString('en-GB')} · {it.kind}
                    {it.direction ? (it.direction === 'in' ? ' · received' : ' · sent') : ''} · {memberName(it.member_id)}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{it.body}</div>
                </li>
              ))}
              {interactions.length === 0 && <li className="muted">Nothing logged yet.</li>}
            </ul>
          </div>

          <div className="panel">
            <h2>Posts</h2>
            <table className="data">
              <thead>
                <tr>
                  <th>Scheduled</th>
                  <th>Ran</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th className="num">Cost</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id}>
                    <td>{p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString('en-GB') : '—'}</td>
                    <td>{p.posted_at ? new Date(p.posted_at).toLocaleDateString('en-GB') : '—'}</td>
                    <td><span className="badge format">{p.format}</span></td>
                    <td><span className={`badge status-${p.status}`}>{POST_STATUS_LABELS[p.status]}</span></td>
                    <td className="num">{formatCents(postCostCents(p), p.currency)}</td>
                    <td className="num">{formatCents(revenueForPost(p.id), p.currency)}</td>
                  </tr>
                ))}
                {posts.length === 0 && <tr><td colSpan={6} className="muted">No posts yet. Add one under Posts.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
