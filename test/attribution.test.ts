import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './helpers/mock-d1';
import { processIngestBatch } from '../src/services/aggregator';
import { sanitizeReferrerDomain, sanitizeUtm, computeChannelGroup } from '../src/services/attribution';
import { SiteRecord, TrackerEvent } from '../src/types';

describe('Attribution Verification (§9, §14)', () => {
  let db: D1Database;
  const mockSite: SiteRecord = {
    id: 'site_attr_test',
    name: 'Attribution Test Site',
    domain: 'mybrand.com',
    site_key: 'qhp_attrkey',
    owner_id: 'owner_attr',
    timezone: 'UTC',
    consent_banner_enabled: 0,
    created_at: new Date().toISOString()
  };

  beforeEach(async () => {
    db = createTestDb();
    await db.prepare(
      `INSERT INTO owners (id, username, password_hash, salt, created_at)
       VALUES (?, 'owner_attr_user', 'hash', 'salt', ?)`
    ).bind(mockSite.owner_id, new Date().toISOString()).run();

    await db.prepare(
      `INSERT INTO sites (id, name, domain, site_key, owner_id, timezone, consent_banner_enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      mockSite.id, mockSite.name, mockSite.domain, mockSite.site_key,
      mockSite.owner_id, mockSite.timezone, mockSite.consent_banner_enabled, mockSite.created_at
    ).run();
  });

  it('Maintains first-touch attribution across internal navigation without overwriting', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const sessionId = 'first_touch_sess_42';

    // Step 1: Session arrives on landing page from Twitter with UTM campaign
    const landingEvent: TrackerEvent = {
      type: 'pageview',
      path: '/welcome',
      session_id: sessionId,
      referrer_domain: 'https://t.co/xyz123',
      utm_source: 'twitter',
      utm_medium: 'social',
      utm_campaign: 'spring_launch',
      utm_term: 'analytics',
      utm_content: 'banner1'
    };

    await processIngestBatch(db, mockSite, { site_key: mockSite.site_key, events: [landingEvent] }, { country: 'US' });

    // Step 2: User navigates internally to /features (internal navigation has no UTMs)
    const internalNav1: TrackerEvent = {
      type: 'pageview',
      path: '/features',
      session_id: sessionId,
      referrer_domain: 'https://mybrand.com/welcome' // internal referrer
    };

    await processIngestBatch(db, mockSite, { site_key: mockSite.site_key, events: [internalNav1] }, { country: 'US' });

    // Step 3: User navigates internally to /pricing
    const internalNav2: TrackerEvent = {
      type: 'pageview',
      path: '/pricing',
      session_id: sessionId,
      referrer_domain: 'https://mybrand.com/features'
    };

    await processIngestBatch(db, mockSite, { site_key: mockSite.site_key, events: [internalNav2] }, { country: 'US' });

    // Verify agg_daily_attribution
    const attrRows = await db.prepare(
      `SELECT channel, source, medium, campaign, sessions, pageviews
       FROM agg_daily_attribution WHERE site_id = ? AND date = ?`
    ).bind(mockSite.id, today).all<any>();

    console.log('[Attribution Rows in Storage]', attrRows.results);

    // There should be exactly 1 attribution row for this session
    expect(attrRows.results.length).toBe(1);
    const attr = attrRows.results[0];
    expect(attr.channel).toBe('social');
    expect(attr.source).toBe('twitter');
    expect(attr.medium).toBe('social');
    expect(attr.campaign).toBe('spring_launch');
    expect(attr.sessions).toBe(1);
    expect(attr.pageviews).toBe(3); // 3 total pageviews accumulated under first-touch attribution
  });

  it('Strips ad click IDs (gclid, fbclid, msclkid, twclid) and never stores them', () => {
    const rawUrl = 'https://mybrand.com/product?gclid=12345&fbclid=67890&msclkid=abc&twclid=def&utm_source=google&utm_medium=cpc&utm_campaign=search1';
    const parsed = new URL(rawUrl);

    // Verify sanitization
    const utm = sanitizeUtm(
      parsed.searchParams.get('utm_source'),
      parsed.searchParams.get('utm_medium'),
      parsed.searchParams.get('utm_campaign'),
      parsed.searchParams.get('utm_term'),
      parsed.searchParams.get('utm_content')
    );

    expect(utm.source).toBe('google');
    expect(utm.medium).toBe('cpc');
    expect(utm.campaign).toBe('search1');

    // Confirm ad click IDs are not captured
    expect((utm as any).gclid).toBeUndefined();
    expect((utm as any).fbclid).toBeUndefined();
    expect((utm as any).msclkid).toBeUndefined();
    expect((utm as any).twclid).toBeUndefined();

    // Channel group is 'paid'
    const channel = computeChannelGroup('', utm);
    expect(channel).toBe('paid');
  });

  it('Sanitizes referrer domain to hostname only with no paths or queries', () => {
    const rawReferrer = 'https://www.google.com/search?q=private+analytics+for+websites&hl=en';
    const cleanDomain = sanitizeReferrerDomain(rawReferrer);
    expect(cleanDomain).toBe('google.com');
    expect(cleanDomain).not.toContain('search');
    expect(cleanDomain).not.toContain('private+analytics');
  });
});
