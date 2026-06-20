import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { IonApp } from '@ionic/react'
import type {
  AboutInfo,
  AppState,
  BackendType,
  RemoteClient,
  RemoteDraft,
  RemoteEntry,
  SyncMode,
  SyncProfile,
  SyncProgress,
  TransferEvent,
} from './types'
import {
  OPTION_FLAGS,
  buildConnString,
  clientLabel,
  formatSize,
  hasFlag,
  isCloudSide,
  remoteOf,
  setFlag,
} from './lib/rclone'
import type { OptionId } from './lib/rclone'
import './App.css'

const VERSION = '0.2.5'
const PROVIDER_ICON_URLS = import.meta.glob('./assets/provider-icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

/* ============================================================ demo fallback (browser dev) */
const demoProfile: SyncProfile = {
  id: 'docs',
  name: 'Belgeler yedeği',
  source: '/Users/emir/Documents',
  destination: 'isdrive:Yedekler/Belgeler',
  mode: 'sync',
  enabled: true,
  extraArgs: '--checksum --bwlimit 8M',
  intervalMinutes: 60,
}

const demoState = (overrides: Partial<AppState> = {}): AppState => ({
  launchAtLogin: false,
  rclonePath: '/opt/homebrew/bin/rclone',
  configPath: 'demo',
  launchAgentPath: '~/Library/LaunchAgents/com.emironuk.syncdeck.plist',
  platform: 'browser',
  profiles: [
    demoProfile,
    { id: 'photos', name: 'Fotoğraf arşivi', source: '/Users/emir/Pictures', destination: 'arsiv:foto-2026', mode: 'copy', enabled: false, extraArgs: '', intervalMinutes: 0 },
    { id: 'code', name: 'Proje kaynağı', source: '/Users/emir/Code/sidrelabs', destination: 'b2cold:kod/snapshot', mode: 'sync', enabled: false, extraArgs: '', intervalMinutes: 0 },
  ],
  lastRun: {},
  remotes: ['isdrive:', 'arsiv:', 'b2cold:'],
  clients: [
    { name: 'isdrive:', type: 'drive' },
    { name: 'arsiv:', type: 's3' },
    { name: 'b2cold:', type: 'b2' },
  ],
  backendTypes: [
    { id: 'drive', name: 'drive', description: 'Google Drive', options: [] },
    { id: 'dropbox', name: 'dropbox', description: 'Dropbox', options: [] },
    { id: 's3', name: 's3', description: 'Amazon S3', options: [] },
    { id: 'b2', name: 'b2', description: 'Backblaze B2', options: [] },
    { id: 'sftp', name: 'sftp', description: 'SSH/SFTP', options: [] },
    { id: 'webdav', name: 'webdav', description: 'WebDAV', options: [] },
    { id: 'crypt', name: 'crypt', description: 'Encrypt/Decrypt a remote', options: [] },
  ],
  ...overrides,
})

const demoApi: Window['rcloneSyncer'] = {
  getState: async () => demoState(),
  saveProfile: async (profile) => demoState({ profiles: [profile] }),
  deleteProfile: async () => demoState({ profiles: [] }),
  chooseFolder: async () => '/Users/emir/Documents',
  runSync: async (id) =>
    demoState({
      lastRun: {
        [id]: { ok: true, code: 0, finishedAt: new Date().toISOString(), output: 'Transferred: 482 MiB / 482 MiB, 100%\n✓ Tamamlandı · 38 dosya, 0 hata' },
      },
    }),
  setLaunchAtLogin: async (enabled) => demoState({ launchAtLogin: enabled }),
  createRemote: async (remote) =>
    demoState({
      remotes: [`${remote.name}:`, 'isdrive:', 'arsiv:', 'b2cold:'],
      clients: [
        { name: `${remote.name}:`, type: remote.type },
        { name: 'isdrive:', type: 'drive' },
        { name: 'arsiv:', type: 's3' },
        { name: 'b2cold:', type: 'b2' },
      ],
    }),
  cancelSync: async () => true,
  authorizeRemote: async () => '{"access_token":"demo","token_type":"Bearer","expiry":"2030-01-01T00:00:00Z"}',
  testRemote: async () => ({ ok: true }),
  deleteRemote: async () => demoState({ remotes: ['isdrive:', 'arsiv:'], clients: [{ name: 'isdrive:', type: 'drive' }, { name: 'arsiv:', type: 's3' }] }),
  aboutRemote: async () => ({ supported: true, total: '5 TiB', used: '2.9 TiB', free: '2.1 TiB' }),
  mkdirRemote: async () => true,
  listRemote: async () => [
    { name: 'Belgeler', isDir: true, size: -1 },
    { name: 'Fotoğraflar', isDir: true, size: -1 },
    { name: 'Arşiv-2025', isDir: true, size: -1 },
    { name: 'notlar.txt', isDir: false, size: 12288 },
  ],
  openExternal: async () => undefined,
  openAbout: async () => undefined,
  onSyncProgress: () => () => undefined,
  onStateRefresh: () => () => undefined,
}

const api: Window['rcloneSyncer'] = window.rcloneSyncer || demoApi

/* ============================================================ tweakable theme */
const ACCENTS = [
  { name: 'Mint', color: '#5fd6b6' },
  { name: 'Teal', color: '#3fb8c7' },
  { name: 'Lime', color: '#9bd65f' },
  { name: 'Amber', color: '#e0a458' },
] as const
type AccentName = (typeof ACCENTS)[number]['name']

const LANGS = [
  { id: 'en', name: 'English', flag: '🇬🇧' },
  { id: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { id: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { id: 'es', name: 'Español', flag: '🇪🇸' },
  { id: 'zh', name: '中文', flag: '🇨🇳' },
  { id: 'ja', name: '日本語', flag: '🇯🇵' },
  { id: 'ru', name: 'Русский', flag: '🇷🇺' },
  { id: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { id: 'ar', name: 'العربية', flag: '🇸🇦' },
] as const
type Language = (typeof LANGS)[number]['id']

/* ============================================================ i18n */
const tr = {
  connBusy: 'Bağlı · aktarılıyor',
  connIdle: 'Bağlı · boşta',
  settings: 'Ayarlar',
  profiles: 'Profiller',
  newProfile: '+ Yeni profil',
  engineReady: 'Motor hazır',
  engineMissing: 'Motor bulunamadı',
  clientCount: (n: number) => `${n} istemci`,
  activeKicker: 'Sync profili · aktif',
  newProfileTitle: 'Yeni profil',
  run: '▶ Şimdi çalıştır',
  stop: '■ Durdur',
  save: 'Kaydet',
  sourceLabel: 'Kaynak',
  routeLocal: 'yerel',
  routeCloud: 'bulut',
  browse: 'Gözat',
  destLabel: 'Hedef',
  browseCloud: 'Bulutta gözat',
  swapRoute: 'Kaynak ve hedefi değiştir',
  noFolder: 'Klasör seçilmedi',
  targetClient: 'Hedef istemci',
  addClient: 'İstemci ekle',
  syncMode: 'Senkron modu',
  mirror: 'Ayna sync',
  copyOnly: 'Sadece kopyala',
  mirrorDesc: 'Hedefi kaynakla birebir aynalar. Kaynakta olmayan dosyalar hedefte de silinir.',
  copyDesc: 'Dosyaları yalnızca ekler, hiçbir şeyi silmez. Güvenli ve geri dönüşsüz veri kaybı yok.',
  moveTitle: 'Taşı',
  moveDesc: 'Dosyaları hedefe taşır; başarıyla aktarılanlar kaynaktan silinir.',
  bisyncTitle: 'Çift yönlü',
  bisyncDesc: 'İki konumu çift yönlü eşitler; ilk çalıştırmada güvenli kurulum (resync) yapılır.',
  checkTitle: 'Doğrula',
  checkDesc: 'Hiçbir şey yazmadan kaynak ile hedefi karşılaştırır, farkları raporlar.',
  tagMirror: 'Ayna',
  tagCopy: 'Kopya',
  tagMove: 'Taşı',
  tagBisync: 'Çift',
  tagCheck: 'Test',
  quotaFree: 'boş',
  schedule: 'Zamanlama & seçenekler',
  schedTitle: 'Çalışma sıklığı',
  schedHint: 'Etkin profiller bu sıklıkta arka planda otomatik çalışır (kapalıyken bile, macOS daemon).',
  schedManual: 'Manuel',
  sched15: '15 dk',
  sched30: '30 dk',
  schedHourly: 'Saatlik',
  sched6h: '6 saat',
  schedDaily: 'Günlük',
  optChecksumLabel: 'Aktarım sonrası doğrula',
  optChecksumHint: 'Sağlama toplamlarını karşılaştır',
  optDryrunLabel: 'Önce kuru çalışma',
  optDryrunHint: 'Hiçbir şey yazmadan değişiklikleri göster',
  optBwlimitLabel: 'Bant genişliği sınırı',
  optBwlimitHint: 'Çalışırken 8 MiB/s ile sınırla',
  optStartupLabel: 'Açılışta bu profili çalıştır',
  optStartupHint: 'Girişte sessizce senkronize et',
  liveLog: 'Canlı günlük',
  noRun: 'Henüz çalışma yok. "Şimdi çalıştır" ile profili dene.',
  deleteProfile: 'Profili sil',
  statusTitle: 'Durum',
  syncing: 'Senkronize ediliyor',
  idle: 'Beklemede',
  speed: 'Hız',
  files: 'Dosya',
  eta: 'ETA',
  langTitle: 'Dil',
  accentTitle: 'Vurgu rengi',
  themeTitle: 'Tema',
  themeDark: 'Koyu',
  themeLight: 'Açık',
  profileName: 'Profil adı',
  systemTitle: 'Sistem',
  launchAtLogin: 'Arka plan zamanlayıcı (daemon)',
  launchAtLoginHint: 'Girişte başlat ve profilleri zamanlanan sıklıkta uygulama kapalıyken bile çalıştır',
  definedClients: 'Tanımlı istemciler',
  newClient: '+ Yeni istemci',
  noClients: 'Henüz istemci yok. Bir tane ekleyerek başla.',
  connected: 'bağlı',
  tabInterface: 'Arayüz',
  tabClients: 'İstemciler',
  tabAbout: 'Hakkında',
  aboutTitle: 'Açık kaynak hakkında',
  aboutBody:
    'SyncDeck, bağımsız açık kaynak rclone projesinin grafik bir sarmalayıcısıdır (wrapper). Tüm aktarımlar arka planda rclone komut satırı motoruyla yürütülür; SyncDeck yalnızca onu kullanışlı bir arayüzle sunar. rclone uygulamayla birlikte paketlenir — ayrıca kurman gerekmez.',
  version: (v: string) => `Sürüm ${v} · sidrelabs.com/syncdeck`,
  wizStepOf: (n: number) => `Yeni istemci · adım ${n}/3`,
  wizStep1: 'Bağlantı türü',
  wizStep2: 'Kimlik & ad',
  wizStep3: 'Gözden geçir & oluştur',
  wizTypePrompt: 'Bağlanmak istediğin bulut türünü seç. SyncDeck arka planda uygun yapılandırmayı oluşturur.',
  providerSearch: 'Client ara',
  wizClientName: 'İstemci adı',
  wizClientNamePh: 'ör. İş Drive',
  wizCredNote: 'Kimlik bilgileri yalnızca yerel motor yapılandırmanda saklanır, hiçbir yere gönderilmez.',
  wizReviewPrompt: 'Her şey hazır. SyncDeck aşağıdaki komutu arka planda çalıştırarak istemciyi oluşturacak:',
  wizName: 'Ad',
  wizType: 'Tür',
  wizRemote: 'Remote',
  engineCmd: 'Motor komutu',
  runsInBg: 'arka planda çalışır',
  back: '‹ Geri',
  next: 'Devam →',
  create: 'İstemciyi oluştur',
  pickerSub: 'Bulut konumu seç',
  pickerEmpty: 'Bu klasör boş.',
  pickerError: 'Bu konum listelenemedi.',
  pickerLoading: 'Yükleniyor…',
  pickerNewFolder: 'Yeni klasör',
  pickerFolderName: 'Klasör adı',
  pickerCreate: 'Oluştur',
  pickerCreating: 'Oluşturuluyor…',
  pickerNameInvalid: 'Klasör adı / veya \\ içeremez.',
  pickerCancel: 'İptal',
  pickerConfirm: 'Bu klasörü seç',
  cloud: 'Bulut',
  engineUnavailable: 'SyncDeck motoru çalışmıyor',
  engineUnavailableDetail: 'Paketli senkron motoru başlatılamadı. SyncDeck’i yeniden kur veya motor dahil olacak şekilde tekrar derle.',
  retry: 'Tekrar dene',
  wizAuthorize: 'Tarayıcıda yetkilendir',
  wizAuthorizing: 'Yetkilendiriliyor…',
  wizAuthorized: 'Yetkilendirildi',
  wizReauthorize: 'Yeniden yetkilendir',
  wizOauthNote: 'Tarayıcıda yetkilendir; SyncDeck erişim jetonunu yerel motor yapılandırmanda güvenle saklar.',
  wizTest: 'Bağlantıyı test et',
  wizTesting: 'Test ediliyor…',
  wizTestOk: 'Bağlantı başarılı',
  wizTestFail: 'Bağlantı başarısız',
  wizOptional: 'opsiyonel',
  wizNeedAuth: 'Devam etmeden önce tarayıcıda yetkilendir.',
  testClient: 'Test et',
  deleteClientLabel: 'Sil',
  deleteClientConfirm: (name: string) => `"${name}" istemcisi silinsin mi? Bu işlem geri alınamaz.`,
}
type Copy = typeof tr

const en: Copy = {
  connBusy: 'Connected · transferring',
  connIdle: 'Connected · idle',
  settings: 'Settings',
  profiles: 'Profiles',
  newProfile: '+ New profile',
  engineReady: 'Engine ready',
  engineMissing: 'Engine not found',
  clientCount: (n) => `${n} clients`,
  activeKicker: 'Sync profile · active',
  newProfileTitle: 'New profile',
  run: '▶ Run now',
  stop: '■ Stop',
  save: 'Save',
  sourceLabel: 'Source',
  routeLocal: 'local',
  routeCloud: 'cloud',
  browse: 'Browse',
  destLabel: 'Destination',
  browseCloud: 'Browse cloud',
  swapRoute: 'Swap source and destination',
  noFolder: 'No folder selected',
  targetClient: 'Target client',
  addClient: 'Add client',
  syncMode: 'Sync mode',
  mirror: 'Mirror sync',
  copyOnly: 'Copy only',
  mirrorDesc: 'Mirrors the destination to the source. Files not in the source are deleted at the destination.',
  copyDesc: 'Only adds files, deletes nothing. Safe — no irreversible data loss.',
  moveTitle: 'Move',
  moveDesc: 'Moves files to the destination; successfully transferred files are removed from the source.',
  bisyncTitle: 'Bi-directional',
  bisyncDesc: 'Keeps both locations in sync both ways; the first run does a safe baseline resync.',
  checkTitle: 'Check',
  checkDesc: 'Compares source and destination without writing anything, and reports differences.',
  tagMirror: 'Mirror',
  tagCopy: 'Copy',
  tagMove: 'Move',
  tagBisync: 'Bi-dir',
  tagCheck: 'Check',
  quotaFree: 'free',
  schedule: 'Scheduling & options',
  schedTitle: 'Run frequency',
  schedHint: 'Enabled profiles run automatically in the background at this cadence (even when closed, via the macOS daemon).',
  schedManual: 'Manual',
  sched15: '15 min',
  sched30: '30 min',
  schedHourly: 'Hourly',
  sched6h: '6 hours',
  schedDaily: 'Daily',
  optChecksumLabel: 'Verify after transfer',
  optChecksumHint: 'Compare checksums',
  optDryrunLabel: 'Dry run first',
  optDryrunHint: 'Show changes without writing anything',
  optBwlimitLabel: 'Bandwidth limit',
  optBwlimitHint: 'Cap at 8 MiB/s while running',
  optStartupLabel: 'Run this profile at startup',
  optStartupHint: 'Sync silently at login',
  liveLog: 'Live log',
  noRun: 'No run yet. Use "Run now" to try the profile.',
  deleteProfile: 'Delete profile',
  statusTitle: 'Status',
  syncing: 'Syncing',
  idle: 'Idle',
  speed: 'Speed',
  files: 'Files',
  eta: 'ETA',
  langTitle: 'Language',
  accentTitle: 'Accent color',
  themeTitle: 'Theme',
  themeDark: 'Dark',
  themeLight: 'Light',
  profileName: 'Profile name',
  systemTitle: 'System',
  launchAtLogin: 'Background scheduler (daemon)',
  launchAtLoginHint: 'Launch at login and run profiles on their schedule even when the app is closed',
  definedClients: 'Configured clients',
  newClient: '+ New client',
  noClients: 'No clients yet. Add one to get started.',
  connected: 'connected',
  tabInterface: 'Interface',
  tabClients: 'Clients',
  tabAbout: 'About',
  aboutTitle: 'About open source',
  aboutBody:
    'SyncDeck is a graphical wrapper for the independent open-source rclone project. Every transfer runs on the rclone command-line engine in the background; SyncDeck just presents it with a friendly interface. rclone ships bundled with the app — no separate install needed.',
  version: (v) => `Version ${v} · sidrelabs.com/syncdeck`,
  wizStepOf: (n) => `New client · step ${n}/3`,
  wizStep1: 'Connection type',
  wizStep2: 'Identity & name',
  wizStep3: 'Review & create',
  wizTypePrompt: 'Pick the cloud type you want to connect. SyncDeck builds the right configuration behind the scenes.',
  providerSearch: 'Search clients',
  wizClientName: 'Client name',
  wizClientNamePh: 'e.g. Work Drive',
  wizCredNote: 'Credentials are stored only in your local engine config and never sent anywhere.',
  wizReviewPrompt: 'All set. SyncDeck will create the client by running this command in the background:',
  wizName: 'Name',
  wizType: 'Type',
  wizRemote: 'Remote',
  engineCmd: 'Engine command',
  runsInBg: 'runs in background',
  back: '‹ Back',
  next: 'Continue →',
  create: 'Create client',
  pickerSub: 'Choose a cloud location',
  pickerEmpty: 'This folder is empty.',
  pickerError: 'Could not list this location.',
  pickerLoading: 'Loading…',
  pickerNewFolder: 'New folder',
  pickerFolderName: 'Folder name',
  pickerCreate: 'Create',
  pickerCreating: 'Creating…',
  pickerNameInvalid: 'Folder name cannot contain / or \\.',
  pickerCancel: 'Cancel',
  pickerConfirm: 'Select this folder',
  cloud: 'Cloud',
  engineUnavailable: 'SyncDeck engine unavailable',
  engineUnavailableDetail: 'The bundled sync engine could not start. Reinstall SyncDeck or rebuild it with the engine included.',
  retry: 'Retry',
  wizAuthorize: 'Authorize in browser',
  wizAuthorizing: 'Authorizing…',
  wizAuthorized: 'Authorized',
  wizReauthorize: 'Re-authorize',
  wizOauthNote: 'Authorize in your browser; SyncDeck stores the access token securely in your local engine config.',
  wizTest: 'Test connection',
  wizTesting: 'Testing…',
  wizTestOk: 'Connection OK',
  wizTestFail: 'Connection failed',
  wizOptional: 'optional',
  wizNeedAuth: 'Authorize in your browser before continuing.',
  testClient: 'Test',
  deleteClientLabel: 'Delete',
  deleteClientConfirm: (name) => `Delete client "${name}"? This cannot be undone.`,
}

const de: Copy = {
  connBusy: 'Verbunden · Übertragung läuft',
  connIdle: 'Verbunden · inaktiv',
  settings: 'Einstellungen',
  profiles: 'Profile',
  newProfile: '+ Neues Profil',
  engineReady: 'Engine bereit',
  engineMissing: 'Engine nicht gefunden',
  clientCount: (n) => `${n} Clients`,
  activeKicker: 'Sync-Profil · aktiv',
  newProfileTitle: 'Neues Profil',
  run: '▶ Jetzt ausführen',
  stop: '■ Stoppen',
  save: 'Speichern',
  sourceLabel: 'Quelle',
  routeLocal: 'lokal',
  routeCloud: 'Cloud',
  browse: 'Durchsuchen',
  destLabel: 'Ziel',
  browseCloud: 'Cloud durchsuchen',
  swapRoute: 'Quelle und Ziel tauschen',
  noFolder: 'Kein Ordner ausgewählt',
  targetClient: 'Ziel-Client',
  addClient: 'Client hinzufügen',
  syncMode: 'Sync-Modus',
  mirror: 'Mirror-Sync',
  copyOnly: 'Nur kopieren',
  mirrorDesc: 'Spiegelt das Ziel exakt zur Quelle. Dateien, die in der Quelle fehlen, werden am Ziel gelöscht.',
  copyDesc: 'Fügt nur Dateien hinzu und löscht nichts. Sicher, ohne unumkehrbaren Datenverlust.',
  moveTitle: 'Verschieben',
  moveDesc: 'Verschiebt Dateien zum Ziel; erfolgreich übertragene Dateien werden aus der Quelle entfernt.',
  bisyncTitle: 'Bidirektional',
  bisyncDesc: 'Hält beide Orte in beide Richtungen synchron; der erste Lauf erstellt eine sichere Basis.',
  checkTitle: 'Prüfen',
  checkDesc: 'Vergleicht Quelle und Ziel ohne zu schreiben und meldet Unterschiede.',
  tagMirror: 'Mirror',
  tagCopy: 'Kopie',
  tagMove: 'Move',
  tagBisync: 'Bi-dir',
  tagCheck: 'Check',
  quotaFree: 'frei',
  schedule: 'Zeitplan & Optionen',
  schedTitle: 'Ausführungsintervall',
  schedHint: 'Aktive Profile laufen automatisch in diesem Intervall im Hintergrund, auch wenn die App geschlossen ist.',
  schedManual: 'Manuell',
  sched15: '15 Min.',
  sched30: '30 Min.',
  schedHourly: 'Stündlich',
  sched6h: '6 Stunden',
  schedDaily: 'Täglich',
  optChecksumLabel: 'Nach Transfer prüfen',
  optChecksumHint: 'Prüfsummen vergleichen',
  optDryrunLabel: 'Zuerst Probelauf',
  optDryrunHint: 'Änderungen anzeigen, ohne zu schreiben',
  optBwlimitLabel: 'Bandbreite begrenzen',
  optBwlimitHint: 'Während des Laufs auf 8 MiB/s begrenzen',
  optStartupLabel: 'Dieses Profil beim Start ausführen',
  optStartupHint: 'Beim Login still synchronisieren',
  liveLog: 'Live-Protokoll',
  noRun: 'Noch kein Lauf. Teste das Profil mit „Jetzt ausführen“.',
  deleteProfile: 'Profil löschen',
  statusTitle: 'Status',
  syncing: 'Synchronisiert',
  idle: 'Inaktiv',
  speed: 'Geschwindigkeit',
  files: 'Dateien',
  eta: 'ETA',
  langTitle: 'Sprache',
  accentTitle: 'Akzentfarbe',
  themeTitle: 'Theme',
  themeDark: 'Dunkel',
  themeLight: 'Hell',
  profileName: 'Profilname',
  systemTitle: 'System',
  launchAtLogin: 'Hintergrundplaner (Daemon)',
  launchAtLoginHint: 'Beim Login starten und Profile auch bei geschlossener App nach Zeitplan ausführen',
  definedClients: 'Konfigurierte Clients',
  newClient: '+ Neuer Client',
  noClients: 'Noch keine Clients. Füge einen hinzu, um zu starten.',
  connected: 'verbunden',
  tabInterface: 'Oberfläche',
  tabClients: 'Clients',
  tabAbout: 'Info',
  aboutTitle: 'Über Open Source',
  aboutBody:
    'SyncDeck ist ein grafischer Wrapper für das unabhängige Open-Source-Projekt rclone. Jede Übertragung läuft im Hintergrund über die rclone-Kommandozeilen-Engine; SyncDeck stellt dafür nur eine freundliche Oberfläche bereit. rclone wird mit der App gebündelt, eine separate Installation ist nicht nötig.',
  version: (v) => `Version ${v} · sidrelabs.com/syncdeck`,
  wizStepOf: (n) => `Neuer Client · Schritt ${n}/3`,
  wizStep1: 'Verbindungstyp',
  wizStep2: 'Identität & Name',
  wizStep3: 'Prüfen & erstellen',
  wizTypePrompt: 'Wähle den Cloud-Typ, den du verbinden möchtest. SyncDeck erstellt die passende Konfiguration im Hintergrund.',
  providerSearch: 'Clients suchen',
  wizClientName: 'Clientname',
  wizClientNamePh: 'z. B. Work Drive',
  wizCredNote: 'Zugangsdaten werden nur in deiner lokalen Engine-Konfiguration gespeichert und nirgendwohin gesendet.',
  wizReviewPrompt: 'Alles bereit. SyncDeck erstellt den Client, indem es diesen Befehl im Hintergrund ausführt:',
  wizName: 'Name',
  wizType: 'Typ',
  wizRemote: 'Remote',
  engineCmd: 'Engine-Befehl',
  runsInBg: 'läuft im Hintergrund',
  back: '‹ Zurück',
  next: 'Weiter →',
  create: 'Client erstellen',
  pickerSub: 'Cloud-Ort auswählen',
  pickerEmpty: 'Dieser Ordner ist leer.',
  pickerError: 'Dieser Ort konnte nicht aufgelistet werden.',
  pickerLoading: 'Lädt…',
  pickerNewFolder: 'Neuer Ordner',
  pickerFolderName: 'Ordnername',
  pickerCreate: 'Erstellen',
  pickerCreating: 'Erstellt…',
  pickerNameInvalid: 'Der Ordnername darf / oder \\ nicht enthalten.',
  pickerCancel: 'Abbrechen',
  pickerConfirm: 'Diesen Ordner auswählen',
  cloud: 'Cloud',
  engineUnavailable: 'SyncDeck-Engine nicht verfügbar',
  engineUnavailableDetail: 'Die gebündelte Sync-Engine konnte nicht gestartet werden. Installiere SyncDeck neu oder baue es mit enthaltener Engine erneut.',
  retry: 'Erneut versuchen',
  wizAuthorize: 'Im Browser autorisieren',
  wizAuthorizing: 'Autorisiert…',
  wizAuthorized: 'Autorisiert',
  wizReauthorize: 'Erneut autorisieren',
  wizOauthNote: 'Autorisiere im Browser; SyncDeck speichert das Zugriffstoken sicher in deiner lokalen Engine-Konfiguration.',
  wizTest: 'Verbindung testen',
  wizTesting: 'Testet…',
  wizTestOk: 'Verbindung OK',
  wizTestFail: 'Verbindung fehlgeschlagen',
  wizOptional: 'optional',
  wizNeedAuth: 'Autorisiere im Browser, bevor du fortfährst.',
  testClient: 'Testen',
  deleteClientLabel: 'Löschen',
  deleteClientConfirm: (name) => `Client „${name}“ löschen? Dies kann nicht rückgängig gemacht werden.`,
}

const es: Copy = {
  connBusy: 'Conectado · transfiriendo',
  connIdle: 'Conectado · inactivo',
  settings: 'Ajustes',
  profiles: 'Perfiles',
  newProfile: '+ Nuevo perfil',
  engineReady: 'Motor listo',
  engineMissing: 'Motor no encontrado',
  clientCount: (n) => `${n} clientes`,
  activeKicker: 'Perfil de sync · activo',
  newProfileTitle: 'Nuevo perfil',
  run: '▶ Ejecutar ahora',
  stop: '■ Detener',
  save: 'Guardar',
  sourceLabel: 'Origen',
  routeLocal: 'local',
  routeCloud: 'nube',
  browse: 'Explorar',
  destLabel: 'Destino',
  browseCloud: 'Explorar nube',
  swapRoute: 'Intercambiar origen y destino',
  noFolder: 'No se seleccionó carpeta',
  targetClient: 'Cliente de destino',
  addClient: 'Añadir cliente',
  syncMode: 'Modo de sync',
  mirror: 'Sync espejo',
  copyOnly: 'Solo copiar',
  mirrorDesc: 'Refleja el destino para que coincida con el origen. Los archivos que no estén en el origen se eliminan del destino.',
  copyDesc: 'Solo añade archivos, no elimina nada. Seguro, sin pérdida irreversible de datos.',
  moveTitle: 'Mover',
  moveDesc: 'Mueve archivos al destino; los transferidos correctamente se eliminan del origen.',
  bisyncTitle: 'Bidireccional',
  bisyncDesc: 'Mantiene ambas ubicaciones sincronizadas en ambos sentidos; la primera ejecución crea una base segura.',
  checkTitle: 'Comprobar',
  checkDesc: 'Compara origen y destino sin escribir nada e informa las diferencias.',
  tagMirror: 'Espejo',
  tagCopy: 'Copia',
  tagMove: 'Mover',
  tagBisync: 'Bi-dir',
  tagCheck: 'Check',
  quotaFree: 'libre',
  schedule: 'Programación y opciones',
  schedTitle: 'Frecuencia de ejecución',
  schedHint: 'Los perfiles activos se ejecutan automáticamente en segundo plano con esta frecuencia, incluso con la app cerrada.',
  schedManual: 'Manual',
  sched15: '15 min',
  sched30: '30 min',
  schedHourly: 'Cada hora',
  sched6h: '6 horas',
  schedDaily: 'Diario',
  optChecksumLabel: 'Verificar después de transferir',
  optChecksumHint: 'Comparar sumas de comprobación',
  optDryrunLabel: 'Simular primero',
  optDryrunHint: 'Mostrar cambios sin escribir nada',
  optBwlimitLabel: 'Límite de ancho de banda',
  optBwlimitHint: 'Limitar a 8 MiB/s durante la ejecución',
  optStartupLabel: 'Ejecutar este perfil al iniciar',
  optStartupHint: 'Sincronizar silenciosamente al iniciar sesión',
  liveLog: 'Registro en vivo',
  noRun: 'Aún no hay ejecuciones. Usa "Ejecutar ahora" para probar el perfil.',
  deleteProfile: 'Eliminar perfil',
  statusTitle: 'Estado',
  syncing: 'Sincronizando',
  idle: 'Inactivo',
  speed: 'Velocidad',
  files: 'Archivos',
  eta: 'ETA',
  langTitle: 'Idioma',
  accentTitle: 'Color de acento',
  themeTitle: 'Tema',
  themeDark: 'Oscuro',
  themeLight: 'Claro',
  profileName: 'Nombre del perfil',
  systemTitle: 'Sistema',
  launchAtLogin: 'Programador en segundo plano (daemon)',
  launchAtLoginHint: 'Inicia al entrar y ejecuta perfiles según su programación aunque la app esté cerrada',
  definedClients: 'Clientes configurados',
  newClient: '+ Nuevo cliente',
  noClients: 'Todavía no hay clientes. Añade uno para empezar.',
  connected: 'conectado',
  tabInterface: 'Interfaz',
  tabClients: 'Clientes',
  tabAbout: 'Acerca de',
  aboutTitle: 'Acerca del código abierto',
  aboutBody:
    'SyncDeck es un wrapper gráfico para el proyecto independiente de código abierto rclone. Todas las transferencias se ejecutan en segundo plano con el motor de línea de comandos de rclone; SyncDeck solo lo presenta con una interfaz cómoda. rclone viene incluido con la app, no necesitas instalarlo aparte.',
  version: (v) => `Versión ${v} · sidrelabs.com/syncdeck`,
  wizStepOf: (n) => `Nuevo cliente · paso ${n}/3`,
  wizStep1: 'Tipo de conexión',
  wizStep2: 'Identidad y nombre',
  wizStep3: 'Revisar y crear',
  wizTypePrompt: 'Elige el tipo de nube que quieres conectar. SyncDeck crea la configuración adecuada en segundo plano.',
  providerSearch: 'Buscar clientes',
  wizClientName: 'Nombre del cliente',
  wizClientNamePh: 'p. ej. Work Drive',
  wizCredNote: 'Las credenciales se guardan solo en tu configuración local del motor y no se envían a ningún sitio.',
  wizReviewPrompt: 'Todo listo. SyncDeck creará el cliente ejecutando este comando en segundo plano:',
  wizName: 'Nombre',
  wizType: 'Tipo',
  wizRemote: 'Remote',
  engineCmd: 'Comando del motor',
  runsInBg: 'se ejecuta en segundo plano',
  back: '‹ Atrás',
  next: 'Continuar →',
  create: 'Crear cliente',
  pickerSub: 'Elegir ubicación en la nube',
  pickerEmpty: 'Esta carpeta está vacía.',
  pickerError: 'No se pudo listar esta ubicación.',
  pickerLoading: 'Cargando…',
  pickerNewFolder: 'Nueva carpeta',
  pickerFolderName: 'Nombre de carpeta',
  pickerCreate: 'Crear',
  pickerCreating: 'Creando…',
  pickerNameInvalid: 'El nombre de carpeta no puede contener / ni \\.',
  pickerCancel: 'Cancelar',
  pickerConfirm: 'Seleccionar esta carpeta',
  cloud: 'Nube',
  engineUnavailable: 'Motor de SyncDeck no disponible',
  engineUnavailableDetail: 'No se pudo iniciar el motor de sincronización incluido. Reinstala SyncDeck o recompílalo con el motor incluido.',
  retry: 'Reintentar',
  wizAuthorize: 'Autorizar en el navegador',
  wizAuthorizing: 'Autorizando…',
  wizAuthorized: 'Autorizado',
  wizReauthorize: 'Volver a autorizar',
  wizOauthNote: 'Autoriza en tu navegador; SyncDeck guarda el token de acceso de forma segura en tu configuración local del motor.',
  wizTest: 'Probar conexión',
  wizTesting: 'Probando…',
  wizTestOk: 'Conexión OK',
  wizTestFail: 'Error de conexión',
  wizOptional: 'opcional',
  wizNeedAuth: 'Autoriza en tu navegador antes de continuar.',
  testClient: 'Probar',
  deleteClientLabel: 'Eliminar',
  deleteClientConfirm: (name) => `¿Eliminar el cliente "${name}"? Esta acción no se puede deshacer.`,
}

const zh: Copy = {
  connBusy: '已连接 · 正在传输',
  connIdle: '已连接 · 空闲',
  settings: '设置',
  profiles: '配置文件',
  newProfile: '+ 新建配置文件',
  engineReady: '引擎就绪',
  engineMissing: '未找到引擎',
  clientCount: (n) => `${n} 个客户端`,
  activeKicker: '同步配置 · 活动',
  newProfileTitle: '新建配置文件',
  run: '▶ 立即运行',
  stop: '■ 停止',
  save: '保存',
  sourceLabel: '源',
  routeLocal: '本地',
  routeCloud: '云端',
  browse: '浏览',
  destLabel: '目标',
  browseCloud: '浏览云端',
  swapRoute: '交换源和目标',
  noFolder: '未选择文件夹',
  targetClient: '目标客户端',
  addClient: '添加客户端',
  syncMode: '同步模式',
  mirror: '镜像同步',
  copyOnly: '仅复制',
  mirrorDesc: '让目标与源完全一致。源中不存在的文件会从目标删除。',
  copyDesc: '只添加文件，不删除任何内容。安全，不会造成不可逆的数据丢失。',
  moveTitle: '移动',
  moveDesc: '将文件移动到目标；成功传输的文件会从源中删除。',
  bisyncTitle: '双向',
  bisyncDesc: '双向保持两个位置同步；首次运行会建立安全基线。',
  checkTitle: '检查',
  checkDesc: '在不写入任何内容的情况下比较源和目标，并报告差异。',
  tagMirror: '镜像',
  tagCopy: '复制',
  tagMove: '移动',
  tagBisync: '双向',
  tagCheck: '检查',
  quotaFree: '可用',
  schedule: '计划与选项',
  schedTitle: '运行频率',
  schedHint: '启用的配置文件会按此频率在后台自动运行，即使应用已关闭。',
  schedManual: '手动',
  sched15: '15 分钟',
  sched30: '30 分钟',
  schedHourly: '每小时',
  sched6h: '6 小时',
  schedDaily: '每天',
  optChecksumLabel: '传输后验证',
  optChecksumHint: '比较校验和',
  optDryrunLabel: '先试运行',
  optDryrunHint: '不写入任何内容，仅显示更改',
  optBwlimitLabel: '带宽限制',
  optBwlimitHint: '运行时限制为 8 MiB/s',
  optStartupLabel: '启动时运行此配置文件',
  optStartupHint: '登录时静默同步',
  liveLog: '实时日志',
  noRun: '尚未运行。使用“立即运行”测试此配置文件。',
  deleteProfile: '删除配置文件',
  statusTitle: '状态',
  syncing: '正在同步',
  idle: '空闲',
  speed: '速度',
  files: '文件',
  eta: 'ETA',
  langTitle: '语言',
  accentTitle: '强调色',
  themeTitle: '主题',
  themeDark: '深色',
  themeLight: '浅色',
  profileName: '配置文件名称',
  systemTitle: '系统',
  launchAtLogin: '后台计划程序 (daemon)',
  launchAtLoginHint: '登录时启动，并在应用关闭时仍按计划运行配置文件',
  definedClients: '已配置客户端',
  newClient: '+ 新建客户端',
  noClients: '还没有客户端。添加一个即可开始。',
  connected: '已连接',
  tabInterface: '界面',
  tabClients: '客户端',
  tabAbout: '关于',
  aboutTitle: '关于开源',
  aboutBody:
    'SyncDeck 是独立开源项目 rclone 的图形包装器。所有传输都在后台通过 rclone 命令行引擎执行；SyncDeck 只是提供更友好的界面。rclone 已随应用打包，无需单独安装。',
  version: (v) => `版本 ${v} · sidrelabs.com/syncdeck`,
  wizStepOf: (n) => `新建客户端 · 第 ${n}/3 步`,
  wizStep1: '连接类型',
  wizStep2: '身份与名称',
  wizStep3: '检查并创建',
  wizTypePrompt: '选择要连接的云类型。SyncDeck 会在后台构建正确的配置。',
  providerSearch: '搜索客户端',
  wizClientName: '客户端名称',
  wizClientNamePh: '例如 Work Drive',
  wizCredNote: '凭据只会保存在本地引擎配置中，不会发送到任何地方。',
  wizReviewPrompt: '一切就绪。SyncDeck 将在后台运行以下命令来创建客户端：',
  wizName: '名称',
  wizType: '类型',
  wizRemote: 'Remote',
  engineCmd: '引擎命令',
  runsInBg: '在后台运行',
  back: '‹ 返回',
  next: '继续 →',
  create: '创建客户端',
  pickerSub: '选择云端位置',
  pickerEmpty: '此文件夹为空。',
  pickerError: '无法列出此位置。',
  pickerLoading: '正在加载…',
  pickerNewFolder: '新建文件夹',
  pickerFolderName: '文件夹名称',
  pickerCreate: '创建',
  pickerCreating: '正在创建…',
  pickerNameInvalid: '文件夹名称不能包含 / 或 \\。',
  pickerCancel: '取消',
  pickerConfirm: '选择此文件夹',
  cloud: '云端',
  engineUnavailable: 'SyncDeck 引擎不可用',
  engineUnavailableDetail: '无法启动随附的同步引擎。请重新安装 SyncDeck，或在构建时包含该引擎。',
  retry: '重试',
  wizAuthorize: '在浏览器中授权',
  wizAuthorizing: '正在授权…',
  wizAuthorized: '已授权',
  wizReauthorize: '重新授权',
  wizOauthNote: '在浏览器中授权；SyncDeck 会把访问令牌安全地保存在本地引擎配置中。',
  wizTest: '测试连接',
  wizTesting: '正在测试…',
  wizTestOk: '连接正常',
  wizTestFail: '连接失败',
  wizOptional: '可选',
  wizNeedAuth: '继续前请先在浏览器中授权。',
  testClient: '测试',
  deleteClientLabel: '删除',
  deleteClientConfirm: (name) => `删除客户端“${name}”？此操作无法撤销。`,
}

const ja: Copy = {
  connBusy: '接続済み · 転送中',
  connIdle: '接続済み · 待機中',
  settings: '設定',
  profiles: 'プロファイル',
  newProfile: '+ 新規プロファイル',
  engineReady: 'エンジン準備完了',
  engineMissing: 'エンジンが見つかりません',
  clientCount: (n) => `${n} クライアント`,
  activeKicker: '同期プロファイル · 有効',
  newProfileTitle: '新規プロファイル',
  run: '▶ 今すぐ実行',
  stop: '■ 停止',
  save: '保存',
  sourceLabel: 'ソース',
  routeLocal: 'ローカル',
  routeCloud: 'クラウド',
  browse: '参照',
  destLabel: '宛先',
  browseCloud: 'クラウドを参照',
  swapRoute: 'ソースと宛先を入れ替え',
  noFolder: 'フォルダが選択されていません',
  targetClient: '宛先クライアント',
  addClient: 'クライアントを追加',
  syncMode: '同期モード',
  mirror: 'ミラー同期',
  copyOnly: 'コピーのみ',
  mirrorDesc: '宛先をソースと完全に一致させます。ソースにないファイルは宛先から削除されます。',
  copyDesc: 'ファイルを追加するだけで、削除はしません。不可逆なデータ損失がなく安全です。',
  moveTitle: '移動',
  moveDesc: 'ファイルを宛先へ移動します。正常に転送されたファイルはソースから削除されます。',
  bisyncTitle: '双方向',
  bisyncDesc: '2 つの場所を双方向に同期します。初回実行では安全な基準を作成します。',
  checkTitle: 'チェック',
  checkDesc: '何も書き込まずにソースと宛先を比較し、差分を報告します。',
  tagMirror: 'ミラー',
  tagCopy: 'コピー',
  tagMove: '移動',
  tagBisync: '双方向',
  tagCheck: '確認',
  quotaFree: '空き',
  schedule: 'スケジュールとオプション',
  schedTitle: '実行頻度',
  schedHint: '有効なプロファイルはこの間隔でバックグラウンド実行されます。アプリを閉じていても実行されます。',
  schedManual: '手動',
  sched15: '15 分',
  sched30: '30 分',
  schedHourly: '毎時',
  sched6h: '6 時間',
  schedDaily: '毎日',
  optChecksumLabel: '転送後に検証',
  optChecksumHint: 'チェックサムを比較',
  optDryrunLabel: '先にドライラン',
  optDryrunHint: '何も書き込まずに変更を表示',
  optBwlimitLabel: '帯域幅制限',
  optBwlimitHint: '実行中は 8 MiB/s に制限',
  optStartupLabel: '起動時にこのプロファイルを実行',
  optStartupHint: 'ログイン時に静かに同期',
  liveLog: 'ライブログ',
  noRun: 'まだ実行されていません。「今すぐ実行」でプロファイルを試してください。',
  deleteProfile: 'プロファイルを削除',
  statusTitle: '状態',
  syncing: '同期中',
  idle: '待機中',
  speed: '速度',
  files: 'ファイル',
  eta: 'ETA',
  langTitle: '言語',
  accentTitle: 'アクセントカラー',
  themeTitle: 'テーマ',
  themeDark: 'ダーク',
  themeLight: 'ライト',
  profileName: 'プロファイル名',
  systemTitle: 'システム',
  launchAtLogin: 'バックグラウンドスケジューラ (daemon)',
  launchAtLoginHint: 'ログイン時に起動し、アプリを閉じていてもスケジュール通りにプロファイルを実行します',
  definedClients: '設定済みクライアント',
  newClient: '+ 新規クライアント',
  noClients: 'クライアントはまだありません。追加して開始してください。',
  connected: '接続済み',
  tabInterface: 'インターフェース',
  tabClients: 'クライアント',
  tabAbout: '情報',
  aboutTitle: 'オープンソースについて',
  aboutBody:
    'SyncDeck は、独立したオープンソースプロジェクト rclone のグラフィカルラッパーです。すべての転送はバックグラウンドで rclone コマンドラインエンジンにより実行されます。SyncDeck はそれを使いやすいインターフェースで提供します。rclone はアプリに同梱されているため、別途インストールは不要です。',
  version: (v) => `バージョン ${v} · sidrelabs.com/syncdeck`,
  wizStepOf: (n) => `新規クライアント · ステップ ${n}/3`,
  wizStep1: '接続タイプ',
  wizStep2: 'ID と名前',
  wizStep3: '確認して作成',
  wizTypePrompt: '接続したいクラウドの種類を選択してください。SyncDeck がバックグラウンドで適切な設定を作成します。',
  providerSearch: 'クライアントを検索',
  wizClientName: 'クライアント名',
  wizClientNamePh: '例: Work Drive',
  wizCredNote: '認証情報はローカルのエンジン設定にのみ保存され、どこにも送信されません。',
  wizReviewPrompt: '準備完了です。SyncDeck はバックグラウンドでこのコマンドを実行してクライアントを作成します:',
  wizName: '名前',
  wizType: 'タイプ',
  wizRemote: 'Remote',
  engineCmd: 'エンジンコマンド',
  runsInBg: 'バックグラウンドで実行',
  back: '‹ 戻る',
  next: '続行 →',
  create: 'クライアントを作成',
  pickerSub: 'クラウド上の場所を選択',
  pickerEmpty: 'このフォルダは空です。',
  pickerError: 'この場所を一覧表示できませんでした。',
  pickerLoading: '読み込み中…',
  pickerNewFolder: '新規フォルダ',
  pickerFolderName: 'フォルダ名',
  pickerCreate: '作成',
  pickerCreating: '作成中…',
  pickerNameInvalid: 'フォルダ名に / または \\ は使用できません。',
  pickerCancel: 'キャンセル',
  pickerConfirm: 'このフォルダを選択',
  cloud: 'クラウド',
  engineUnavailable: 'SyncDeck エンジンを利用できません',
  engineUnavailableDetail: '同梱の同期エンジンを起動できませんでした。SyncDeck を再インストールするか、エンジンを含めて再ビルドしてください。',
  retry: '再試行',
  wizAuthorize: 'ブラウザで認可',
  wizAuthorizing: '認可中…',
  wizAuthorized: '認可済み',
  wizReauthorize: '再認可',
  wizOauthNote: 'ブラウザで認可してください。SyncDeck はアクセストークンをローカルのエンジン設定に安全に保存します。',
  wizTest: '接続をテスト',
  wizTesting: 'テスト中…',
  wizTestOk: '接続 OK',
  wizTestFail: '接続に失敗',
  wizOptional: '任意',
  wizNeedAuth: '続行する前にブラウザで認可してください。',
  testClient: 'テスト',
  deleteClientLabel: '削除',
  deleteClientConfirm: (name) => `クライアント「${name}」を削除しますか？この操作は元に戻せません。`,
}

const ru: Copy = {
  connBusy: 'Подключено · идет передача',
  connIdle: 'Подключено · ожидание',
  settings: 'Настройки',
  profiles: 'Профили',
  newProfile: '+ Новый профиль',
  engineReady: 'Движок готов',
  engineMissing: 'Движок не найден',
  clientCount: (n) => `${n} клиентов`,
  activeKicker: 'Профиль синхронизации · активен',
  newProfileTitle: 'Новый профиль',
  run: '▶ Запустить сейчас',
  stop: '■ Остановить',
  save: 'Сохранить',
  sourceLabel: 'Источник',
  routeLocal: 'локально',
  routeCloud: 'облако',
  browse: 'Обзор',
  destLabel: 'Назначение',
  browseCloud: 'Обзор облака',
  swapRoute: 'Поменять источник и назначение',
  noFolder: 'Папка не выбрана',
  targetClient: 'Целевой клиент',
  addClient: 'Добавить клиент',
  syncMode: 'Режим синхронизации',
  mirror: 'Зеркальная sync',
  copyOnly: 'Только копировать',
  mirrorDesc: 'Приводит назначение к точному состоянию источника. Файлы, отсутствующие в источнике, удаляются в назначении.',
  copyDesc: 'Только добавляет файлы и ничего не удаляет. Безопасно, без необратимой потери данных.',
  moveTitle: 'Переместить',
  moveDesc: 'Перемещает файлы в назначение; успешно переданные файлы удаляются из источника.',
  bisyncTitle: 'Двусторонний',
  bisyncDesc: 'Синхронизирует обе папки в обе стороны; первый запуск создает безопасную базу.',
  checkTitle: 'Проверить',
  checkDesc: 'Сравнивает источник и назначение без записи и сообщает различия.',
  tagMirror: 'Зеркало',
  tagCopy: 'Копия',
  tagMove: 'Move',
  tagBisync: '2-стор.',
  tagCheck: 'Check',
  quotaFree: 'свободно',
  schedule: 'Расписание и параметры',
  schedTitle: 'Частота запуска',
  schedHint: 'Включенные профили запускаются автоматически в фоне с этой частотой, даже когда приложение закрыто.',
  schedManual: 'Вручную',
  sched15: '15 мин',
  sched30: '30 мин',
  schedHourly: 'Каждый час',
  sched6h: '6 часов',
  schedDaily: 'Ежедневно',
  optChecksumLabel: 'Проверять после передачи',
  optChecksumHint: 'Сравнивать контрольные суммы',
  optDryrunLabel: 'Сначала пробный запуск',
  optDryrunHint: 'Показать изменения без записи',
  optBwlimitLabel: 'Ограничение скорости',
  optBwlimitHint: 'Ограничить до 8 MiB/s во время работы',
  optStartupLabel: 'Запускать этот профиль при старте',
  optStartupHint: 'Тихо синхронизировать при входе',
  liveLog: 'Живой журнал',
  noRun: 'Запусков еще не было. Используйте «Запустить сейчас», чтобы проверить профиль.',
  deleteProfile: 'Удалить профиль',
  statusTitle: 'Статус',
  syncing: 'Синхронизация',
  idle: 'Ожидание',
  speed: 'Скорость',
  files: 'Файлы',
  eta: 'ETA',
  langTitle: 'Язык',
  accentTitle: 'Цвет акцента',
  themeTitle: 'Тема',
  themeDark: 'Темная',
  themeLight: 'Светлая',
  profileName: 'Имя профиля',
  systemTitle: 'Система',
  launchAtLogin: 'Фоновый планировщик (daemon)',
  launchAtLoginHint: 'Запускать при входе и выполнять профили по расписанию даже при закрытом приложении',
  definedClients: 'Настроенные клиенты',
  newClient: '+ Новый клиент',
  noClients: 'Клиентов пока нет. Добавьте один, чтобы начать.',
  connected: 'подключено',
  tabInterface: 'Интерфейс',
  tabClients: 'Клиенты',
  tabAbout: 'О программе',
  aboutTitle: 'Об открытом коде',
  aboutBody:
    'SyncDeck — графическая оболочка для независимого open-source проекта rclone. Все передачи выполняются в фоне через командный движок rclone; SyncDeck лишь предоставляет удобный интерфейс. rclone поставляется вместе с приложением, отдельная установка не требуется.',
  version: (v) => `Версия ${v} · sidrelabs.com/syncdeck`,
  wizStepOf: (n) => `Новый клиент · шаг ${n}/3`,
  wizStep1: 'Тип подключения',
  wizStep2: 'Учетные данные и имя',
  wizStep3: 'Проверить и создать',
  wizTypePrompt: 'Выберите тип облака для подключения. SyncDeck создаст нужную конфигурацию в фоне.',
  providerSearch: 'Поиск клиентов',
  wizClientName: 'Имя клиента',
  wizClientNamePh: 'например Work Drive',
  wizCredNote: 'Учетные данные сохраняются только в локальной конфигурации движка и никуда не отправляются.',
  wizReviewPrompt: 'Все готово. SyncDeck создаст клиент, выполнив эту команду в фоне:',
  wizName: 'Имя',
  wizType: 'Тип',
  wizRemote: 'Remote',
  engineCmd: 'Команда движка',
  runsInBg: 'работает в фоне',
  back: '‹ Назад',
  next: 'Продолжить →',
  create: 'Создать клиент',
  pickerSub: 'Выберите облачное расположение',
  pickerEmpty: 'Эта папка пуста.',
  pickerError: 'Не удалось вывести это расположение.',
  pickerLoading: 'Загрузка…',
  pickerNewFolder: 'Новая папка',
  pickerFolderName: 'Имя папки',
  pickerCreate: 'Создать',
  pickerCreating: 'Создание…',
  pickerNameInvalid: 'Имя папки не может содержать / или \\.',
  pickerCancel: 'Отмена',
  pickerConfirm: 'Выбрать эту папку',
  cloud: 'Облако',
  engineUnavailable: 'Движок SyncDeck недоступен',
  engineUnavailableDetail: 'Не удалось запустить встроенный движок синхронизации. Переустановите SyncDeck или соберите его с включенным движком.',
  retry: 'Повторить',
  wizAuthorize: 'Авторизовать в браузере',
  wizAuthorizing: 'Авторизация…',
  wizAuthorized: 'Авторизовано',
  wizReauthorize: 'Авторизовать снова',
  wizOauthNote: 'Авторизуйтесь в браузере; SyncDeck безопасно сохранит токен доступа в локальной конфигурации движка.',
  wizTest: 'Проверить подключение',
  wizTesting: 'Проверка…',
  wizTestOk: 'Подключение OK',
  wizTestFail: 'Сбой подключения',
  wizOptional: 'необязательно',
  wizNeedAuth: 'Перед продолжением авторизуйтесь в браузере.',
  testClient: 'Проверить',
  deleteClientLabel: 'Удалить',
  deleteClientConfirm: (name) => `Удалить клиент «${name}»? Это действие нельзя отменить.`,
}

const nl: Copy = {
  connBusy: 'Verbonden · bezig met overzetten',
  connIdle: 'Verbonden · inactief',
  settings: 'Instellingen',
  profiles: 'Profielen',
  newProfile: '+ Nieuw profiel',
  engineReady: 'Engine gereed',
  engineMissing: 'Engine niet gevonden',
  clientCount: (n) => `${n} clients`,
  activeKicker: 'Sync-profiel · actief',
  newProfileTitle: 'Nieuw profiel',
  run: '▶ Nu uitvoeren',
  stop: '■ Stoppen',
  save: 'Opslaan',
  sourceLabel: 'Bron',
  routeLocal: 'lokaal',
  routeCloud: 'cloud',
  browse: 'Bladeren',
  destLabel: 'Doel',
  browseCloud: 'Cloud bladeren',
  swapRoute: 'Bron en doel wisselen',
  noFolder: 'Geen map geselecteerd',
  targetClient: 'Doelclient',
  addClient: 'Client toevoegen',
  syncMode: 'Sync-modus',
  mirror: 'Mirror-sync',
  copyOnly: 'Alleen kopiëren',
  mirrorDesc: 'Spiegelt het doel exact naar de bron. Bestanden die niet in de bron staan, worden op het doel verwijderd.',
  copyDesc: 'Voegt alleen bestanden toe en verwijdert niets. Veilig, zonder onomkeerbaar gegevensverlies.',
  moveTitle: 'Verplaatsen',
  moveDesc: 'Verplaatst bestanden naar het doel; succesvol overgezette bestanden worden uit de bron verwijderd.',
  bisyncTitle: 'Tweerichtings',
  bisyncDesc: 'Houdt beide locaties in twee richtingen gelijk; de eerste run maakt een veilige basis.',
  checkTitle: 'Controleren',
  checkDesc: 'Vergelijkt bron en doel zonder iets te schrijven en rapporteert verschillen.',
  tagMirror: 'Mirror',
  tagCopy: 'Kopie',
  tagMove: 'Move',
  tagBisync: 'Bi-dir',
  tagCheck: 'Check',
  quotaFree: 'vrij',
  schedule: 'Planning en opties',
  schedTitle: 'Uitvoerfrequentie',
  schedHint: 'Ingeschakelde profielen draaien automatisch op deze frequentie in de achtergrond, ook wanneer de app gesloten is.',
  schedManual: 'Handmatig',
  sched15: '15 min',
  sched30: '30 min',
  schedHourly: 'Elk uur',
  sched6h: '6 uur',
  schedDaily: 'Dagelijks',
  optChecksumLabel: 'Na overdracht verifiëren',
  optChecksumHint: 'Checksums vergelijken',
  optDryrunLabel: 'Eerst proefrun',
  optDryrunHint: 'Wijzigingen tonen zonder iets te schrijven',
  optBwlimitLabel: 'Bandbreedtelimiet',
  optBwlimitHint: 'Tijdens uitvoeren beperken tot 8 MiB/s',
  optStartupLabel: 'Dit profiel bij opstarten uitvoeren',
  optStartupHint: 'Stil synchroniseren bij inloggen',
  liveLog: 'Live logboek',
  noRun: 'Nog geen run. Gebruik "Nu uitvoeren" om het profiel te testen.',
  deleteProfile: 'Profiel verwijderen',
  statusTitle: 'Status',
  syncing: 'Synchroniseren',
  idle: 'Inactief',
  speed: 'Snelheid',
  files: 'Bestanden',
  eta: 'ETA',
  langTitle: 'Taal',
  accentTitle: 'Accentkleur',
  themeTitle: 'Thema',
  themeDark: 'Donker',
  themeLight: 'Licht',
  profileName: 'Profielnaam',
  systemTitle: 'Systeem',
  launchAtLogin: 'Achtergrondplanner (daemon)',
  launchAtLoginHint: 'Start bij inloggen en voer profielen volgens schema uit, ook als de app gesloten is',
  definedClients: 'Geconfigureerde clients',
  newClient: '+ Nieuwe client',
  noClients: 'Nog geen clients. Voeg er een toe om te beginnen.',
  connected: 'verbonden',
  tabInterface: 'Interface',
  tabClients: 'Clients',
  tabAbout: 'Over',
  aboutTitle: 'Over open source',
  aboutBody:
    'SyncDeck is een grafische wrapper voor het onafhankelijke open-sourceproject rclone. Elke overdracht draait in de achtergrond via de rclone-commandline-engine; SyncDeck presenteert die alleen met een vriendelijke interface. rclone wordt met de app meegeleverd, dus apart installeren is niet nodig.',
  version: (v) => `Versie ${v} · sidrelabs.com/syncdeck`,
  wizStepOf: (n) => `Nieuwe client · stap ${n}/3`,
  wizStep1: 'Verbindingstype',
  wizStep2: 'Identiteit en naam',
  wizStep3: 'Controleren en maken',
  wizTypePrompt: 'Kies het cloudtype dat je wilt verbinden. SyncDeck maakt op de achtergrond de juiste configuratie.',
  providerSearch: 'Clients zoeken',
  wizClientName: 'Clientnaam',
  wizClientNamePh: 'bijv. Work Drive',
  wizCredNote: 'Inloggegevens worden alleen opgeslagen in je lokale engineconfiguratie en nergens heen gestuurd.',
  wizReviewPrompt: 'Alles klaar. SyncDeck maakt de client door deze opdracht in de achtergrond uit te voeren:',
  wizName: 'Naam',
  wizType: 'Type',
  wizRemote: 'Remote',
  engineCmd: 'Engine-opdracht',
  runsInBg: 'draait in achtergrond',
  back: '‹ Terug',
  next: 'Doorgaan →',
  create: 'Client maken',
  pickerSub: 'Cloudlocatie kiezen',
  pickerEmpty: 'Deze map is leeg.',
  pickerError: 'Deze locatie kon niet worden weergegeven.',
  pickerLoading: 'Laden…',
  pickerNewFolder: 'Nieuwe map',
  pickerFolderName: 'Mapnaam',
  pickerCreate: 'Maken',
  pickerCreating: 'Maken…',
  pickerNameInvalid: 'Mapnaam mag geen / of \\ bevatten.',
  pickerCancel: 'Annuleren',
  pickerConfirm: 'Deze map kiezen',
  cloud: 'Cloud',
  engineUnavailable: 'SyncDeck-engine niet beschikbaar',
  engineUnavailableDetail: 'De meegeleverde sync-engine kon niet starten. Installeer SyncDeck opnieuw of bouw opnieuw met de engine inbegrepen.',
  retry: 'Opnieuw proberen',
  wizAuthorize: 'Autoriseren in browser',
  wizAuthorizing: 'Autoriseren…',
  wizAuthorized: 'Geautoriseerd',
  wizReauthorize: 'Opnieuw autoriseren',
  wizOauthNote: 'Autoriseer in je browser; SyncDeck slaat het toegangstoken veilig op in je lokale engineconfiguratie.',
  wizTest: 'Verbinding testen',
  wizTesting: 'Testen…',
  wizTestOk: 'Verbinding OK',
  wizTestFail: 'Verbinding mislukt',
  wizOptional: 'optioneel',
  wizNeedAuth: 'Autoriseer in je browser voordat je doorgaat.',
  testClient: 'Testen',
  deleteClientLabel: 'Verwijderen',
  deleteClientConfirm: (name) => `Client "${name}" verwijderen? Dit kan niet ongedaan worden gemaakt.`,
}

const ar: Copy = {
  connBusy: 'متصل · جار النقل',
  connIdle: 'متصل · خامل',
  settings: 'الإعدادات',
  profiles: 'الملفات',
  newProfile: '+ ملف جديد',
  engineReady: 'المحرك جاهز',
  engineMissing: 'المحرك غير موجود',
  clientCount: (n) => `${n} عملاء`,
  activeKicker: 'ملف المزامنة · نشط',
  newProfileTitle: 'ملف جديد',
  run: '▶ شغل الآن',
  stop: '■ إيقاف',
  save: 'حفظ',
  sourceLabel: 'المصدر',
  routeLocal: 'محلي',
  routeCloud: 'سحابة',
  browse: 'تصفح',
  destLabel: 'الوجهة',
  browseCloud: 'تصفح السحابة',
  swapRoute: 'تبديل المصدر والوجهة',
  noFolder: 'لم يتم اختيار مجلد',
  targetClient: 'عميل الوجهة',
  addClient: 'إضافة عميل',
  syncMode: 'وضع المزامنة',
  mirror: 'مزامنة مرآة',
  copyOnly: 'نسخ فقط',
  mirrorDesc: 'يجعل الوجهة مطابقة للمصدر. الملفات غير الموجودة في المصدر تحذف من الوجهة.',
  copyDesc: 'يضيف الملفات فقط ولا يحذف شيئا. آمن، بلا فقدان بيانات غير قابل للتراجع.',
  moveTitle: 'نقل',
  moveDesc: 'ينقل الملفات إلى الوجهة؛ الملفات المنقولة بنجاح تزال من المصدر.',
  bisyncTitle: 'ثنائي الاتجاه',
  bisyncDesc: 'يبقي الموقعين متزامنين في الاتجاهين؛ ينشئ التشغيل الأول أساسا آمنا.',
  checkTitle: 'تحقق',
  checkDesc: 'يقارن المصدر والوجهة دون كتابة أي شيء ويبلغ عن الاختلافات.',
  tagMirror: 'مرآة',
  tagCopy: 'نسخ',
  tagMove: 'نقل',
  tagBisync: 'ثنائي',
  tagCheck: 'تحقق',
  quotaFree: 'متاح',
  schedule: 'الجدولة والخيارات',
  schedTitle: 'تكرار التشغيل',
  schedHint: 'تعمل الملفات المفعلة تلقائيا في الخلفية بهذا التكرار، حتى عند إغلاق التطبيق.',
  schedManual: 'يدوي',
  sched15: '15 د',
  sched30: '30 د',
  schedHourly: 'كل ساعة',
  sched6h: '6 ساعات',
  schedDaily: 'يومي',
  optChecksumLabel: 'تحقق بعد النقل',
  optChecksumHint: 'مقارنة checksums',
  optDryrunLabel: 'تجربة أولا',
  optDryrunHint: 'عرض التغييرات دون كتابة أي شيء',
  optBwlimitLabel: 'حد عرض النطاق',
  optBwlimitHint: 'التحديد إلى 8 MiB/s أثناء التشغيل',
  optStartupLabel: 'تشغيل هذا الملف عند البدء',
  optStartupHint: 'مزامنة صامتة عند تسجيل الدخول',
  liveLog: 'السجل المباشر',
  noRun: 'لا يوجد تشغيل بعد. استخدم "شغل الآن" لتجربة الملف.',
  deleteProfile: 'حذف الملف',
  statusTitle: 'الحالة',
  syncing: 'جار المزامنة',
  idle: 'خامل',
  speed: 'السرعة',
  files: 'الملفات',
  eta: 'ETA',
  langTitle: 'اللغة',
  accentTitle: 'لون التمييز',
  themeTitle: 'السمة',
  themeDark: 'داكن',
  themeLight: 'فاتح',
  profileName: 'اسم الملف',
  systemTitle: 'النظام',
  launchAtLogin: 'مجدول الخلفية (daemon)',
  launchAtLoginHint: 'يبدأ عند تسجيل الدخول ويشغل الملفات حسب جدولها حتى عندما يكون التطبيق مغلقا',
  definedClients: 'العملاء المكونون',
  newClient: '+ عميل جديد',
  noClients: 'لا يوجد عملاء بعد. أضف واحدا للبدء.',
  connected: 'متصل',
  tabInterface: 'الواجهة',
  tabClients: 'العملاء',
  tabAbout: 'حول',
  aboutTitle: 'حول المصدر المفتوح',
  aboutBody:
    'SyncDeck هو غلاف رسومي لمشروع rclone المستقل مفتوح المصدر. كل عمليات النقل تعمل في الخلفية عبر محرك rclone لسطر الأوامر؛ يقدم SyncDeck ذلك فقط بواجهة سهلة. يأتي rclone مضمنا مع التطبيق، ولا تحتاج إلى تثبيت منفصل.',
  version: (v) => `الإصدار ${v} · sidrelabs.com/syncdeck`,
  wizStepOf: (n) => `عميل جديد · خطوة ${n}/3`,
  wizStep1: 'نوع الاتصال',
  wizStep2: 'الهوية والاسم',
  wizStep3: 'مراجعة وإنشاء',
  wizTypePrompt: 'اختر نوع السحابة التي تريد ربطها. ينشئ SyncDeck الإعداد المناسب في الخلفية.',
  providerSearch: 'بحث في العملاء',
  wizClientName: 'اسم العميل',
  wizClientNamePh: 'مثال Work Drive',
  wizCredNote: 'تحفظ بيانات الاعتماد فقط في إعدادات المحرك المحلية ولا ترسل إلى أي مكان.',
  wizReviewPrompt: 'كل شيء جاهز. سينشئ SyncDeck العميل بتشغيل هذا الأمر في الخلفية:',
  wizName: 'الاسم',
  wizType: 'النوع',
  wizRemote: 'Remote',
  engineCmd: 'أمر المحرك',
  runsInBg: 'يعمل في الخلفية',
  back: '‹ رجوع',
  next: 'متابعة →',
  create: 'إنشاء العميل',
  pickerSub: 'اختر موقعا سحابيا',
  pickerEmpty: 'هذا المجلد فارغ.',
  pickerError: 'تعذر عرض هذا الموقع.',
  pickerLoading: 'جار التحميل…',
  pickerNewFolder: 'مجلد جديد',
  pickerFolderName: 'اسم المجلد',
  pickerCreate: 'إنشاء',
  pickerCreating: 'جار الإنشاء…',
  pickerNameInvalid: 'لا يمكن أن يحتوي اسم المجلد على / أو \\.',
  pickerCancel: 'إلغاء',
  pickerConfirm: 'اختيار هذا المجلد',
  cloud: 'السحابة',
  engineUnavailable: 'محرك SyncDeck غير متاح',
  engineUnavailableDetail: 'تعذر بدء محرك المزامنة المضمن. أعد تثبيت SyncDeck أو أعد بناءه مع تضمين المحرك.',
  retry: 'إعادة المحاولة',
  wizAuthorize: 'تفويض في المتصفح',
  wizAuthorizing: 'جار التفويض…',
  wizAuthorized: 'تم التفويض',
  wizReauthorize: 'إعادة التفويض',
  wizOauthNote: 'قم بالتفويض في المتصفح؛ يحفظ SyncDeck رمز الوصول بأمان في إعدادات المحرك المحلية.',
  wizTest: 'اختبار الاتصال',
  wizTesting: 'جار الاختبار…',
  wizTestOk: 'الاتصال سليم',
  wizTestFail: 'فشل الاتصال',
  wizOptional: 'اختياري',
  wizNeedAuth: 'قم بالتفويض في المتصفح قبل المتابعة.',
  testClient: 'اختبار',
  deleteClientLabel: 'حذف',
  deleteClientConfirm: (name) => `حذف العميل "${name}"؟ لا يمكن التراجع عن ذلك.`,
}

const TRANSLATIONS: Record<Language, Copy> = {
  en,
  tr,
  de,
  es,
  zh,
  ja,
  ru,
  nl,
  ar,
}


/* ============================================================ wizard providers */
const PROVIDER_TYPES = [
  { id: 'drive', name: 'Google Drive' },
  { id: 'dropbox', name: 'Dropbox' },
  { id: 's3', name: 'Amazon S3' },
  { id: 'b2', name: 'Backblaze B2' },
  { id: 'sftp', name: 'SFTP / SSH' },
  { id: 'webdav', name: 'WebDAV' },
  { id: 'crypt', name: 'Şifreli (crypt)' },
] as const
type ProviderId = string

const FALLBACK_BACKEND_TYPES: BackendType[] = PROVIDER_TYPES.map((provider) => ({
  id: provider.id,
  name: provider.id,
  description: provider.name,
  options: [],
}))

type ProviderField = { key: string; label: string; ph?: string; secret?: boolean; optional?: boolean }
type ProviderConfig = { oauth: boolean; fields: ProviderField[] }

// rclone config keys per backend. The wizard renders these and passes them to
// `rclone config create`; OAuth backends authorize in the browser instead.
const PROVIDER_FIELDS: Record<ProviderId, ProviderConfig> = {
  drive: {
    oauth: true,
    fields: [
      { key: 'client_id', label: 'OAuth Client ID', ph: 'boş → rclone’un kendi istemcisi', optional: true },
      { key: 'client_secret', label: 'OAuth Client Secret', secret: true, optional: true },
    ],
  },
  dropbox: {
    oauth: true,
    fields: [
      { key: 'client_id', label: 'App key', optional: true },
      { key: 'client_secret', label: 'App secret', secret: true, optional: true },
    ],
  },
  s3: {
    oauth: false,
    fields: [
      { key: 'provider', label: 'Sağlayıcı', ph: 'AWS, Wasabi, MinIO…' },
      { key: 'access_key_id', label: 'Access Key ID', ph: 'AKIA…' },
      { key: 'secret_access_key', label: 'Secret Access Key', secret: true },
      { key: 'region', label: 'Bölge', ph: 'us-east-1', optional: true },
      { key: 'endpoint', label: 'Endpoint', ph: 'S3-uyumlu servisler için', optional: true },
    ],
  },
  b2: {
    oauth: false,
    fields: [
      { key: 'account', label: 'Account ID / Key ID', ph: '0012ab…' },
      { key: 'key', label: 'Application Key', secret: true },
    ],
  },
  sftp: {
    oauth: false,
    fields: [
      { key: 'host', label: 'Sunucu', ph: 'ornek.com' },
      { key: 'user', label: 'Kullanıcı', ph: 'kullanici' },
      { key: 'port', label: 'Port', ph: '22', optional: true },
      { key: 'pass', label: 'Parola', secret: true, optional: true },
      { key: 'key_file', label: 'SSH anahtar dosyası', ph: '~/.ssh/id_ed25519', optional: true },
    ],
  },
  webdav: {
    oauth: false,
    fields: [
      { key: 'url', label: 'URL', ph: 'https://dav.ornek.com/remote.php/dav/files/me/' },
      { key: 'vendor', label: 'Sağlayıcı', ph: 'nextcloud, owncloud, other', optional: true },
      { key: 'user', label: 'Kullanıcı', optional: true },
      { key: 'pass', label: 'Parola', secret: true, optional: true },
    ],
  },
  crypt: {
    oauth: false,
    fields: [
      { key: 'remote', label: 'Şifrelenecek konum', ph: 'arsiv:gizli (mevcut remote:yol)' },
      { key: 'password', label: 'Parola', secret: true },
      { key: 'password2', label: 'Tuz (salt)', secret: true, optional: true },
    ],
  },
}

const KNOWN_OAUTH_TYPES = new Set([
  'box',
  'drive',
  'dropbox',
  'gphotos',
  'hidrive',
  'jottacloud',
  'mailru',
  'onedrive',
  'pcloud',
  'pikpak',
  'premiumizeme',
  'protondrive',
  'putio',
  'sharefile',
  'yandex',
  'zoho',
])

function optionLabel(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function optionPlaceholder(help: string, examples?: Array<{ value: string; help: string }>): string | undefined {
  const example = examples?.find((item) => item.value)?.value
  if (example) return example
  const first = help.split(/\n+/).map((line) => line.trim()).find(Boolean)
  return first && first.length <= 90 ? first : undefined
}

function providerName(type: BackendType): string {
  return type.description || type.name || type.id
}

function providerConfigFor(type: string | null, backendTypes: BackendType[]): ProviderConfig | null {
  if (!type) return null
  const override = PROVIDER_FIELDS[type]
  const backend = backendTypes.find((item) => item.id === type)
  if (!backend) return override ?? null
  const oauth = KNOWN_OAUTH_TYPES.has(type)
  const dynamicFields = backend.options
    .filter((option) => !option.advanced)
    .filter((option) => !['token', 'config_is_local'].includes(option.name))
    .filter((option) => option.required || !oauth || ['client_id', 'client_secret'].includes(option.name))
    .slice(0, 12)
    .map((option) => ({
      key: option.name,
      label: optionLabel(option.name),
      ph: optionPlaceholder(option.help, option.examples),
      secret: option.secret,
      optional: !option.required,
    }))

  return {
    oauth,
    fields: dynamicFields.length || !override ? dynamicFields : override.fields,
  }
}

/* ============================================================ inline icons (match the design) */
type GlyphProps = { size?: number; sw?: number; children: ReactNode }
const Glyph = ({ size = 18, sw = 1.7, children }: GlyphProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
const FolderIcon = (p: { size?: number }) => <Glyph size={p.size}><path d="M3 7a2 2 0 0 1 2-2h4l2 2.2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Glyph>
const FileIcon = (p: { size?: number }) => <Glyph size={p.size}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></Glyph>
const CloudIcon = (p: { size?: number }) => <Glyph size={p.size}><path d="M18 17.6A4 4 0 0 0 16 10h-1.3A6 6 0 1 0 4 15.5" /></Glyph>
const GearIcon = () => (
  <Glyph size={17}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Glyph>
)
const ShieldIcon = () => <Glyph size={18} sw={1.8}><path d="M12 2 4 5v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5z" /><path d="M9 12l2 2 4-4" /></Glyph>
const InterfaceIcon = () => <Glyph size={16}><circle cx="12" cy="12" r="9" /><path d="M3.5 9h17M3.5 15h17" /><path d="M12 3a13 13 0 0 1 0 18 13 13 0 0 1 0-18z" /></Glyph>
const ServerIcon = (p: { size?: number }) => <Glyph size={p.size ?? 16}><path d="M3 7a2 2 0 0 1 2-2h4l2 2.2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Glyph>
const InfoIcon = () => <Glyph size={16}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Glyph>
const TrashIcon = () => <Glyph size={15}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></Glyph>
const SwapIcon = () => <Glyph size={18}><path d="M7 4 3 8l4 4" /><path d="M3 8h13" /><path d="M17 20l4-4-4-4" /><path d="M21 16H8" /></Glyph>

const ProviderGlyph = ({ id, size = 18 }: { id: string; size?: number }) => {
  const iconUrl = PROVIDER_ICON_URLS[`./assets/provider-icons/${id}.svg`]
  if (iconUrl) {
    return (
      <span
        className="sd-provider-icon"
        style={{
          '--provider-icon-url': `url("${iconUrl}")`,
          width: size,
          height: size,
        } as CSSProperties}
        aria-hidden="true"
      />
    )
  }

  switch (id) {
    case 'drive':
      return <Glyph size={size} sw={1.6}><path d="M8 3 2.5 13l3 5 5.5-10z" /><path d="M16 3H8l8 14h-5" /><path d="M21.5 13 16 3l-2.7 5 5.4 10z" opacity=".55" /></Glyph>
    case 'dropbox':
      return <Glyph size={size} sw={1.6}><path d="M7 4 2 7.5 7 11l5-3.5z" /><path d="M17 4 12 7.5 17 11l5-3.5z" /><path d="M2 14.5 7 11l5 3.5L7 18z" /><path d="M22 14.5 17 11l-5 3.5L17 18z" /></Glyph>
    case 's3':
      return <Glyph size={size} sw={1.6}><path d="M5 6.5 12 4l7 2.5v11L12 20l-7-2.5z" /><path d="M5 6.5 12 9l7-2.5M12 9v11" /></Glyph>
    case 'b2':
      return <Glyph size={size} sw={1.6}><path d="M12 3c2 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.4.5-2.4 1.2-3.4" /><circle cx="12" cy="14" r="2" /></Glyph>
    case 'sftp':
      return <Glyph size={size} sw={1.6}><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="m7 9 3 3-3 3M13 15h4" /></Glyph>
    case 'webdav':
      return <Glyph size={size} sw={1.6}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></Glyph>
    case 'crypt':
      return <Glyph size={size} sw={1.6}><rect x="4.5" y="11" width="15" height="9" rx="1.5" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /><circle cx="12" cy="15.5" r="1.2" /></Glyph>
    default:
      return <ServerIcon size={size} />
  }
}

const Logo = ({ w = 26, h = 24 }: { w?: number; h?: number }) => (
  <svg width={w} height={h} viewBox="0 0 30 28" fill="none" aria-hidden="true">
    <path d="M6 8 L15 13.5 L24 8" stroke="var(--accent)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 14 L15 19.5 L24 14" stroke="var(--accent)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
    <path d="M6 20 L15 25.5 L24 20" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
  </svg>
)

/* ============================================================ helpers */
const newProfile = (): SyncProfile => ({
  id: String(Date.now()),
  name: 'Yeni profil',
  source: '',
  destination: '',
  mode: 'sync',
  enabled: true,
  extraArgs: '',
  intervalMinutes: 0,
})

const TRANSFER_BAR_LIMIT = 34

const SCHEDULE_PRESETS = [
  { minutes: 0, key: 'schedManual' },
  { minutes: 15, key: 'sched15' },
  { minutes: 30, key: 'sched30' },
  { minutes: 60, key: 'schedHourly' },
  { minutes: 360, key: 'sched6h' },
  { minutes: 1440, key: 'schedDaily' },
] as const

/* ============================================================ component */
function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [draft, setDraft] = useState<SyncProfile>(newProfile)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [transferBars, setTransferBars] = useState<TransferEvent[]>([])

  const [accentName, setAccentName] = useState<AccentName>(() => (localStorage.getItem('sd_accent') as AccentName) || 'Mint')
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('sd_lang') as Language) || 'tr')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('sd_theme') as 'dark' | 'light') || 'dark')

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'interface' | 'clients' | 'about'>('interface')
  const [clientTests, setClientTests] = useState<Record<string, { state: 'idle' | 'busy' | 'ok' | 'fail'; msg?: string }>>({})
  const [clientAbout, setClientAbout] = useState<Record<string, AboutInfo>>({})

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizStep, setWizStep] = useState(1)
  const [wizType, setWizType] = useState<ProviderId | null>(null)
  const [wizName, setWizName] = useState('')
  const [wizFilter, setWizFilter] = useState('')
  const [wizFields, setWizFields] = useState<Record<string, string>>({})
  const [wizToken, setWizToken] = useState('')
  const [wizAuthBusy, setWizAuthBusy] = useState(false)
  const [wizTest, setWizTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'fail'; msg?: string }>({ state: 'idle' })

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerRemote, setPickerRemote] = useState('')
  const [pickerStack, setPickerStack] = useState<string[]>([])
  const [pickerItems, setPickerItems] = useState<RemoteEntry[]>([])
  const [pickerBusy, setPickerBusy] = useState(false)
  const [pickerMkdirBusy, setPickerMkdirBusy] = useState(false)
  const [pickerNewName, setPickerNewName] = useState('')
  const [pickerError, setPickerError] = useState<string | null>(null)
  const [pickerField, setPickerField] = useState<'source' | 'destination'>('destination')

  const t = TRANSLATIONS[language]
  const accent = ACCENTS.find((a) => a.name === accentName)?.color || '#5fd6b6'
  const profiles = state?.profiles ?? []
  const remotes = state?.remotes ?? []
  const backendTypes = useMemo<BackendType[]>(() => {
    const source = state?.backendTypes?.length ? state.backendTypes : FALLBACK_BACKEND_TYPES
    return Array.from(new Map(source.map((type) => [type.id, type])).values())
  }, [state])
  const filteredBackendTypes = useMemo(() => {
    const q = wizFilter.trim().toLowerCase()
    if (!q) return backendTypes
    return backendTypes.filter((type) => `${type.id} ${providerName(type)}`.toLowerCase().includes(q))
  }, [backendTypes, wizFilter])
  const clients = useMemo<RemoteClient[]>(() => {
    const r = state?.remotes ?? []
    const source = state?.clients?.length ? state.clients : r.map((name) => ({ name, type: '' }))
    return Array.from(new Map(source.map((client) => [client.name, client])).values())
  }, [state])
  const selectedRun = selectedId && state ? state.lastRun[selectedId] : null
  const canSave = Boolean(draft.name.trim() && draft.source.trim() && draft.destination.trim())
  const running = busy === 'run' || Boolean(progress?.running)
  // Each route box follows its actual content: a remote ("name:…") is the cloud
  // side, a filesystem path is local. After a swap, labels/buttons/client-picker
  // track the swapped values instead of assuming source=local, dest=cloud.
  const srcCloud = isCloudSide(draft.source, true)
  const dstCloud = isCloudSide(draft.destination, false)
  const cloudField: 'source' | 'destination' = dstCloud ? 'destination' : srcCloud ? 'source' : 'destination'
  const activeRemote = remoteOf(draft[cloudField], remotes)

  const modeCards = [
    { id: 'sync' as SyncMode, title: t.mirror, cmd: 'sync', desc: t.mirrorDesc, tag: t.tagMirror },
    { id: 'copy' as SyncMode, title: t.copyOnly, cmd: 'copy', desc: t.copyDesc, tag: t.tagCopy },
    { id: 'move' as SyncMode, title: t.moveTitle, cmd: 'move', desc: t.moveDesc, tag: t.tagMove },
    { id: 'bisync' as SyncMode, title: t.bisyncTitle, cmd: 'bisync', desc: t.bisyncDesc, tag: t.tagBisync },
    { id: 'check' as SyncMode, title: t.checkTitle, cmd: 'check', desc: t.checkDesc, tag: t.tagCheck },
  ]
  const modeTag = (mode: SyncMode) => modeCards.find((m) => m.id === mode)?.tag ?? mode

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])
  useEffect(() => {
    localStorage.setItem('sd_accent', accentName)
  }, [accentName])
  useEffect(() => {
    localStorage.setItem('sd_lang', language)
  }, [language])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sd_theme', theme)
  }, [theme])

  // fetch quota (rclone about) for each client when the Clients tab opens
  useEffect(() => {
    if (!settingsOpen || settingsTab !== 'clients') return
    let cancelled = false
    clients.forEach((c) => {
      api
        .aboutRemote(c.name)
        .then((info) => !cancelled && setClientAbout((m) => ({ ...m, [c.name]: info })))
        .catch(() => undefined)
    })
    return () => {
      cancelled = true
    }
  }, [settingsOpen, settingsTab, clients])

  // live progress subscription
  useEffect(() => {
    const unsub = api.onSyncProgress((data) => {
      setProgress(data)
      if (data.running && data.transferEvents?.length) {
        setTransferBars((current) => {
          const next = [...current]
          for (const event of data.transferEvents || []) {
            const existing = next.findIndex((item) => item.id === event.id)
            if (existing >= 0) next[existing] = { ...next[existing], ...event }
            else next.push(event)
          }
          return next.slice(-TRANSFER_BAR_LIMIT)
        })
      }
      if (!data.running) window.setTimeout(() => setProgress((cur) => (cur && !cur.running ? null : cur)), 4000)
    })
    return unsub
  }, [])

  // The background scheduler refreshes app state (lastRun/log) after a run.
  useEffect(() => {
    const unsub = api.onStateRefresh(() => {
      api.getState().then(setState).catch(() => undefined)
    })
    return unsub
  }, [])

  async function load(preferredId: string | null = selectedId) {
    setError(null)
    try {
      const next = await api.getState()
      setState(next)
      const profile = next.profiles.find((p) => p.id === preferredId) || next.profiles[0]
      if (profile) {
        setSelectedId(profile.id)
        setDraft(profile)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    let mounted = true
    api
      .getState()
      .then((next) => {
        if (!mounted) return
        setState(next)
        const first = next.profiles[0]
        if (first) {
          setSelectedId(first.id)
          setDraft(first)
        }
      })
      .catch((err) => mounted && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      mounted = false
    }
  }, [])

  // ESC closes any open overlay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (pickerOpen) setPickerOpen(false)
      else if (wizardOpen) setWizardOpen(false)
      else if (settingsOpen) setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pickerOpen, wizardOpen, settingsOpen])

  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const selectProfile = (p: SyncProfile) => {
    setSelectedId(p.id)
    setDraft(p)
  }
  const startNewProfile = () => {
    setDraft(newProfile())
    setSelectedId(null)
  }
  const saveProfile = () =>
    canSave &&
    withBusy('save', async () => {
      setState(await api.saveProfile(draft))
      setSelectedId(draft.id)
    })
  const deleteProfile = () =>
    selectedId &&
    withBusy('delete', async () => {
      const next = await api.deleteProfile(selectedId)
      setState(next)
      const first = next.profiles[0]
      setSelectedId(first?.id ?? null)
      setDraft(first ?? newProfile())
    })
  const runOrStop = () => {
    if (!selectedId) return
    if (running) {
      api.cancelSync(selectedId).catch(() => undefined)
      return
    }
    setTransferBars([])
    withBusy('run', async () => {
      setState(await api.runSync(selectedId))
    })
  }
  const browseLocal = (field: 'source' | 'destination') =>
    withBusy('browse', async () => {
      const folder = await api.chooseFolder()
      if (folder) setDraft((d) => ({ ...d, [field]: folder }))
    })
  const toggleLaunch = () =>
    withBusy('launch', async () => {
      setState(await api.setLaunchAtLogin(!state?.launchAtLogin))
    })

  const setMode = (mode: SyncMode) => setDraft((d) => ({ ...d, mode }))
  const swapRoute = () => setDraft((d) => ({ ...d, source: d.destination, destination: d.source }))
  const toggleOption = (id: OptionId) =>
    setDraft((d) => ({ ...d, extraArgs: setFlag(d.extraArgs, OPTION_FLAGS[id], !hasFlag(d.extraArgs, OPTION_FLAGS[id])) }))
  const selectClient = (remote: string) =>
    setDraft((d) => {
      const field = isCloudSide(d.destination, false) ? 'destination' : isCloudSide(d.source, true) ? 'source' : 'destination'
      const value = d[field]
      const cur = remoteOf(value, remotes)
      const rest = cur ? value.slice(cur.length) : value.includes(':') ? value.slice(value.indexOf(':') + 1) : ''
      return { ...d, [field]: `${remote}${rest.replace(/^\/+/, '')}` }
    })

  // ---- cloud picker ----
  async function loadPicker(remote: string, stack: string[]) {
    setPickerBusy(true)
    setPickerError(null)
    try {
      const path = `${remote}${stack.join('/')}`
      const items = await api.listRemote(path)
      setPickerItems(items)
    } catch (err) {
      setPickerItems([])
      setPickerError(err instanceof Error ? err.message : String(err))
    } finally {
      setPickerBusy(false)
    }
  }
  function openPicker(field: 'source' | 'destination') {
    const current = draft[field]
    const known = remoteOf(current, remotes)
    const remote = known || clients[0]?.name || ''
    if (!remote) {
      openSettings('clients')
      return
    }
    const start = known ? current.slice(known.length).split('/').filter(Boolean) : []
    setPickerField(field)
    setPickerRemote(remote)
    setPickerStack(start)
    setPickerNewName('')
    setPickerOpen(true)
    loadPicker(remote, start)
  }
  function pickerInto(name: string) {
    const stack = [...pickerStack, name]
    setPickerStack(stack)
    loadPicker(pickerRemote, stack)
  }
  function pickerCrumb(i: number) {
    const stack = pickerStack.slice(0, i)
    setPickerStack(stack)
    loadPicker(pickerRemote, stack)
  }
  function confirmPicker() {
    setDraft((d) => ({ ...d, [pickerField]: `${pickerRemote}${pickerStack.join('/')}` }))
    setPickerOpen(false)
  }
  async function createPickerFolder() {
    const name = pickerNewName.trim().replace(/^\/+|\/+$/g, '')
    if (!name || pickerMkdirBusy) return
    if (/[\\/]/.test(name)) {
      setPickerError(t.pickerNameInvalid)
      return
    }
    setPickerMkdirBusy(true)
    setPickerError(null)
    try {
      const base = pickerStack.join('/')
      const target = `${pickerRemote}${[base, name].filter(Boolean).join('/')}`
      await api.mkdirRemote(target)
      setPickerNewName('')
      await loadPicker(pickerRemote, pickerStack)
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : String(err))
    } finally {
      setPickerMkdirBusy(false)
    }
  }

  // ---- wizard ----
  function startWizard() {
    setWizStep(1)
    setWizType(null)
    setWizName('')
    setWizFilter('')
    setWizFields({})
    setWizToken('')
    setWizTest({ state: 'idle' })
    setWizardOpen(true)
  }
  const providerCfg = providerConfigFor(wizType, backendTypes)
  const wizBackend = backendTypes.find((p) => p.id === wizType)
  const wizNameFinal = wizName || (wizBackend ? providerName(wizBackend) : '')
  const remoteSlug = wizNameFinal.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yeni'
  const setWizField = (key: string, value: string) => {
    setWizFields((f) => ({ ...f, [key]: value }))
    setWizTest({ state: 'idle' })
  }
  const wizCli = useMemo(() => {
    if (!wizType || !providerCfg) return '$ syncdeck engine · hazır'
    const entered = providerCfg.fields
      .filter((f) => (wizFields[f.key] || '').trim())
      .map((f) => `  \\\n    ${f.key} ${f.secret ? '••••••' : `"${wizFields[f.key]}"`}`)
      .join('')
    const tokenLine = wizToken ? '  \\\n    token "<oauth>"  config_is_local false' : ''
    return `config create "${remoteSlug}" ${wizType}${entered}${tokenLine}`
  }, [wizType, providerCfg, wizFields, wizToken, remoteSlug])

  // Whether step 2 is satisfied: OAuth needs a captured token; key providers
  // need every non-optional field filled.
  const wizReady = !providerCfg
    ? false
    : providerCfg.oauth
      ? Boolean(wizToken)
      : providerCfg.fields.filter((f) => !f.optional).every((f) => (wizFields[f.key] || '').trim())

  function authorizeWizard() {
    if (!wizType) return
    setWizAuthBusy(true)
    setWizTest({ state: 'busy' })
    api
      .authorizeRemote({ type: wizType, clientId: wizFields.client_id, clientSecret: wizFields.client_secret })
      .then((token) => {
        setWizToken(token)
        setWizTest({ state: 'ok' })
      })
      .catch((err) => setWizTest({ state: 'fail', msg: err instanceof Error ? err.message : String(err) }))
      .finally(() => setWizAuthBusy(false))
  }

  function testWizard() {
    if (!wizType) return
    setWizTest({ state: 'busy' })
    api
      .testRemote(buildConnString(wizType, wizFields))
      .then((res) => setWizTest(res.ok ? { state: 'ok' } : { state: 'fail', msg: res.message }))
      .catch((err) => setWizTest({ state: 'fail', msg: err instanceof Error ? err.message : String(err) }))
  }

  function wizNext() {
    if (wizStep === 1 && !wizType) return
    if (wizStep === 2 && !wizReady) return
    if (wizStep < 3) {
      setWizStep((s) => s + 1)
      return
    }
    if (!wizType || !providerCfg) return
    withBusy('wizard', async () => {
      const options = providerCfg.fields
        .filter((f) => (wizFields[f.key] || '').trim())
        .map((f) => ({ key: f.key, value: wizFields[f.key].trim() }))
      const remote: RemoteDraft = {
        name: remoteSlug,
        type: wizType,
        token: wizToken || '',
        options,
      }
      setState(await api.createRemote(remote))
      setWizardOpen(false)
    })
  }

  function openSettings(tab: 'interface' | 'clients' | 'about' = 'interface') {
    setSettingsTab(tab)
    setSettingsOpen(true)
  }
  const addClient = () => openSettings('clients')
  const openExternal = (url: string) => api.openExternal(url)

  const testClient = (name: string) => {
    setClientTests((m) => ({ ...m, [name]: { state: 'busy' } }))
    api
      .testRemote(name)
      .then((res) => setClientTests((m) => ({ ...m, [name]: res.ok ? { state: 'ok' } : { state: 'fail', msg: res.message } })))
      .catch((err) => setClientTests((m) => ({ ...m, [name]: { state: 'fail', msg: err instanceof Error ? err.message : String(err) } })))
  }
  const deleteClient = (name: string) => {
    if (!window.confirm(t.deleteClientConfirm(clientLabel(name)))) return
    withBusy(`client:${name}`, async () => {
      setState(await api.deleteRemote(name))
      setClientTests((m) => {
        const next = { ...m }
        delete next[name]
        return next
      })
    })
  }

  /* ---- engine unavailable guard ---- */
  if (!state) {
    return (
      <IonApp>
        <div className="sd-root sd-engine-block" style={{ '--accent': accent } as CSSProperties}>
          <div className="sd-engine-card">
            <div className="sd-engine-ico"><Logo /></div>
            <h1>{error ? 'SyncDeck başlatılamadı' : 'SyncDeck yükleniyor'}</h1>
            <p>{error || 'Motor ve istemci yapılandırması hazırlanıyor.'}</p>
            {error && <button className="sl-btn sl-btn--sm" onClick={() => load(null)}>{t.retry}</button>}
          </div>
        </div>
      </IonApp>
    )
  }

  if (state && !state.rclonePath) {
    return (
      <IonApp>
        <div className="sd-root sd-engine-block" style={{ '--accent': accent } as CSSProperties}>
          <div className="sd-engine-card">
            <div className="sd-engine-ico"><Glyph size={28} sw={1.8}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></Glyph></div>
            <h1>{t.engineUnavailable}</h1>
            <p>{t.engineUnavailableDetail}</p>
            <button className="sl-btn sl-btn--sm" onClick={() => load()}>{t.retry}</button>
          </div>
        </div>
      </IonApp>
    )
  }

  const logText = running
    ? `Transferred:   ${progress?.transferred ?? '…'} / ${progress?.total ?? '482 MiB'}, ${progress?.pct ?? 0}%\n↻ ${draft.name} · ${draft.destination} aktarılıyor…`
    : selectedRun?.output || t.noRun

  return (
    <IonApp>
      <div className="sd-root" style={{ '--accent': accent } as CSSProperties}>
        <div className="sd-dotfield" aria-hidden="true" />

        {/* ============ TITLE BAR ============ */}
        <header className="sd-titlebar">
          <div className="sd-traffic" aria-hidden="true"><span /><span /><span className="is-accent" /></div>
          <div className="sd-brand"><Logo /><span className="sd-brand__name">SYNCDECK</span></div>
          <div className="sd-titlebar__right">
            <span className="sd-conn"><span className={`sd-dot sd-dot--pulse${running ? '' : ' is-idle'}`} />{running ? t.connBusy : t.connIdle}</span>
            <button className="sd-icobtn" onClick={() => openSettings()} title={t.settings} aria-label={t.settings}><GearIcon /></button>
          </div>
        </header>

        {/* ============ BODY ============ */}
        <div className="sd-body">
          {/* sidebar */}
          <aside className="sd-side">
            <div className="sd-side__head"><span>{t.profiles}</span><span className="sd-side__count">{String(profiles.length).padStart(2, '0')}</span></div>
            <div className="sd-side__list">
              {profiles.map((p) => {
                const on = p.id === selectedId
                return (
                  <button key={p.id} className={`sd-prof${on ? ' is-active' : ''}`} style={{ opacity: p.enabled ? 1 : 0.55 }} onClick={() => selectProfile(p)}>
                    <span className="sd-prof__icon"><FolderIcon size={16} /></span>
                    <span className="sd-prof__text">
                      <span className="sd-prof__name">{p.name}</span>
                      <span className="sd-prof__remote">{p.destination || t.noFolder}</span>
                    </span>
                    <span className="sd-prof__tag">{modeTag(p.mode)}</span>
                  </button>
                )
              })}
            </div>
            <div className="sd-side__new">
              <button className="sl-btn sl-btn--ghost sl-btn--sm" onClick={startNewProfile} style={{ width: '100%', justifyContent: 'center' }}>{t.newProfile}</button>
            </div>
            <div className="sd-side__foot">
              <span className={`sd-dot${state?.rclonePath ? '' : ' is-idle'}`} style={{ boxShadow: `0 0 0 3px color-mix(in oklch, ${accent} 20%, transparent)` }} />
              <div className="sd-side__foot-text">
                <div className="sd-side__foot-title">{state?.rclonePath ? t.engineReady : t.engineMissing}</div>
                <div className="sd-side__foot-sub">{t.clientCount(clients.length)}</div>
              </div>
            </div>
          </aside>

          {/* main editor */}
          <main className="sd-main">
            <div className="sd-main__inner">
              {error && (
                <div className="sd-error" role="alert">
                  <span>{error}</span>
                  <button onClick={() => setError(null)} aria-label="Kapat">✕</button>
                </div>
              )}

              <div className="sd-editor-head">
                <div>
                  <div className="sd-kicker">{t.activeKicker}</div>
                  <input
                    className="sd-editor-title sd-editor-title--input"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder={t.newProfileTitle}
                    aria-label={t.profileName}
                    spellCheck={false}
                  />
                </div>
                <div className="sd-editor-actions">
                  <button className="sl-btn sl-btn--ghost sl-btn--sm" disabled={!selectedId} onClick={runOrStop}>{running ? t.stop : t.run}</button>
                  <button className="sl-btn sl-btn--sm" disabled={!canSave || busy === 'save'} onClick={saveProfile}>{t.save}</button>
                </div>
              </div>

              {/* source -> dest */}
              <div className="sd-route">
                <div className="sl-card sd-route__box">
                  <div className="sd-route__label"><span className="ac">01</span> {t.sourceLabel} · {srcCloud ? t.routeCloud : t.routeLocal}</div>
                  <div className="sd-route__val">{draft.source || <span className="muted">{t.noFolder}</span>}</div>
                  {srcCloud ? (
                    <button className="sl-btn sl-btn--ghost sl-btn--sm" onClick={() => openPicker('source')}>{t.browseCloud}</button>
                  ) : (
                    <button className="sl-btn sl-btn--ghost sl-btn--sm" onClick={() => browseLocal('source')}>{t.browse}</button>
                  )}
                </div>
                <button className="sd-route__arrow" onClick={swapRoute} title={t.swapRoute} aria-label={t.swapRoute}><SwapIcon /></button>
                <div className="sl-card sd-route__box">
                  <div className="sd-route__label"><span className="ac">02</span> {t.destLabel} · {dstCloud ? t.routeCloud : t.routeLocal}</div>
                  <div className="sd-route__val">{draft.destination || <span className="muted">{t.noFolder}</span>}</div>
                  {dstCloud ? (
                    <button className="sl-btn sl-btn--ghost sl-btn--sm" onClick={() => openPicker('destination')}>{t.browseCloud}</button>
                  ) : (
                    <button className="sl-btn sl-btn--ghost sl-btn--sm" onClick={() => browseLocal('destination')}>{t.browse}</button>
                  )}
                </div>
              </div>

              {/* client selector */}
              <div className="sd-panel">
                <div className="sd-panel__label">{t.targetClient}</div>
                <div className="sd-chips">
                  {clients.map((c) => {
                    const on = c.name === activeRemote
                    return (
                      <button key={c.name} className={`sd-clientchip${on ? ' is-active' : ''}`} onClick={() => selectClient(c.name)}>
                        <span className="sd-clientchip__icon"><ProviderGlyph id={c.type} size={18} /></span>
                        <span className="sd-clientchip__name">{clientLabel(c.name)}</span>
                        <span className="sd-clientchip__remote">{c.type || c.name}</span>
                      </button>
                    )
                  })}
                  <button className="sd-clientchip sd-clientchip--add" onClick={addClient}>
                    <span className="sd-clientchip__plus">+</span>
                    <span className="sd-clientchip__addlabel">{t.addClient}</span>
                  </button>
                </div>
              </div>

              {/* mode */}
              <div className="sd-panel">
                <div className="sd-panel__label">{t.syncMode}</div>
                <div className="sd-modes">
                  {modeCards.map((m) => {
                    const on = draft.mode === m.id
                    return (
                      <button key={m.id} className={`sd-mode${on ? ' is-active' : ''}`} onClick={() => setMode(m.id)}>
                        <span className="sd-mode__top">
                          <span className={`sd-radio${on ? ' is-on' : ''}`}><span /></span>
                          <span className="sd-mode__title">{m.title}</span>
                          <code className="sd-mode__cmd">{m.cmd}</code>
                        </span>
                        <span className="sd-mode__desc">{m.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* options */}
              <div className="sd-panel">
                <div className="sd-panel__label">{t.schedule}</div>
                <div className="sd-sched">
                  <div className="sd-sched__head">
                    <span className="sd-sched__title">{t.schedTitle}</span>
                    <span className="sd-sched__hint">{t.schedHint}</span>
                  </div>
                  <div className="sd-sched__opts" role="radiogroup" aria-label={t.schedTitle}>
                    {SCHEDULE_PRESETS.map((p) => (
                      <button
                        key={p.minutes}
                        role="radio"
                        aria-checked={draft.intervalMinutes === p.minutes}
                        className={`sd-schedbtn${draft.intervalMinutes === p.minutes ? ' is-active' : ''}`}
                        onClick={() => setDraft((d) => ({ ...d, intervalMinutes: p.minutes }))}
                      >
                        {t[p.key]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sd-opts">
                  {([
                    { id: 'startup' as const, on: draft.enabled, label: t.optStartupLabel, hint: t.optStartupHint, flag: 'startup' },
                    { id: 'checksum' as const, on: hasFlag(draft.extraArgs, OPTION_FLAGS.checksum), label: t.optChecksumLabel, hint: t.optChecksumHint, flag: OPTION_FLAGS.checksum },
                    { id: 'dryrun' as const, on: hasFlag(draft.extraArgs, OPTION_FLAGS.dryrun), label: t.optDryrunLabel, hint: t.optDryrunHint, flag: OPTION_FLAGS.dryrun },
                    { id: 'bwlimit' as const, on: hasFlag(draft.extraArgs, OPTION_FLAGS.bwlimit), label: t.optBwlimitLabel, hint: t.optBwlimitHint, flag: OPTION_FLAGS.bwlimit },
                  ]).map((o) => (
                    <button
                      key={o.id}
                      className="sd-opt"
                      role="switch"
                      aria-checked={o.on}
                      onClick={() => (o.id === 'startup' ? setDraft((d) => ({ ...d, enabled: !d.enabled })) : toggleOption(o.id as OptionId))}
                    >
                      <span className={`sd-toggle${o.on ? ' is-on' : ''}`}><span className="sd-toggle__knob" /></span>
                      <span className="sd-opt__text">
                        <span className="sd-opt__label">{o.label}</span>
                        <span className="sd-opt__hint">{o.hint}</span>
                      </span>
                      <code className={`sd-opt__flag${o.on ? ' is-on' : ''}`}>{o.flag === 'startup' ? '@login' : o.flag}</code>
                    </button>
                  ))}
                </div>
              </div>

              {/* live log */}
              <div className="sd-log">
                <div className="sd-log__head">
                  <span className={`sd-dot${running ? '' : ' is-idle'}`} />
                  <span className="sd-log__title">{t.liveLog}</span>
                  {selectedRun?.finishedAt && <span className="sd-log__time">{new Date(selectedRun.finishedAt).toLocaleTimeString()}</span>}
                </div>
                <pre className="sd-log__pre">{logText}</pre>
              </div>

              <div className="sd-delete">
                <button className="sd-delete__btn" disabled={!selectedId || busy === 'delete'} onClick={deleteProfile}>{t.deleteProfile}</button>
              </div>
            </div>
          </main>
        </div>

        {/* ============ STATUS BAR ============ */}
        <StatusBar t={t} accent={accent} running={running} progress={progress} transferBars={transferBars} />

        {/* ============ SETTINGS ============ */}
        {settingsOpen && (
          <Overlay onClose={() => setSettingsOpen(false)} label={t.settings}>
            <div className="sd-modal sd-modal--settings">
              <div className="sd-modal__head">
                <span className="sd-modal__title">{t.settings}</span>
                <button className="sd-icobtn" onClick={() => setSettingsOpen(false)} aria-label="Kapat">✕</button>
              </div>
              <div className="sd-modal__body sd-settings">
                <nav className="sd-settings__nav">
                  {([
                    { id: 'interface' as const, label: t.tabInterface, icon: <InterfaceIcon /> },
                    { id: 'clients' as const, label: t.tabClients, icon: <ServerIcon /> },
                    { id: 'about' as const, label: t.tabAbout, icon: <InfoIcon /> },
                  ]).map((tab) => (
                    <button key={tab.id} className={`sd-settings__tab${settingsTab === tab.id ? ' is-active' : ''}`} onClick={() => setSettingsTab(tab.id)}>
                      {tab.icon}<span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
                <div className="sd-settings__panel">
                  {settingsTab === 'interface' && (
                    <div>
                      <div className="sd-panel__label" style={{ marginBottom: 14 }}>{t.langTitle}</div>
                      <div className="sd-langgrid">
                        {LANGS.map((l) => (
                          <button key={l.id} className={`sd-langchip${language === l.id ? ' is-active' : ''}`} onClick={() => setLanguage(l.id)}>
                            <span className="sd-langchip__flag">{l.flag}</span><span>{l.name}</span>
                          </button>
                        ))}
                      </div>
                      <div className="sd-panel__label" style={{ margin: '30px 0 14px' }}>{t.accentTitle}</div>
                      <div className="sd-accents">
                        {ACCENTS.map((a) => (
                          <button key={a.name} className="sd-swatch" title={a.name} aria-label={a.name} style={{ background: a.color, borderColor: a.name === accentName ? 'var(--ink)' : 'transparent' }} onClick={() => setAccentName(a.name)} />
                        ))}
                      </div>
                      <div className="sd-panel__label" style={{ margin: '30px 0 14px' }}>{t.themeTitle}</div>
                      <div className="sd-themetoggle" role="radiogroup" aria-label={t.themeTitle}>
                        {([
                          { id: 'dark' as const, label: t.themeDark },
                          { id: 'light' as const, label: t.themeLight },
                        ]).map((opt) => (
                          <button
                            key={opt.id}
                            role="radio"
                            aria-checked={theme === opt.id}
                            className={`sd-themebtn${theme === opt.id ? ' is-active' : ''}`}
                            onClick={() => setTheme(opt.id)}
                          >
                            <span className={`sd-themeswatch sd-themeswatch--${opt.id}`} aria-hidden="true" />
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <div className="sd-panel__label" style={{ margin: '30px 0 14px' }}>{t.systemTitle}</div>
                      <button className="sd-opt sd-opt--bordered" role="switch" aria-checked={!!state?.launchAtLogin} disabled={busy === 'launch'} onClick={toggleLaunch}>
                        <span className={`sd-toggle${state?.launchAtLogin ? ' is-on' : ''}`}><span className="sd-toggle__knob" /></span>
                        <span className="sd-opt__text">
                          <span className="sd-opt__label">{t.launchAtLogin}</span>
                          <span className="sd-opt__hint">{t.launchAtLoginHint}</span>
                        </span>
                      </button>
                    </div>
                  )}
                  {settingsTab === 'clients' && (
                    <div>
                      <div className="sd-settings__row">
                        <div className="sd-panel__label">{t.definedClients}</div>
                        <button className="sl-btn sl-btn--sm" onClick={startWizard}>{t.newClient}</button>
                      </div>
                      {clients.length === 0 ? (
                        <div className="sd-empty">{t.noClients}</div>
                      ) : (
                        <div className="sd-clientlist">
                          {clients.map((c) => {
                            const test = clientTests[c.name]
                            const about = clientAbout[c.name]
                            const statusState = test && test.state !== 'idle' ? test.state : 'connected'
                            const statusLabel =
                              statusState === 'busy' ? t.wizTesting
                                : statusState === 'ok' ? t.wizTestOk
                                  : statusState === 'fail' ? t.wizTestFail
                                    : t.connected
                            return (
                              <div key={c.name} className="sd-clientrow">
                                <span className="sd-clientrow__icon"><ProviderGlyph id={c.type} size={22} /></span>
                                <div className="sd-clientrow__text">
                                  <div className="sd-clientrow__name">{clientLabel(c.name)}</div>
                                  <div className="sd-clientrow__type">{c.type || '—'} · {c.name}</div>
                                  {about?.supported && about.free && (
                                    <div className="sd-clientrow__quota">{about.free} {t.quotaFree}{about.total ? ` / ${about.total}` : ''}</div>
                                  )}
                                </div>
                                <span className={`sd-clientrow__status is-${statusState}`} title={test?.msg}>
                                  <span className="sd-dot" />{statusLabel}
                                </span>
                                <div className="sd-clientrow__actions">
                                  <button className="sd-rowbtn" disabled={test?.state === 'busy'} onClick={() => testClient(c.name)}>{t.testClient}</button>
                                  <button className="sd-rowbtn sd-rowbtn--danger" disabled={busy === `client:${c.name}`} onClick={() => deleteClient(c.name)} aria-label={t.deleteClientLabel} title={t.deleteClientLabel}>
                                    <TrashIcon />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {settingsTab === 'about' && (
                    <div>
                      <div className="sd-about__head">
                        <Logo w={44} h={40} />
                        <div>
                          <div className="sd-about__name">SyncDeck</div>
                          <div className="sd-about__ver">{t.version(VERSION)}</div>
                        </div>
                      </div>
                      <div className="sl-card sd-about__card">
                        <div className="sd-about__cardlabel">{t.aboutTitle}</div>
                        <p className="sd-about__body">{t.aboutBody}</p>
                      </div>
                      <div className="sd-about__links">
                        <button className="sl-btn sl-btn--ghost sl-btn--sm" onClick={() => openExternal('https://rclone.org')}>rclone.org</button>
                        <button className="sl-btn sl-btn--ghost sl-btn--sm" onClick={() => openExternal('https://github.com/e-onux/syncdeck')}>GitHub · e-onux/syncdeck</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Overlay>
        )}

        {/* ============ CLIENT WIZARD ============ */}
        {wizardOpen && (
          <Overlay onClose={() => setWizardOpen(false)} label={t.wizStep1}>
            <div className="sd-modal sd-modal--wizard">
              <div className="sd-modal__head">
                <div>
                  <div className="sd-modal__kicker">{t.wizStepOf(wizStep)}</div>
                  <div className="sd-modal__title sd-modal__title--sm">{[t.wizStep1, t.wizStep2, t.wizStep3][wizStep - 1]}</div>
                </div>
                <button className="sd-icobtn" onClick={() => setWizardOpen(false)} aria-label="Kapat">✕</button>
              </div>
              <div className="sd-wizrail">{[1, 2, 3].map((n) => <span key={n} style={{ background: n <= wizStep ? accent : 'var(--line-soft)' }} />)}</div>
              <div className="sd-modal__body sd-wiz__body">
                {wizStep === 1 && (
                  <div>
                    <p className="sd-wiz__prompt">{t.wizTypePrompt}</p>
                    <input
                      className="sl-input sd-provsearch"
                      value={wizFilter}
                      onChange={(e) => setWizFilter(e.target.value)}
                      placeholder={t.providerSearch}
                    />
                    <div className="sd-provgrid">
                      {filteredBackendTypes.map((p) => (
                        <button key={p.id} className={`sd-prov${wizType === p.id ? ' is-active' : ''}`} onClick={() => setWizType(p.id)}>
                          <span className="sd-prov__icon"><ProviderGlyph id={p.id} size={24} /></span>
                          <span className="sd-prov__name">{providerName(p)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {wizStep === 2 && providerCfg && (
                  <div className="sd-wiz__form">
                    <label className="sl-field">
                      <span className="sl-field__label">{t.wizClientName}</span>
                      <input className="sl-input" value={wizName} onChange={(e) => setWizName(e.target.value)} placeholder={t.wizClientNamePh} />
                    </label>
                    {providerCfg.fields.map((f) => (
                      <label key={f.key} className="sl-field">
                        <span className="sl-field__label">{f.label}{f.optional ? ` · ${t.wizOptional}` : ''}</span>
                        <input
                          className="sl-input"
                          type={f.secret ? 'password' : 'text'}
                          value={wizFields[f.key] || ''}
                          onChange={(e) => setWizField(f.key, e.target.value)}
                          placeholder={f.ph}
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </label>
                    ))}
                    <div className="sd-wiz__note"><span className="sd-wiz__note-icon"><ShieldIcon /></span><span>{providerCfg.oauth ? t.wizOauthNote : t.wizCredNote}</span></div>
                    <div className="sd-wiz__auth">
                      {providerCfg.oauth ? (
                        <button className="sl-btn sl-btn--ghost sl-btn--sm" disabled={wizAuthBusy} onClick={authorizeWizard}>
                          {wizAuthBusy ? t.wizAuthorizing : wizToken ? t.wizReauthorize : t.wizAuthorize}
                        </button>
                      ) : (
                        <button className="sl-btn sl-btn--ghost sl-btn--sm" disabled={wizTest.state === 'busy' || !wizReady} onClick={testWizard}>
                          {wizTest.state === 'busy' ? t.wizTesting : t.wizTest}
                        </button>
                      )}
                      {wizTest.state !== 'idle' && (
                        <span className={`sd-wiz__status is-${wizTest.state}`} title={wizTest.msg}>
                          {wizTest.state === 'busy'
                            ? providerCfg.oauth ? t.wizAuthorizing : t.wizTesting
                            : wizTest.state === 'ok'
                              ? providerCfg.oauth ? t.wizAuthorized : t.wizTestOk
                              : `${t.wizTestFail}${wizTest.msg ? ` · ${wizTest.msg}` : ''}`}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {wizStep === 3 && (
                  <div className="sd-wiz__review">
                    <p className="sd-wiz__prompt">{t.wizReviewPrompt}</p>
                    {[
                      { k: t.wizName, v: wizNameFinal },
                      { k: t.wizType, v: wizBackend ? providerName(wizBackend) : '' },
                      { k: t.wizRemote, v: `${remoteSlug}:` },
                      ...(providerCfg?.oauth && wizToken ? [{ k: 'OAuth', v: t.wizAuthorized }] : []),
                    ].map((r) => (
                      <div key={r.k} className="sd-wiz__rev"><span>{r.k}</span><strong>{r.v}</strong></div>
                    ))}
                  </div>
                )}
              </div>
              <div className="sd-wiz__cli">
                <div className="sd-wiz__cli-head"><span>{t.engineCmd}</span><span className="sd-wiz__cli-rule" /><span className="ac">{t.runsInBg}</span></div>
                <pre className="sd-wiz__cli-pre">{wizCli}</pre>
                <div className="sd-wiz__nav">
                  <button className="sl-btn sl-btn--quiet sl-btn--sm" style={{ visibility: wizStep > 1 ? 'visible' : 'hidden' }} onClick={() => setWizStep((s) => Math.max(1, s - 1))}>{t.back}</button>
                  <button className="sl-btn sl-btn--sm" disabled={(wizStep === 1 && !wizType) || (wizStep === 2 && !wizReady) || busy === 'wizard'} onClick={wizNext}>{wizStep === 3 ? t.create : t.next}</button>
                </div>
              </div>
            </div>
          </Overlay>
        )}

        {/* ============ CLOUD PICKER ============ */}
        {pickerOpen && (
          <Overlay onClose={() => setPickerOpen(false)} label={t.pickerSub}>
            <div className="sd-modal sd-modal--picker">
              <div className="sd-modal__head">
                <div className="sd-picker__id">
                  <span className="sd-picker__icon"><CloudIcon size={20} /></span>
                  <div>
                    <div className="sd-picker__client">{clientLabel(pickerRemote) || t.cloud}</div>
                    <div className="sd-picker__sub">{t.pickerSub}</div>
                  </div>
                </div>
                <button className="sd-icobtn" onClick={() => setPickerOpen(false)} aria-label="Kapat">✕</button>
              </div>
              <div className="sd-crumbs">
                <button className="sd-crumb" onClick={() => pickerCrumb(0)} style={{ color: pickerStack.length === 0 ? 'var(--accent)' : 'var(--ink-dim)' }}>{clientLabel(pickerRemote)}</button>
                {pickerStack.map((c, i) => (
                  <span key={`${c}-${i}`} className="sd-crumbwrap">
                    <span className="sd-crumb__sep">/</span>
                    <button className="sd-crumb" onClick={() => pickerCrumb(i + 1)} style={{ color: i === pickerStack.length - 1 ? 'var(--accent)' : 'var(--ink-dim)' }}>{c}</button>
                  </span>
                ))}
              </div>
              <div className="sd-picker__mkdir">
                <span className="sd-picker__mkdir-label">{t.pickerNewFolder}</span>
                <input
                  className="sl-input sd-picker__mkdir-input"
                  value={pickerNewName}
                  onChange={(e) => setPickerNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createPickerFolder()
                  }}
                  placeholder={t.pickerFolderName}
                  disabled={pickerMkdirBusy}
                />
                <button className="sl-btn sl-btn--ghost sl-btn--sm" disabled={!pickerNewName.trim() || pickerMkdirBusy || pickerBusy} onClick={createPickerFolder}>
                  {pickerMkdirBusy ? t.pickerCreating : t.pickerCreate}
                </button>
              </div>
              <div className="sd-modal__body sd-picker__list">
                {pickerBusy ? (
                  <div className="sd-empty">{t.pickerLoading}</div>
                ) : pickerError ? (
                  <div className="sd-empty sd-empty--error">{t.pickerError}</div>
                ) : pickerItems.length === 0 ? (
                  <div className="sd-empty">{t.pickerEmpty}</div>
                ) : (
                  pickerItems.map((it, index) => (
                    <button key={`${it.name}-${index}`} className="sd-fileitem" disabled={!it.isDir} onClick={() => it.isDir && pickerInto(it.name)}>
                      <span className="sd-fileitem__icon" style={{ color: it.isDir ? 'var(--accent)' : 'var(--ink-faint)' }}>{it.isDir ? <FolderIcon size={18} /> : <FileIcon size={18} />}</span>
                      <span className="sd-fileitem__name">{it.name}</span>
                      <span className="sd-fileitem__meta">{it.isDir ? '' : formatSize(it.size)}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="sd-picker__foot">
                <div className="sd-picker__path">{pickerRemote}{pickerStack.join('/')}</div>
                <div className="sd-picker__actions">
                  <button className="sl-btn sl-btn--quiet sl-btn--sm" onClick={() => setPickerOpen(false)}>{t.pickerCancel}</button>
                  <button className="sl-btn sl-btn--sm" onClick={confirmPicker}>{t.pickerConfirm}</button>
                </div>
              </div>
            </div>
          </Overlay>
        )}
      </div>
    </IonApp>
  )
}

/* ============================================================ status bar */
function StatusBar({
  t,
  accent,
  running,
  progress,
  transferBars,
}: {
  t: Copy;
  accent: string;
  running: boolean;
  progress: SyncProgress | null;
  transferBars: TransferEvent[];
}) {
  const pct = progress?.pct ?? 0
  const filesText =
    running && progress && progress.files != null
      ? progress.totalFiles
        ? `${progress.files} / ${progress.totalFiles}`
        : String(progress.files)
      : '—'
  return (
    <footer className="sd-status">
      <div className="sd-status__seg">
        <span className={`sd-dot sd-dot--pulse${running ? '' : ' is-idle'}`} style={{ boxShadow: `0 0 0 3px color-mix(in oklch, ${running ? accent : 'var(--ink-faint)'} 22%, transparent)` }} />
        <div><div className="sd-status__cap">{t.statusTitle}</div><div className="sd-status__val">{running ? t.syncing : t.idle}</div></div>
      </div>
      <div className="sd-status__seg sd-status__eq-seg">
        <div className="sd-eq" aria-label="Dosya aktarım göstergesi">
          {transferBars.length === 0 ? (
            <span className="sd-filebar is-empty" />
          ) : transferBars.map((bar) => (
            <span
              key={bar.id}
              className={`sd-filebar is-${bar.direction} is-${bar.status}`}
              title={`${bar.name} · ${bar.pct}%`}
            >
              <span style={{ height: `${running ? Math.max(8, Math.min(100, bar.pct)) : bar.pct}%` }} />
            </span>
          ))}
        </div>
        <div><div className="sd-status__cap">{t.speed}</div><div className="sd-status__val ac">{running ? progress?.speed || '—' : '—'}</div></div>
      </div>
      <div className="sd-status__progress">
        <div className="sd-status__bar-row">
          <span>{running ? `${progress?.transferred || '0'} / ${progress?.total || '—'}` : '—'}</span>
          <span className="muted">{running ? `${pct}%` : ''}</span>
        </div>
        <div className="sd-status__track"><div className="sd-status__fill" style={{ width: `${running ? pct : 0}%` }} /></div>
      </div>
      <div className="sd-status__stats">
        <div className="sd-status__stat"><div className="sd-status__cap">{t.files}</div><div className="sd-status__val">{filesText}</div></div>
        <div className="sd-status__stat"><div className="sd-status__cap">{t.eta}</div><div className="sd-status__val">{running ? progress?.eta || '—' : '—'}</div></div>
      </div>
    </footer>
  )
}

/* ============================================================ overlay shell */
function Overlay({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div className="sd-overlay" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e) => e.target === ref.current && onClose()} ref={ref}>
      {children}
    </div>
  )
}

export default App
