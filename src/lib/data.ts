import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { AttributedConversion, Influencer, Post, TeamMember, TrackedLink } from './types';

export type ClickRow = { link_id: string; clicked_at: string };

export type AppData = {
  influencers: Influencer[];
  posts: Post[];
  links: TrackedLink[];
  clicks: ClickRow[];
  conversions: AttributedConversion[];
  members: TeamMember[];
};

const EMPTY: AppData = { influencers: [], posts: [], links: [], clicks: [], conversions: [], members: [] };

// Small-team tool: load everything once and slice client-side.
export function useAppData() {
  const [data, setData] = useState<AppData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [influencers, posts, links, clicks, conversions, members] = await Promise.all([
      supabase.from('ig_influencers').select('*').order('name'),
      supabase.from('ig_posts').select('*').order('scheduled_at', { ascending: false, nullsFirst: false }),
      supabase.from('ig_links').select('*').order('created_at', { ascending: false }),
      supabase.from('ig_link_clicks').select('link_id, clicked_at').order('clicked_at', { ascending: false }).limit(20000),
      supabase.from('ig_conversions_attributed').select('*').order('occurred_at', { ascending: false }).limit(20000),
      supabase.from('ig_team_members').select('*').order('created_at'),
    ]);
    const firstError = [influencers, posts, links, clicks, conversions, members].find((r) => r.error)?.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    setData({
      influencers: (influencers.data ?? []) as Influencer[],
      posts: (posts.data ?? []) as Post[],
      links: (links.data ?? []) as TrackedLink[],
      clicks: (clicks.data ?? []) as ClickRow[],
      conversions: (conversions.data ?? []) as AttributedConversion[],
      members: (members.data ?? []) as TeamMember[],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}

// link_id → influencer_id → click count
export function clicksByInfluencer(links: TrackedLink[], clicks: ClickRow[]): Map<string, number> {
  const linkToInfluencer = new Map(links.filter((l) => l.influencer_id).map((l) => [l.id, l.influencer_id!]));
  const out = new Map<string, number>();
  for (const c of clicks) {
    const inf = linkToInfluencer.get(c.link_id);
    if (inf) out.set(inf, (out.get(inf) ?? 0) + 1);
  }
  return out;
}
