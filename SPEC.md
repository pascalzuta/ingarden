# Ingarden — product spec

Influencer marketing system for a small team running Instagram Reels and Stories with discount codes and tracked links. Built on the Fire Sale stack: React 18 + Vite + TypeScript, Supabase (Postgres with row level security, auth, edge functions). Database lives in the `firesale-prod` Supabase project, tables prefixed `ig_`.

## Research basis

Twelve market-leading tools were studied at UI level (GRIN, Upfluence, CreatorIQ, Aspire, Traackr, Modash, Klear/Meltwater, Later Influence, Impact.com, Kolsquare, Influencity, HypeAuditor). Their feature sets converge on the same core, which this product implements:

1. A creator roster table with workflow status, fee, code, and revenue per row (the most-used screen in every tool).
2. One unique discount code per influencer as the attribution mechanism. Codes dominate over links for Reels and Stories because link attribution is cookie-bound and breaks across devices; codes survive word of mouth. Tracked links stay in the product as directional traffic data.
3. Deliverable tracking with planned versus actual publish date.
4. Three cost buckets per collaboration: flat fee, product or gifting cost, commission. Commission is out of scope for v1.
5. Automatic efficiency metrics (ROAS, CPM) so nobody maintains a spreadsheet.
6. Reporting at three levels: post, influencer lifetime, and month, with leaderboard sorting and date filters.
7. A CRM record per creator with contact details, rates, tags, relationship stage, and a full conversation log.

## Metric logic

Two moments matter, and every screen follows them.

Before a deal (influencer level): the manager manually records the influencer's median story views and median reel views over their last ~10 posts, next to the story and reel rates. Rate ÷ median views × 1,000 gives the story CPM and reel CPM, shown on the influencer profile and as roster columns. This is the price-versus-audience check that decides the deal.

After a post (post level): the scorecard is views (reach), clicks (via the post's tracked link), orders (attributed conversions), saves, revenue, and ROAS (revenue ÷ cost). These are the columns on the Posts page and the per-influencer post table.

Left out on purpose (the episodic 80% of features): influencer discovery and search, fake-follower audits, contracts and e-signature, mass payouts, content libraries, competitive benchmarking, automated Instagram metric ingestion (needs creator OAuth or scraping; metrics are entered manually per post instead).

## Users and access

Team members only. Access is a two-step gate: an admin lists the person's email in `ig_team_members`, then the person creates a Supabase auth account with that email. Row level security enforces the allowlist on every table, so a stray signup sees nothing. Roles: `admin` (can manage the team list) and `member`. Seeded admin: pascal.zuta@gmail.com.

## Data model

- `ig_team_members` — email (allowlist key), name, role, linked auth user.
- `ig_influencers` — name, Instagram handle, email, phone, manager/agency contact, address, status (prospect → contacted → negotiating → active → paused → ended), tags, follower count, average story/reel views, story and reel rates, default discount code, notes, owning team member.
- `ig_posts` — one row per deliverable: influencer, title/campaign label, format (reel, story, feed, other), status (planned → agreed → content review → scheduled → posted, or canceled), `scheduled_at` and `posted_at` (planned versus actual), fee, gifting cost, discount code, post URL, manual metrics (views, likes, comments, reach), notes.
- `ig_links` — tracked short links: slug, destination URL, owning influencer.
- `ig_link_clicks` — one row per click with timestamp, referrer, user agent. Written only by the edge function.
- `ig_conversions` — revenue events: date, discount code, revenue, order reference (unique, for de-dup), source (import, manual, code, link), optional explicit influencer or post.
- `ig_interactions` — conversation log: kind (note, email, DM, call, meeting), direction, body, timestamp, author.
- `ig_conversions_attributed` — view that resolves each conversion to an influencer and post.

Money is integer cents; default currency EUR.

## Attribution rules

A conversion is attributed in this order:

1. Explicit `post_id` or `influencer_id` on the row wins (manual entry).
2. Else the code matches a post using that code: the latest post with `posted_at` before the conversion gets it, and its influencer with it.
3. Else the code matches an influencer's default code: influencer-level attribution, no post.
4. Else unattributed (shown as such, never dropped).

This mirrors the industry model (Impact.com "Always Credit" per code, Later Influence's link-not-post rule): code-based revenue is trustworthy at influencer level, best-effort at post level.

Conversions come in through CSV import (Shopify order export works unchanged: Created at, Discount Code, Total, Name; German date and decimal formats accepted) or manual entry. Re-imports are de-duplicated by order reference.

Tracked links are served by the `go` Supabase edge function at `/functions/v1/go/<slug>`: it logs the click and 302-redirects. Clicks count as traffic per influencer; they do not attribute revenue.

## Screens

- **Dashboard** — this month's revenue, spend, ROAS, orders, posts running; six-month revenue-versus-spend chart; top-influencer leaderboard for the month; upcoming scheduled posts.
- **Influencers** — roster table: status, code, followers, post count, clicks, lifetime spend, lifetime revenue, ROAS. Search across name, handle, code, tags; status filter; inline creation.
- **Influencer detail** — the CRM record: editable profile and contact details, rates, tags; lifetime stat tiles; six-month performance chart; conversation log (add notes/emails/DMs/calls with direction, attributed to the team member); tracked links with click counts and creation form; all posts with scheduled versus ran dates, cost, and attributed revenue.
- **Posts** — all deliverables with influencer, format, status, scheduled and actual date (a "moved" badge when they differ), cost, revenue; filters by influencer and status; full create/edit form including manual view/like entry.
- **Reports** — the slice-and-dice screen: date range, group by influencer, month, format, or influencer × month, filter by influencer and format; columns revenue, spend, ROAS, orders, posts, clicks, views, CPM; totals row; CSV export.
- **Revenue** — CSV import with per-row error reporting, manual conversion entry, latest-conversions table showing attribution result.
- **Team** — member list with signup status; admins add or remove members.

## Non-goals for v1, candidates for v2

- Campaigns as a first-class entity (post `title` is a lightweight label today; promote to a table when multiple concurrent programs need separate budgets).
- Automatic Instagram metrics via creator OAuth.
- Shopify webhook ingestion (`orders/create`) replacing CSV import.
- Email sync (Gmail integration) into the conversation log.
- Commission-based deals and payout tracking.
- Custom workflow statuses.

## Operations

- Migrations in `supabase/migrations/`, applied to `firesale-prod`.
- Edge function source in `supabase/functions/go/`.
- Static SPA; build with `npm run build`, host anywhere with an SPA fallback (see README for a Render config).
- Tests: `npm run typecheck`, `npm test` (unit tests for money parsing, CSV import, stats rollups).
