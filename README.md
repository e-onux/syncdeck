# SyncDeck

SyncDeck, `rclone` için sakin bir masaüstü arayüzü sunan çapraz platform bir
uygulamadır — herhangi bir yerel klasörü dilediğin buluta mount etmeden eşitler
(ayna sync ya da güvenli kopyala). Bir **Sidre Labs** ürünüdür.

Bu depo iki projeyi yan yana barındıran bir monorepo'dur:

| Dizin | Ne | Teknoloji |
|---|---|---|
| [`app/`](app/) | Masaüstü uygulaması (SyncDeck) | Ionic + React + Electron, electron-builder |
| [`website/`](website/) | Ürün sitesi (`sidrelabs.com/syncdeck`) | Statik, hız öncelikli build → nginx (K3s) |

## app/ — masaüstü uygulaması

```bash
cd app
npm install
npm run dev            # Vite + Electron
npm run build          # tsc + vite build
npm run bundle:mac     # standalone .dmg/.zip (win/linux için bundle:win / bundle:linux)
```

Detaylar: [`app/README.md`](app/README.md). Sürümler GitHub Actions ile
`v*` tag'i push edildiğinde derlenir (bkz. `.github/workflows/release.yml`).

## website/ — ürün sitesi

```bash
cd website
npm install
npm run build          # tek self-contained dist/index.html
npm run preview        # http://localhost:8080
```

`sidrelabs.com/syncdeck` alt yoluna deploy edilir. Build & deploy detayları:
[`website/README.md`](website/README.md).

## Bağlantılar

- Site: https://sidrelabs.com/syncdeck
- Kaynak: https://github.com/e-onux/syncdeck
- rclone, bağımsız açık kaynak proje ekibinin markasıdır — SyncDeck onun için bir
  sarmalayıcıdır (wrapper).
