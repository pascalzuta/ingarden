-- ============================================================
-- Ingarden — influencer marketing system, initial schema.
-- Lives in the shared firesale-prod Supabase project; every
-- table is prefixed ig_ and gated by the ig_team_members
-- allowlist, so Fire Sale's consumer users cannot see any of it.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Team allowlist. A row here (matched by login email) is what
-- grants access to the whole app.
-- ------------------------------------------------------------
create table if not exists public.ig_team_members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  role text not null default 'member' check (role in ('admin', 'member')),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.ig_team_members enable row level security;

create or replace function public.ig_is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ig_team_members m
    where m.user_id = auth.uid()
       or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.ig_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ig_team_members m
    where (m.user_id = auth.uid()
           or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      and m.role = 'admin'
  );
$$;

-- Called by the app after login to bind the auth user to their row.
create or replace function public.ig_claim_membership()
returns void
language sql
security definer
set search_path = public
as $$
  update public.ig_team_members
  set user_id = auth.uid()
  where user_id is null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create policy "ig_team_members_read" on public.ig_team_members
  for select using (public.ig_is_team_member());
create policy "ig_team_members_admin_insert" on public.ig_team_members
  for insert with check (public.ig_is_admin());
create policy "ig_team_members_admin_update" on public.ig_team_members
  for update using (public.ig_is_admin());
create policy "ig_team_members_admin_delete" on public.ig_team_members
  for delete using (public.ig_is_admin());

-- ------------------------------------------------------------
-- Influencers (the CRM core)
-- ------------------------------------------------------------
create table if not exists public.ig_influencers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  instagram_handle text not null default '',
  email text not null default '',
  phone text not null default '',
  manager_contact text not null default '',
  address text not null default '',
  status text not null default 'prospect'
    check (status in ('prospect', 'contacted', 'negotiating', 'active', 'paused', 'ended')),
  tags text[] not null default '{}',
  follower_count integer,
  avg_story_views integer,
  avg_reel_views integer,
  story_rate_cents integer,
  reel_rate_cents integer,
  currency text not null default 'EUR',
  discount_code text not null default '',
  notes text not null default '',
  owner_member_id uuid references public.ig_team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ig_influencers enable row level security;
create policy "ig_influencers_team" on public.ig_influencers
  for all using (public.ig_is_team_member()) with check (public.ig_is_team_member());

-- ------------------------------------------------------------
-- Tracked links (short slugs served by the `go` edge function)
-- ------------------------------------------------------------
create table if not exists public.ig_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  destination_url text not null,
  influencer_id uuid references public.ig_influencers(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.ig_links enable row level security;
create policy "ig_links_team" on public.ig_links
  for all using (public.ig_is_team_member()) with check (public.ig_is_team_member());

create table if not exists public.ig_link_clicks (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.ig_links(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  referrer text not null default '',
  user_agent text not null default ''
);

create index if not exists ig_link_clicks_link_time on public.ig_link_clicks (link_id, clicked_at);

alter table public.ig_link_clicks enable row level security;
-- Inserts come only from the edge function (service role, bypasses RLS).
create policy "ig_link_clicks_team_read" on public.ig_link_clicks
  for select using (public.ig_is_team_member());

-- ------------------------------------------------------------
-- Posts (deliverables: reels, stories)
-- ------------------------------------------------------------
create table if not exists public.ig_posts (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.ig_influencers(id) on delete cascade,
  title text not null default '',
  format text not null default 'reel' check (format in ('reel', 'story', 'feed', 'other')),
  status text not null default 'planned'
    check (status in ('planned', 'agreed', 'content_review', 'scheduled', 'posted', 'canceled')),
  scheduled_at timestamptz,
  posted_at timestamptz,
  fee_cents integer not null default 0,
  gifting_cost_cents integer not null default 0,
  currency text not null default 'EUR',
  discount_code text not null default '',
  link_id uuid references public.ig_links(id) on delete set null,
  post_url text not null default '',
  views integer,
  likes integer,
  comments_count integer,
  reach integer,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ig_posts_influencer on public.ig_posts (influencer_id, scheduled_at);

alter table public.ig_posts enable row level security;
create policy "ig_posts_team" on public.ig_posts
  for all using (public.ig_is_team_member()) with check (public.ig_is_team_member());

-- ------------------------------------------------------------
-- Conversions (revenue events, imported or entered manually)
-- ------------------------------------------------------------
create table if not exists public.ig_conversions (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null,
  discount_code text not null default '',
  revenue_cents integer not null default 0,
  currency text not null default 'EUR',
  order_ref text not null default '',
  source text not null default 'import' check (source in ('code', 'link', 'manual', 'import')),
  influencer_id uuid references public.ig_influencers(id) on delete set null,
  post_id uuid references public.ig_posts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ig_conversions_time on public.ig_conversions (occurred_at);
create index if not exists ig_conversions_code on public.ig_conversions (discount_code);
create unique index if not exists ig_conversions_order_ref
  on public.ig_conversions (order_ref) where order_ref <> '';

alter table public.ig_conversions enable row level security;
create policy "ig_conversions_team" on public.ig_conversions
  for all using (public.ig_is_team_member()) with check (public.ig_is_team_member());

-- ------------------------------------------------------------
-- Interactions (conversation log per influencer)
-- ------------------------------------------------------------
create table if not exists public.ig_interactions (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.ig_influencers(id) on delete cascade,
  kind text not null default 'note'
    check (kind in ('note', 'email', 'dm', 'call', 'meeting', 'status_change')),
  direction text check (direction in ('in', 'out')),
  body text not null default '',
  occurred_at timestamptz not null default now(),
  member_id uuid references public.ig_team_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ig_interactions_influencer on public.ig_interactions (influencer_id, occurred_at desc);

alter table public.ig_interactions enable row level security;
create policy "ig_interactions_team" on public.ig_interactions
  for all using (public.ig_is_team_member()) with check (public.ig_is_team_member());

-- ------------------------------------------------------------
-- Attribution view: resolve each conversion to an influencer and,
-- where possible, the most recent matching post before the sale.
-- ------------------------------------------------------------
create or replace view public.ig_conversions_attributed
with (security_invoker = true) as
select
  c.id,
  c.occurred_at,
  c.discount_code,
  c.revenue_cents,
  c.currency,
  c.order_ref,
  c.source,
  coalesce(c.influencer_id, p.influencer_id, i.id) as influencer_id,
  coalesce(c.post_id, p.id) as post_id
from public.ig_conversions c
left join lateral (
  select p.id, p.influencer_id
  from public.ig_posts p
  where c.post_id is null
    and c.discount_code <> ''
    and lower(p.discount_code) = lower(c.discount_code)
    and p.posted_at is not null
    and p.posted_at <= c.occurred_at
  order by p.posted_at desc
  limit 1
) p on true
left join public.ig_influencers i
  on c.influencer_id is null and p.id is null
 and c.discount_code <> ''
 and lower(i.discount_code) = lower(c.discount_code);

-- ------------------------------------------------------------
-- updated_at maintenance
-- ------------------------------------------------------------
create or replace function public.ig_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ig_influencers_touch on public.ig_influencers;
create trigger ig_influencers_touch before update on public.ig_influencers
  for each row execute function public.ig_touch_updated_at();

drop trigger if exists ig_posts_touch on public.ig_posts;
create trigger ig_posts_touch before update on public.ig_posts
  for each row execute function public.ig_touch_updated_at();

-- ------------------------------------------------------------
-- Bootstrap: first admin
-- ------------------------------------------------------------
insert into public.ig_team_members (email, name, role)
values ('pascal.zuta@gmail.com', 'Pascal Zuta', 'admin')
on conflict (email) do nothing;
