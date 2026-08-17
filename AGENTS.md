# AGENTS.md

## What this is

A WebExtension (Chrome + Firefox, Manifest V3) that tracks video watch time
across the web and shows local, offline analytics. There is no server
component — this is not a typical Netlify web app, it's a browser
extension whose codebase happens to live in this repo. There is no
database, function, or edge function involved; all persistence is
client-side IndexedDB inside the browser running the extension.

## Architecture

- **Shared source, two manifests.** Everything under `src/` is written once
  and loaded by both browsers. `manifests/manifest.chrome.json` and
  `manifests/manifest.firefox.json` are the only browser-specific files
  (background registration differs: Chrome MV3 needs a single-file service
  worker, Firefox MV3 accepts a `background.scripts` array).
- **No bundler.** Every file in `src/` is a plain classic (non-module)
  script that attaches to the global scope (`self`/`window`), e.g. `VTDB`,
  `VTTitle`, `VTAnalytics`. This lets the same files be loaded via
  `importScripts()` (Chrome service worker), a `background.scripts` array
  (Firefox), a `content_scripts.js` array, or plain `<script>` tags
  (popup/dashboard HTML) without any transpilation step. Do not introduce
  ES module `import`/`export` syntax into these files unless the whole
  loading strategy is revisited.
- **`src/background/background-core.js`** is the single source of truth for
  session categorization and storage. `service-worker.chrome.js` is a thin
  Chrome-only shim that `importScripts()`s the polyfill + libs + this file.
- **`src/content/content.js`** runs on every page (`<all_urls>`,
  `all_frames: true`), finds `<video>` elements via a `MutationObserver`
  (for SPAs/lazy-loaded players), and tracks *active* watch time using
  play/pause/visibilitychange events. It polls `location.href` to detect
  in-page navigation (YouTube-style SPA transitions) and finalizes/report
  the current session when the URL changes.
- **Categorization** (`src/lib/titleHeuristics.js`): YouTube sessions are
  grouped by channel name scraped from the watch page DOM. Everything else
  is grouped by a cleaned page title (regex-based junk stripping) with
  Levenshtein-based fuzzy matching against existing group keys, so repeat
  episodes of "Show Name — Ep 4" and "Show Name Episode 5" land in the same
  group without hitting any external metadata API.
- **`src/lib/db.js`** wraps IndexedDB (`video-tracker` DB, `sessions`
  store). It's loaded both in the background context and directly in the
  popup/dashboard pages for read access — IndexedDB behaves the same in
  both places on both browsers.
- **`src/lib/analytics.js`** computes totals/breakdowns/trends from raw
  session records; both `popup/popup.js` and `dashboard/dashboard.js` call
  into it rather than duplicating aggregation logic.

## Build

`scripts/build.js` copies `src/` + `icons/` into `dist/chrome` and
`dist/firefox`, dropping in the right `manifest.json` for each. `dist/` is
gitignored — it's a generated artifact, not source. `scripts/pack.js` zips
those folders for store submission (requires `zip` on PATH).

## Conventions

- Keep `src/lib/vendor/` vendored, not npm-installed — the project builds
  without `npm install` by design (only `web-ext` for local Firefox
  auto-reload is an npm dependency, and it's optional).
- New shared logic goes in `src/lib/*.js` as a global-namespace IIFE
  (follow the `VTDB`/`VTTitle`/`VTAnalytics` pattern), not as an ES module.
- If you add a new browser-specific behavior, prefer branching inside
  shared code (checking `typeof browser.X === 'function'`, etc.) over
  forking files; only fork when the manifest structure itself forces it
  (as with the Chrome service worker vs. Firefox background scripts).
- v1 is intentionally offline: no TMDB/OMDb/network metadata calls. Don't
  add outbound network requests to the categorization path without an
  explicit product decision to do so.
