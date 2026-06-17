# SyncDeck — Website

SyncDeck ürün sitesi. **Hız öncelikli statik mimari**: build aşamasında tek bir
self-contained `index.html` üretilir, K3s üzerinde RAM'den (tmpfs + page cache)
precompressed olarak nginx ile servis edilir. Sidre Labs ana sitesiyle **aynı
teknik**; `sidrelabs.com/syncdeck` alt yolundan yayınlanır.

Tasarım Claude Design'da hazırlandı (Sidre Labs tasarım sistemi: koyu teal-siyah
zemin, Archivo eğik başlıklar, JetBrains Mono etiketler, mint aksan). PHP/Slim
gibi bir runtime **yoktur** — istek başına render yapılmaz, dosya doğrudan
bellekten döner.

## Hız için yapılanlar

| Optimizasyon | Etki |
|---|---|
| CSS + JS + ikonlar **inline** | Tüm sayfa tek istek (~46 KB, gzip **~9.5 KB**), render-blocking link yok |
| **Self-host fontlar** (`dist/fonts/`, göreli yol) | Google'a 3rd-party round-trip yok; latin alt küme `preload` edilir |
| **gzip_static** | nginx precompressed `.gz` dosyasını okur, runtime sıkıştırma yok |
| **open_file_cache** + tmpfs | Dosya fd + içerik RAM'de sıcak kalır |
| Fingerprint'li fontlar `immutable` cache | Tekrar ziyarette font isteği gitmez |
| `nginx-unprivileged`, read-only rootfs | Küçük, sertleştirilmiş çalışma imajı (~91 MB) |

Font URL'leri **göreli** (`fonts/...`) üretilir; böylece aynı `dist/` hem kök
(`/`) hem de alt yol (`/syncdeck/`) altında çalışır.

## Yapı

```
website/
├── src/                 # düzenlenebilir kaynak (standalone da çalışır)
│   ├── index.html
│   ├── styles.css       # Sidre token'ları + bileşenler + sayfa stilleri
│   └── main.js          # footer yılı (kasıtlı olarak minik)
├── build.mjs            # inline + minify + font self-host + gzip → dist/
├── package.json         # tek devDependency: esbuild
├── nginx.conf           # /syncdeck/ alt yolu, gzip_static, cache, headers
├── Dockerfile           # 2 aşama: node build → nginx-unprivileged
└── k8s/                 # Deployment (tmpfs/RAM) + Service + Ingress (/syncdeck)
    └── kustomization.yaml
```

## Geliştirme

```bash
npm install
npm run build          # → dist/  (font self-host için internet ister; yoksa CDN fallback)
npm run preview        # build + http://localhost:8080  (dist'i kökten servis eder)
```

## Build & deploy (K3s — sidrelabs.com/syncdeck)

Canlı: **https://sidrelabs.com/syncdeck/**. Ana site (`sidrelabs-web`) ile aynı
sunucu, aynı `sidrelabs-web` namespace'i ve aynı yöntem: imaj **registry'siz**,
doğrudan k3s containerd'ye import edilir (`sidrelabs-web:1` ile birebir aynı
mantık). Sunucuda registry yok; `imagePullPolicy: IfNotPresent`.

```bash
# 1. imajı sunucu mimarisi (amd64) için build et ve tar'a kaydet
docker build --platform linux/amd64 --provenance=false -t syncdeck-web:1 .
docker save syncdeck-web:1 -o /tmp/syncdeck-web.tar

# 2. tar'ı sunucuya kopyala ve k3s containerd'ye import et
scp /tmp/syncdeck-web.tar root@<sunucu>:/tmp/
ssh root@<sunucu> 'k3s ctr images import /tmp/syncdeck-web.tar'

# 3. manifestleri uygula (tag'i bump ettiysen k8s/kustomization.yaml newTag'i güncelle)
scp k8s/*.yaml root@<sunucu>:/tmp/syncdeck-k8s/
ssh root@<sunucu> 'kubectl apply -k /tmp/syncdeck-k8s/'
```

> Yeni sürümde `:1` → `:2` gibi tag'i bump et, yeniden import et ve
> `kustomization.yaml` newTag'i güncelle (IfNotPresent eski imajı tutar).

### Notlar / varsayımlar
- Site `/syncdeck/` alt yolu altında servis edilir; `nginx.conf` içeriği
  `/usr/share/nginx/html/syncdeck/` altına kopyalanır. Kök (`/`) ziyaretleri
  `/syncdeck/`'e yönlendirilir.
- `k8s/ingress.yaml` ana site (`sidrelabs-web`) ile **aynı host'u** paylaşır:
  Traefik daha uzun path prefix'i önceliklendirir, yani `/syncdeck` →
  `syncdeck-web`, `/` → `sidrelabs-web`. Ingress backend'leri aynı namespace'te
  olmalı; bu yüzden `kustomization.yaml` namespace `sidrelabs-web`.
- K3s varsayılanı **Traefik** + cert-manager/`le` resolver varsayılır
  (sidrelabs-web ile aynı annotation'lar). ingress-nginx kullanıyorsan
  `ingressClassName` ve annotation'ları + bir `rewrite-target` ayarla.
- Deployment site'ı bir `emptyDir{medium:Memory}` (tmpfs) hacmine kopyalayıp
  oradan servis eder; istekler garantili olarak RAM'den döner.

## İçerik düzenleme

Metinler `src/index.html` içinde (Türkçe). Hero'daki dönen kelime şeridi
(`sessizce → güvenle → …`) ve aksan rengi `src/styles.css` içindedir.
Değişiklikten sonra `npm run build`.
