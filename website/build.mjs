/**
 * SyncDeck - speed-first static build (same technique as sidrelabs.com).
 *
 * Produces one self-contained HTML page PER LANGUAGE:
 *   dist/index.html          default language (tr)
 *   dist/<lang>/index.html   every other language the desktop app ships
 *
 *   - CSS + JS minified and inlined (one request, zero render-blocking links)
 *   - web fonts self-hosted once into dist/fonts and referenced with an
 *     ABSOLUTE path (BASE_PATH) so the same markup works at any URL depth -
 *     required now that pages live at /syncdeck/ and /syncdeck/<lang>/
 *   - <link rel="preload"> for the latin subset
 *   - canonical + hreflang alternates for every locale
 *   - each page precompressed to .gz for nginx gzip_static
 *
 * nginx picks the language from Accept-Language (see nginx.conf), so there is
 * no redirect and no client-side detection: the first byte is already right.
 *
 * Network is only needed to self-host fonts; if it is unavailable the build
 * falls back to the Google Fonts @import so it still succeeds offline.
 */
import { transform } from 'esbuild';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { LOCALES, DEFAULT_LANG } from './src/i18n.mjs';

const SRC = new URL('./src/', import.meta.url);
const DIST = new URL('./dist/', import.meta.url);
const FONTS_OUT = new URL('./dist/fonts/', import.meta.url);

// Public path the site is mounted at. Absolute so /syncdeck/ and
// /syncdeck/en/ can share one dist/fonts directory.
const BASE = process.env.BASE_PATH || '/syncdeck/';
const SITE = (process.env.SITE_ORIGIN || 'https://sidrelabs.com').replace(/\/$/, '');

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
      // ABSOLUTE url -> resolves the same from /syncdeck/ and /syncdeck/<lang>/.
      const localBlock = block.replace(url, `${BASE}fonts/${file}`);
      out += localBlock + '\n';
      if (isLatin) preloads.add(`${BASE}fonts/${file}`);
    }
    if (!out) throw new Error('no @font-face blocks parsed');
    return { css: out, preloads: [...preloads].slice(0, 4) };
  } catch (err) {
    console.warn(`! font self-host skipped (${err.message}); falling back to CDN @import`);
    return null;
  }
}

/** Every locale must carry the same keys, or a page silently ships {{holes}}. */
function assertLocalesComplete() {
  const reference = Object.keys(LOCALES[DEFAULT_LANG]).sort();
  for (const [lang, dict] of Object.entries(LOCALES)) {
    const keys = Object.keys(dict).sort();
    const missing = reference.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !reference.includes(k));
    if (missing.length || extra.length) {
      throw new Error(
        `locale "${lang}" is out of sync` +
          (missing.length ? `, missing: ${missing.join(', ')}` : '') +
          (extra.length ? `, unexpected: ${extra.join(', ')}` : ''),
      );
    }
  }
}

const attr = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
/** Public URL for a locale: default sits at the root, others in a subfolder. */
const langPath = (lang) => (lang === DEFAULT_LANG ? BASE : `${BASE}${lang}/`);

function renderPage(template, lang, { version }) {
  const dict = LOCALES[lang];

  const alternates = [
    ...Object.keys(LOCALES).map(
      (l) => `<link rel="alternate" hreflang="${l}" href="${SITE}${langPath(l)}" />`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${SITE}${BASE}" />`,
  ].join('\n');

  const langLinks = Object.entries(LOCALES)
    .map(([l, d]) =>
      l === lang
        ? `<span class="sd-langs__cur" aria-current="true">${d.name}</span>`
        : `<a href="${langPath(l)}" hreflang="${l}" lang="${l}">${d.name}</a>`,
    )
    .join('\n      ');

  const values = {
    ...dict,
    lang,
    dir: dict.dir,
    canonical: `${SITE}${langPath(lang)}`,
    ogLocale: lang,
    alternates,
    langLinks,
    navAria: dict.navFeatures,
    heroWord0: dict.heroWords[0],
    heroWordsJson: attr(JSON.stringify(dict.heroWords)),
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in values)) throw new Error(`unknown placeholder {{${key}}} (lang ${lang})`);
    const value = values[key];
    if (Array.isArray(value)) return '';
    return String(value).replace(/\{version\}/g, version);
  });
}

async function main() {
  assertLocalesComplete();

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
  const version = pkg.version;

  let [template, css, js] = await Promise.all([
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

  // 2. Minify once, reuse for every language.
  const { code: minJs } = await transform(js, { loader: 'js', minify: true, target: 'es2019' });
  const { code: minCss } = await transform(css, { loader: 'css', minify: true });

  const kb = (b) => (b / 1024).toFixed(1) + ' KB';

  // 3. Render + inline + write one page per language.
  for (const lang of Object.keys(LOCALES)) {
    let html = renderPage(template, lang, { version })
      .replace('<link rel="stylesheet" href="styles.css" />', `${preloadTags}<style>${minCss}</style>`)
      .replace('<script src="main.js"></script>', `<script>${minJs}</script>`)
      .replace(/<!--[\s\S]*?-->/g, '') // drop HTML comments
      .replace(/\n\s*\n/g, '\n');

    const dir = lang === DEFAULT_LANG ? DIST : new URL(`./${lang}/`, DIST);
    if (lang !== DEFAULT_LANG) await mkdir(dir, { recursive: true });

    const gz = gzipSync(Buffer.from(html), { level: 9 });
    await writeFile(new URL('index.html', dir), html);
    await writeFile(new URL('index.html.gz', dir), gz);

    const where = lang === DEFAULT_LANG ? 'dist/index.html' : `dist/${lang}/index.html`;
    console.log(`✓ ${where.padEnd(22)} ${kb(Buffer.byteLength(html)).padStart(9)}  (gzip ${kb(gz.length)})`);
  }

  console.log(`✓ ${Object.keys(LOCALES).length} languages · default "${DEFAULT_LANG}" · base ${BASE}`);
  console.log(`✓ fonts self-hosted: ${fonts ? fonts.preloads.length + ' preloaded' : 'CDN fallback'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
