# Quhip — Progress & Roadmap

## Status: COMPLETE (V1 Platform Delivered & Validated)
- [x] Step 1: Hono Worker skeleton + D1 schema for aggregated tables + site-key validation + rate limiting.
- [x] Step 2: Snippet: pageview, session (sessionStorage), active time, scroll depth, SPA handling, batching + sendBeacon, bot filtering.
- [x] Step 3: Ingest aggregation for traffic + engagement metrics + dashboard overview.
- [x] Step 4: Referrer + UTM attribution & ad click ID stripping.
- [x] Step 5: Automatic element tracking + element CTR table + dead/rage clicks.
- [x] Step 6: Heatmaps (click + scroll overlays) with minimum-count suppression.
- [x] Step 7: Goals (definition in dashboard, counting in ingest, conversion views).
- [x] Step 8: Optional consent-banner module with dynamic auto-discovery.
- [x] Step 9: Dashboard polish: multi-site management, filters, date ranges, "not enough data" states.
- [x] Step 10: Dogfood verification, privacy audit, synthetic metric tests.
- [x] Step 11: Per-Page Heatmaps with Live Page Preview:
  - Page selection directory (`/api/dashboard/heatmaps/pages`) and per-page metrics.
  - Live page preview proxy (`/api/dashboard/preview`) stripping frame blockers and injecting `<base>`.
  - Visual simulated browser frame in the dashboard UI with live iframe underlay, canvas overlay, interactive tooltips, opacity control, and viewport toggle.
- [x] Repository Hygiene: Sane `.gitignore`, Kopimi LICENSE, Cloudflare Workers deploy badge, remote origin configured and pushed to GitHub (`hoytnix/Quhip:main`).

## Verification Summary
- **Test Suite**: 9 test suites, 26 tests passing (`pnpm test`).
- **Snippet Bundle Size**: 4.18 KB gzipped (Budget: < 10 KB).
- **Overhead**: ~0.82 ms execution latency per page load.
- **Privacy Audit**: 0 cookie calls, 0 fingerprinting APIs, 0 IP columns, small-count suppression (< 5 sessions) enforced on all pages.
- **Metric Math**: Verified exact session calculations, bounce rates, element-view CTR denominator, per-page heatmap clicks, and preview proxying.
