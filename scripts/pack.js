#!/usr/bin/env node
// Zips dist/chrome and dist/firefox into loadable packages
// (dist/chrome.zip, dist/firefox.zip) for distribution/store submission.
// Run `node scripts/build.js` first.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function zipDir(target) {
  const srcDir = path.join(DIST, target);
  const zipPath = path.join(DIST, `${target}.zip`);
  if (!fs.existsSync(srcDir)) {
    console.error(`Missing ${srcDir} — run "node scripts/build.js" first.`);
    process.exitCode = 1;
    return;
  }
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
  execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: srcDir });
  console.log(`Packed ${path.relative(ROOT, zipPath)}`);
}

zipDir('chrome');
zipDir('firefox');
