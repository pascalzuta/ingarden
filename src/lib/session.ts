import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { TeamMember } from './types';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

// Resolves the logged-in user's team membership; null means no access.
export function useMembership(session: Session | null) {
  const [member, setMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!session) {
      setMember(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      await supabase.rpc('ig_claim_membership');
      const { data } = await supabase
        .from('ig_team_members')
        .select('*')
        .or(`user_id.eq.${session.user.id},email.ilike.${session.user.email ?? ''}`)
        .maybeSingle();
      if (alive) {
        setMember((data as TeamMember | null) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [session]);

  return { member, loading };
}
