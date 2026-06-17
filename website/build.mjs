/**
 * SyncDeck - speed-first static build (same technique as sidrelabs.com).
 *
 * Produces a single self-contained dist/index.html:
 *   - CSS + JS minified and inlined (one request, zero render-blocking links)
 *   - web fonts self-hosted into dist/fonts (no third-party round trip),
 *     referenced with RELATIVE paths so the same bundle works both at the
 *     site root (local preview) and under the /syncdeck/ sub-path (prod)
 *   - <link rel="preload"> for the latin subset
 *   - index.html precompressed to index.html.gz for nginx gzip_static
 *
 * Network is only needed to self-host fonts; if it is unavailable the build
 * falls back to the Google Fonts @import so it still succeeds offline.
 */
import { transform } from 'esbuild';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const SRC = new URL('./src/', import.meta.url);
const DIST = new URL('./dist/', import.meta.url);
const FONTS_OUT = new URL('./dist/fonts/', import.meta.url);

const GOOGLE_CSS =
  'https://fonts.googleapis.com/css2' +
  '?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900' +
  '&family=JetBrains+Mono:wght@400;500;600&display=swap';
// A modern desktop UA makes Google return woff2.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const read = (name) => readFile(new URL(name, SRC), 'utf8');

/** Self-host the Google fonts. Returns { css, preloads } or null on failure. */
async function selfHostFonts() {
  try {
    const res = await fetch(GOOGLE_CSS, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`fonts css ${res.status}`);
    const css = await res.text();
    await mkdir(FONTS_OUT, { recursive: true });

    const blocks = css.split('@font-face').slice(1);
    const seen = new Map(); // url -> local filename
    const preloads = new Set();
    let out = '';

    for (const raw of blocks) {
      const block = '@font-face' + raw.slice(0, raw.indexOf('}') + 1);
      const urlMatch = block.match(/url\((https:[^)]+\.woff2)\)/);
      if (!urlMatch) continue;
      const url = urlMatch[1];
      const family = (block.match(/font-family:\s*['"]([^'"]+)/) || [])[1] || 'font';
      const isLatin = /unicode-range:[^;]*U\+0000-00FF/i.test(block) ||
        !/unicode-range/i.test(block);

      let file = seen.get(url);
      if (!file) {
        const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
        file = `${family.toLowerCase().replace(/\s+/g, '-')}-${seen.size}.woff2`;
        await writeFile(new URL(file, FONTS_OUT), buf);
        seen.set(url, file);
      }
      // RELATIVE url -> works at "/" and under "/syncdeck/" alike.
      const localBlock = block.replace(url, `fonts/${file}`);
      out += localBlock + '\n';
      if (isLatin) preloads.add(`fonts/${file}`);
    }
    if (!out) throw new Error('no @font-face blocks parsed');
    return { css: out, preloads: [...preloads].slice(0, 4) };
  } catch (err) {
    console.warn(`! font self-host skipped (${err.message}); falling back to CDN @import`);
    return null;
  }
}

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  let [html, css, js] = await Promise.all([
    read('index.html'),
    read('styles.css'),
    read('main.js'),
  ]);

  // 1. Fonts: replace the @import with self-hosted @font-face if possible.
  const fonts = await selfHostFonts();
  let preloadTags = '';
  if (fonts) {
    css = css.replace(/@import url\(['"]https:\/\/fonts\.googleapis\.com[^)]*\);\s*/, fonts.css);
    preloadTags = fonts.preloads
      .map((p) => `<link rel="preload" href="${p}" as="font" type="font/woff2" crossorigin>`)
      .join('');
  } else {
    preloadTags =
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
  }

  // 2. Minify.
  const { code: minJs } = await transform(js, { loader: 'js', minify: true, target: 'es2019' });
  const { code: minCss } = await transform(css, { loader: 'css', minify: true });

  // 3. Inline everything into the HTML.
  html = html
    .replace('<link rel="stylesheet" href="styles.css" />', `${preloadTags}<style>${minCss}</style>`)
    .replace('<script src="main.js"></script>', `<script>${minJs}</script>`)
    .replace(/<!--[\s\S]*?-->/g, '') // drop HTML comments
    .replace(/\n\s*\n/g, '\n');

  await writeFile(new URL('index.html', DIST), html);
  await writeFile(new URL('index.html.gz', DIST), gzipSync(Buffer.from(html), { level: 9 }));

  const kb = (b) => (b / 1024).toFixed(1) + ' KB';
  const gz = gzipSync(Buffer.from(html), { level: 9 }).length;
  console.log(`✓ dist/index.html  ${kb(Buffer.byteLength(html))}  (gzip ${kb(gz)})`);
  console.log(`✓ fonts self-hosted: ${fonts ? fonts.preloads.length + ' preloaded' : 'CDN fallback'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
