# Ingarden

Influencer marketing system for the team: influencer CRM with conversation log, post planning (scheduled vs actual run date), budget per post, and revenue attribution through discount codes and tracked links.

Stack, shared with the Fire Sale project: React 18 + Vite + TypeScript, Supabase (Postgres, auth, edge functions). The database lives in the `firesale-prod` Supabase project; every table is prefixed `ig_` and locked down by row level security to the `ig_team_members` allowlist. See `SPEC.md` for the full product spec.

## Run it

```
npm install
npm run dev
```

The Supabase URL and anon key are baked in (`src/lib/supabase.ts`); no env file needed. To point elsewhere set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Deploy

`npm run build` produces a static site in `dist/`. Host it anywhere that serves static files with SPA fallback to `index.html` (Render static site, Netlify, Vercel). A Render config matching Fire Sale's setup:

```yaml
# render.yaml
services:
  - type: web
    name: ingarden
    runtime: static
    buildCommand: npm install && npm run build
    staticPublishPath: dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

## Logins

Access is a two-step gate:

1. An admin adds the person's email under **Team** in the app.
2. The person opens the app, clicks "Create account" with exactly that email, confirms the email, and signs in.

`pascal.zuta@gmail.com` is seeded as admin. Accounts without a team entry can sign in but see nothing (enforced by RLS, not just the UI).

## Revenue data

- **Discount codes**: import a Shopify order export (or any CSV with date + revenue columns) under **Revenue**. Rows are de-duplicated by order reference, so re-importing is safe. A conversion is attributed to the latest post using its code, else to the influencer owning the code.
- **Tracked links**: create a link on an influencer's page. It is served at `https://uqkmvbeikxdrfeqshexi.supabase.co/functions/v1/go/<slug>` (edge function `supabase/functions/go`), logs every click, and redirects.

## Demo data

Three influencers tagged `demo` with posts and conversions are seeded so the dashboards show something. Remove them with:

```sql
delete from ig_conversions where order_ref like 'DEMO-%';
delete from ig_influencers where 'demo' = any(tags);
```

## Tests

```
npm run typecheck
npm test
npm run build
```
