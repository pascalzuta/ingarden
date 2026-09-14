// Tracked-link redirect: GET /go/{slug} logs a click and 302s to the
// destination. Deployed with verify_jwt=false so it is publicly reachable.
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const slug = parts[parts.length - 1] || '';
  if (!slug || slug === 'go') {
    return new Response('Not found', { status: 404 });
  }

  const { data: link } = await supabase
    .from('ig_links')
    .select('id, destination_url, active')
    .eq('slug', slug)
    .maybeSingle();

  if (!link || !link.active) {
    return new Response('Not found', { status: 404 });
  }

  // Log the click; the redirect must not fail if logging does.
  try {
    await supabase.from('ig_link_clicks').insert({
      link_id: link.id,
      referrer: req.headers.get('referer') ?? '',
      user_agent: req.headers.get('user-agent') ?? '',
    });
  } catch (_e) {
    // ignore
  }

  return new Response(null, {
    status: 302,
    headers: { Location: link.destination_url, 'Cache-Control': 'no-store' },
  });
});
