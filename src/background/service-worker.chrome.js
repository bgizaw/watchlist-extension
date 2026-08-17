// Chrome MV3 requires a single service_worker file. This thin entry point
// loads the shared, browser-agnostic scripts via importScripts (only
// available in classic, non-module service workers) and then hands off to
// the shared background-core.js logic. Firefox loads the same files directly
// as a background.scripts array instead (see manifests/manifest.firefox.json).
importScripts(
  '../lib/vendor/browser-polyfill.min.js',
  '../lib/db.js',
  '../lib/titleHeuristics.js',
  'background-core.js'
);
