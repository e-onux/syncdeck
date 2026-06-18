import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { IonApp } from '@ionic/react'
import type {
  AboutInfo,
  AppState,
  RemoteClient,
  RemoteDraft,
  RemoteEntry,
  SyncMode,
  SyncProfile,
  SyncProgress,
} from './types'
import {
  OPTION_FLAGS,
  buildConnString,
  clientLabel,
  formatSize,
  hasFlag,
  remoteOf,
  setFlag,
} from './lib/rclone'
import type { OptionId } from './lib/rclone'
import './App.css'

const VERSION = '0.2.0'

/* ============================================================ demo fallback (browser dev) */
const demoProfile: SyncProfile = {
  id: 'docs',
  name: 'Belgeler yedeği',
  source: '/Users/emir/Documents',
  destination: 'isdrive:Yedekler/Belgeler',
  mode: 'sync',
  enabled: true,
  extraArgs: '--checksum --bwlimit 8M',
}

const demoState = (overrides: Partial<AppState> = {}): AppState => ({
  launchAtLogin: false,
  rclonePath: '/opt/homebrew/bin/rclone',
  configPath: 'demo',
  launchAgentPath: '~/Library/LaunchAgents/com.emironuk.syncdeck.plist',
  platform: 'browser',
  profiles: [
    demoProfile,
    { id: 'photos', name: 'Fotoğraf arşivi', source: '/Users/emir/Pictures', destination: 'arsiv:foto-2026', mode: 'copy', enabled: false, extraArgs: '' },
    { id: 'code', name: 'Proje kaynağı', source: '/Users/emir/Code/sidrelabs', destination: 'b2cold:kod/snapshot', mode: 'sync', enabled: false, extraArgs: '' },
  ],
  lastRun: {},
  remotes: ['isdrive:', 'arsiv:', 'b2cold:'],
  clients: [
    { name: 'isdrive:', type: 'drive' },
    { name: 'arsiv:', type: 's3' },
    { name: 'b2cold:', type: 'b2' },
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
  listRemote: async () => [
    { name: 'Belgeler', isDir: true, size: -1 },
    { name: 'Fotoğraflar', isDir: true, size: -1 },
    { name: 'Arşiv-2025', isDir: true, size: -1 },
    { name: 'notlar.txt', isDir: false, size: 12288 },
  ],
  openExternal: async () => undefined,
  openAbout: async () => undefined,
  onSyncProgress: () => () => undefined,
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

/* ============================================================ i18n (tr/en full, others fall back to en) */
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
  sourceLabel: 'Kaynak · yerel',
  browse: 'Gözat',
  destLabel: 'Hedef · bulut',
  browseCloud: 'Bulutta gözat',
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
  systemTitle: 'Sistem',
  launchAtLogin: 'Açılışta SyncDeck’i başlat',
  launchAtLoginHint: 'Etkin profiller girişte çalışsın',
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
  sourceLabel: 'Source · local',
  browse: 'Browse',
  destLabel: 'Destination · cloud',
  browseCloud: 'Browse cloud',
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
  systemTitle: 'System',
  launchAtLogin: 'Launch SyncDeck at startup',
  launchAtLoginHint: 'Run enabled profiles at login',
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

const TRANSLATIONS: Record<Language, Copy> = {
  en,
  tr,
  de: { ...en, save: 'Speichern', run: '▶ Jetzt ausführen', settings: 'Einstellungen', profiles: 'Profile' },
  es: { ...en, save: 'Guardar', run: '▶ Ejecutar', settings: 'Ajustes', profiles: 'Perfiles' },
  zh: { ...en, save: '保存', run: '▶ 立即运行', settings: '设置', profiles: '配置' },
  ja: { ...en, save: '保存', run: '▶ 今すぐ実行', settings: '設定', profiles: 'プロファイル' },
  ru: { ...en, save: 'Сохранить', run: '▶ Запустить', settings: 'Настройки', profiles: 'Профили' },
  nl: { ...en, save: 'Opslaan', run: '▶ Nu uitvoeren', settings: 'Instellingen', profiles: 'Profielen' },
  ar: { ...en, save: 'حفظ', run: '▶ شغّل الآن', settings: 'الإعدادات', profiles: 'الملفات' },
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
type ProviderId = (typeof PROVIDER_TYPES)[number]['id']

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
const GearIcon = () => <Glyph size={17}><circle cx="12" cy="12" r="3.1" /><path d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V19a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.5 17.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H2a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 3.6 8.5a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H8a1.7 1.7 0 0 0 1-1.56V2a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V8a1.7 1.7 0 0 0 1.56 1H22a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" /></Glyph>
const ShieldIcon = () => <Glyph size={18} sw={1.8}><path d="M12 2 4 5v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5z" /><path d="M9 12l2 2 4-4" /></Glyph>
const InterfaceIcon = () => <Glyph size={16}><circle cx="12" cy="12" r="9" /><path d="M3.5 9h17M3.5 15h17" /><path d="M12 3a13 13 0 0 1 0 18 13 13 0 0 1 0-18z" /></Glyph>
const ServerIcon = (p: { size?: number }) => <Glyph size={p.size ?? 16}><path d="M3 7a2 2 0 0 1 2-2h4l2 2.2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Glyph>
const InfoIcon = () => <Glyph size={16}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Glyph>
const TrashIcon = () => <Glyph size={15}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></Glyph>

const ProviderGlyph = ({ id, size = 18 }: { id: string; size?: number }) => {
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
})

const EQ_BARS = Array.from({ length: 22 }, (_, i) => ({
  base: (0.25 + ((i * 37) % 70) / 100).toFixed(2),
  accent: i % 3 === 0,
  dur: (0.7 + ((i * 13) % 9) / 10).toFixed(2) + 's',
  delay: '-' + ((i * 7) % 11) / 10 + 's',
}))

/* ============================================================ component */
function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [draft, setDraft] = useState<SyncProfile>(newProfile)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<SyncProgress | null>(null)

  const [accentName, setAccentName] = useState<AccentName>(() => (localStorage.getItem('sd_accent') as AccentName) || 'Mint')
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('sd_lang') as Language) || 'tr')

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'interface' | 'clients' | 'about'>('interface')
  const [clientTests, setClientTests] = useState<Record<string, { state: 'idle' | 'busy' | 'ok' | 'fail'; msg?: string }>>({})
  const [clientAbout, setClientAbout] = useState<Record<string, AboutInfo>>({})

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizStep, setWizStep] = useState(1)
  const [wizType, setWizType] = useState<ProviderId | null>(null)
  const [wizName, setWizName] = useState('')
  const [wizFields, setWizFields] = useState<Record<string, string>>({})
  const [wizToken, setWizToken] = useState('')
  const [wizAuthBusy, setWizAuthBusy] = useState(false)
  const [wizTest, setWizTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'fail'; msg?: string }>({ state: 'idle' })

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerRemote, setPickerRemote] = useState('')
  const [pickerStack, setPickerStack] = useState<string[]>([])
  const [pickerItems, setPickerItems] = useState<RemoteEntry[]>([])
  const [pickerBusy, setPickerBusy] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)

  const t = TRANSLATIONS[language]
  const accent = ACCENTS.find((a) => a.name === accentName)?.color || '#5fd6b6'
  const profiles = state?.profiles ?? []
  const remotes = state?.remotes ?? []
  const clients = useMemo<RemoteClient[]>(() => {
    const r = state?.remotes ?? []
    return state?.clients?.length ? state.clients : r.map((name) => ({ name, type: '' }))
  }, [state])
  const selectedRun = selectedId && state ? state.lastRun[selectedId] : null
  const canSave = Boolean(draft.name.trim() && draft.source.trim() && draft.destination.trim())
  const running = busy === 'run' || Boolean(progress?.running)
  const activeRemote = remoteOf(draft.destination, remotes)

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
      if (!data.running) window.setTimeout(() => setProgress((cur) => (cur && !cur.running ? null : cur)), 4000)
    })
    return unsub
  }, [])

  async function load(preferredId: string | null = selectedId) {
    setError(null)
    const next = await api.getState()
    setState(next)
    const profile = next.profiles.find((p) => p.id === preferredId) || next.profiles[0]
    if (profile) {
      setSelectedId(profile.id)
      setDraft(profile)
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
    withBusy('run', async () => {
      setState(await api.runSync(selectedId))
    })
  }
  const browseSource = () =>
    withBusy('browse', async () => {
      const folder = await api.chooseFolder()
      if (folder) setDraft((d) => ({ ...d, source: folder }))
    })
  const toggleLaunch = () =>
    withBusy('launch', async () => {
      setState(await api.setLaunchAtLogin(!state?.launchAtLogin))
    })

  const setMode = (mode: SyncMode) => setDraft((d) => ({ ...d, mode }))
  const toggleOption = (id: OptionId) =>
    setDraft((d) => ({ ...d, extraArgs: setFlag(d.extraArgs, OPTION_FLAGS[id], !hasFlag(d.extraArgs, OPTION_FLAGS[id])) }))
  const selectClient = (remote: string) =>
    setDraft((d) => {
      const cur = remoteOf(d.destination, remotes)
      const path = cur ? d.destination.slice(cur.length) : d.destination
      return { ...d, destination: `${remote}${path.replace(/^\/+/, '')}` }
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
  function openPicker() {
    const remote = activeRemote || clients[0]?.name || ''
    if (!remote) {
      openSettings('clients')
      return
    }
    const start = activeRemote ? draft.destination.slice(remote.length).split('/').filter(Boolean) : []
    setPickerRemote(remote)
    setPickerStack(start)
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
    setDraft((d) => ({ ...d, destination: `${pickerRemote}${pickerStack.join('/')}` }))
    setPickerOpen(false)
  }

  // ---- wizard ----
  function startWizard() {
    setWizStep(1)
    setWizType(null)
    setWizName('')
    setWizFields({})
    setWizToken('')
    setWizTest({ state: 'idle' })
    setWizardOpen(true)
  }
  const providerCfg = wizType ? PROVIDER_FIELDS[wizType] : null
  const wizNameFinal = wizName || (wizType ? PROVIDER_TYPES.find((p) => p.id === wizType)?.name ?? '' : '')
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
                  <h1 className="sd-editor-title">{draft.name || t.newProfileTitle}</h1>
                </div>
                <div className="sd-editor-actions">
                  <button className="sl-btn sl-btn--ghost sl-btn--sm" disabled={!selectedId} onClick={runOrStop}>{running ? t.stop : t.run}</button>
                  <button className="sl-btn sl-btn--sm" disabled={!canSave || busy === 'save'} onClick={saveProfile}>{t.save}</button>
                </div>
              </div>

              {/* source -> dest */}
              <div className="sd-route">
                <div className="sl-card sd-route__box">
                  <div className="sd-route__label"><span className="ac">01</span> {t.sourceLabel}</div>
                  <div className="sd-route__val">{draft.source || <span className="muted">{t.noFolder}</span>}</div>
                  <button className="sl-btn sl-btn--ghost sl-btn--sm" onClick={browseSource}>{t.browse}</button>
                </div>
                <div className="sd-route__arrow">→</div>
                <div className="sl-card sd-route__box">
                  <div className="sd-route__label"><span className="ac">02</span> {t.destLabel}</div>
                  <div className="sd-route__val">{draft.destination || <span className="muted">{t.noFolder}</span>}</div>
                  <button className="sl-btn sl-btn--ghost sl-btn--sm" onClick={openPicker}>{t.browseCloud}</button>
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
        <StatusBar t={t} accent={accent} running={running} progress={progress} />

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
                    <div className="sd-provgrid">
                      {PROVIDER_TYPES.map((p) => (
                        <button key={p.id} className={`sd-prov${wizType === p.id ? ' is-active' : ''}`} onClick={() => setWizType(p.id)}>
                          <span className="sd-prov__icon"><ProviderGlyph id={p.id} size={24} /></span>
                          <span className="sd-prov__name">{p.name}</span>
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
                      { k: t.wizType, v: PROVIDER_TYPES.find((p) => p.id === wizType)?.name ?? '' },
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
              <div className="sd-modal__body sd-picker__list">
                {pickerBusy ? (
                  <div className="sd-empty">{t.pickerLoading}</div>
                ) : pickerError ? (
                  <div className="sd-empty sd-empty--error">{t.pickerError}</div>
                ) : pickerItems.length === 0 ? (
                  <div className="sd-empty">{t.pickerEmpty}</div>
                ) : (
                  pickerItems.map((it) => (
                    <button key={it.name} className="sd-fileitem" disabled={!it.isDir} onClick={() => it.isDir && pickerInto(it.name)}>
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
function StatusBar({ t, accent, running, progress }: { t: Copy; accent: string; running: boolean; progress: SyncProgress | null }) {
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
        <div className="sd-eq" aria-hidden="true">
          {EQ_BARS.map((b, i) => (
            <span key={i} style={{ transform: `scaleY(${b.base})`, background: b.accent ? accent : `color-mix(in oklch, ${accent} 45%, transparent)`, animationDuration: b.dur, animationDelay: b.delay, animationPlayState: running ? 'running' : 'paused' }} />
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
