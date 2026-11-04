import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './helpers/mock-d1';
import app from '../src/index';

describe('Small-Count Suppression Verification (§6, §7, §8, §14)', () => {
  let db: D1Database;
  const ownerId = 'owner_suppress_1';
  const siteId = 'site_suppress_1';
  const siteKey = 'qhp_suppress_key';
  const token = 'token_suppress_test_123';
  const today = new Date().toISOString().slice(0, 10);

  beforeEach(async () => {
    db = createTestDb();

    // Insert owner & auth session
    await db.prepare(
      `INSERT INTO owners (id, username, password_hash, salt, created_at)
       VALUES (?, 'admin_test', 'hash', 'salt', ?)`
    ).bind(ownerId, new Date().toISOString()).run();

    await db.prepare(
      `INSERT INTO auth_sessions (token, owner_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`
    ).bind(token, ownerId, Date.now(), Date.now() + 86400000).run();

    // Insert site
    await db.prepare(
      `INSERT INTO sites (id, name, domain, site_key, owner_id, timezone, consent_banner_enabled, created_at)
       VALUES (?, 'Suppression Test', 'suppress.org', ?, ?, 'UTC', 0, ?)`
    ).bind(siteId, siteKey, ownerId, new Date().toISOString()).run();

    // Seed Pages:
    // /rare-page with 3 sessions (< 5)
    await db.prepare(
      `INSERT INTO agg_daily_page (site_id, date, path, pageviews, sessions, entries, exits, bounces, total_active_time, active_times_json)
       VALUES (?, ?, '/rare-page', 3, 3, 3, 2, 1, 30, '[10, 10, 10]')`
    ).bind(siteId, today).run();

    // /popular-page with 10 sessions (>= 5)
    await db.prepare(
      `INSERT INTO agg_daily_page (site_id, date, path, pageviews, sessions, entries, exits, bounces, total_active_time, active_times_json)
       VALUES (?, ?, '/popular-page', 25, 10, 8, 4, 2, 200, '[20, 20, 20]')`
    ).bind(siteId, today).run();

    // Seed Elements:
    // rare-button with 2 views (< 5)
    await db.prepare(
      `INSERT INTO agg_daily_element (site_id, date, path, element_identity, element_label, element_tag, views, total_clicks, sessions_clicked)
       VALUES (?, ?, '/rare-page', 'quhip:rare-button', 'rare-button', 'button', 2, 2, 2)`
    ).bind(siteId, today).run();

    // popular-button with 8 views (>= 5)
    await db.prepare(
      `INSERT INTO agg_daily_element (site_id, date, path, element_identity, element_label, element_tag, views, total_clicks, sessions_clicked)
       VALUES (?, ?, '/popular-page', 'quhip:popular-button', 'popular-button', 'button', 8, 6, 6)`
    ).bind(siteId, today).run();

    // Seed Paths:
    // Path with 3 sessions (< 5)
    await db.prepare(
      `INSERT INTO agg_daily_paths (site_id, date, path_length, path_sequence, sessions)
       VALUES (?, ?, 2, '/home -> /rare-page', 3)`
    ).bind(siteId, today).run();

    // Path with 8 sessions (>= 5)
    await db.prepare(
      `INSERT INTO agg_daily_paths (site_id, date, path_length, path_sequence, sessions)
       VALUES (?, ?, 2, '/home -> /popular-page', 8)`
    ).bind(siteId, today).run();
  });

  it('Suppresses page metrics with < 5 sessions to "not enough data"', async () => {
    const res = await app.request(`/api/dashboard/overview?site_id=${siteId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }, { DB: db });

    expect(res.status).toBe(200);
    const data = await res.json() as any;

    const rarePage = data.top_pages.find((p: any) => p.path === '/rare-page');
    expect(rarePage).toBeDefined();
    // Must return 'not enough data' for small count sessions
    expect(rarePage.sessions).toBe('not enough data');
    expect(rarePage.bounce_rate).toBe('not enough data');
    expect(rarePage.avg_active_time).toBe('not enough data');

    const popularPage = data.top_pages.find((p: any) => p.path === '/popular-page');
    expect(popularPage).toBeDefined();
    expect(popularPage.sessions).toBe(10);
  });

  it('Suppresses element CTR with < 5 sessions to "not enough data"', async () => {
    const res = await app.request(`/api/dashboard/elements?site_id=${siteId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }, { DB: db });

    expect(res.status).toBe(200);
    const data = await res.json() as any;

    const rareEl = data.elements.find((e: any) => e.element_label === 'rare-button');
    expect(rareEl).toBeDefined();
    expect(rareEl.views).toBe('not enough data');
    expect(rareEl.sessions_clicked).toBe('not enough data');
    expect(rareEl.ctr).toBe('not enough data');

    const popEl = data.elements.find((e: any) => e.element_label === 'popular-button');
    expect(popEl).toBeDefined();
    expect(popEl.views).toBe(8);
    expect(popEl.sessions_clicked).toBe(6);
    expect(popEl.ctr).toBe(75); // 6 / 8 = 75%
  });

  it('Suppresses heatmaps when page has < 5 sessions and shows "not enough data"', async () => {
    // /rare-page has 3 sessions
    const rareHeatRes = await app.request(`/api/dashboard/heatmaps?site_id=${siteId}&path=/rare-page`, {
      headers: { Authorization: `Bearer ${token}` }
    }, { DB: db });

    const rareData = await rareHeatRes.json() as any;
    expect(rareData.has_enough_data).toBe(false);
    expect(rareData.message).toBe('not enough data');

    // /popular-page has 10 sessions
    const popHeatRes = await app.request(`/api/dashboard/heatmaps?site_id=${siteId}&path=/popular-page`, {
      headers: { Authorization: `Bearer ${token}` }
    }, { DB: db });

    const popData = await popHeatRes.json() as any;
    expect(popData.has_enough_data).toBe(true);
  });

  it('Suppresses top paths under 5 sessions', async () => {
    const res = await app.request(`/api/dashboard/paths?site_id=${siteId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }, { DB: db });

    expect(res.status).toBe(200);
    const data = await res.json() as any;

    const sequences = data.paths.map((p: any) => p.path_sequence);
    expect(sequences).toContain('/home -> /popular-page');
    // /home -> /rare-page had only 3 sessions and must be omitted/suppressed!
    expect(sequences).not.toContain('/home -> /rare-page');
  });
});
