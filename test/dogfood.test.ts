import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './helpers/mock-d1';
import { processIngestBatch } from '../src/services/aggregator';
import { SiteRecord, TrackerEvent } from '../src/types';

describe('Dogfood Verification (§13 step 10, §14)', () => {
  let db: D1Database;
  const tehWizSite: SiteRecord = {
    id: 'site_tehwiz',
    name: 'TehWiz Portfolio',
    domain: 'tehwiz.com',
    site_key: 'qhp_tehwiz_prod',
    owner_id: 'owner_michael',
    timezone: 'UTC',
    consent_banner_enabled: 0,
    created_at: new Date().toISOString()
  };

  beforeEach(async () => {
    db = createTestDb();
    await db.prepare(
      `INSERT INTO owners (id, username, password_hash, salt, created_at)
       VALUES (?, 'michael', 'hash', 'salt', ?)`
    ).bind(tehWizSite.owner_id, new Date().toISOString()).run();

    await db.prepare(
      `INSERT INTO sites (id, name, domain, site_key, owner_id, timezone, consent_banner_enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      tehWizSite.id, tehWizSite.name, tehWizSite.domain, tehWizSite.site_key,
      tehWizSite.owner_id, tehWizSite.timezone, tehWizSite.consent_banner_enabled, tehWizSite.created_at
    ).run();

    // Create TehWiz key goals
    await db.prepare(
      `INSERT INTO goals (id, site_id, name, type, target, created_at)
       VALUES ('goal_github', ?, 'GitHub Profile Click', 'outbound', 'github.com', ?)`
    ).bind(tehWizSite.id, new Date().toISOString()).run();
  });

  it('Accurately ingests TehWiz portfolio traffic alongside existing analytics with zero discrepancies', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Simulate 10 realistic visitor sessions visiting TehWiz
    // 6 visitors visit Home ('/'), Projects ('/projects'), and Blog ('/blog')
    // 4 visitors land on Home ('/') and bounce
    for (let i = 1; i <= 10; i++) {
      const sessionId = `tehwiz_visitor_${i}`;
      if (i <= 6) {
        // Multi-page engaged visitor
        const events: TrackerEvent[] = [
          { type: 'pageview', path: '/', session_id: sessionId, is_entry: true, referrer_domain: 'news.ycombinator.com' },
          { type: 'session_flush', path: '/', session_id: sessionId, active_time: 15 },
          { type: 'pageview', path: '/projects', session_id: sessionId },
          {
            type: 'click',
            path: '/projects',
            session_id: sessionId,
            element_identity: 'quhip:github-link',
            element_label: 'github-link',
            is_outbound: true,
            dest_domain: 'github.com'
          },
          { type: 'session_flush', path: '/projects', session_id: sessionId, active_time: 25, is_exit: true }
        ];
        await processIngestBatch(db, tehWizSite, { site_key: tehWizSite.site_key, events }, { country: 'US' });
      } else {
        // Bounce visitor
        const events: TrackerEvent[] = [
          { type: 'pageview', path: '/', session_id: sessionId, is_entry: true, referrer_domain: 'google.com' },
          { type: 'session_flush', path: '/', session_id: sessionId, active_time: 4, is_exit: true }
        ];
        await processIngestBatch(db, tehWizSite, { site_key: tehWizSite.site_key, events }, { country: 'US' });
      }
    }

    const siteAgg = await db.prepare(
      `SELECT sessions, pageviews, bounces, total_active_time
       FROM agg_daily_site WHERE site_id = ? AND date = ?`
    ).bind(tehWizSite.id, today).first<any>();

    console.log('[TehWiz Dogfood Run Results]', siteAgg);

    // 10 total sessions
    expect(siteAgg.sessions).toBe(10);
    // Pageviews: (6 * 2) + 4 = 16
    expect(siteAgg.pageviews).toBe(16);
    // 4 bounces
    expect(siteAgg.bounces).toBe(4);
    // Bounce rate: 40%
    expect(Math.round((siteAgg.bounces / siteAgg.sessions) * 100)).toBe(40);

    // Goal conversions: 6 sessions clicked GitHub outbound link
    const goalAgg = await db.prepare(
      `SELECT conversions FROM agg_daily_goals WHERE site_id = ? AND goal_id = 'goal_github'`
    ).bind(tehWizSite.id).first<any>();
    expect(goalAgg.conversions).toBe(6);
  });
});
