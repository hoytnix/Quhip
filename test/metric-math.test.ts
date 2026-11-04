import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './helpers/mock-d1';
import { processIngestBatch } from '../src/services/aggregator';
import { SiteRecord, TrackerEvent } from '../src/types';

describe('Metric Math Verification (§5, §6, §14)', () => {
  let db: D1Database;
  const mockSite: SiteRecord = {
    id: 'site_test_123',
    name: 'Test Site',
    domain: 'example.com',
    site_key: 'qhp_testkey',
    owner_id: 'owner_1',
    timezone: 'UTC',
    consent_banner_enabled: 0,
    created_at: new Date().toISOString()
  };

  beforeEach(async () => {
    db = createTestDb();
    await db.prepare(
      `INSERT INTO owners (id, username, password_hash, salt, created_at)
       VALUES (?, 'owner_math', 'hash', 'salt', ?)`
    ).bind(mockSite.owner_id, new Date().toISOString()).run();

    await db.prepare(
      `INSERT INTO sites (id, name, domain, site_key, owner_id, timezone, consent_banner_enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      mockSite.id, mockSite.name, mockSite.domain, mockSite.site_key,
      mockSite.owner_id, mockSite.timezone, mockSite.consent_banner_enabled, mockSite.created_at
    ).run();

    // Create a goal
    await db.prepare(
      `INSERT INTO goals (id, site_id, name, type, target, created_at)
       VALUES ('goal_buy', ?, 'Buy Button', 'click', 'quhip:buy-cta', ?)`
    ).bind(mockSite.id, new Date().toISOString()).run();
  });

  it('Accurately computes pageviews, sessions, bounce rate, CTR, and goal conversion', async () => {
    // 1. Session 1: Pure Bounce (< 10s active time, 1 pageview, 0 interactions, 0 goals)
    const s1Events: TrackerEvent[] = [
      { type: 'pageview', path: '/home', session_id: 'sess_1', is_entry: true },
      { type: 'session_flush', path: '/home', session_id: 'sess_1', active_time: 4, is_exit: true }
    ];

    // 2. Session 2: Non-bounce by active time >= 10s
    const s2Events: TrackerEvent[] = [
      { type: 'pageview', path: '/blog', session_id: 'sess_2', is_entry: true },
      { type: 'session_flush', path: '/blog', session_id: 'sess_2', active_time: 14, is_exit: true }
    ];

    // 3. Session 3: Non-bounce by click interaction
    const s3Events: TrackerEvent[] = [
      { type: 'pageview', path: '/pricing', session_id: 'sess_3', is_entry: true },
      { type: 'element_view', path: '/pricing', session_id: 'sess_3', element_identity: 'quhip:buy-cta', element_label: 'buy-cta' },
      { type: 'click', path: '/pricing', session_id: 'sess_3', element_identity: 'quhip:buy-cta', element_label: 'buy-cta' },
      { type: 'session_flush', path: '/pricing', session_id: 'sess_3', active_time: 3, is_exit: true }
    ];

    // 4. Session 4: Non-bounce by scroll depth milestone >= 25%
    const s4Events: TrackerEvent[] = [
      { type: 'pageview', path: '/features', session_id: 'sess_4', is_entry: true },
      { type: 'scroll', path: '/features', session_id: 'sess_4', scroll_depth: 50 },
      { type: 'session_flush', path: '/features', session_id: 'sess_4', active_time: 5, is_exit: true }
    ];

    // 5. Session 5: Multi-page session (/home -> /pricing) with element view + click
    const s5Events: TrackerEvent[] = [
      { type: 'pageview', path: '/home', session_id: 'sess_5', is_entry: true },
      { type: 'session_flush', path: '/home', session_id: 'sess_5', active_time: 8 },
      { type: 'pageview', path: '/pricing', session_id: 'sess_5' },
      { type: 'element_view', path: '/pricing', session_id: 'sess_5', element_identity: 'quhip:buy-cta', element_label: 'buy-cta' },
      { type: 'click', path: '/pricing', session_id: 'sess_5', element_identity: 'quhip:buy-cta', element_label: 'buy-cta' },
      { type: 'session_flush', path: '/pricing', session_id: 'sess_5', active_time: 12, is_exit: true }
    ];

    // Process all 5 sessions
    await processIngestBatch(db, mockSite, { site_key: mockSite.site_key, events: s1Events }, { country: 'US' });
    await processIngestBatch(db, mockSite, { site_key: mockSite.site_key, events: s2Events }, { country: 'CA' });
    await processIngestBatch(db, mockSite, { site_key: mockSite.site_key, events: s3Events }, { country: 'GB' });
    await processIngestBatch(db, mockSite, { site_key: mockSite.site_key, events: s4Events }, { country: 'DE' });
    await processIngestBatch(db, mockSite, { site_key: mockSite.site_key, events: s5Events }, { country: 'US' });

    // Verify Site Aggregates
    const today = new Date().toISOString().slice(0, 10);
    const siteAgg = await db.prepare(
      `SELECT sessions, pageviews, bounces, total_active_time, active_times_json
       FROM agg_daily_site WHERE site_id = ? AND date = ?`
    ).bind(mockSite.id, today).first<any>();

    expect(siteAgg).not.toBeNull();
    console.log('[Metric Math Test Output]', siteAgg);

    // Total sessions must be exactly 5
    expect(siteAgg.sessions).toBe(5);

    // Total pageviews: 1 + 1 + 1 + 1 + 2 = 6
    expect(siteAgg.pageviews).toBe(6);

    // Exactly 1 bounce (Session 1 was the only one with 1 pageview, <10s active time, and 0 interactions)
    expect(siteAgg.bounces).toBe(1);

    // Bounce rate: 1 / 5 = 20%
    const bounceRate = Math.round((siteAgg.bounces / siteAgg.sessions) * 100);
    expect(bounceRate).toBe(20);

    // Total active time: 4 + 14 + 3 + 5 + 8 + 12 = 46s
    expect(siteAgg.total_active_time).toBe(46);

    // Verify Element CTR
    // Element 'quhip:buy-cta' was seen by Session 3 and Session 5 (2 sessions)
    // It was clicked by Session 3 and Session 5 (2 sessions)
    const elementAgg = await db.prepare(
      `SELECT views, sessions_clicked, total_clicks
       FROM agg_daily_element WHERE site_id = ? AND element_identity = 'quhip:buy-cta'`
    ).bind(mockSite.id).first<any>();

    expect(elementAgg).not.toBeNull();
    expect(elementAgg.views).toBe(2);
    expect(elementAgg.sessions_clicked).toBe(2);
    expect(elementAgg.total_clicks).toBe(2);
    const ctr = (elementAgg.sessions_clicked / elementAgg.views) * 100;
    expect(ctr).toBe(100);

    // Verify Goal Conversion
    // Goal 'goal_buy' was completed by Session 3 and Session 5 -> 2 conversions
    const goalAgg = await db.prepare(
      `SELECT conversions FROM agg_daily_goals WHERE site_id = ? AND goal_id = 'goal_buy'`
    ).bind(mockSite.id).first<any>();

    expect(goalAgg).not.toBeNull();
    expect(goalAgg.conversions).toBe(2);
    const conversionRate = (goalAgg.conversions / siteAgg.sessions) * 100;
    expect(conversionRate).toBe(40); // 2 / 5 = 40%
  });
});
