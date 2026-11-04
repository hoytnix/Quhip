# Quhip — Product Context

## Problem Domain
Website owners need actionable behavioral insights (which elements get clicked, how deep people scroll, what traffic channels convert) without exposing visitors to surveillance capitalism, cross-site trackers, heavy SDK bloat, or regulatory consent headaches.

## UX Goals
- **Zero Configuration for Tracking**: Paste one tiny `<script>` tag with a `data-site` key, and all pageviews, active time, scrolls, and element interactions track automatically.
- **Epic Element CTR**: Understand what elements are seen and clicked with element view denominator (sessions clicked / sessions saw element), without manual event tagging.
- **Actionable Heatmaps**: Click overlays and scroll-depth distribution overlays with minimum-count suppression (< 5 sessions shows "not enough data").
- **Clear Attribution**: First-touch channel grouping (direct, search, social, referral, email, paid) and UTM parameters without leaking search queries or storing ad IDs.
- **Privacy by Default**: Cookieless and aggregated, so by default no consent banner is required. If site owners toggle on optional consent banner, it must be strictly opt-in with unchecked toggles, equal button weights, and zero data sent prior to affirmative consent.
- **Clean Site Owner Dashboard**: Multi-site portfolio management, date range filtering, breakdown tables, heatmaps, goals, and export/management.
