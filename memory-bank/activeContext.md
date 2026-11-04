# Quhip — Active Context

## Current Status
- Initialized Git repository (`main`) with remote origin `git@github.com:hoytnix/Quhip.git`.
- Configured [Kopimi LICENSE](file:///home/oloty/Dev/Quhip/LICENSE) and public domain dedication (`CC0-1.0` in `package.json`).
- Added Cloudflare Workers deploy badge to [`README.md`](file:///home/oloty/Dev/Quhip/README.md).
- **Per-Page Heatmaps with Live Page Preview Delivered**:
  - Implemented `/api/dashboard/heatmaps/pages` directory endpoint returning tracked pages with session and click counts.
  - Enhanced `/api/dashboard/heatmaps` with strict per-page minimum session suppression (< 5 sessions) and metadata.
  - Implemented `/api/dashboard/preview` proxy endpoint: fetches target HTML, strips `X-Frame-Options` and CSP frame-ancestors, injects `<base href="...">`, and neutralizes navigation clicks.
  - Refactored dashboard UI with a simulated browser window preview container, iframe live page underlay, transparent click canvas overlay, horizontal scroll depth guide lines (25%, 50%, 75%, 100%), opacity slider, interactive tooltip, responsive viewport switcher (Desktop, Tablet, Mobile), and direct "Heatmap ➔" jump from the Top Pages table.
  - Resolved template literal regex escaping in [`src/ui/dashboard.ts`](file:///home/oloty/Dev/Quhip/src/ui/dashboard.ts) and removed redundant iframe sandbox attribute causing console warnings.
  - Added test suite in [`test/heatmap-preview.test.ts`](file:///home/oloty/Dev/Quhip/test/heatmap-preview.test.ts) (25 passing tests total).
- **Active Development Environments**:
  - Quhip Worker API & Dashboard running on `http://localhost:8787`.
  - Hello Quhip Test App running on `http://localhost:5173`.

## Next Focus
- Monitor deployments, remote D1 migrations, and live telemetry.
