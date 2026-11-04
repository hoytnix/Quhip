import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createTestDb } from './helpers/mock-d1';
import app from '../src/index';

describe('Per-Page Heatmaps & Live Preview Verification (§7, §8)', () => {
  let db: D1Database;
  const ownerId = 'owner_heat_test_1';
  const siteId = 'site_heat_test_1';
  const siteKey = 'qhp_heat_key_1';
  const token = 'token_heat_preview_123';
  const today = new Date().toISOString().slice(0, 10);

  beforeEach(async () => {
    db = createTestDb();

    // Insert owner & auth session
    await db.prepare(
      `INSERT INTO owners (id, username, password_hash, salt, created_at)
       VALUES (?, 'heat_admin', 'hash', 'salt', ?)`
    ).bind(ownerId, new Date().toISOString()).run();

    await db.prepare(
      `INSERT INTO auth_sessions (token, owner_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`
    ).bind(token, ownerId, Date.now(), Date.now() + 86400000).run();

    // Insert site with domain
    await db.prepare(
      `INSERT INTO sites (id, name, domain, site_key, owner_id, timezone, consent_banner_enabled, created_at)
       VALUES (?, 'Heatmap Demo', 'https://example.com', ?, ?, 'UTC', 0, ?)`
    ).bind(siteId, siteKey, ownerId, new Date().toISOString()).run();

    // Page 1: '/' with 12 sessions and 8 clicks
    await db.prepare(
      `INSERT INTO agg_daily_page (site_id, date, path, pageviews, sessions, entries, exits, bounces, total_active_time, active_times_json)
       VALUES (?, ?, '/', 30, 12, 10, 5, 2, 300, '[20, 25]')`
    ).bind(siteId, today).run();

    await db.prepare(
      `INSERT INTO agg_daily_heatmap (site_id, date, path, x_bucket, y_bucket, clicks)
       VALUES (?, ?, '/', 50, 25, 8)`
    ).bind(siteId, today).run();

    await db.prepare(
      `INSERT INTO agg_daily_scroll (site_id, date, path, reached_25, reached_50, reached_75, reached_100, total_max_depth, session_count)
       VALUES (?, ?, '/', 10, 8, 5, 2, 600, 10)`
    ).bind(siteId, today).run();

    // Page 2: '/pricing' with 6 sessions and 3 clicks
    await db.prepare(
      `INSERT INTO agg_daily_page (site_id, date, path, pageviews, sessions, entries, exits, bounces, total_active_time, active_times_json)
       VALUES (?, ?, '/pricing', 15, 6, 4, 3, 1, 150, '[15, 30]')`
    ).bind(siteId, today).run();

    await db.prepare(
      `INSERT INTO agg_daily_heatmap (site_id, date, path, x_bucket, y_bucket, clicks)
       VALUES (?, ?, '/pricing', 40, 60, 3)`
    ).bind(siteId, today).run();

    // Page 3: '/contact' with 2 sessions (< 5, suppressed)
    await db.prepare(
      `INSERT INTO agg_daily_page (site_id, date, path, pageviews, sessions, entries, exits, bounces, total_active_time, active_times_json)
       VALUES (?, ?, '/contact', 3, 2, 2, 2, 1, 40, '[20]')`
    ).bind(siteId, today).run();

    await db.prepare(
      `INSERT INTO agg_daily_heatmap (site_id, date, path, x_bucket, y_bucket, clicks)
       VALUES (?, ?, '/contact', 80, 80, 1)`
    ).bind(siteId, today).run();
  });

  it('GET /api/dashboard/heatmaps/pages returns per-page directory with session counts and click counts', async () => {
    const res = await app.request(`/api/dashboard/heatmaps/pages?site_id=${siteId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }, { DB: db });

    expect(res.status).toBe(200);
    const data = await res.json() as any;

    expect(data.domain).toBe('https://example.com');
    expect(data.pages).toHaveLength(3);

    const rootPage = data.pages.find((p: any) => p.path === '/');
    expect(rootPage).toBeDefined();
    expect(rootPage.has_enough_data).toBe(true);
    expect(rootPage.sessions).toBe(12);
    expect(rootPage.heatmap_clicks).toBe(8);

    const pricingPage = data.pages.find((p: any) => p.path === '/pricing');
    expect(pricingPage).toBeDefined();
    expect(pricingPage.has_enough_data).toBe(true);
    expect(pricingPage.sessions).toBe(6);
    expect(pricingPage.heatmap_clicks).toBe(3);

    const contactPage = data.pages.find((p: any) => p.path === '/contact');
    expect(contactPage).toBeDefined();
    expect(contactPage.has_enough_data).toBe(false);
    expect(contactPage.sessions).toBe('not enough data'); // Privacy small-count suppression!
    expect(contactPage.raw_sessions).toBe(2);
  });

  it('GET /api/dashboard/heatmaps returns per-page heatmap data and enforces 5-session threshold', async () => {
    // 1. Root page (12 sessions >= 5)
    const rootRes = await app.request(`/api/dashboard/heatmaps?site_id=${siteId}&path=/`, {
      headers: { Authorization: `Bearer ${token}` }
    }, { DB: db });

    expect(rootRes.status).toBe(200);
    const rootData = await rootRes.json() as any;
    expect(rootData.has_enough_data).toBe(true);
    expect(rootData.path).toBe('/');
    expect(rootData.domain).toBe('https://example.com');
    expect(rootData.sessions).toBe(12);
    expect(rootData.click_points).toEqual([
      { x_bucket: 50, y_bucket: 25, clicks: 8 }
    ]);
    expect(rootData.scroll_depth.pct_reached_25).toBe(100);

    // 2. Pricing page (6 sessions >= 5)
    const pricingRes = await app.request(`/api/dashboard/heatmaps?site_id=${siteId}&path=/pricing`, {
      headers: { Authorization: `Bearer ${token}` }
    }, { DB: db });

    expect(pricingRes.status).toBe(200);
    const pricingData = await pricingRes.json() as any;
    expect(pricingData.has_enough_data).toBe(true);
    expect(pricingData.path).toBe('/pricing');
    expect(pricingData.sessions).toBe(6);
    expect(pricingData.click_points).toEqual([
      { x_bucket: 40, y_bucket: 60, clicks: 3 }
    ]);

    // 3. Contact page (2 sessions < 5 -> suppressed)
    const contactRes = await app.request(`/api/dashboard/heatmaps?site_id=${siteId}&path=/contact`, {
      headers: { Authorization: `Bearer ${token}` }
    }, { DB: db });

    expect(contactRes.status).toBe(200);
    const contactData = await contactRes.json() as any;
    expect(contactData.has_enough_data).toBe(false);
    expect(contactData.message).toBe('not enough data');
    expect(contactData.sessions).toBe(2);
    expect(contactData.path).toBe('/contact');
  });

  it('GET /api/dashboard/preview proxies target HTML, strips X-Frame-Options, and injects <base> and interaction guard', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('example.com/pricing')) {
        return new Response(
          '<!DOCTYPE html><html><head><title>Pricing Page</title></head><body><h1>Choose your plan</h1><a href="/buy">Buy Now</a></body></html>',
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'X-Frame-Options': 'DENY',
              'Content-Security-Policy': "frame-ancestors 'none'"
            }
          }
        );
      }
      return new Response('Not Found', { status: 404 });
    });

    try {
      // Test authentication via query param ?token= (used by iframes)
      const res = await app.request(`/api/dashboard/preview?site_id=${siteId}&path=/pricing&token=${token}`, {}, { DB: db });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      // Must not contain X-Frame-Options DENY
      expect(res.headers.get('x-frame-options')).toBeNull();
      // Must allow iframe framing
      expect(res.headers.get('content-security-policy')).toBe("frame-ancestors 'self' *");

      const html = await res.text();
      // Must inject <base href="https://example.com/pricing">
      expect(html).toContain('<base href="https://example.com/pricing">');
      // Must inject click interaction guard (pointer-events: none on links)
      expect(html).toContain('pointer-events: none !important');
      expect(html).toContain('Choose your plan');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('GET /api/dashboard/preview returns friendly fallback card when origin is unreachable', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    try {
      const res = await app.request(`/api/dashboard/preview?site_id=${siteId}&path=/offline&token=${token}`, {}, { DB: db });

      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('Live Proxy Preview Unavailable');
      expect(html).toContain('Connection refused');
      expect(html).toContain('Direct Iframe');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
