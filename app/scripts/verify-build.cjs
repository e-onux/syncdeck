// Post-build guard. Catches the packaging regressions that shipped broken
// before electron-builder runs, so a bad bundle never reaches a release:
//   1. Absolute asset paths in dist/index.html → blank screen under file://
//      (Electron loadFile). Fixed by vite "base": "./".
//   2. Missing macOS icon → the app would fall back to the default Electron icon.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const errors = [];

const indexPath = path.join(root, 'dist', 'index.html');
if (!fs.existsSync(indexPath)) {
  errors.push('dist/index.html missing — run `npm run build` first.');
} else {
  const html = fs.readFileSync(indexPath, 'utf8');
  const absolute = [...html.matchAll(/(?:src|href)="(\/[^"]*\.(?:js|css))"/g)].map((m) => m[1]);
  if (absolute.length) {
    errors.push(
      `dist/index.html references absolute asset paths (${absolute.join(', ')}). ` +
        'Electron loads the bundle via file:// and needs relative paths — keep `base: "./"` in vite.config.ts.',
    );
  }
}

const icon = path.join(root, 'build', 'icon.icns');
if (!fs.existsSync(icon)) {
  errors.push('build/icon.icns missing — the packaged app would use the default Electron icon.');
}

if (errors.length) {
  console.error(`verify-build FAILED:\n - ${errors.join('\n - ')}`);
  process.exit(1);
}
console.log('verify-build OK: dist asset paths are relative and the app icon is present.');
