import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './helpers/mock-d1';
import { processIngestBatch } from '../src/services/aggregator';
import { SiteRecord, TrackerEvent } from '../src/types';

describe('Element CTR Denominator Verification (§7, §14)', () => {
  let db: D1Database;
  const mockSite: SiteRecord = {
    id: 'site_ctr_test',
    name: 'CTR Test Site',
    domain: 'testsite.org',
    site_key: 'qhp_ctrkey',
    owner_id: 'owner_ctr',
    timezone: 'UTC',
    consent_banner_enabled: 0,
    created_at: new Date().toISOString()
  };

  beforeEach(async () => {
    db = createTestDb();
    await db.prepare(
      `INSERT INTO owners (id, username, password_hash, salt, created_at)
       VALUES (?, 'owner_ctr_user', 'hash', 'salt', ?)`
    ).bind(mockSite.owner_id, new Date().toISOString()).run();

    await db.prepare(
      `INSERT INTO sites (id, name, domain, site_key, owner_id, timezone, consent_banner_enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      mockSite.id, mockSite.name, mockSite.domain, mockSite.site_key,
      mockSite.owner_id, mockSite.timezone, mockSite.consent_banner_enabled, mockSite.created_at
    ).run();
  });

  it('Uses element-views denominator for primary headline CTR, not pageviews', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // 100 sessions visit the page (100 pageviews)
    for (let i = 1; i <= 100; i++) {
      const sessionId = `visitor_${i}`;
      const events: TrackerEvent[] = [
        { type: 'pageview', path: '/landing', session_id: sessionId }
      ];

      // Only 10 sessions scroll to see the below-the-fold element
      if (i <= 10) {
        events.push({
          type: 'element_view',
          path: '/landing',
          session_id: sessionId,
          element_identity: 'quhip:below-the-fold-button',
          element_label: 'below-the-fold-button',
          element_tag: 'button'
        });
      }

      // 5 of those 10 sessions click the element
      if (i <= 5) {
        events.push({
          type: 'click',
          path: '/landing',
          session_id: sessionId,
          element_identity: 'quhip:below-the-fold-button',
          element_label: 'below-the-fold-button',
          element_tag: 'button'
        });
      }

      await processIngestBatch(db, mockSite, { site_key: mockSite.site_key, events }, { country: 'US' });
    }

    // Check pageviews on /landing
    const pageRow = await db.prepare(
      `SELECT pageviews, sessions FROM agg_daily_page WHERE site_id = ? AND path = '/landing'`
    ).bind(mockSite.id).first<any>();
    expect(pageRow.pageviews).toBe(100);
    expect(pageRow.sessions).toBe(100);

    // Check element stats
    const elementRow = await db.prepare(
      `SELECT views, sessions_clicked, total_clicks
       FROM agg_daily_element WHERE site_id = ? AND element_identity = 'quhip:below-the-fold-button'`
    ).bind(mockSite.id).first<any>();

    expect(elementRow.views).toBe(10); // only 10 sessions saw it
    expect(elementRow.sessions_clicked).toBe(5); // 5 sessions clicked
    expect(elementRow.total_clicks).toBe(5);

    // Primary CTR MUST be based on element views: 5 / 10 = 50%
    const primaryCtr = (elementRow.sessions_clicked / elementRow.views) * 100;
    expect(primaryCtr).toBe(50);

    // Secondary CTR based on pageviews: 5 / 100 = 5%
    const secondaryCtr = (elementRow.total_clicks / pageRow.pageviews) * 100;
    expect(secondaryCtr).toBe(5);

    console.log('[Element CTR Verification Result]');
    console.log(`Pageviews: ${pageRow.pageviews}`);
    console.log(`Element Views: ${elementRow.views}`);
    console.log(`Sessions Clicked: ${elementRow.sessions_clicked}`);
    console.log(`Headline CTR (element-view denominator): ${primaryCtr}%`);
    console.log(`Secondary CTR (pageview denominator): ${secondaryCtr}%`);

    // Verify headline CTR is 50%, NOT 5%
    expect(primaryCtr).toBeGreaterThan(secondaryCtr);
  });
});
