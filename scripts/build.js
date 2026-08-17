#!/usr/bin/env node
// Assembles two loadable extension folders from the shared src/ + icons/
// directory: dist/chrome (load unpacked at chrome://extensions) and
// dist/firefox (load temporary add-on at about:debugging). No bundler is
// needed — every script in src/ is a plain classic script, so this is a
// straight copy plus dropping in the right manifest.json per target.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function rimraf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function buildTarget(target, manifestFile) {
  const outDir = path.join(DIST, target);
  rimraf(outDir);
  fs.mkdirSync(outDir, { recursive: true });

  copyDir(path.join(ROOT, 'src'), path.join(outDir, 'src'));
  copyDir(path.join(ROOT, 'icons'), path.join(outDir, 'icons'));
  fs.copyFileSync(path.join(ROOT, 'manifests', manifestFile), path.join(outDir, 'manifest.json'));

  console.log(`Built ${target} extension -> ${path.relative(ROOT, outDir)}`);
}

rimraf(DIST);
buildTarget('chrome', 'manifest.chrome.json');
buildTarget('firefox', 'manifest.firefox.json');

console.log('\nLoad unpacked:');
console.log('  Chrome  -> chrome://extensions -> Load unpacked -> dist/chrome');
console.log('  Firefox -> about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> dist/firefox/manifest.json');
