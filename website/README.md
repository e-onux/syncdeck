# SyncDeck, website

The SyncDeck product site. **Speed-first static architecture**: the build emits
one self-contained `index.html` per language, served precompressed from RAM
(tmpfs + page cache) by nginx on K3s. Same technique as the main Sidre Labs
site, published under the `sidrelabs.com/syncdeck` sub-path.

The design was prepared in Claude Design (Sidre Labs design system: deep
teal-black canvas, oblique Archivo headings, JetBrains Mono labels, mint
accent). There is **no runtime** such as PHP or Slim, nothing is rendered per
request, the file is returned straight from memory.

## What makes it fast

| Optimisation | Effect |
|---|---|
| CSS + JS + icons **inlined** | Whole page in one request (~50 KB, gzip **~11 KB**), no render-blocking links |
| **Self-hosted fonts** (`dist/fonts/`) | No third-party round trip to Google, the latin subset is `preload`ed |
| **gzip_static** | nginx reads the precompressed `.gz`, no runtime compression |
| **open_file_cache** + tmpfs | File descriptors and content stay hot in RAM |
| Fingerprinted fonts, `immutable` cache | Repeat visits do not re-request fonts |
| `nginx-unprivileged`, read-only rootfs | Small, hardened runtime image (~91 MB) |

## Languages

The site ships in the same nine languages as the app: Turkish (default),
English, German, Spanish, Dutch, Russian, Chinese, Japanese and Arabic.

- All copy lives in [`src/i18n.mjs`](src/i18n.mjs). Every locale must define the
  same keys, the build fails otherwise, so a page can never ship `{{holes}}`.
- `build.mjs` renders one static page per language: `dist/index.html` is the
  default (tr) and `dist/<lang>/index.html` holds the rest.
- **nginx picks the language from the browser's `Accept-Language` header**
  (see the `map` block in `nginx.conf`), so there is no redirect and no
  client-side detection: the first byte is already in the right language.
  Unsupported languages fall back to the default.
- Explicit URLs such as `/syncdeck/en/` always win over negotiation and are what
  the footer language switcher links to. `hreflang` and `canonical` are emitted
  for every locale, and Arabic renders with `dir="rtl"`.
- Font URLs are **absolute** (`/syncdeck/fonts/...`) so one shared font
  directory works at every URL depth. Set `BASE_PATH=/` to build for the root,
  which is what `npm run preview` does.

## Layout

```
website/
├── src/
│   ├── index.html       # template with {{placeholders}}
│   ├── i18n.mjs         # all copy, one entry per language
│   ├── styles.css       # Sidre tokens + components + page styles
│   └── main.js          # footer year + rotating hero word (deliberately tiny)
├── build.mjs            # render per language + inline + minify + fonts + gzip
├── package.json         # single devDependency: esbuild
├── nginx.conf           # /syncdeck/ sub-path, Accept-Language map, gzip_static
├── Dockerfile           # 2 stages: node build → nginx-unprivileged
└── k8s/                 # Deployment (tmpfs/RAM) + Service + Ingress (/syncdeck)
    └── kustomization.yaml
```

## Development

```bash
npm install
npm run build          # → dist/  (needs the network to self-host fonts, CDN fallback otherwise)
npm run preview        # build for the root + http://localhost:8080
```

## Build and deploy (K3s, sidrelabs.com/syncdeck)

Live at **https://sidrelabs.com/syncdeck/**. Same server, same `sidrelabs-web`
namespace and same method as the main site: the image is imported straight into
k3s containerd **without a registry** (identical to how `sidrelabs-web:1` is
loaded). There is no registry on the server, so `imagePullPolicy: IfNotPresent`.

```bash
# 1. build for the server architecture (amd64) and save it to a tar
docker build --platform linux/amd64 --provenance=false -t syncdeck-web:4 .
docker save syncdeck-web:4 -o /tmp/syncdeck-web.tar

# 2. copy the tar to the server and import it into k3s containerd
scp /tmp/syncdeck-web.tar root@<server>:/tmp/
ssh root@<server> 'k3s ctr images import /tmp/syncdeck-web.tar'

# 3. apply the manifests (bump newTag in k8s/kustomization.yaml when the tag changes)
scp k8s/*.yaml root@<server>:/tmp/syncdeck-k8s/
ssh root@<server> 'kubectl apply -k /tmp/syncdeck-k8s/'
```

> For a new release bump the tag (`:4` → `:5`), re-import, and update `newTag` in
> `kustomization.yaml`. `IfNotPresent` would otherwise keep the old image.

### Notes and assumptions
- The site is served under the `/syncdeck/` sub-path, its content is copied to
  `/usr/share/nginx/html/syncdeck/`. Visits to the root (`/`) are redirected to
  `/syncdeck/`.
- `k8s/ingress.yaml` shares the **same host** as the main site
  (`sidrelabs-web`): Traefik prefers the longer path prefix, so `/syncdeck` goes
  to `syncdeck-web` and `/` goes to `sidrelabs-web`. Ingress backends must live
  in the same namespace, which is why `kustomization.yaml` sets namespace
  `sidrelabs-web`.
- The K3s default of **Traefik** plus cert-manager or the `le` resolver is
  assumed (same annotations as sidrelabs-web). With ingress-nginx you need to
  set `ingressClassName`, its annotations and a `rewrite-target`.
- The Deployment copies the site into an `emptyDir{medium:Memory}` (tmpfs)
  volume and serves from there, so requests are guaranteed to come from RAM.

## Editing content

All text lives in [`src/i18n.mjs`](src/i18n.mjs), keyed per language. The
rotating hero words (`sessizce → güvenle → …`) are the `heroWords` array of each
locale, and the accent colour is in `src/styles.css`. Run `npm run build` after
any change. The version string is templated from `package.json` as `{version}`,
so it only needs bumping in one place.
