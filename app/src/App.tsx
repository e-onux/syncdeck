import { useEffect, useMemo, useState } from 'react'
import { IonApp, IonIcon } from '@ionic/react'
import {
  add,
  close,
  cloudUploadOutline,
  colorPaletteOutline,
  folderOpenOutline,
  informationCircleOutline,
  keyOutline,
  languageOutline,
  play,
  refresh,
  serverOutline,
  save,
  search,
  settingsOutline,
  shieldCheckmarkOutline,
  syncOutline,
  terminalOutline,
  trash,
  warning,
} from 'ionicons/icons'
import type { AppState, RemoteDraft, SyncMode, SyncProfile } from './types'
import './App.css'

const appName = 'SyncDeck'

const emptyProfile = (): SyncProfile => ({
  id: String(Date.now()),
  name: 'Belgeler yedeği',
  source: '',
  destination: '',
  mode: 'sync',
  enabled: true,
  extraArgs: '--exclude .DS_Store',
})

const demoProfile: SyncProfile = {
  id: 'demo-profile',
  name: 'Belgeler yedeği',
  source: '/Users/emironuk/Documents',
  destination: 'Drive:Yedek/Belgeler',
  mode: 'sync',
  enabled: true,
  extraArgs: '--exclude .DS_Store',
}

const createDemoState = (overrides: Partial<AppState> = {}): AppState => ({
  launchAtLogin: false,
  rclonePath: '/opt/homebrew/bin/rclone',
  configPath: 'Electron icinde kullanilir',
  launchAgentPath: '~/Library/LaunchAgents/com.emironuk.rclone-syncer.plist',
  profiles: [demoProfile],
  lastRun: {},
  platform: 'browser',
  remotes: ['Drive:', 'B2:'],
  ...overrides,
})

const demoApi = {
  getState: async (): Promise<AppState> => createDemoState(),
  saveProfile: async (profile: SyncProfile): Promise<AppState> =>
    createDemoState({ profiles: [profile] }),
  deleteProfile: async (): Promise<AppState> => createDemoState({ profiles: [] }),
  chooseFolder: async (): Promise<string | null> => '/Users/emironuk/Documents/Ornek',
  runSync: async (id: string): Promise<AppState> =>
    createDemoState({
      lastRun: {
        [id]: {
          ok: true,
          code: 0,
          finishedAt: new Date().toISOString(),
          output:
            '$ rclone sync "/Users/emironuk/Documents" "Drive:Yedek/Belgeler" --exclude .DS_Store\n\nTransferred: 482.183 MiB / 482.183 MiB, 100%\nChecks: 1240 / 1240, 100%\nTransferred: 38 / 38, 100%\nElapsed time: 21.4s\n\nTamamlandı · 38 dosya aktarıldı, 0 hata',
        },
      },
    }),
  setLaunchAtLogin: async (enabled: boolean): Promise<AppState> =>
    createDemoState({ launchAtLogin: enabled }),
  createRemote: async (remote: RemoteDraft): Promise<AppState> =>
    createDemoState({ remotes: [`${remote.name}:`, 'Drive:', 'B2:'] }),
  openAbout: async (): Promise<void> => undefined,
}

const api = window.rcloneSyncer || demoApi

const accents = {
  Mavi: '#007aff',
  Mor: '#8e5bf2',
  Yeşil: '#34c759',
  Grafit: '#5b6470',
}

type AccentName = keyof typeof accents
const emptyProfiles: SyncProfile[] = []
type SettingsTab = 'appearance' | 'clients' | 'about'

const languages = ['en', 'es', 'de', 'nl', 'zh', 'tr', 'ja', 'ar', 'ru'] as const
type Language = (typeof languages)[number]

const copy = {
  en: {
    subtitle: 'Cloud and folder operations',
    search: 'Search profiles',
    profiles: 'Profiles',
    newProfile: 'New profile',
    ready: 'rclone ready',
    missing: 'rclone not found',
    engineUnavailable: 'SyncDeck engine is unavailable',
    engineUnavailableDetail: 'The bundled sync engine could not be started. Reinstall SyncDeck or build it again with the bundled engine included.',
    run: 'Run now',
    save: 'Save',
    status: 'Status',
    activeProfiles: 'Active profiles',
    startAtLogin: 'Run at startup',
    startupOn: 'Startup item installed',
    off: 'Off',
    profile: 'Profile',
    profileName: 'Profile name',
    profileAtLogin: 'Run this profile at startup',
    profileAtLoginHelp: 'Automatically syncs at login/startup',
    folders: 'Folders',
    source: 'Source',
    destination: 'Destination',
    change: 'Change',
    syncMode: 'Sync mode',
    mirror: 'Mirror sync',
    copyOnly: 'Copy only',
    syncNote: 'Mirror sync makes the destination identical to the source. Files not in the source are deleted from the destination.',
    copyNote: 'Copy only adds files to the destination. Nothing is deleted.',
    advanced: 'Advanced',
    extraArgs: 'Extra engine arguments',
    appearance: 'Appearance',
    clients: 'Clients',
    settings: 'Settings',
    interface: 'Interface',
    addClient: 'Add client',
    openClientSettings: 'Add or manage clients',
    selectClient: 'Select client',
    remotePath: 'Remote path',
    remoteName: 'Remote name',
    remoteType: 'Type',
    clientId: 'Client ID',
    clientSecret: 'Client secret',
    provider: 'Provider',
    auth: 'Authentication',
    commandOptions: 'Command options',
    optionKey: 'Option key',
    optionValue: 'Value',
    addOption: 'Add option',
    existingClients: 'Configured clients',
    noClients: 'No clients yet. Add a client from Settings.',
    lastRun: 'Last run',
    noRecord: 'No record',
    success: 'Successful',
    failed: 'Failed',
    noFolder: 'No folder selected',
    noRun: 'No run record yet. Use "Run now" to test the profile.',
    deleteProfile: 'Delete profile',
    about: 'About',
    appVersion: 'Standalone sync app',
    wrapperNote: 'SyncDeck is a graphical wrapper for rclone. rclone is an independent open-source project by its maintainers.',
  },
  tr: {
    subtitle: 'Bulut ve klasör işlemleri',
    search: 'Profil ara',
    profiles: 'Profiller',
    newProfile: 'Yeni profil',
    ready: 'rclone hazır',
    missing: 'rclone bulunamadı',
    engineUnavailable: 'SyncDeck motoru çalışmıyor',
    engineUnavailableDetail: 'Paketli senkron motoru başlatılamadı. SyncDeck’i yeniden kur veya rclone motoru dahil olacak şekilde tekrar build et.',
    run: 'Şimdi çalıştır',
    save: 'Kaydet',
    status: 'Durum',
    activeProfiles: 'Aktif profiller',
    startAtLogin: 'Açılışta çalıştır',
    startupOn: 'Başlangıç öğesi kurulu',
    off: 'Kapalı',
    profile: 'Profil',
    profileName: 'Profil adı',
    profileAtLogin: 'Bu profili açılışta çalıştır',
    profileAtLoginHelp: 'Login/başlangıç anında otomatik senkronlanır',
    folders: 'Klasörler',
    source: 'Kaynak',
    destination: 'Hedef',
    change: 'Değiştir',
    syncMode: 'Senkron modu',
    mirror: 'Ayna sync',
    copyOnly: 'Sadece kopyala',
    syncNote: 'Ayna sync, hedefi kaynakla birebir aynı hale getirir. Kaynakta olmayan dosyalar hedefte silinir.',
    copyNote: 'Sadece kopyala, dosyaları hedefe ekler. Hiçbir şey silinmez.',
    advanced: 'Gelişmiş',
    extraArgs: 'Ek motor argümanları',
    appearance: 'Görünüm',
    clients: 'Clientlar',
    settings: 'Ayarlar',
    interface: 'Arayüz',
    addClient: 'Client ekle',
    openClientSettings: 'Client ekle veya yönet',
    selectClient: 'Client seç',
    remotePath: 'Remote yolu',
    remoteName: 'Remote adı',
    remoteType: 'Tip',
    clientId: 'Client ID',
    clientSecret: 'Client secret',
    provider: 'Sağlayıcı',
    auth: 'Kimlik doğrulama',
    commandOptions: 'Komut seçenekleri',
    optionKey: 'Seçenek anahtarı',
    optionValue: 'Değer',
    addOption: 'Seçenek ekle',
    existingClients: 'Tanımlı clientlar',
    noClients: 'Henüz client yok. Ayarlardan client ekle.',
    lastRun: 'Son çalışma',
    noRecord: 'Kayıt yok',
    success: 'Başarılı',
    failed: 'Hatalı',
    noFolder: 'Klasör seçilmedi',
    noRun: 'Henüz çalışma kaydı yok. "Şimdi çalıştır" ile profili test edebilirsin.',
    deleteProfile: 'Profili sil',
    about: 'Hakkında',
    appVersion: 'Standalone senkron uygulaması',
    wrapperNote: 'SyncDeck, rclone için grafik arayüzlü bir wrapper’dır. rclone, kendi geliştiricileri tarafından sürdürülen bağımsız açık kaynak projedir.',
  },
}

const translations: Record<Language, typeof copy.en> = {
  en: copy.en,
  tr: copy.tr,
  es: { ...copy.en, subtitle: 'Operaciones de nube y carpetas', search: 'Buscar perfiles', profiles: 'Perfiles', save: 'Guardar', run: 'Ejecutar ahora', about: 'Acerca de' },
  de: { ...copy.en, subtitle: 'Cloud- und Ordneraktionen', search: 'Profile suchen', profiles: 'Profile', save: 'Speichern', run: 'Jetzt ausführen', about: 'Über' },
  nl: { ...copy.en, subtitle: 'Cloud- en mapbewerkingen', search: 'Profielen zoeken', profiles: 'Profielen', save: 'Opslaan', run: 'Nu uitvoeren', about: 'Over' },
  zh: { ...copy.en, subtitle: '云端与文件夹操作', search: '搜索配置', profiles: '配置', save: '保存', run: '立即运行', about: '关于' },
  ja: { ...copy.en, subtitle: 'クラウドとフォルダ操作', search: 'プロファイル検索', profiles: 'プロファイル', save: '保存', run: '今すぐ実行', about: '情報' },
  ar: { ...copy.en, subtitle: 'عمليات السحابة والمجلدات', search: 'بحث في الملفات', profiles: 'الملفات', save: 'حفظ', run: 'تشغيل الآن', about: 'حول' },
  ru: { ...copy.en, subtitle: 'Операции с облаком и папками', search: 'Поиск профилей', profiles: 'Профили', save: 'Сохранить', run: 'Запустить', about: 'О программе' },
}

const remoteTypes = ['drive', 'dropbox', 'onedrive', 's3', 'b2', 'sftp', 'local']

const providerHints: Record<string, Array<{ key: string; label: string; placeholder: string }>> = {
  drive: [
    { key: 'scope', label: 'Scope', placeholder: 'drive' },
    { key: 'root_folder_id', label: 'Root folder ID', placeholder: 'optional' },
    { key: 'team_drive', label: 'Shared drive ID', placeholder: 'optional' },
  ],
  s3: [
    { key: 'provider', label: 'Provider', placeholder: 'AWS' },
    { key: 'access_key_id', label: 'Access key ID', placeholder: 'AKIA...' },
    { key: 'secret_access_key', label: 'Secret access key', placeholder: 'secret' },
    { key: 'region', label: 'Region', placeholder: 'eu-central-1' },
  ],
  sftp: [
    { key: 'host', label: 'Host', placeholder: 'example.com' },
    { key: 'user', label: 'User', placeholder: 'username' },
    { key: 'port', label: 'Port', placeholder: '22' },
    { key: 'key_file', label: 'Key file', placeholder: '/Users/me/.ssh/id_rsa' },
  ],
  b2: [
    { key: 'account', label: 'Account ID', placeholder: 'account id' },
    { key: 'key', label: 'Application key', placeholder: 'application key' },
  ],
  onedrive: [{ key: 'drive_type', label: 'Drive type', placeholder: 'personal | business' }],
}

function shortPath(path: string) {
  if (!path) return ''
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 2) return path
  return `.../${parts.slice(-2).join('/')}`
}

function formatRunTime(value?: string) {
  if (!value) return ''
  return `Son çalışma · ${new Date(value).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`
}

function splitRemoteDestination(destination: string, remotes: string[]) {
  const remote = remotes.find((item) => destination.startsWith(item))
  return {
    remote: remote || '',
    path: remote ? destination.slice(remote.length) : destination,
  }
}

function buildRemoteDestination(remote: string, remotePath: string) {
  if (!remote) return remotePath
  return `${remote}${remotePath.replace(/^\/+/, '')}`
}

function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [draft, setDraft] = useState<SyncProfile>(emptyProfile)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [accentName, setAccentName] = useState<AccentName>('Mavi')
  const [language, setLanguage] = useState<Language>('tr')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('appearance')
  const [remoteDraft, setRemoteDraft] = useState<RemoteDraft>({
    name: '',
    type: 'drive',
    clientId: '',
    clientSecret: '',
    options: [],
    extraArgs: '',
  })

  const accent = accents[accentName]
  const t = translations[language]
  const profiles = state?.profiles ?? emptyProfiles
  const selectedRun = selectedId && state ? state.lastRun[selectedId] : null
  const canSave = Boolean(draft.name.trim() && draft.source.trim() && draft.destination.trim())
  const activeCount = profiles.filter((profile) => profile.enabled).length
  const remotes = state?.remotes ?? []
  const destinationParts = splitRemoteDestination(draft.destination, remotes)

  const filteredProfiles = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR')
    if (!needle) return profiles
    return profiles.filter((profile) =>
      `${profile.name} ${profile.source} ${profile.destination}`
        .toLocaleLowerCase('tr-TR')
        .includes(needle),
    )
  }, [profiles, query])

  async function load(preferredId = selectedId) {
    setError(null)
    const nextState = await api.getState()
    setState(nextState)
    const nextProfile =
      nextState.profiles.find((profile) => profile.id === preferredId) || nextState.profiles[0]
    if (nextProfile) {
      setSelectedId(nextProfile.id)
      setDraft(nextProfile)
    }
  }

  useEffect(() => {
    let mounted = true
    api
      .getState()
      .then((nextState) => {
        if (!mounted) return
        setState(nextState)
        const firstProfile = nextState.profiles[0]
        if (firstProfile) {
          setSelectedId(firstProfile.id)
          setDraft(firstProfile)
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message)
      })
    return () => {
      mounted = false
    }
  }, [])

  async function choosePath(field: 'source' | 'destination') {
    const folder = await api.chooseFolder()
    if (folder) setDraft((current) => ({ ...current, [field]: folder }))
  }

  async function saveProfile() {
    if (!canSave) return
    setBusy('save')
    setError(null)
    try {
      const nextState = await api.saveProfile(draft)
      setState(nextState)
      setSelectedId(draft.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function deleteProfile() {
    if (!selectedId) return
    setBusy('delete')
    setError(null)
    try {
      const nextState = await api.deleteProfile(selectedId)
      setState(nextState)
      const nextProfile = nextState.profiles[0] || emptyProfile()
      setSelectedId(nextState.profiles[0]?.id || null)
      setDraft(nextProfile)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function runNow() {
    if (!selectedId) return
    setBusy('run')
    setError(null)
    try {
      setState(await api.runSync(selectedId))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function toggleLaunchAtLogin() {
    setBusy('launch')
    setError(null)
    try {
      setState(await api.setLaunchAtLogin(!state?.launchAtLogin))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function createRemote() {
    if (!remoteDraft.name.trim() || !remoteDraft.type.trim()) return
    setBusy('remote')
    setError(null)
    try {
      setState(await api.createRemote(remoteDraft))
      setRemoteDraft({ name: '', type: 'drive', clientId: '', clientSecret: '', options: [], extraArgs: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  function startNewProfile() {
    const profile = emptyProfile()
    setDraft(profile)
    setSelectedId(null)
  }

  function selectProfile(profile: SyncProfile) {
    setSelectedId(profile.id)
    setDraft(profile)
  }

  function setMode(mode: SyncMode) {
    setDraft((current) => ({ ...current, mode }))
  }

  function openSettings(tab: SettingsTab = 'appearance') {
    setSettingsTab(tab)
    setSettingsOpen(true)
  }

  function setDestinationRemote(remote: string) {
    setDraft((current) => ({
      ...current,
      destination: buildRemoteDestination(remote, splitRemoteDestination(current.destination, remotes).path),
    }))
  }

  function setDestinationPath(remotePath: string) {
    setDraft((current) => ({
      ...current,
      destination: buildRemoteDestination(splitRemoteDestination(current.destination, remotes).remote, remotePath),
    }))
  }

  function setRemoteOption(index: number, field: 'key' | 'value', value: string) {
    setRemoteDraft((current) => ({
      ...current,
      options: (current.options || []).map((option, optionIndex) =>
        optionIndex === index ? { ...option, [field]: value } : option,
      ),
    }))
  }

  function addRemoteOption(key = '', value = '') {
    setRemoteDraft((current) => ({
      ...current,
      options: [...(current.options || []), { key, value }],
    }))
  }

  function removeRemoteOption(index: number) {
    setRemoteDraft((current) => ({
      ...current,
      options: (current.options || []).filter((_option, optionIndex) => optionIndex !== index),
    }))
  }

  if (state && !state.rclonePath) {
    return (
      <IonApp>
        <main className="engine-block" style={{ '--accent': accent } as React.CSSProperties}>
          <section>
            <div className="engine-icon">
              <IonIcon icon={warning} />
            </div>
            <h1>{t.engineUnavailable}</h1>
            <p>{t.engineUnavailableDetail}</p>
            <div className="engine-actions">
              <button className="primary-button" onClick={() => load()}>
                <IonIcon icon={refresh} />
                {language === 'tr' ? 'Tekrar dene' : 'Retry'}
              </button>
              <button className="toolbar-button" onClick={() => api.openAbout()}>
                <IonIcon icon={informationCircleOutline} />
                {t.about}
              </button>
            </div>
          </section>
        </main>
      </IonApp>
    )
  }

  return (
    <IonApp>
      <main
        className="mac-stage"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        style={{ '--accent': accent } as React.CSSProperties}
      >
        <section className="mac-window">
          <aside className="sidebar">
            <div className="app-identity">
              <div className="app-icon">
                <IonIcon icon={syncOutline} />
              </div>
              <div>
                <strong>{appName}</strong>
                <span>{t.subtitle}</span>
              </div>
            </div>

            <label className="search-field">
              <IonIcon icon={search} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.search}
              />
            </label>

            <div className="sidebar-section">
              <span>{t.profiles}</span>
              <strong>{profiles.length}</strong>
            </div>

            <div className="profile-list">
              {filteredProfiles.map((profile) => {
                const selected = profile.id === selectedId
                return (
                  <button
                    key={profile.id}
                    className={`profile-row ${selected ? 'selected' : ''}`}
                    style={{ opacity: profile.enabled ? 1 : 0.52 }}
                    onClick={() => selectProfile(profile)}
                  >
                    <span className="profile-tile">
                      <IonIcon icon={folderOpenOutline} />
                    </span>
                      <span className="profile-copy">
                        <strong>{profile.name}</strong>
                      <small>{shortPath(profile.source) || t.noFolder}</small>
                      </span>
                      <span className="profile-badge">{profile.mode === 'sync' ? 'Ayna' : 'Kopya'}</span>
                  </button>
                )
              })}
            </div>

            <div className="sidebar-actions">
              <button className="ghost-button" onClick={startNewProfile}>
                <IonIcon icon={add} />
                {t.newProfile}
              </button>
            </div>

          </aside>

          <section className="content-pane">
            <header className="toolbar">
              <strong>{draft.name || 'Yeni profil'}</strong>
              <div className="toolbar-actions">
                <button className="toolbar-button icon-only" onClick={() => load()} aria-label="Yenile">
                  <IonIcon icon={refresh} />
                </button>
                <button className="toolbar-button" disabled={!selectedId || busy === 'run'} onClick={runNow}>
                  <IonIcon icon={play} />
                  {t.run}
                </button>
                <button className="primary-button" disabled={!canSave || busy === 'save'} onClick={saveProfile}>
                  <IonIcon icon={save} />
                  {t.save}
                </button>
                <button className="toolbar-button icon-only" onClick={() => openSettings()} aria-label={t.settings}>
                  <IonIcon icon={settingsOutline} />
                </button>
              </div>
            </header>

            <div className="settings-scroll">
              <div className="settings-body">
                {error && (
                  <div className="error-banner">
                    <IonIcon icon={warning} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} aria-label="Hatayı kapat">
                      <IonIcon icon={close} />
                    </button>
                  </div>
                )}

                <section className="setting-group">
                  <h2>{t.status}</h2>
                  <div className="group-card">
                    <div className="setting-row">
                      <IonIcon icon={cloudUploadOutline} />
                      <span>{t.activeProfiles}</span>
                      <strong>{activeCount} / {profiles.length}</strong>
                    </div>
                    <div className="setting-row">
                      <IonIcon icon={syncOutline} />
                      <div className="row-copy">
                        <span>{t.startAtLogin}</span>
                        <small>{state?.launchAtLogin ? t.startupOn : t.off}</small>
                      </div>
                      <button
                        className={`switch ${state?.launchAtLogin ? 'on' : ''}`}
                        disabled={busy === 'launch'}
                        onClick={toggleLaunchAtLogin}
                        aria-label="Mac açılışında çalıştır"
                      >
                        <span />
                      </button>
                    </div>
                  </div>
                </section>

                <section className="setting-group">
                  <h2>{t.profile}</h2>
                  <div className="group-card">
                    <label className="setting-row">
                      <span>{t.profileName}</span>
                      <input
                        className="inline-input"
                        value={draft.name}
                        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                        placeholder={t.profileName}
                      />
                    </label>
                    <div className="setting-row">
                      <div className="row-copy">
                        <span>{t.profileAtLogin}</span>
                        <small>{t.profileAtLoginHelp}</small>
                      </div>
                      <button
                        className={`switch ${draft.enabled ? 'on' : ''}`}
                        onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
                        aria-label="Bu profili açılışta çalıştır"
                      >
                        <span />
                      </button>
                    </div>
                  </div>
                </section>

                <section className="setting-group">
                  <h2>{t.folders}</h2>
                  <div className="group-card">
                    <div className="setting-row folder-row">
                      <IonIcon icon={folderOpenOutline} />
                      <div className="row-copy">
                        <small>{t.source}</small>
                        <span className={draft.source ? '' : 'muted'}>{draft.source || t.noFolder}</span>
                      </div>
                      <button className="small-button" onClick={() => choosePath('source')}>
                        {t.change}
                      </button>
                    </div>
                    <div className="setting-row folder-row">
                      <IonIcon icon={folderOpenOutline} />
                      <div className="row-copy">
                        <small>{t.destination}</small>
                        {remotes.length > 0 ? (
                          <div className="destination-controls">
                            <select
                              value={destinationParts.remote}
                              onChange={(event) => setDestinationRemote(event.target.value)}
                              aria-label={t.selectClient}
                            >
                              <option value="">{t.selectClient}</option>
                              {remotes.map((remote) => (
                                <option key={remote} value={remote}>
                                  {remote}
                                </option>
                              ))}
                            </select>
                            <input
                              value={destinationParts.path}
                              onChange={(event) => setDestinationPath(event.target.value)}
                              placeholder={t.remotePath}
                            />
                          </div>
                        ) : (
                          <span className="muted">{t.noClients}</span>
                        )}
                      </div>
                      <button className="small-button" onClick={() => openSettings('clients')}>
                        {t.openClientSettings}
                      </button>
                    </div>
                  </div>
                </section>

                <section className="setting-group">
                  <h2>{t.syncMode}</h2>
                  <div className="group-card padded">
                    <div className="segmented-control">
                      <button className={draft.mode === 'sync' ? 'active' : ''} onClick={() => setMode('sync')}>
                        {t.mirror}
                      </button>
                      <button className={draft.mode === 'copy' ? 'active' : ''} onClick={() => setMode('copy')}>
                        {t.copyOnly}
                      </button>
                    </div>
                    <p className="mode-note">
                      {draft.mode === 'sync' ? t.syncNote : t.copyNote}
                    </p>
                  </div>
                </section>

                <section className="setting-group">
                  <h2>{t.advanced}</h2>
                  <div className="group-card padded">
                    <label className="textarea-label" htmlFor="extra-args">
                      {t.extraArgs}
                    </label>
                    <textarea
                      id="extra-args"
                      value={draft.extraArgs}
                      onChange={(event) => setDraft({ ...draft, extraArgs: event.target.value })}
                      placeholder="--exclude .DS_Store"
                    />
                  </div>
                </section>

                <section className="setting-group">
                  <div className="section-title-row">
                    <h2>{t.lastRun}</h2>
                    <span className={`run-badge ${selectedRun ? (selectedRun.ok ? 'ok' : 'danger') : ''}`}>
                      {selectedRun ? (selectedRun.ok ? t.success : t.failed) : t.noRecord}
                    </span>
                  </div>
                  <div className="terminal-card">
                    <div className="terminal-top">
                      <span className={`terminal-dot ${selectedRun?.ok ? 'ok' : ''}`} />
                      <small>{formatRunTime(selectedRun?.finishedAt) || t.noRecord}</small>
                    </div>
                    <pre>
                      {selectedRun?.output ||
                        t.noRun}
                    </pre>
                  </div>
                </section>

                <div className="delete-row">
                  <button className="delete-button" disabled={!selectedId || busy === 'delete'} onClick={deleteProfile}>
                    <IonIcon icon={trash} />
                    {t.deleteProfile}
                  </button>
                </div>

              </div>
            </div>
          </section>
        </section>

        {settingsOpen && (
          <div className="settings-overlay" role="presentation">
            <section className="settings-window" role="dialog" aria-modal="true" aria-label={t.settings}>
              <header className="settings-header">
                <strong>{t.settings}</strong>
                <button className="toolbar-button icon-only" onClick={() => setSettingsOpen(false)} aria-label="Kapat">
                  <IonIcon icon={close} />
                </button>
              </header>

              <div className="settings-layout">
                <nav className="settings-tabs" aria-label={t.settings}>
                  <button
                    className={settingsTab === 'appearance' ? 'active' : ''}
                    onClick={() => setSettingsTab('appearance')}
                  >
                    <IonIcon icon={colorPaletteOutline} />
                    <span>{t.interface}</span>
                  </button>
                  <button
                    className={settingsTab === 'clients' ? 'active' : ''}
                    onClick={() => setSettingsTab('clients')}
                  >
                    <IonIcon icon={serverOutline} />
                    <span>{t.clients}</span>
                  </button>
                  <button
                    className={settingsTab === 'about' ? 'active' : ''}
                    onClick={() => setSettingsTab('about')}
                  >
                    <IonIcon icon={informationCircleOutline} />
                    <span>{t.about}</span>
                  </button>
                </nav>

                <div className="settings-panel">
                  {settingsTab === 'appearance' && (
                    <section className="setting-group">
                      <h2>{t.appearance}</h2>
                      <div className="group-card padded">
                        <label className="select-line">
                          <span>
                            <IonIcon icon={languageOutline} />
                            Language
                          </span>
                          <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
                            {languages.map((item) => (
                              <option key={item} value={item}>
                                {item.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="accent-picker">
                          {(Object.keys(accents) as AccentName[]).map((name) => (
                            <button
                              key={name}
                              className={name === accentName ? 'active' : ''}
                              onClick={() => setAccentName(name)}
                            >
                              <span style={{ background: accents[name] }} />
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}

                  {settingsTab === 'clients' && (
                    <section className="setting-group">
                      <h2>{t.clients}</h2>
                      <div className="client-wizard">
                        <div className="wizard-column">
                          <div className="wizard-step">
                            <span className="step-icon">
                              <IonIcon icon={serverOutline} />
                            </span>
                            <div>
                              <strong>{t.provider}</strong>
                              <div className="remote-grid">
                                <input
                                  value={remoteDraft.name}
                                  onChange={(event) => setRemoteDraft({ ...remoteDraft, name: event.target.value })}
                                  placeholder={t.remoteName}
                                />
                                <select
                                  value={remoteDraft.type}
                                  onChange={(event) =>
                                    setRemoteDraft({ ...remoteDraft, type: event.target.value, options: [] })
                                  }
                                >
                                  {remoteTypes.map((type) => (
                                    <option key={type} value={type}>
                                      {type}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className="wizard-step">
                            <span className="step-icon">
                              <IonIcon icon={keyOutline} />
                            </span>
                            <div>
                              <strong>{t.auth}</strong>
                              <div className="remote-grid">
                                <input
                                  value={remoteDraft.clientId}
                                  onChange={(event) => setRemoteDraft({ ...remoteDraft, clientId: event.target.value })}
                                  placeholder={t.clientId}
                                />
                                <input
                                  type="password"
                                  value={remoteDraft.clientSecret}
                                  onChange={(event) =>
                                    setRemoteDraft({ ...remoteDraft, clientSecret: event.target.value })
                                  }
                                  placeholder={t.clientSecret}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="wizard-step">
                            <span className="step-icon">
                              <IonIcon icon={terminalOutline} />
                            </span>
                            <div>
                              <strong>{t.commandOptions}</strong>
                              <div className="preset-list">
                                {(providerHints[remoteDraft.type] || []).map((hint) => (
                                  <button key={hint.key} onClick={() => addRemoteOption(hint.key, '')}>
                                    {hint.label}
                                  </button>
                                ))}
                              </div>
                              <div className="option-list">
                                {(remoteDraft.options || []).map((option, index) => (
                                  <div className="option-row" key={`${option.key}-${index}`}>
                                    <input
                                      value={option.key}
                                      onChange={(event) => setRemoteOption(index, 'key', event.target.value)}
                                      placeholder={t.optionKey}
                                    />
                                    <input
                                      value={option.value}
                                      onChange={(event) => setRemoteOption(index, 'value', event.target.value)}
                                      placeholder={
                                        providerHints[remoteDraft.type]?.find((hint) => hint.key === option.key)
                                          ?.placeholder || t.optionValue
                                      }
                                    />
                                    <button className="toolbar-button icon-only" onClick={() => removeRemoteOption(index)}>
                                      <IonIcon icon={trash} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <button className="small-button" onClick={() => addRemoteOption()}>
                                <IonIcon icon={add} />
                                {t.addOption}
                              </button>
                              <textarea
                                className="remote-extra"
                                value={remoteDraft.extraArgs}
                                onChange={(event) => setRemoteDraft({ ...remoteDraft, extraArgs: event.target.value })}
                                placeholder="scope drive config_is_local false"
                              />
                            </div>
                          </div>
                        </div>

                        <aside className="client-summary">
                          <strong>{t.existingClients}</strong>
                          <div className="remote-chip-list">
                            {remotes.length > 0
                              ? remotes.map((remote) => <span key={remote}>{remote}</span>)
                              : <small>{t.noClients}</small>}
                          </div>
                          <button className="primary-button" disabled={busy === 'remote'} onClick={createRemote}>
                            <IonIcon icon={serverOutline} />
                            {t.addClient}
                          </button>
                        </aside>
                      </div>
                    </section>
                  )}

                  {settingsTab === 'about' && (
                    <section className="setting-group">
                      <h2>{t.about}</h2>
                      <div className="about-panel">
                        <div className="app-icon large">
                          <IonIcon icon={syncOutline} />
                        </div>
                        <div>
                          <h3>{appName}</h3>
                          <p>{t.appVersion}</p>
                        </div>
                        <div className="about-callout">
                          <IonIcon icon={shieldCheckmarkOutline} />
                          <p>{t.wrapperNote}</p>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </IonApp>
  )
}

export default App
