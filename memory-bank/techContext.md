# Quhip — Tech Context

## Technology Stack
- **Framework**: Hono (TypeScript)
- **Runtime**: Cloudflare Workers (Web Standards Request/Response)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Package Manager**: pnpm exclusively (never npm or Bun)
- **Client Snippet**: Vanilla TypeScript/ES6 compiled to standalone minified script (< 10 KB gzipped)
- **Deployment**: Single Cloudflare Worker project containing API, snippet delivery, and embedded dashboard UI

## Constraints & Hard Lines
1. Strictly no cookies (`document.cookie`, `Set-Cookie` header).
2. Zero fingerprinting (no Canvas, WebGL, Audio, Battery, or WebRTC leaks).
3. Zero IP storage. Use `cf.country` only for country-level reporting.
4. Ephemeral session IDs stored exclusively in `sessionStorage`.
5. No raw visitor event logs retained.
6. Strip ad click IDs (`gclid`, `fbclid`, `msclkid`, `twclid`, etc.).
7. Small-count suppression (< 5 sessions returns "not enough data").
8. No pre-checked consent toggles.
9. No Google Analytics code, SDK, or beacons.
10. One deployable Worker project.
