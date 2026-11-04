# Quhip — System Patterns & Architecture

## Architecture
- **Ingest (`POST /api/event`, `GET /api/config`)**: Validates site keys, applies rate limiting, extracts `cf.country`, drops bots, immediately rolls up metrics into D1 (no raw event storage). Exposes public site config for dynamic consent banner auto-discovery.
- **Dashboard API & UI (`/api/dashboard/*`)**: PBKDF2 authenticated, enforces small-count suppression (< 5 sessions returns "not enough data"), serves embedded dashboard SPA directly from the Worker.
- **Client Snippet (`quhip.js`, < 5 KB gzip)**: Ephemeral `sessionStorage` ID (destroyed on tab close or 30m inactivity), Active Time via visibility API, delegated click capture (`data-quhip` > `id` > `aria-label` > CSS), 50% `IntersectionObserver` visibility, rage/dead click detection, SPA route tracking, batched transport via `navigator.sendBeacon` with `fetch(keepalive)` fallback.

## D1 Data Model
Aggregated counter tables (zero raw per-visitor logs):
- `sites`: `id`, `name`, `domain`, `site_key`, `created_at`, `owner_id`, `settings_json`
- `agg_daily_site`: `site_id`, `date`, `sessions`, `pageviews`, `bounces`, `total_active_time`, `session_durations_json`
- `agg_daily_page`: `site_id`, `date`, `path`, `pageviews`, `entries`, `exits`, `total_active_time`, `bounces`, `active_times_json`
- `agg_daily_element`: `site_id`, `date`, `path`, `element_id`, `element_label`, `element_type`, `views`, `clicks`, `sessions_clicked`, `rage_clicks`, `dead_clicks`, `is_outbound`, `dest_domain`
- `agg_daily_scroll`: `site_id`, `date`, `path`, `sessions_reached_25/50/75/100`, `total_max_depth`, `session_count`
- `agg_daily_heatmap_clicks`: `site_id`, `date`, `path`, `x_bucket`, `y_bucket`, `clicks`
- `agg_daily_attribution`: `site_id`, `date`, `channel`, `source`, `medium`, `campaign`, `term`, `content`, `sessions`, `pageviews`, `bounces`
- `agg_daily_paths`: `site_id`, `date`, `path_sequence`, `sessions`
- `goals` & `agg_daily_goals`: goal rules (click, path, outbound) and daily conversion counts
- `owner` & `rate_limits`: credentials and rolling window rate limit counters
