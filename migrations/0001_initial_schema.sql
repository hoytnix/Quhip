-- Quhip Initial Schema: Aggregated Tables + Auth + Settings
-- Strictly no IP addresses, no user tracking, no query strings with PII/ad click IDs.

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  site_key TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  consent_banner_enabled INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sites_key ON sites(site_key);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'click', 'path', 'outbound'
  target TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_goals_site ON goals(site_id);

-- Daily site-level aggregated metrics
CREATE TABLE IF NOT EXISTS agg_daily_site (
  site_id TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  sessions INTEGER DEFAULT 0,
  pageviews INTEGER DEFAULT 0,
  bounces INTEGER DEFAULT 0,
  total_active_time INTEGER DEFAULT 0,
  active_times_json TEXT DEFAULT '[]',
  PRIMARY KEY (site_id, date)
);

-- Daily page-level aggregated metrics
CREATE TABLE IF NOT EXISTS agg_daily_page (
  site_id TEXT NOT NULL,
  date TEXT NOT NULL,
  path TEXT NOT NULL,
  pageviews INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  entries INTEGER DEFAULT 0,
  exits INTEGER DEFAULT 0,
  bounces INTEGER DEFAULT 0,
  total_active_time INTEGER DEFAULT 0,
  active_times_json TEXT DEFAULT '[]',
  PRIMARY KEY (site_id, date, path)
);

-- Daily element CTR and interactions table
CREATE TABLE IF NOT EXISTS agg_daily_element (
  site_id TEXT NOT NULL,
  date TEXT NOT NULL,
  path TEXT NOT NULL,
  element_identity TEXT NOT NULL,
  element_label TEXT NOT NULL,
  element_tag TEXT NOT NULL,
  views INTEGER DEFAULT 0, -- sessions that saw element
  total_clicks INTEGER DEFAULT 0, -- raw click events
  sessions_clicked INTEGER DEFAULT 0, -- unique sessions clicked
  rage_clicks INTEGER DEFAULT 0,
  dead_clicks INTEGER DEFAULT 0,
  is_outbound INTEGER DEFAULT 0,
  dest_domain TEXT DEFAULT '',
  PRIMARY KEY (site_id, date, path, element_identity)
);

-- Daily scroll depth milestones
CREATE TABLE IF NOT EXISTS agg_daily_scroll (
  site_id TEXT NOT NULL,
  date TEXT NOT NULL,
  path TEXT NOT NULL,
  reached_25 INTEGER DEFAULT 0,
  reached_50 INTEGER DEFAULT 0,
  reached_75 INTEGER DEFAULT 0,
  reached_100 INTEGER DEFAULT 0,
  total_max_depth INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,
  PRIMARY KEY (site_id, date, path)
);

-- Daily click heatmap coordinates (normalized 0-99 x/y buckets)
CREATE TABLE IF NOT EXISTS agg_daily_heatmap (
  site_id TEXT NOT NULL,
  date TEXT NOT NULL,
  path TEXT NOT NULL,
  x_bucket INTEGER NOT NULL,
  y_bucket INTEGER NOT NULL,
  clicks INTEGER DEFAULT 0,
  PRIMARY KEY (site_id, date, path, x_bucket, y_bucket)
);

-- Daily attribution metrics
CREATE TABLE IF NOT EXISTS agg_daily_attribution (
  site_id TEXT NOT NULL,
  date TEXT NOT NULL,
  channel TEXT NOT NULL,
  source TEXT NOT NULL,
  medium TEXT NOT NULL,
  campaign TEXT NOT NULL,
  term TEXT NOT NULL,
  content TEXT NOT NULL,
  sessions INTEGER DEFAULT 0,
  pageviews INTEGER DEFAULT 0,
  bounces INTEGER DEFAULT 0,
  PRIMARY KEY (site_id, date, channel, source, medium, campaign, term, content)
);

-- Daily context metrics (device, browser family, country)
CREATE TABLE IF NOT EXISTS agg_daily_context (
  site_id TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL, -- 'device', 'browser', 'country'
  value TEXT NOT NULL,
  sessions INTEGER DEFAULT 0,
  PRIMARY KEY (site_id, date, type, value)
);

-- Daily top aggregated paths (2- and 3-page sequences)
CREATE TABLE IF NOT EXISTS agg_daily_paths (
  site_id TEXT NOT NULL,
  date TEXT NOT NULL,
  path_length INTEGER NOT NULL,
  path_sequence TEXT NOT NULL,
  sessions INTEGER DEFAULT 0,
  PRIMARY KEY (site_id, date, path_sequence)
);

-- Daily goal conversions
CREATE TABLE IF NOT EXISTS agg_daily_goals (
  site_id TEXT NOT NULL,
  date TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  source TEXT NOT NULL,
  campaign TEXT NOT NULL,
  conversions INTEGER DEFAULT 0,
  PRIMARY KEY (site_id, date, goal_id, source, campaign)
);

-- Ephemeral session buffer for in-flight deduplication (cleaned up periodically, not queryable by dashboard)
CREATE TABLE IF NOT EXISTS active_sessions_buffer (
  site_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  landing_path TEXT NOT NULL,
  current_path TEXT NOT NULL,
  page_count INTEGER DEFAULT 1,
  path_history TEXT DEFAULT '[]',
  total_active_time INTEGER DEFAULT 0,
  has_interaction INTEGER DEFAULT 0,
  has_goal INTEGER DEFAULT 0,
  max_scroll INTEGER DEFAULT 0,
  elements_seen TEXT DEFAULT '[]',
  elements_clicked TEXT DEFAULT '[]',
  goals_completed TEXT DEFAULT '[]',
  source TEXT DEFAULT '',
  medium TEXT DEFAULT '',
  campaign TEXT DEFAULT '',
  channel TEXT DEFAULT 'direct',
  device_class TEXT DEFAULT 'desktop',
  browser_class TEXT DEFAULT 'other',
  country TEXT DEFAULT '',
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (site_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions_buffer(expires_at);

-- Ephemeral rate limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);
