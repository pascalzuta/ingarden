-- Hardening pass after the security advisor run.
alter function public.ig_touch_updated_at() set search_path = public;

revoke execute on function public.ig_is_team_member() from anon;
revoke execute on function public.ig_is_admin() from anon;
revoke execute on function public.ig_claim_membership() from anon;
