# Quhip

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/hoytnix/Quhip)

Cookieless, privacy-first web analytics with click/scroll heatmaps, automatic element CTR, and full session/attribution metrics on Cloudflare Workers and Cloudflare D1.

## Key Features

- **100% Cookieless**: No cookies set, read, or required.
- **Zero Fingerprinting & Zero IP Storage**: No canvas, WebGL, audio, or device fingerprinting. Coarse country from Cloudflare edge headers only (`cf.country`). Never stores visitor IP addresses.
- **Ephemeral Sessions**: Sessions live strictly in `sessionStorage` for the active tab (30-minute inactivity timeout). Returning visitors tomorrow or in a new tab receive an unrelated ephemeral ID.
- **Immediate Aggregation (Zero Raw Logs)**: Raw visitor event streams are never stored or retained. Ingest aggregates directly into Cloudflare D1 counter rollups.
- **Epic Element CTR**: Automatic element tracking using a single delegated click listener and `IntersectionObserver` (50% visibility threshold). Primary CTR = `sessions that clicked element / sessions that saw element`. Clicks/pageviews is reported as secondary.
- **Click & Scroll Heatmaps**: Aggregated click coordinates normalized to 0–99% buckets and scroll depth milestones (25%, 50%, 75%, 100%).
- **Small-Count Suppression**: Strict minimum-count protection (< 5 sessions returns "not enough data" across heatmaps, top paths, elements, and breakdown tables) to prevent visitor de-anonymization.
- **First-Touch Attribution**: UTM source, medium, campaign, term, content, and referrer domains are captured at entry and preserved across internal navigation. Ad click IDs (`gclid`, `fbclid`, `msclkid`, `twclid`) are stripped on ingest.
- **Single Deployable Worker Project**: Hono API, tracker script delivery (`/quhip.js`), and full dashboard UI are bundled and served from a single Cloudflare Worker.

## Stack

- **Framework**: [Hono](https://hono.dev/) (TypeScript) on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Package Manager**: `pnpm` exclusively
- **Tracker Snippet**: Minified Vanilla TypeScript, **3.99 KB gzipped** (well under 10 KB budget)

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Apply Local D1 Database Migration
```bash
pnpm exec wrangler d1 execute quhip-db --local --file=migrations/0001_initial_schema.sql
```

### 3. Build & Run Locally
```bash
# Build tracker snippet and verify bundle size
pnpm run build:snippet

# Run test suite
pnpm test

# Start local development server
pnpm run dev
```

### 4. Deploy to Cloudflare Workers
```bash
# Run migration on remote D1 database
pnpm exec wrangler d1 execute quhip-db --remote --file=migrations/0001_initial_schema.sql

# Deploy worker
pnpm exec wrangler deploy
```

## Adding the Tracker Snippet

Paste this script tag into the `<head>` of your website:

```html
<script defer src="https://your-quhip-worker.workers.dev/quhip.js" data-site="qhp_YOUR_SITE_KEY"></script>
```

### Identifying Key Elements

Quhip automatically identifies elements using this priority order:
1. `data-quhip` attribute: `<button data-quhip="signup-cta">Sign Up</button>`
2. Element `id` (if not random/hashed): `<button id="pricing-card-buy">Buy</button>`
3. `aria-label`: `<button aria-label="Subscribe to Newsletter">Subscribe</button>`
4. Structural CSS selector fallback.

### Excluding Sensitive Elements & Inputs

- Clicks inside `input`, `textarea`, `select`, password fields, and `contenteditable` elements are automatically ignored.
- To exclude any element or subtree, add `data-quhip-ignore`:
  ```html
  <div data-quhip-ignore>
    <!-- Quhip will never track clicks, views, or heatmap coordinates here -->
  </div>
  ```

### Optional Consent Banner

Quhip is cookieless and aggregated, so by default **no consent banner is shown**.

If you wish to display an optional opt-in banner, enable it in Site Settings or add `data-consent="true"`:
```html
<script defer src="https://your-quhip-worker.workers.dev/quhip.js" data-site="qhp_..." data-consent="true"></script>
```
When enabled:
- All toggles start **unchecked** (strictly opt-in).
- Zero events are sent before affirmative consent.
- Reject All sends nothing.
- Persistent privacy controls allow visitors to withdraw consent at any time.

## Verification Suite

Run all verification tests:
```bash
pnpm test
```
The test suite covers:
- **Privacy Audit**: Verifies 0 cookie reads/writes, 0 fingerprinting APIs, 0 IP columns, and 0 Google Analytics code.
- **Metric Math**: Verifies synthetic session math for pageviews, sessions, bounces (< 10s active time with 0 interactions), CTR, and goal conversions.
- **Element CTR Denominator**: Verifies below-the-fold elements use element-view denominator (sessions clicked / sessions saw) instead of pageview denominator.
- **Attribution**: Verifies first-touch attribution retention across internal navigation and stripping of ad click identifiers (`gclid`, `fbclid`).
- **Consent Gating**: Verifies strictly unchecked toggles and zero events prior to consent.
- **Small-Count Suppression**: Verifies counts < 5 sessions return "not enough data".
- **Performance**: Verifies snippet execution latency is under 0.1 ms per page load.
- **Dogfood**: Verifies live simulation against TehWiz portfolio structure.

## License

Released under [Kopimi](https://kopimi.com/) (Copy Me). All works are dedicated to the public domain. Free to copy, remix, and share.
