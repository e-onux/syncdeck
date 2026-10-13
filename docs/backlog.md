# Backlog

Work that is planned but not started. Design sources live in `docs/designs/`.

## Android app

The Android engine (`.aar`, built by `.github/workflows/rclone-mobile.yml`) is
published, but there is no Android app yet. It should reach parity with the iOS
app in `mobile/ios`: profiles, clients wizard (incl. the well-known services in
`sources/provider-presets.json`), photo backup that frees space only after the
upload is verified, linked folders, background sync, 9 languages.

### Splash screen

Design: `docs/designs/splash/SyncDeck Splash.dc.html` (frame `1b`, Android
412 x 915), the same animation as the iOS splash in
`mobile/ios/SyncDeck/Views/SplashView.swift`:

- 0.0s camera low and tilted over the chevrons, 0.3s the chevrons light up in
  accelerating waves with sparks running inside the bars, 1.3s the camera rises,
  2.2s top-down view with a flash and glow, 2.5s wordmark, about 3.5s into the app.
- Android 12+ system splash (`windowSplashScreenAnimatedIcon`) shows only the
  static chevron mark from `app/build/icon.svg` on `#0c1f1c`; the animation
  continues from there.
- Status line `Preparing profiles` is localized; the tagline stays English.
- Honour "remove animations" (show the final frame).
