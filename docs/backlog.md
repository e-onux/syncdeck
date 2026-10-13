# Backlog

Work that is planned but not started. Design sources live in `docs/designs/`.
The iOS app (`mobile/ios`) leads; every feature it gets must reach the desktop
app (`app/`) and the Android app too. Items are listed per platform so each can
be picked up on its own.

## Secure and supervised transfers (all platforms)

Being built in the iOS app first, in this order. Port each one once it lands.

1. **Encrypted client credentials.** rclone's own config encryption (NaCl
   secretbox, `RCLONE_ENCRYPT_V0`), with the key kept in the platform's secret
   store instead of next to the file, so a backup or copied config file alone
   does not give access to the clouds. No password for the user to remember.
2. **Notifications and a "no successful backup for N days" warning**, so a
   silently failing background sync is noticed.
3. **Resumable runs**: a journal of what was uploaded and verified, so an
   interrupted photo backup continues instead of starting over; run only on
   Wi-Fi / while charging / outside Low Power Mode when the user asks for it.
4. **Encrypted vault**: a guided rclone `crypt` client wrapping any cloud, with
   the key in the secret store and a recovery key shown once.
5. **Deletion ledger and stronger verification**: a record of every item
   removed from the device (name, size, hash, cloud path), a "download and
   compare" check where the cloud has no hash, `cryptcheck` for vaults.

## Desktop app

### Secure and supervised transfers
- Credentials: `rclone config encryption set`, key in the OS keychain through
  Electron `safeStorage`, passed to the bundled rclone via `--password-command`
  or `RCLONE_CONFIG_PASS` in the child environment only. Migrate existing plain
  configs on start-up; never log the key.
- Notifications (Electron `Notification`) on failure and on a stale backup.
- Resumable runs, conditions (metered network, on battery).
- Encrypted vault wizard and the deletion ledger / stronger verification.

### Clients
- The well-known services catalogue (`sources/provider-presets.json`) is wired
  into the wizard; still to do:
  - Show the service name (Wasabi, Nextcloud...) for existing clients in the
    client list and Settings, like the iOS client list does
    (`PresetCatalog.preset(type:settings:)`).
  - A visual pass over the wizard's service groups in all languages (only unit
    tests and `check:presets` cover it so far).

## Android app

There is no Android app yet. The engine (`rclone.aar`, built by
`.github/workflows/rclone-mobile.yml`) is published. The app should reach
parity with iOS:

- Profiles, run history, friendly errors with rclone details hidden.
- Clients wizard with the well-known services from
  `sources/provider-presets.json` (S3, WebDAV, servers / NAS groups), provider
  filtered options and service names for existing clients.
- OAuth sign-in through a Custom Tab, re-sign-in alerts.
- Photo backup that frees space only after the upload is verified.
- Linked folders (Storage Access Framework), background sync (WorkManager).
- 9 languages.
- Every item in "Secure and supervised transfers" above (secret store:
  Android Keystore; notifications; WorkManager constraints for Wi-Fi /
  charging; a foreground service for long user-started backups).

### Splash screen

Design: `docs/designs/splash/SyncDeck Splash.dc.html` (frame `1b`, Android
412 x 915), the same animation as the iOS splash in
`mobile/ios/SyncDeck/Views/SplashView.swift`, played at 0.75x speed
(`SplashTimeline.speed`):

- 0.0s camera low and tilted over the chevrons, 0.3s the chevrons light up in
  accelerating waves with sparks running inside the bars, 1.3s the camera rises,
  2.2s top-down view with a flash and glow, 2.5s wordmark, about 3.5s into the
  app (design timings, before the 0.75x slowdown).
- Android 12+ system splash (`windowSplashScreenAnimatedIcon`) shows only the
  static chevron mark from `app/build/icon.svg` on `#0c1f1c`; the animation
  continues from there.
- Status line `Preparing profiles` is localized; the tagline stays English.
- Honour "remove animations" (show the final frame).
