# Project instructions

- This is a standalone MV3 extension. Do not merge it into sibling caption, sync or downloader projects.
- `extension/` is the exact loadable runtime; no build needed. Only `storage` permission and `https://www.youtube.com/*` content-script matches are authorized by this scope.
- Before altering selectors, inspect the real YouTube DOM and update `docs/DOM-CONTRACT.md`. Do not guess additional A/B selectors or rely on SVG paths / generated classes.
- A playlist card can have watch URLs for its title AND cover. The observed collection thumbnail component excludes the whole card.
- Keep one delegated capture listener per event at document_start. No per-card rebinding, polling, route monkey patches or broad DOM rewrites.
- Never intercept modified clicks, auxclick/contextmenu, action overlays, unrelated links or non-topbar search.
- Keep source navigation blocked synchronously, then create one tab via service worker; do not retry or navigate source on uncertain responses.
- Runtime must have no networking, analytics, history log, external services or remote executable code.
- Use Node.js 24+. Run `npm ci --ignore-scripts`, `npm run check`, `npm test`; package via PowerShell 7 `pwsh -NoProfile -File ./package.ps1` or macOS/Linux `bash package.sh`.
- Mac/ego-lite continuation: read `docs/MAC-HANDOFF.md`, verify this exact extension is loaded inside the actual TaskSpace, and compare TaskSpace tab baselines. Background tabs.create need not emit a page popup event.
- Work on a `codex/` feature branch and open a draft PR for review; do not merge without user authorization. The user's established debugging-release authorization includes publishing validated prerelease ZIPs and checksums, with truthful validation limits.
- Tests execute real scripts but simulate `chrome.*` and use reduced observed DOM. Never call their results Chrome/Edge E2E evidence. Track actual validation and blockers in `docs/VALIDATION.md`.
- Preserve sibling changes in the parent workspace. Do not commit/push/publish without the user's request.
