# Quhip — Project Brief

## Core Goals
Build Quhip, a Hono API on Cloudflare Workers that replaces invasive Google Analytics:
- Cookieless, privacy-first web analytics
- Click & scroll heatmaps with minimum-count suppression (>= 5 sessions)
- Automatic element CTR based on element visibility (IntersectionObserver)
- Full session & first-touch attribution metrics
- Site owners keep and control their own data

## Scope & Boundaries
- **IS**: Self-hostable analytics API + tiny JS snippet (< 10 KB gzipped) + dashboard, for any website. First customer is Michael's own portfolio (TehWiz sites), then other site owners.
- **IS NOT**: Google Analytics (no Google code, SDK, account, or cross-site tracking).
- **IS NOT**: Session-replay tool (no playback, no mouse-trail recording, no screen capture).
- **IS NOT**: User-tracking tool (no user profiles, no cross-day/cross-site identities, no visitor journeys).

## Foundation & Principles
- 100% cookieless: `document.cookie` is never touched.
- Ephemeral sessions: `sessionStorage` only, destroyed on tab close or 30-min inactivity.
- Zero raw per-visitor event logs retained: aggregated immediately on ingest into Cloudflare D1.
- No IP address storage (full or truncated). Coarse country from Cloudflare edge headers only.
- No ad click IDs (`gclid`, `fbclid`, etc.) stored.
- Privacy guards on DOM: ignore inputs, password fields, `contenteditable`, and `data-quhip-ignore` subtrees.
- Strict owner authentication for dashboard access.
