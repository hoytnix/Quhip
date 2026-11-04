# Quhip — System Patterns & Architecture

## Architecture Overview
Quhip is a single deployable Cloudflare Worker project containing:
1. **Ingest API (`POST /api/event`)**:
   - Validates site key and payload structure.
   - Rate limits per site key.
   - Extracts coarse country from Cloudflare headers (`cf.country`).
   - Ignores bots and sessions under 1s active time with zero interactions.
   - Performs immediate in-memory rollup / D1 aggregation — never storing raw per-visitor event logs.
2. **Dashboard API (`/api/dashboard/*`)**:
   - Protected by owner authentication (PBKDF2/scrypt hashed password session or token).
   - Serves aggregated analytics, breakdowns, heatmaps, element CTR, and goal conversion metrics.
   - Enforces small-count suppression: metrics or paths with < 5 sessions return "not enough data".
3. **Dashboard App**:
   - Built-in lightweight UI served directly by Hono / Worker assets.
   - Multi-site management, date filtering, metric cards, element CTR table, heatmap overlay, attribution.
4. **Tracker Snippet (`quhip.js`)**:
   - Under 10 KB gzipped.
   - Ephemeral session ID in `sessionStorage` (regenerated on tab close or 30m inactivity).
   - Visibility API + throttled activity listeners for true Active Time calculation.
   - Delegated click listener with priority identifier (`data-quhip` > `id` > `aria-label` > structural selector).
   - IntersectionObserver (50% threshold) for element visibility counting.
   - Rage click detection (3+ clicks within 2s) and dead click flagging.
   - SPA route handling (`history.pushState`, `popstate`).
   - Batched transport via `navigator.sendBeacon` with `fetch(..., { keepalive: true })` fallback.
   - Degrades silently on network/server errors.

## D1 Data Model
Aggregated counter tables (no raw visitor event logs):
- `sites`: `id`, `name`, `domain`, `site_key`, `created_at`, `owner_id`, `settings_json`
- `agg_daily_site`: `site_id`, `date`, `sessions`, `pageviews`, `bounces`, `total_active_time`, `session_durations_json`
- `agg_daily_page`: `site_id`, `date`, `path`, `pageviews`, `entries`, `exits`, `total_active_time`, `bounces`, `active_times_json`
- `agg_daily_element`: `site_id`, `date`, `path`, `element_id`, `element_label`, `element_type`, `views`, `clicks`, `sessions_clicked`, `rage_clicks`, `dead_clicks`, `is_outbound`, `dest_domain`
- `agg_daily_scroll`: `site_id`, `date`, `path`, `sessions_reached_25`, `sessions_reached_50`, `sessions_reached_75`, `sessions_reached_100`, `total_max_depth`, `session_count`
- `agg_daily_heatmap_clicks`: `site_id`, `date`, `path`, `x_bucket`, `y_bucket`, `clicks`
- `agg_daily_attribution`: `site_id`, `date`, `channel`, `source`, `medium`, `campaign`, `term`, `content`, `sessions`, `pageviews`, `bounces`
- `agg_daily_paths`: `site_id`, `date`, `path_sequence`, `sessions`
- `goals`: `id`, `site_id`, `name`, `type` (click, path, outbound), `target`, `created_at`
- `agg_daily_goals`: `site_id`, `date`, `goal_id`, `source`, `campaign`, `conversions`
- `owner`: `id`, `username`, `password_hash`, `salt`, `created_at`
- `rate_limits`: temporary rate limit tracking in D1/in-memory
