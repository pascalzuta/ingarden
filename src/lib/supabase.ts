import { createClient } from '@supabase/supabase-js';

// Shared firesale-prod project. The anon key is public by design; all access
// is enforced by row level security (ig_team_members allowlist).
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://uqkmvbeikxdrfeqshexi.supabase.co';
const anon =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxa212YmVpa3hkcmZlcXNoZXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzYxOTQsImV4cCI6MjA5MjYxMjE5NH0.8xEWlgdvfdydHNa45sKSApvOiX7If8nJb1zEi6VpSw0';

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const TRACKED_LINK_BASE = `${url}/functions/v1/go/`;
