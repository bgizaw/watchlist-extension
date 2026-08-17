# Watch Time Tracker

A cross-browser extension (Chrome + Firefox, Manifest V3) that automatically
detects video playback on any website, logs watch sessions locally, and
gives you time-based analytics — daily/weekly/monthly totals, a trend chart,
and a ranked breakdown by show/movie/channel. Nothing is sent to a server;
all data lives in the browser's IndexedDB.

## How it works

- A content script runs on every page, watches for `<video>` elements, and
  tracks *active* watch time (paused or backgrounded tabs stop the timer).
  Once a video has been actively watched for 30+ seconds, a session is sent
  to the background script.
- The background script categorizes the session — YouTube videos are
  grouped by channel (read from the page DOM), everything else is grouped by
  a cleaned-up, fuzzy-matched page title (junk like "Watch Online Free |
  SiteName" and episode/quality markers are stripped with local regex
  heuristics, no external API calls) — and stores it in IndexedDB.
- The popup gives an at-a-glance summary; the dashboard page (opened from
  the popup) shows full analytics: totals, a 14-day trend chart (Chart.js),
  a ranked breakdown, and a filterable session list.

## Tech

- Plain JavaScript, loaded as classic (non-module) scripts shared across
  both browsers — no bundler is required for the extension logic itself.
- [`webextension-polyfill`](https://github.com/mozilla/webextension-polyfill)
  (vendored in `src/lib/vendor/`) so all code uses the promise-based
  `browser.*` API on both Chrome and Firefox.
- [Chart.js](https://www.chartjs.org/) (vendored in `src/lib/vendor/`) for
  the trend chart.
- IndexedDB for storage, accessed directly from the background context and
  from the popup/dashboard pages.

## Project structure

```
manifests/
  manifest.chrome.json    Chrome MV3 manifest (service_worker background)
  manifest.firefox.json   Firefox MV3 manifest (background.scripts, gecko id)
src/
  background/
    background-core.js        Shared logic: receive sessions, categorize, store
    service-worker.chrome.js  Chrome-only entry point (importScripts wrapper)
  content/
    content.js            Detects <video> elements and tracks active watch time
  lib/
    db.js                 IndexedDB wrapper (VTDB)
    titleHeuristics.js    Title cleanup + fuzzy grouping (VTTitle)
    analytics.js          Totals/breakdown/trend queries (VTAnalytics)
    vendor/                webextension-polyfill + Chart.js (vendored, no npm install needed to build)
  popup/                  Toolbar popup (quick glance)
  dashboard/              Full analytics dashboard page
icons/                    Placeholder toolbar/store icons
scripts/
  build.js               Assembles dist/chrome and dist/firefox from src/
  pack.js                Zips dist/chrome and dist/firefox for distribution
```

Chrome MV3 requires a single-file service worker, while Firefox MV3 still
loads a background page from a `scripts` array. Rather than forking the
logic, `background-core.js` holds everything browser-agnostic; Chrome's
`service-worker.chrome.js` just `importScripts()`s the polyfill + shared
libs + `background-core.js`, and Firefox's manifest lists those same files
directly in `background.scripts`.

## Running locally

No `npm install` is required to build — the only "build" step is copying
files into two output folders (the polyfill and Chart.js are already
vendored as plain scripts):

```sh
node scripts/build.js
```

This produces:

- `dist/chrome/` — load via `chrome://extensions` → enable Developer mode →
  **Load unpacked** → select `dist/chrome`.
- `dist/firefox/` — load via `about:debugging#/runtime/this-firefox` →
  **Load Temporary Add-on** → select `dist/firefox/manifest.json`.

Firefox temporary add-ons are removed when Firefox restarts; re-run the
load-temporary-add-on step (or use `npm run web-ext:firefox`, which needs
`npm install` for the `web-ext` dev dependency) each session.

To produce distributable zips (e.g. for store submission):

```sh
npm run pack
```

## Try it

1. Run `node scripts/build.js`.
2. Load `dist/chrome` unpacked in Chrome (or `dist/firefox` as a temporary
   add-on in Firefox).
3. Play a video anywhere (YouTube, a streaming site, etc.) for 30+ seconds.
4. Click the toolbar icon for a quick summary, or "Open full dashboard" for
   the full analytics view.

## v1 scope

- No external metadata lookups (TMDB/OMDb) — titles/channels are derived
  entirely from page content and local heuristics.
- No sync, accounts, or login — data stays on-device in IndexedDB.
