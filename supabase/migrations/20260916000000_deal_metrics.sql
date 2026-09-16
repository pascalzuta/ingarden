-- Pre-deal economics: the manager records MEDIAN story/reel views over the
-- last ~10 posts; rate ÷ median views × 1000 is the story/reel CPM.
-- Post scorecard gains saves.

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'ig_influencers'
               and column_name = 'avg_story_views') then
    alter table public.ig_influencers rename column avg_story_views to median_story_views;
    alter table public.ig_influencers rename column avg_reel_views to median_reel_views;
  end if;
end $$;

alter table public.ig_posts add column if not exists saves integer;
