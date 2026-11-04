# Quhip — Tech Context

## Tech Stack
- **Framework**: Hono (TypeScript)
- **Runtime**: Cloudflare Workers (Edge Request/Response)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Package Manager**: pnpm exclusively (never npm or Bun)
- **Client Snippet**: Vanilla TypeScript/ES6 compiled to minified script (< 10 KB gzip budget, ~4 KB actual)
- **Deployment**: Single deployable Worker project (API + tracker snippet + embedded dashboard UI)

## Constraints & Rules
1. Strictly cookieless (`document.cookie` / `Set-Cookie` never used).
2. Zero fingerprinting (no Canvas, WebGL, Audio, Battery, WebRTC).
3. Zero IP storage (coarse country from `cf.country` only).
4. Ephemeral session IDs in `sessionStorage` only.
5. Zero raw event logs; immediate rollup aggregation in D1.
6. Strip ad click IDs (`gclid`, `fbclid`, `msclkid`, `twclid`).
7. Small-count suppression (< 5 sessions = "not enough data").
8. Opt-in consent toggles unchecked by default with zero pre-consent beacons.
9. Single deployable Worker bundle.
