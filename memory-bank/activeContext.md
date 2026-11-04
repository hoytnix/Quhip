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
- **Automated Push-to-Deploy CI/CD Pipeline Configured**:
  - Added `.github/workflows/deploy.yml` triggering on every push to `main`.
  - Configured job output evaluation for optional secrets (`needs.test.outputs.has_cf_secret == 'true'`) because GitHub Actions disables `secrets` and `env` contexts at the job-level `if` level.
  - Runs full test suite and builds snippet.
  - Deploys `www` to GitHub Pages automatically with zero credentials.
  - Deploys Quhip Worker API to Cloudflare Workers and `www` to Cloudflare Pages when repository secrets (`CLOUDFLARE_API_TOKEN`) are configured.
- Added test coverage in [`test/www-landing.test.ts`](file:///home/oloty/Dev/Quhip/test/www-landing.test.ts) (32 tests passing across 10 test files).

## Next Focus
- Monitor deployments, live telemetry, and subscriber leads.
