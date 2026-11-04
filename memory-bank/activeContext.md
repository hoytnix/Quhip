# Quhip — Active Context

## Current Status
- Initialized Git repository (`main`) with remote origin `git@github.com:hoytnix/Quhip.git`.
- Configured [Kopimi LICENSE](file:///home/oloty/Dev/Quhip/LICENSE) and public domain dedication (`CC0-1.0` in `package.json`).
- Added Cloudflare Workers deploy badge to [`README.md`](file:///home/oloty/Dev/Quhip/README.md).
- **Per-Page Heatmaps with Live Page Preview Delivered**:
  - Implemented `/api/dashboard/heatmaps/pages` directory endpoint returning tracked pages with session and click counts.
  - Enhanced `/api/dashboard/heatmaps` with strict per-page minimum session suppression (< 5 sessions) and metadata.
  - Implemented `/api/dashboard/preview` proxy endpoint: fetches target HTML, strips `X-Frame-Options` and CSP frame-ancestors, injects `<base href="...">`, and neutralizes navigation clicks.
  - Refactored dashboard UI with a simulated browser window preview container, iframe live page underlay, transparent click canvas overlay, horizontal scroll depth guide lines (25%, 50%, 75%, 100%), opacity slider, interactive tooltip, responsive viewport switcher, and direct "Heatmap ➔" jump from Top Pages.
- **Standalone WWW Landing & Squeeze Page Package Delivered**:
  - Structured separate workspace package in `www/` (aliased via `WWW` symlink) with its own `package.json` (`quhip-www`).
  - Created single-file zero-roundtrip `www/index.html` with completely inlined CSS and JavaScript.
  - Wrote high-converting, human copy following Ray Edwards' PASTOR framework (Problem, Agitation, Story/Solution, Transformation, Offer, Response).
  - Configured top navbar "Deploy" button jumping directly to the `#deploy-tutorial` section.
  - Replaced hero playbook squeeze section with an interactive **1-Click Deploy Tutorial** featuring:
    - Browser 1-click deploy to Cloudflare Workers via `https://deploy.workers.cloudflare.com/?url=https://github.com/hoytnix/Quhip`.
    - 3-command CLI deploy snippet with one-click copy button (`copyCliCommand`).
  - Maintained lead-capture squeeze opt-in in the Offer section for *"The Cookieless Conversion Playbook"*.
  - Built interactive CTR Calculator comparing GA4 pageview CTR vs Quhip True Element Visibility CTR.
  - Configured Quhip dogfood tracking snippet (`data-site="qhp_quhip_www"`).
- **Static GitHub Pages Push-to-Deploy Workflow**:
  - Simplified `.github/workflows/deploy.yml` to a single zero-dependency job: checkout and deploy static `www/` directory to GitHub Pages.
  - Completely stripped out Node.js, pnpm, and external build dependencies from GitHub Actions CI so static page deployments never fail on package manager or cache steps.
  - Cloudflare Workers and Cloudflare Pages deployments remain strictly manual via CLI (`pnpm run deploy`).
- **Core Memory Bank Protocol Enhancement**:
  - Updated `GEMINI.md` to enforce immediate Git staging, committing, and pushing every time `/memory-bank/` files are written.
- Added test coverage in [`test/www-landing.test.ts`](file:///home/oloty/Dev/Quhip/test/www-landing.test.ts) (32 tests passing across 10 test files).
- **Embedded Vector Icons for Zero-Dependency Rendering in WWW**:
  - Replaced OS-dependent raw emoji characters across `www/index.html` with an inlined, lightweight SVG sprite bundle (`#icon-zap`, `#icon-globe`, `#icon-rocket`, `#icon-terminal`, `#icon-lock`, `#icon-cookie`, `#icon-timer`, `#icon-scale`, `#icon-stop`, `#icon-snail`, `#icon-mirror`, `#icon-bulb`, `#icon-chart`).
  - Guarantees 100% sharp and consistent visual rendering across all operating systems, Linux distros, and legacy browsers without requiring any system emoji TTF font.

- **Interactive Cloudflare Free Tier & Cost Calculator Delivered in WWW Landing**:
  - Embedded an edge infrastructure cost calculator in `www/index.html` positioned between "The Hidden Toll" (Agitation) and "Cookieless & Privacy-First Web Analytics / Story & Solution".
  - Evaluates traffic thresholds against Cloudflare Workers Free Tier (100k requests/day, ~3M requests/month) and Workers Paid ($5/month base including 10M requests, +$0.30/million overage).
  - Displays instant free tier eligibility indicator, calculated monthly hosting bill ($0 vs ~$5+), and competitor price comparison.
  - Implemented bidirectional synchronization between the new Cost Calculator and the True Element CTR Calculator so users only enter their traffic figure once.
  - Added unit test coverage in `test/www-landing.test.ts`.

## Next Focus
- Monitor deployments, live telemetry, and subscriber leads.
