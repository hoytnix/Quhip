# Quhip — Project Brief

## Core Goals
Privacy-first, cookieless web analytics replacing Google Analytics on Cloudflare Workers + D1.
- Immediate ingest rollup with zero raw visitor logs.
- Click & scroll heatmaps with small-count suppression (>= 5 sessions).
- Automatic element CTR via `IntersectionObserver` visibility denominator.
- Ephemeral sessions and first-touch UTM/referrer attribution.
- Built-in lightweight site owner dashboard.

## Boundaries & Principles
- **In Scope**: Self-hostable Worker API, client snippet (< 10 KB gzip budget), owner dashboard.
- **Out of Scope**: Cross-site tracking, session replay, canvas/device fingerprinting, user profiling.
- **Hard Privacy**: No cookies (`document.cookie` never accessed), no IP storage (`cf.country` only), strip ad click IDs (`gclid`, `fbclid`), ignore form inputs and `data-quhip-ignore` subtrees.
