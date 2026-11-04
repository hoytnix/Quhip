-- Clean reset of all Quhip tables without deleting SQLite file handles
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS active_sessions_buffer;
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS agg_daily_goals;
DROP TABLE IF EXISTS agg_daily_paths;
DROP TABLE IF EXISTS agg_daily_context;
DROP TABLE IF EXISTS agg_daily_attribution;
DROP TABLE IF EXISTS agg_daily_heatmap;
DROP TABLE IF EXISTS agg_daily_scroll;
DROP TABLE IF EXISTS agg_daily_element;
DROP TABLE IF EXISTS agg_daily_page;
DROP TABLE IF EXISTS agg_daily_site;
DROP TABLE IF EXISTS goals;
DROP TABLE IF EXISTS sites;
DROP TABLE IF EXISTS owners;

PRAGMA foreign_keys = ON;
