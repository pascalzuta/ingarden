# Ingarden

Influencer marketing system for a small team. Live at https://pascalzuta.github.io/ingarden/. Read SPEC.md before changing product behavior; it defines the data model, attribution rules, and metric logic.

## Stack

- React 18 + Vite + TypeScript single-page app, no backend server. All data access goes through supabase-js with row level security.
- Database: the shared `firesale-prod` Supabase project (`uqkmvbeikxdrfeqshexi`). This project also runs the separate Fire Sale product. Only touch tables prefixed `ig_` and the edge function `go`. Never modify Fire Sale's tables (profiles, items, ebay_*, growth_*, worker_*, and others without the prefix) or its triggers.
- Schema changes: add a SQL file under `supabase/migrations/` AND apply it to the live project (Supabase MCP `apply_migration`, or ask Pascal). Migrations go straight to production; keep them additive.
- Access control: every `ig_` table's RLS policy requires the caller to be in `ig_team_members` (matched by auth user id or login email). Keep it that way for new tables.
- React is written with classic JSX (`React.createElement` output, configured in vite.config.ts). React, ReactDOM, react-router and supabase-js load as UMD globals from `public/vendor/` (script tags in index.html) and are marked external in the build. Do not import new heavy dependencies without vendoring them the same way; the app bundle must stay small.
- Routing is hash-based (HashRouter) because GitHub Pages has no SPA rewrites.

## Metric logic (Pascal's model, applies everywhere)

- Before a deal, influencer level: the manager manually enters median story views and median reel views (over the last ~10 posts) plus story/reel rates. Story CPM = story rate ÷ median story views × 1,000; same for reels. Shown on the profile and as roster columns.
- After a post, post level: the scorecard is views (reach), clicks (from the post's tracked link), orders (attributed conversions), saves, revenue, ROAS (revenue ÷ cost). Any new post view must show these columns.
- Money is integer cents everywhere; default currency EUR.
- Attribution: a conversion's discount code matches the latest post using that code (posted before the conversion), else the influencer owning the code; explicit ids on the conversion win. Implemented in the `ig_conversions_attributed` SQL view; client aggregation in `src/lib/stats.ts`.

## Workflow

- Develop on branch `claude/upbeat-hamilton-3sjmyr` (or a branch off it) and push; `.github/workflows/pages.yml` runs typecheck-free CI (npm ci, tests, build) and publishes `dist/` to the `gh-pages` branch, which serves the live site.
- Before pushing: `npm run typecheck && npm test && npm run build` must all pass.
- Unit tests live next to the code (`src/lib/*.test.ts`, vitest). Pure logic (money parsing, CSV import, stats, CPM) is tested; add tests when touching those files.
- The demo data (influencers tagged `demo`, orders `DEMO-*`) is safe to delete; README has the SQL.

## Login for testing

Team access = row in `ig_team_members` + Supabase auth account with that email. Do not commit credentials. For an end-to-end check, create a throwaway auth user, confirm it and add it to `ig_team_members` via SQL, and delete both afterwards.
