/**
 * SyncDeck site copy, one entry per language the desktop app ships.
 *
 * Values may contain a little inline HTML (<strong>, <b>, <a>) — they are
 * inserted into the template verbatim, so keep them trusted and well-formed.
 * `{version}` is substituted at build time from website/package.json.
 *
 * Every locale must define the same keys; build.mjs fails the build otherwise.
 */

export const DEFAULT_LANG = 'tr';

export const LOCALES = {
  tr: {
    name: 'Türkçe',
    dir: 'ltr',
    title: 'SyncDeck · Klasörlerini sessizce senkronize et',
    description:
      'SyncDeck · rclone için sakin bir masaüstü arayüzü. Herhangi bir yerel klasörü dilediğin buluta mount etmeden eşitle — ayna sync ya da güvenli kopyala. macOS, Windows ve Linux.',
    ogTitle: 'SyncDeck · Klasörlerini sessizce senkronize et',
    ogDescription:
      'rclone için sakin bir masaüstü arayüzü. Mount etmeden eşitle — ayna sync ya da güvenli kopyala.',

    navFeatures: 'Özellikler',
    navModes: 'Modlar',
    navProviders: 'Sağlayıcılar',
    navDownload: 'İndir',

    heroEyebrow: 'Klasör senkronizasyonu',
    heroTitlePre: 'Klasörlerini',
    heroTitlePost: 'senkronize et',
    heroWords: ['sessizce', 'güvenle', 'akıllıca', 'hızlıca', 'uçarak', 'tamamiyle', 'mutlu mutlu'],
    heroLede:
      'Herhangi bir yerel klasörü dilediğin buluta <strong>mount etmeden</strong> eşitle. Ayna sync ya da güvenli kopyala, profili kur, açılışta sessizce çalışsın.',
    heroCtaMac: 'macOS için indir',
    heroCtaSource: 'Kaynağı gör',
    heroNote: 'Apple Silicon · Sürüm {version} · Windows &amp; Linux da mevcut',

    mockAria: 'SyncDeck uygulama penceresi: Belgeler yedeği profili senkronize ediliyor',
    mockConnected: 'Bağlı',
    mockProfiles: 'Profiller · 03',
    mockProf1: 'Belgeler yedeği',
    mockProf1Tag: 'AYNA · isdrive:',
    mockProf2: 'Fotoğraf arşivi',
    mockProf2Tag: 'KOPYA · arsiv:',
    mockProf3: 'Proje kaynağı',
    mockProf3Tag: 'AYNA · b2cold:',
    mockKicker: 'Sync profili · aktif',
    mockSource: 'KAYNAK',
    mockTarget: 'HEDEF',
    mockLog: 'Canlı günlük',
    mockLogLine: '↻ isdrive:Yedekler aktarılıyor…',
    mockSyncing: 'Senkronize ediliyor',
    mockMeta: '24 / 38 dosya · ETA 00:42',

    providersLabel: 'Açık kaynak motorun desteklediği <b>70+</b> bulut arka ucuyla çalışır',

    featKicker: 'Ne yapar',
    featH2: 'Bir terminal kadar güçlü, bir uygulama kadar sakin.',
    f1Title: 'Sync profilleri',
    f1Kicker: 'Kaynak · hedef · mod',
    f1Body:
      'Kaynak, hedef, mod ve ek argümanları tek bir profilde sakla. İstediğin kadar oluştur, sol panelden anında geç.',
    f1Tag: 'Profil',
    f2Title: 'Ayna sync &amp; kopyala',
    f2Kicker: 'Tam kontrol',
    f2Body:
      'Hedefi birebir aynala ya da yalnızca dosya ekle. Hiçbir şey beklenmedik şekilde silinmez, kontrol sende.',
    f2Tag: 'Mod',
    f3Title: 'Açılışta otomatik',
    f3Kicker: 'Kur ve unut',
    f3Body:
      'Etkin profiller her girişte sessizce çalışır. LaunchAgent ya da login item ile sistemine entegre olur.',
    f3Tag: 'Otomasyon',
    f4Title: 'Mount gerektirmez',
    f4Kicker: 'Hızlı &amp; temiz',
    f4Body: 'Doğrudan sync ve copy çağrılır. Sürücü bağlamaya, sanal disk oluşturmaya gerek yok.',
    f4Tag: 'Motor',
    f5Title: 'İstemci sihirbazı',
    f5Kicker: 'GUI → komut satırı',
    f5Body:
      'Yeni bulut bağlantısını adım adım kur. SyncDeck arka plandaki motor komutunu senin için oluşturur ve çalıştırır.',
    f5Tag: 'Sihirbaz',
    f6Title: '9 dil desteği',
    f6Kicker: 'Çok dilli arayüz',
    f6Body: 'İngilizce, Türkçe, Almanca, İspanyolca, Çince, Japonca, Rusça, Felemenkçe ve Arapça olarak hazır.',
    f6Tag: 'i18n',

    modesKicker: 'İki mod',
    modesH2: 'Yansıt ya da koru — kararı sen ver.',
    mode1Title: 'Ayna sync',
    mode1Body:
      'Hedefi kaynakla birebir aynı hale getirir. Kaynakta olmayan dosyalar hedefte de silinir — tam bir yansıma istediğinde.',
    mode2Title: 'Sadece kopyala',
    mode2Body:
      'Dosyaları hedefe ekler, hiçbir şeyi silmez. Daha temkinli kullanım için güvenli seçim — geri dönüşsüz veri kaybı riski yok.',

    dlKicker: 'İndir',
    dlH2: 'Her masaüstünde çalışır.',
    dlLede:
      'Sürüm {version} · bağımsız derlemeler. <span class="ac">Motor dahili gelir — ayrıca kurulum gerekmez.</span>',
    dlMacDetail: 'Apple Silicon · 12+',
    dlWinDetail: 'x64 · 10+',
    dlLinuxDetail: 'x64',
    dlNote: 'Tüm derlemeler <a href="https://github.com/e-onux/syncdeck/releases">GitHub Releases</a> sayfasında',

    footDesc:
      'Açık kaynak rclone motoru için sakin bir masaüstü sarmalayıcısı (wrapper). <a href="https://sidrelabs.com">Sidre Labs</a> tarafından geliştirildi.',
    footProduct: 'Ürün',
    footModesLink: 'Senkron modları',
    footSource: 'Kaynak',
    footReleases: 'Sürümler',
    footContact: 'Bağlantı',
    footIssues: 'Sorun bildir',
    footTrademark: 'rclone, bağımsız açık kaynak proje ekibinin markasıdır.',
    footLang: 'Dil',
  },

  en: {
    name: 'English',
    dir: 'ltr',
    title: 'SyncDeck · Sync your folders quietly',
    description:
      'SyncDeck · a calm desktop interface for rclone. Sync any local folder to any cloud without mounting — mirror sync or safe copy. macOS, Windows and Linux.',
    ogTitle: 'SyncDeck · Sync your folders quietly',
    ogDescription: 'A calm desktop interface for rclone. Sync without mounting — mirror sync or safe copy.',

    navFeatures: 'Features',
    navModes: 'Modes',
    navProviders: 'Providers',
    navDownload: 'Download',

    heroEyebrow: 'Folder synchronisation',
    heroTitlePre: 'Sync your folders',
    heroTitlePost: '',
    heroWords: ['quietly', 'securely', 'smartly', 'quickly', 'effortlessly', 'completely', 'happily'],
    heroLede:
      'Sync any local folder to the cloud of your choice <strong>without mounting a drive</strong>. Mirror sync or safe copy, set up a profile, let it run quietly at login.',
    heroCtaMac: 'Download for macOS',
    heroCtaSource: 'View the source',
    heroNote: 'Apple Silicon · Version {version} · Windows &amp; Linux also available',

    mockAria: 'SyncDeck app window: the Documents backup profile is syncing',
    mockConnected: 'Connected',
    mockProfiles: 'Profiles · 03',
    mockProf1: 'Documents backup',
    mockProf1Tag: 'MIRROR · isdrive:',
    mockProf2: 'Photo archive',
    mockProf2Tag: 'COPY · archive:',
    mockProf3: 'Project source',
    mockProf3Tag: 'MIRROR · b2cold:',
    mockKicker: 'Sync profile · active',
    mockSource: 'SOURCE',
    mockTarget: 'TARGET',
    mockLog: 'Live log',
    mockLogLine: '↻ transferring isdrive:Backups…',
    mockSyncing: 'Syncing',
    mockMeta: '24 / 38 files · ETA 00:42',

    providersLabel: 'Works with the <b>70+</b> cloud backends the open-source engine supports',

    featKicker: 'What it does',
    featH2: 'As capable as a terminal, as calm as an app.',
    f1Title: 'Sync profiles',
    f1Kicker: 'Source · target · mode',
    f1Body:
      'Keep the source, target, mode and extra arguments in a single profile. Create as many as you like and switch instantly from the sidebar.',
    f1Tag: 'Profile',
    f2Title: 'Mirror sync &amp; copy',
    f2Kicker: 'Full control',
    f2Body:
      'Mirror the target exactly, or only add files. Nothing is deleted unexpectedly — you stay in control.',
    f2Tag: 'Mode',
    f3Title: 'Automatic at login',
    f3Kicker: 'Set and forget',
    f3Body:
      'Enabled profiles run quietly at every login, integrated with your system through a LaunchAgent or login item.',
    f3Tag: 'Automation',
    f4Title: 'No mounting required',
    f4Kicker: 'Fast &amp; clean',
    f4Body: 'Sync and copy are called directly. No drives to mount, no virtual disks to create.',
    f4Tag: 'Engine',
    f5Title: 'Client wizard',
    f5Kicker: 'GUI → command line',
    f5Body:
      'Set up a new cloud connection step by step. SyncDeck builds and runs the underlying engine command for you.',
    f5Tag: 'Wizard',
    f6Title: '9 languages',
    f6Kicker: 'Multilingual interface',
    f6Body: 'Ready in English, Turkish, German, Spanish, Chinese, Japanese, Russian, Dutch and Arabic.',
    f6Tag: 'i18n',

    modesKicker: 'Two modes',
    modesH2: 'Mirror it or preserve it — your call.',
    mode1Title: 'Mirror sync',
    mode1Body:
      'Makes the target identical to the source. Files missing from the source are deleted at the target too — for when you want an exact reflection.',
    mode2Title: 'Copy only',
    mode2Body:
      'Adds files to the target and deletes nothing. The safe choice for more cautious use — no risk of irreversible data loss.',

    dlKicker: 'Download',
    dlH2: 'Runs on every desktop.',
    dlLede:
      'Version {version} · standalone builds. <span class="ac">The engine is bundled — no separate install needed.</span>',
    dlMacDetail: 'Apple Silicon · 12+',
    dlWinDetail: 'x64 · 10+',
    dlLinuxDetail: 'x64',
    dlNote: 'All builds are on the <a href="https://github.com/e-onux/syncdeck/releases">GitHub Releases</a> page',

    footDesc:
      'A calm desktop wrapper for the open-source rclone engine. Built by <a href="https://sidrelabs.com">Sidre Labs</a>.',
    footProduct: 'Product',
    footModesLink: 'Sync modes',
    footSource: 'Source',
    footReleases: 'Releases',
    footContact: 'Contact',
    footIssues: 'Report an issue',
    footTrademark: 'rclone is a trademark of the independent open-source project team.',
    footLang: 'Language',
  },

  de: {
    name: 'Deutsch',
    dir: 'ltr',
    title: 'SyncDeck · Synchronisiere deine Ordner leise',
    description:
      'SyncDeck · eine ruhige Desktop-Oberfläche für rclone. Synchronisiere jeden lokalen Ordner mit jeder Cloud, ohne zu mounten — Spiegel-Sync oder sicheres Kopieren. macOS, Windows und Linux.',
    ogTitle: 'SyncDeck · Synchronisiere deine Ordner leise',
    ogDescription:
      'Eine ruhige Desktop-Oberfläche für rclone. Synchronisieren ohne Mounten — Spiegel-Sync oder sicheres Kopieren.',

    navFeatures: 'Funktionen',
    navModes: 'Modi',
    navProviders: 'Anbieter',
    navDownload: 'Download',

    heroEyebrow: 'Ordner-Synchronisierung',
    heroTitlePre: 'Synchronisiere deine Ordner',
    heroTitlePost: '',
    heroWords: ['leise', 'sicher', 'clever', 'schnell', 'mühelos', 'vollständig', 'entspannt'],
    heroLede:
      'Synchronisiere jeden lokalen Ordner mit der Cloud deiner Wahl — <strong>ohne Laufwerk zu mounten</strong>. Spiegel-Sync oder sicheres Kopieren, Profil anlegen, beim Anmelden leise laufen lassen.',
    heroCtaMac: 'Für macOS laden',
    heroCtaSource: 'Quellcode ansehen',
    heroNote: 'Apple Silicon · Version {version} · Windows &amp; Linux ebenfalls verfügbar',

    mockAria: 'SyncDeck-Fenster: Das Profil „Dokumente-Backup“ wird synchronisiert',
    mockConnected: 'Verbunden',
    mockProfiles: 'Profile · 03',
    mockProf1: 'Dokumente-Backup',
    mockProf1Tag: 'SPIEGEL · isdrive:',
    mockProf2: 'Fotoarchiv',
    mockProf2Tag: 'KOPIE · archiv:',
    mockProf3: 'Projektquelle',
    mockProf3Tag: 'SPIEGEL · b2cold:',
    mockKicker: 'Sync-Profil · aktiv',
    mockSource: 'QUELLE',
    mockTarget: 'ZIEL',
    mockLog: 'Live-Protokoll',
    mockLogLine: '↻ isdrive:Backups wird übertragen…',
    mockSyncing: 'Wird synchronisiert',
    mockMeta: '24 / 38 Dateien · ETA 00:42',

    providersLabel: 'Funktioniert mit den <b>70+</b> Cloud-Backends, die die Open-Source-Engine unterstützt',

    featKicker: 'Was es kann',
    featH2: 'So mächtig wie ein Terminal, so ruhig wie eine App.',
    f1Title: 'Sync-Profile',
    f1Kicker: 'Quelle · Ziel · Modus',
    f1Body:
      'Quelle, Ziel, Modus und zusätzliche Argumente in einem Profil speichern. Beliebig viele anlegen und in der Seitenleiste sofort wechseln.',
    f1Tag: 'Profil',
    f2Title: 'Spiegel-Sync &amp; Kopie',
    f2Kicker: 'Volle Kontrolle',
    f2Body:
      'Das Ziel exakt spiegeln oder nur Dateien hinzufügen. Nichts wird unerwartet gelöscht — du behältst die Kontrolle.',
    f2Tag: 'Modus',
    f3Title: 'Automatisch beim Start',
    f3Kicker: 'Einrichten und vergessen',
    f3Body:
      'Aktive Profile laufen bei jeder Anmeldung leise — über einen LaunchAgent oder ein Login-Item ins System integriert.',
    f3Tag: 'Automatisierung',
    f4Title: 'Kein Mounten nötig',
    f4Kicker: 'Schnell &amp; sauber',
    f4Body:
      'Sync und Copy werden direkt aufgerufen. Keine Laufwerke einhängen, keine virtuellen Datenträger anlegen.',
    f4Tag: 'Engine',
    f5Title: 'Client-Assistent',
    f5Kicker: 'GUI → Kommandozeile',
    f5Body:
      'Richte eine neue Cloud-Verbindung Schritt für Schritt ein. SyncDeck erzeugt und startet den passenden Engine-Befehl für dich.',
    f5Tag: 'Assistent',
    f6Title: '9 Sprachen',
    f6Kicker: 'Mehrsprachige Oberfläche',
    f6Body: 'Verfügbar in Englisch, Türkisch, Deutsch, Spanisch, Chinesisch, Japanisch, Russisch, Niederländisch und Arabisch.',
    f6Tag: 'i18n',

    modesKicker: 'Zwei Modi',
    modesH2: 'Spiegeln oder bewahren — du entscheidest.',
    mode1Title: 'Spiegel-Sync',
    mode1Body:
      'Macht das Ziel mit der Quelle identisch. Dateien, die in der Quelle fehlen, werden auch im Ziel gelöscht — für eine exakte Abbildung.',
    mode2Title: 'Nur kopieren',
    mode2Body:
      'Fügt Dateien im Ziel hinzu und löscht nichts. Die sichere Wahl für vorsichtigeren Einsatz — kein Risiko unwiederbringlichen Datenverlusts.',

    dlKicker: 'Download',
    dlH2: 'Läuft auf jedem Desktop.',
    dlLede:
      'Version {version} · eigenständige Builds. <span class="ac">Die Engine ist enthalten — keine separate Installation nötig.</span>',
    dlMacDetail: 'Apple Silicon · 12+',
    dlWinDetail: 'x64 · 10+',
    dlLinuxDetail: 'x64',
    dlNote: 'Alle Builds findest du auf der <a href="https://github.com/e-onux/syncdeck/releases">GitHub-Releases</a>-Seite',

    footDesc:
      'Ein ruhiger Desktop-Wrapper für die Open-Source-Engine rclone. Entwickelt von <a href="https://sidrelabs.com">Sidre Labs</a>.',
    footProduct: 'Produkt',
    footModesLink: 'Sync-Modi',
    footSource: 'Quelle',
    footReleases: 'Releases',
    footContact: 'Kontakt',
    footIssues: 'Problem melden',
    footTrademark: 'rclone ist eine Marke des unabhängigen Open-Source-Projektteams.',
    footLang: 'Sprache',
  },

  es: {
    name: 'Español',
    dir: 'ltr',
    title: 'SyncDeck · Sincroniza tus carpetas en silencio',
    description:
      'SyncDeck · una interfaz de escritorio serena para rclone. Sincroniza cualquier carpeta local con cualquier nube sin montar unidades: sync espejo o copia segura. macOS, Windows y Linux.',
    ogTitle: 'SyncDeck · Sincroniza tus carpetas en silencio',
    ogDescription:
      'Una interfaz de escritorio serena para rclone. Sincroniza sin montar: sync espejo o copia segura.',

    navFeatures: 'Funciones',
    navModes: 'Modos',
    navProviders: 'Proveedores',
    navDownload: 'Descargar',

    heroEyebrow: 'Sincronización de carpetas',
    heroTitlePre: 'Sincroniza tus carpetas',
    heroTitlePost: '',
    heroWords: ['en silencio', 'con seguridad', 'con inteligencia', 'rápido', 'sin esfuerzo', 'por completo', 'con gusto'],
    heroLede:
      'Sincroniza cualquier carpeta local con la nube que prefieras <strong>sin montar unidades</strong>. Sync espejo o copia segura: crea un perfil y deja que se ejecute en silencio al iniciar sesión.',
    heroCtaMac: 'Descargar para macOS',
    heroCtaSource: 'Ver el código',
    heroNote: 'Apple Silicon · Versión {version} · también para Windows y Linux',

    mockAria: 'Ventana de SyncDeck: el perfil Copia de Documentos se está sincronizando',
    mockConnected: 'Conectado',
    mockProfiles: 'Perfiles · 03',
    mockProf1: 'Copia de Documentos',
    mockProf1Tag: 'ESPEJO · isdrive:',
    mockProf2: 'Archivo de fotos',
    mockProf2Tag: 'COPIA · archivo:',
    mockProf3: 'Código del proyecto',
    mockProf3Tag: 'ESPEJO · b2cold:',
    mockKicker: 'Perfil de sync · activo',
    mockSource: 'ORIGEN',
    mockTarget: 'DESTINO',
    mockLog: 'Registro en vivo',
    mockLogLine: '↻ transfiriendo isdrive:Copias…',
    mockSyncing: 'Sincronizando',
    mockMeta: '24 / 38 archivos · ETA 00:42',

    providersLabel: 'Funciona con los <b>70+</b> backends de nube que admite el motor de código abierto',

    featKicker: 'Qué hace',
    featH2: 'Tan potente como un terminal, tan sereno como una app.',
    f1Title: 'Perfiles de sync',
    f1Kicker: 'Origen · destino · modo',
    f1Body:
      'Guarda origen, destino, modo y argumentos adicionales en un solo perfil. Crea los que quieras y cambia al instante desde el panel lateral.',
    f1Tag: 'Perfil',
    f2Title: 'Sync espejo y copia',
    f2Kicker: 'Control total',
    f2Body:
      'Refleja el destino exactamente o solo añade archivos. Nada se borra de forma inesperada: tú tienes el control.',
    f2Tag: 'Modo',
    f3Title: 'Automático al iniciar',
    f3Kicker: 'Configura y olvídate',
    f3Body:
      'Los perfiles activos se ejecutan en silencio en cada inicio de sesión, integrados con tu sistema mediante LaunchAgent o login item.',
    f3Tag: 'Automatización',
    f4Title: 'Sin montar unidades',
    f4Kicker: 'Rápido y limpio',
    f4Body: 'Se llaman sync y copy directamente. Sin unidades que montar ni discos virtuales que crear.',
    f4Tag: 'Motor',
    f5Title: 'Asistente de clientes',
    f5Kicker: 'GUI → línea de comandos',
    f5Body:
      'Configura una nueva conexión de nube paso a paso. SyncDeck construye y ejecuta por ti el comando del motor.',
    f5Tag: 'Asistente',
    f6Title: '9 idiomas',
    f6Kicker: 'Interfaz multilingüe',
    f6Body: 'Disponible en inglés, turco, alemán, español, chino, japonés, ruso, neerlandés y árabe.',
    f6Tag: 'i18n',

    modesKicker: 'Dos modos',
    modesH2: 'Reflejar o conservar: tú decides.',
    mode1Title: 'Sync espejo',
    mode1Body:
      'Deja el destino idéntico al origen. Los archivos que faltan en el origen también se borran en el destino, para cuando quieres un reflejo exacto.',
    mode2Title: 'Solo copiar',
    mode2Body:
      'Añade archivos al destino y no borra nada. La opción segura para un uso más prudente: sin riesgo de pérdida irreversible de datos.',

    dlKicker: 'Descargar',
    dlH2: 'Funciona en cualquier escritorio.',
    dlLede:
      'Versión {version} · compilaciones independientes. <span class="ac">El motor viene incluido: no hace falta instalarlo aparte.</span>',
    dlMacDetail: 'Apple Silicon · 12+',
    dlWinDetail: 'x64 · 10+',
    dlLinuxDetail: 'x64',
    dlNote: 'Todas las compilaciones están en la página de <a href="https://github.com/e-onux/syncdeck/releases">GitHub Releases</a>',

    footDesc:
      'Un envoltorio (wrapper) sereno de escritorio para el motor de código abierto rclone. Creado por <a href="https://sidrelabs.com">Sidre Labs</a>.',
    footProduct: 'Producto',
    footModesLink: 'Modos de sync',
    footSource: 'Código',
    footReleases: 'Versiones',
    footContact: 'Contacto',
    footIssues: 'Informar de un problema',
    footTrademark: 'rclone es una marca del equipo independiente del proyecto de código abierto.',
    footLang: 'Idioma',
  },

  nl: {
    name: 'Nederlands',
    dir: 'ltr',
    title: 'SyncDeck · Synchroniseer je mappen stilletjes',
    description:
      'SyncDeck · een rustige desktopinterface voor rclone. Synchroniseer elke lokale map met elke cloud zonder te mounten — mirror-sync of veilig kopiëren. macOS, Windows en Linux.',
    ogTitle: 'SyncDeck · Synchroniseer je mappen stilletjes',
    ogDescription:
      'Een rustige desktopinterface voor rclone. Synchroniseren zonder mounten — mirror-sync of veilig kopiëren.',

    navFeatures: 'Functies',
    navModes: 'Modi',
    navProviders: 'Providers',
    navDownload: 'Downloaden',

    heroEyebrow: 'Mapsynchronisatie',
    heroTitlePre: 'Synchroniseer je mappen',
    heroTitlePost: '',
    heroWords: ['stilletjes', 'veilig', 'slim', 'snel', 'moeiteloos', 'volledig', 'met plezier'],
    heroLede:
      'Synchroniseer elke lokale map met de cloud van je keuze <strong>zonder een schijf te mounten</strong>. Mirror-sync of veilig kopiëren: maak een profiel en laat het stilletjes draaien bij het inloggen.',
    heroCtaMac: 'Download voor macOS',
    heroCtaSource: 'Bekijk de broncode',
    heroNote: 'Apple Silicon · Versie {version} · ook voor Windows &amp; Linux',

    mockAria: 'SyncDeck-venster: het profiel Documenten-back-up wordt gesynchroniseerd',
    mockConnected: 'Verbonden',
    mockProfiles: 'Profielen · 03',
    mockProf1: 'Documenten-back-up',
    mockProf1Tag: 'MIRROR · isdrive:',
    mockProf2: 'Fotoarchief',
    mockProf2Tag: 'KOPIE · archief:',
    mockProf3: 'Projectbron',
    mockProf3Tag: 'MIRROR · b2cold:',
    mockKicker: 'Syncprofiel · actief',
    mockSource: 'BRON',
    mockTarget: 'DOEL',
    mockLog: 'Live logboek',
    mockLogLine: '↻ isdrive:Back-ups wordt overgezet…',
    mockSyncing: 'Bezig met synchroniseren',
    mockMeta: '24 / 38 bestanden · ETA 00:42',

    providersLabel: 'Werkt met de <b>70+</b> cloud-backends die de opensource-engine ondersteunt',

    featKicker: 'Wat het doet',
    featH2: 'Zo krachtig als een terminal, zo rustig als een app.',
    f1Title: 'Syncprofielen',
    f1Kicker: 'Bron · doel · modus',
    f1Body:
      'Bewaar bron, doel, modus en extra argumenten in één profiel. Maak er zoveel je wilt en wissel direct via de zijbalk.',
    f1Tag: 'Profiel',
    f2Title: 'Mirror-sync &amp; kopiëren',
    f2Kicker: 'Volledige controle',
    f2Body:
      'Spiegel het doel exact of voeg alleen bestanden toe. Er wordt niets onverwacht verwijderd — jij houdt de controle.',
    f2Tag: 'Modus',
    f3Title: 'Automatisch bij het inloggen',
    f3Kicker: 'Instellen en vergeten',
    f3Body:
      'Actieve profielen draaien stilletjes bij elke aanmelding, geïntegreerd in je systeem via een LaunchAgent of login item.',
    f3Tag: 'Automatisering',
    f4Title: 'Geen mounten nodig',
    f4Kicker: 'Snel &amp; schoon',
    f4Body: 'Sync en copy worden direct aangeroepen. Geen schijven mounten, geen virtuele schijven maken.',
    f4Tag: 'Engine',
    f5Title: 'Clientwizard',
    f5Kicker: 'GUI → opdrachtregel',
    f5Body:
      'Stel stap voor stap een nieuwe cloudverbinding in. SyncDeck bouwt en start het onderliggende engine-commando voor je.',
    f5Tag: 'Wizard',
    f6Title: '9 talen',
    f6Kicker: 'Meertalige interface',
    f6Body: 'Beschikbaar in het Engels, Turks, Duits, Spaans, Chinees, Japans, Russisch, Nederlands en Arabisch.',
    f6Tag: 'i18n',

    modesKicker: 'Twee modi',
    modesH2: 'Spiegelen of behouden — jij beslist.',
    mode1Title: 'Mirror-sync',
    mode1Body:
      'Maakt het doel identiek aan de bron. Bestanden die in de bron ontbreken, worden ook op het doel verwijderd — voor een exacte weerspiegeling.',
    mode2Title: 'Alleen kopiëren',
    mode2Body:
      'Voegt bestanden toe aan het doel en verwijdert niets. De veilige keuze voor voorzichtiger gebruik — geen risico op onomkeerbaar gegevensverlies.',

    dlKicker: 'Downloaden',
    dlH2: 'Draait op elke desktop.',
    dlLede:
      'Versie {version} · zelfstandige builds. <span class="ac">De engine zit erbij — geen aparte installatie nodig.</span>',
    dlMacDetail: 'Apple Silicon · 12+',
    dlWinDetail: 'x64 · 10+',
    dlLinuxDetail: 'x64',
    dlNote: 'Alle builds staan op de <a href="https://github.com/e-onux/syncdeck/releases">GitHub Releases</a>-pagina',

    footDesc:
      'Een rustige desktopwrapper voor de opensource-engine rclone. Gemaakt door <a href="https://sidrelabs.com">Sidre Labs</a>.',
    footProduct: 'Product',
    footModesLink: 'Syncmodi',
    footSource: 'Broncode',
    footReleases: 'Releases',
    footContact: 'Contact',
    footIssues: 'Probleem melden',
    footTrademark: 'rclone is een merk van het onafhankelijke opensourceprojectteam.',
    footLang: 'Taal',
  },

  ru: {
    name: 'Русский',
    dir: 'ltr',
    title: 'SyncDeck · Синхронизируй папки тихо',
    description:
      'SyncDeck · спокойный десктопный интерфейс для rclone. Синхронизируй любую локальную папку с любым облаком без монтирования — зеркальная синхронизация или безопасное копирование. macOS, Windows и Linux.',
    ogTitle: 'SyncDeck · Синхронизируй папки тихо',
    ogDescription:
      'Спокойный десктопный интерфейс для rclone. Синхронизация без монтирования — зеркало или безопасное копирование.',

    navFeatures: 'Возможности',
    navModes: 'Режимы',
    navProviders: 'Провайдеры',
    navDownload: 'Скачать',

    heroEyebrow: 'Синхронизация папок',
    heroTitlePre: 'Синхронизируй папки',
    heroTitlePost: '',
    heroWords: ['тихо', 'надёжно', 'умно', 'быстро', 'легко', 'полностью', 'с удовольствием'],
    heroLede:
      'Синхронизируй любую локальную папку с выбранным облаком <strong>без монтирования диска</strong>. Зеркальная синхронизация или безопасное копирование: создай профиль, и он будет тихо работать при входе в систему.',
    heroCtaMac: 'Скачать для macOS',
    heroCtaSource: 'Открыть исходный код',
    heroNote: 'Apple Silicon · Версия {version} · Windows и Linux тоже доступны',

    mockAria: 'Окно SyncDeck: профиль «Резервная копия документов» синхронизируется',
    mockConnected: 'Подключено',
    mockProfiles: 'Профили · 03',
    mockProf1: 'Копия документов',
    mockProf1Tag: 'ЗЕРКАЛО · isdrive:',
    mockProf2: 'Фотоархив',
    mockProf2Tag: 'КОПИЯ · archive:',
    mockProf3: 'Исходники проекта',
    mockProf3Tag: 'ЗЕРКАЛО · b2cold:',
    mockKicker: 'Профиль синхронизации · активен',
    mockSource: 'ИСТОЧНИК',
    mockTarget: 'НАЗНАЧЕНИЕ',
    mockLog: 'Живой журнал',
    mockLogLine: '↻ передача isdrive:Backups…',
    mockSyncing: 'Синхронизация',
    mockMeta: '24 / 38 файлов · ETA 00:42',

    providersLabel: 'Работает с <b>70+</b> облачными бэкендами, которые поддерживает движок с открытым кодом',

    featKicker: 'Что умеет',
    featH2: 'Мощный как терминал, спокойный как приложение.',
    f1Title: 'Профили синхронизации',
    f1Kicker: 'Источник · назначение · режим',
    f1Body:
      'Храни источник, назначение, режим и дополнительные аргументы в одном профиле. Создавай сколько угодно и переключайся мгновенно из боковой панели.',
    f1Tag: 'Профиль',
    f2Title: 'Зеркало и копирование',
    f2Kicker: 'Полный контроль',
    f2Body:
      'Зеркаль назначение точь-в-точь или только добавляй файлы. Ничего не удаляется неожиданно — контроль за тобой.',
    f2Tag: 'Режим',
    f3Title: 'Автоматически при входе',
    f3Kicker: 'Настроил и забыл',
    f3Body:
      'Включённые профили тихо запускаются при каждом входе — через LaunchAgent или элемент автозагрузки.',
    f3Tag: 'Автоматизация',
    f4Title: 'Монтирование не нужно',
    f4Kicker: 'Быстро и чисто',
    f4Body: 'Sync и copy вызываются напрямую. Не нужно монтировать диски и создавать виртуальные тома.',
    f4Tag: 'Движок',
    f5Title: 'Мастер клиентов',
    f5Kicker: 'GUI → командная строка',
    f5Body:
      'Настрой новое облачное подключение шаг за шагом. SyncDeck сам составит и выполнит нужную команду движка.',
    f5Tag: 'Мастер',
    f6Title: '9 языков',
    f6Kicker: 'Многоязычный интерфейс',
    f6Body: 'Доступно на английском, турецком, немецком, испанском, китайском, японском, русском, нидерландском и арабском.',
    f6Tag: 'i18n',

    modesKicker: 'Два режима',
    modesH2: 'Отразить или сохранить — решать тебе.',
    mode1Title: 'Зеркальная синхронизация',
    mode1Body:
      'Делает назначение идентичным источнику. Файлы, отсутствующие в источнике, удаляются и в назначении — когда нужно точное отражение.',
    mode2Title: 'Только копирование',
    mode2Body:
      'Добавляет файлы в назначение и ничего не удаляет. Безопасный выбор для осторожного использования — без риска необратимой потери данных.',

    dlKicker: 'Скачать',
    dlH2: 'Работает на любом десктопе.',
    dlLede:
      'Версия {version} · автономные сборки. <span class="ac">Движок уже внутри — отдельная установка не нужна.</span>',
    dlMacDetail: 'Apple Silicon · 12+',
    dlWinDetail: 'x64 · 10+',
    dlLinuxDetail: 'x64',
    dlNote: 'Все сборки — на странице <a href="https://github.com/e-onux/syncdeck/releases">GitHub Releases</a>',

    footDesc:
      'Спокойная десктопная оболочка для движка rclone с открытым исходным кодом. Разработано <a href="https://sidrelabs.com">Sidre Labs</a>.',
    footProduct: 'Продукт',
    footModesLink: 'Режимы синхронизации',
    footSource: 'Исходный код',
    footReleases: 'Релизы',
    footContact: 'Контакты',
    footIssues: 'Сообщить о проблеме',
    footTrademark: 'rclone — торговая марка независимой команды открытого проекта.',
    footLang: 'Язык',
  },

  zh: {
    name: '中文',
    dir: 'ltr',
    title: 'SyncDeck · 静静地同步你的文件夹',
    description:
      'SyncDeck · 为 rclone 打造的沉静桌面界面。无需挂载即可把任意本地文件夹同步到任意云端——镜像同步或安全复制。支持 macOS、Windows 和 Linux。',
    ogTitle: 'SyncDeck · 静静地同步你的文件夹',
    ogDescription: '为 rclone 打造的沉静桌面界面。无需挂载即可同步——镜像同步或安全复制。',

    navFeatures: '功能',
    navModes: '模式',
    navProviders: '服务商',
    navDownload: '下载',

    heroEyebrow: '文件夹同步',
    heroTitlePre: '',
    heroTitlePost: '同步你的文件夹',
    heroWords: ['静静地', '安全地', '聪明地', '快速地', '轻松地', '完整地', '愉快地'],
    heroLede:
      '把任意本地文件夹同步到你选择的云端，<strong>无需挂载磁盘</strong>。镜像同步或安全复制，建好配置，登录时静静运行。',
    heroCtaMac: '下载 macOS 版',
    heroCtaSource: '查看源码',
    heroNote: 'Apple Silicon · 版本 {version} · 同时提供 Windows 和 Linux 版',

    mockAria: 'SyncDeck 应用窗口：文档备份配置正在同步',
    mockConnected: '已连接',
    mockProfiles: '配置 · 03',
    mockProf1: '文档备份',
    mockProf1Tag: '镜像 · isdrive:',
    mockProf2: '照片存档',
    mockProf2Tag: '复制 · archive:',
    mockProf3: '项目源码',
    mockProf3Tag: '镜像 · b2cold:',
    mockKicker: '同步配置 · 运行中',
    mockSource: '来源',
    mockTarget: '目标',
    mockLog: '实时日志',
    mockLogLine: '↻ 正在传输 isdrive:Backups…',
    mockSyncing: '正在同步',
    mockMeta: '24 / 38 个文件 · 预计 00:42',

    providersLabel: '支持开源引擎所兼容的 <b>70+</b> 种云端后端',

    featKicker: '能做什么',
    featH2: '像终端一样强大，像应用一样安静。',
    f1Title: '同步配置',
    f1Kicker: '来源 · 目标 · 模式',
    f1Body: '把来源、目标、模式和附加参数保存在一个配置里。想建多少个都行，在侧栏即时切换。',
    f1Tag: '配置',
    f2Title: '镜像同步与复制',
    f2Kicker: '完全掌控',
    f2Body: '可以让目标与来源完全一致，也可以只新增文件。不会有意外删除——一切由你决定。',
    f2Tag: '模式',
    f3Title: '登录时自动运行',
    f3Kicker: '设置后即可忘记',
    f3Body: '启用的配置会在每次登录时静静运行，通过 LaunchAgent 或登录项与系统集成。',
    f3Tag: '自动化',
    f4Title: '无需挂载',
    f4Kicker: '快速而干净',
    f4Body: '直接调用 sync 和 copy。不用挂载驱动器，也不用创建虚拟磁盘。',
    f4Tag: '引擎',
    f5Title: '客户端向导',
    f5Kicker: 'GUI → 命令行',
    f5Body: '一步步配置新的云连接。SyncDeck 会为你生成并执行底层引擎命令。',
    f5Tag: '向导',
    f6Title: '9 种语言',
    f6Kicker: '多语言界面',
    f6Body: '已支持英语、土耳其语、德语、西班牙语、中文、日语、俄语、荷兰语和阿拉伯语。',
    f6Tag: 'i18n',

    modesKicker: '两种模式',
    modesH2: '镜像还是保留——你来决定。',
    mode1Title: '镜像同步',
    mode1Body: '让目标与来源完全一致。来源中已删除的文件在目标中也会删除——适合需要精确映射时。',
    mode2Title: '仅复制',
    mode2Body: '只向目标添加文件，不删除任何内容。更谨慎使用时的安全选择——没有不可逆的数据丢失风险。',

    dlKicker: '下载',
    dlH2: '在每台桌面设备上运行。',
    dlLede: '版本 {version} · 独立构建。<span class="ac">引擎已内置——无需另行安装。</span>',
    dlMacDetail: 'Apple Silicon · 12+',
    dlWinDetail: 'x64 · 10+',
    dlLinuxDetail: 'x64',
    dlNote: '所有构建都在 <a href="https://github.com/e-onux/syncdeck/releases">GitHub Releases</a> 页面',

    footDesc:
      '为开源 rclone 引擎打造的沉静桌面封装。由 <a href="https://sidrelabs.com">Sidre Labs</a> 开发。',
    footProduct: '产品',
    footModesLink: '同步模式',
    footSource: '源码',
    footReleases: '版本',
    footContact: '联系',
    footIssues: '反馈问题',
    footTrademark: 'rclone 是该独立开源项目团队的商标。',
    footLang: '语言',
  },

  ja: {
    name: '日本語',
    dir: 'ltr',
    title: 'SyncDeck · フォルダを静かに同期',
    description:
      'SyncDeck · rclone のための静かなデスクトップインターフェース。マウントせずに任意のローカルフォルダを好きなクラウドへ同期 — ミラー同期または安全なコピー。macOS、Windows、Linux 対応。',
    ogTitle: 'SyncDeck · フォルダを静かに同期',
    ogDescription: 'rclone のための静かなデスクトップインターフェース。マウント不要で同期 — ミラー同期または安全なコピー。',

    navFeatures: '機能',
    navModes: 'モード',
    navProviders: 'プロバイダ',
    navDownload: 'ダウンロード',

    heroEyebrow: 'フォルダ同期',
    heroTitlePre: 'フォルダを',
    heroTitlePost: '同期',
    heroWords: ['静かに', '安全に', '賢く', '素早く', '軽やかに', '完全に', '気持ちよく'],
    heroLede:
      '任意のローカルフォルダを好きなクラウドへ<strong>マウントせずに</strong>同期。ミラー同期か安全なコピーを選び、プロファイルを作れば、ログイン時に静かに実行されます。',
    heroCtaMac: 'macOS 版をダウンロード',
    heroCtaSource: 'ソースを見る',
    heroNote: 'Apple Silicon · バージョン {version} · Windows と Linux も利用可能',

    mockAria: 'SyncDeck のウィンドウ: ドキュメントのバックアップ プロファイルを同期中',
    mockConnected: '接続済み',
    mockProfiles: 'プロファイル · 03',
    mockProf1: 'ドキュメントのバックアップ',
    mockProf1Tag: 'ミラー · isdrive:',
    mockProf2: '写真アーカイブ',
    mockProf2Tag: 'コピー · archive:',
    mockProf3: 'プロジェクトのソース',
    mockProf3Tag: 'ミラー · b2cold:',
    mockKicker: '同期プロファイル · 実行中',
    mockSource: '転送元',
    mockTarget: '転送先',
    mockLog: 'ライブログ',
    mockLogLine: '↻ isdrive:Backups を転送中…',
    mockSyncing: '同期中',
    mockMeta: '24 / 38 ファイル · 残り 00:42',

    providersLabel: 'オープンソースエンジンが対応する <b>70+</b> のクラウドバックエンドで動作します',

    featKicker: 'できること',
    featH2: 'ターミナルのように強力で、アプリのように静か。',
    f1Title: '同期プロファイル',
    f1Kicker: '転送元 · 転送先 · モード',
    f1Body:
      '転送元・転送先・モード・追加引数を1つのプロファイルに保存。いくつでも作成でき、サイドバーから即座に切り替えられます。',
    f1Tag: 'プロファイル',
    f2Title: 'ミラー同期とコピー',
    f2Kicker: '完全なコントロール',
    f2Body: '転送先を完全に一致させることも、ファイルを追加するだけにすることも可能。予期しない削除は起きません。',
    f2Tag: 'モード',
    f3Title: 'ログイン時に自動実行',
    f3Kicker: '設定したら任せるだけ',
    f3Body:
      '有効なプロファイルはログインのたびに静かに実行され、LaunchAgent やログイン項目でシステムに統合されます。',
    f3Tag: '自動化',
    f4Title: 'マウント不要',
    f4Kicker: '速くてクリーン',
    f4Body: 'sync と copy を直接呼び出します。ドライブのマウントも仮想ディスクの作成も不要です。',
    f4Tag: 'エンジン',
    f5Title: 'クライアントウィザード',
    f5Kicker: 'GUI → コマンドライン',
    f5Body:
      '新しいクラウド接続をステップごとに設定。SyncDeck が裏側のエンジンコマンドを生成して実行します。',
    f5Tag: 'ウィザード',
    f6Title: '9言語対応',
    f6Kicker: '多言語インターフェース',
    f6Body: '英語・トルコ語・ドイツ語・スペイン語・中国語・日本語・ロシア語・オランダ語・アラビア語に対応。',
    f6Tag: 'i18n',

    modesKicker: '2つのモード',
    modesH2: 'ミラーするか、保持するか — あなた次第。',
    mode1Title: 'ミラー同期',
    mode1Body:
      '転送先を転送元と同一にします。転送元にないファイルは転送先でも削除されます — 正確な複製が必要なときに。',
    mode2Title: 'コピーのみ',
    mode2Body:
      '転送先にファイルを追加し、何も削除しません。慎重に使いたいときの安全な選択 — 取り返しのつかないデータ損失の心配がありません。',

    dlKicker: 'ダウンロード',
    dlH2: 'どのデスクトップでも動作します。',
    dlLede:
      'バージョン {version} · スタンドアロンビルド。<span class="ac">エンジンは同梱済み — 別途インストールは不要です。</span>',
    dlMacDetail: 'Apple Silicon · 12+',
    dlWinDetail: 'x64 · 10+',
    dlLinuxDetail: 'x64',
    dlNote: 'すべてのビルドは <a href="https://github.com/e-onux/syncdeck/releases">GitHub Releases</a> ページにあります',

    footDesc:
      'オープンソースの rclone エンジンのための静かなデスクトップラッパー。<a href="https://sidrelabs.com">Sidre Labs</a> が開発。',
    footProduct: '製品',
    footModesLink: '同期モード',
    footSource: 'ソース',
    footReleases: 'リリース',
    footContact: '連絡先',
    footIssues: '問題を報告',
    footTrademark: 'rclone は独立したオープンソースプロジェクトチームの商標です。',
    footLang: '言語',
  },

  ar: {
    name: 'العربية',
    dir: 'rtl',
    title: 'SyncDeck · زامن مجلداتك بهدوء',
    description:
      'SyncDeck · واجهة سطح مكتب هادئة لـ rclone. زامن أي مجلد محلي مع أي سحابة دون الحاجة إلى التركيب — مزامنة مرآة أو نسخ آمن. لنظام macOS وWindows وLinux.',
    ogTitle: 'SyncDeck · زامن مجلداتك بهدوء',
    ogDescription: 'واجهة سطح مكتب هادئة لـ rclone. مزامنة دون تركيب — مزامنة مرآة أو نسخ آمن.',

    navFeatures: 'المزايا',
    navModes: 'الأوضاع',
    navProviders: 'المزودون',
    navDownload: 'تنزيل',

    heroEyebrow: 'مزامنة المجلدات',
    heroTitlePre: 'زامن مجلداتك',
    heroTitlePost: '',
    heroWords: ['بهدوء', 'بأمان', 'بذكاء', 'بسرعة', 'بسلاسة', 'بالكامل', 'بسعادة'],
    heroLede:
      'زامن أي مجلد محلي مع السحابة التي تختارها <strong>دون تركيب أي قرص</strong>. مزامنة مرآة أو نسخ آمن: أنشئ ملف إعداد ودعه يعمل بهدوء عند تسجيل الدخول.',
    heroCtaMac: 'تنزيل لنظام macOS',
    heroCtaSource: 'عرض الكود المصدري',
    heroNote: 'Apple Silicon · الإصدار {version} · متوفر أيضًا لـ Windows وLinux',

    mockAria: 'نافذة تطبيق SyncDeck: يجري مزامنة ملف إعداد نسخ المستندات',
    mockConnected: 'متصل',
    mockProfiles: 'ملفات الإعداد · 03',
    mockProf1: 'نسخة المستندات',
    mockProf1Tag: 'مرآة · isdrive:',
    mockProf2: 'أرشيف الصور',
    mockProf2Tag: 'نسخ · archive:',
    mockProf3: 'مصدر المشروع',
    mockProf3Tag: 'مرآة · b2cold:',
    mockKicker: 'ملف مزامنة · نشط',
    mockSource: 'المصدر',
    mockTarget: 'الوجهة',
    mockLog: 'السجل المباشر',
    mockLogLine: '↻ جارٍ نقل isdrive:Backups…',
    mockSyncing: 'جارٍ المزامنة',
    mockMeta: '24 / 38 ملفًا · الوقت المتبقي 00:42',

    providersLabel: 'يعمل مع أكثر من <b>70</b> خدمة سحابية يدعمها المحرك مفتوح المصدر',

    featKicker: 'ماذا يفعل',
    featH2: 'بقوة الطرفية، وبهدوء التطبيق.',
    f1Title: 'ملفات إعداد المزامنة',
    f1Kicker: 'المصدر · الوجهة · الوضع',
    f1Body:
      'احفظ المصدر والوجهة والوضع والوسائط الإضافية في ملف إعداد واحد. أنشئ ما تشاء وانتقل بينها فورًا من الشريط الجانبي.',
    f1Tag: 'ملف إعداد',
    f2Title: 'مزامنة مرآة ونسخ',
    f2Kicker: 'تحكم كامل',
    f2Body: 'اجعل الوجهة مطابقة تمامًا، أو اكتفِ بإضافة الملفات. لا شيء يُحذف بشكل غير متوقع — القرار لك.',
    f2Tag: 'الوضع',
    f3Title: 'تلقائيًا عند بدء التشغيل',
    f3Kicker: 'اضبطه وانسَه',
    f3Body:
      'تعمل ملفات الإعداد المفعّلة بهدوء عند كل تسجيل دخول، متكاملة مع نظامك عبر LaunchAgent أو عنصر بدء التشغيل.',
    f3Tag: 'الأتمتة',
    f4Title: 'بلا تركيب',
    f4Kicker: 'سريع ونظيف',
    f4Body: 'يتم استدعاء sync وcopy مباشرة. لا حاجة لتركيب أقراص أو إنشاء أقراص افتراضية.',
    f4Tag: 'المحرك',
    f5Title: 'معالج العملاء',
    f5Kicker: 'واجهة رسومية → سطر الأوامر',
    f5Body: 'اضبط اتصالًا سحابيًا جديدًا خطوة بخطوة. ينشئ SyncDeck أمر المحرك المناسب وينفذه نيابة عنك.',
    f5Tag: 'معالج',
    f6Title: '9 لغات',
    f6Kicker: 'واجهة متعددة اللغات',
    f6Body: 'متوفر بالإنجليزية والتركية والألمانية والإسبانية والصينية واليابانية والروسية والهولندية والعربية.',
    f6Tag: 'i18n',

    modesKicker: 'وضعان',
    modesH2: 'انسخ الصورة أو احتفظ بها — القرار لك.',
    mode1Title: 'مزامنة مرآة',
    mode1Body:
      'تجعل الوجهة مطابقة للمصدر تمامًا. الملفات غير الموجودة في المصدر تُحذف من الوجهة أيضًا — عندما تريد نسخة طبق الأصل.',
    mode2Title: 'نسخ فقط',
    mode2Body:
      'يضيف الملفات إلى الوجهة ولا يحذف شيئًا. الخيار الآمن للاستخدام الحذر — دون خطر فقدان بيانات لا يمكن التراجع عنه.',

    dlKicker: 'تنزيل',
    dlH2: 'يعمل على كل سطح مكتب.',
    dlLede:
      'الإصدار {version} · حزم مستقلة. <span class="ac">المحرك مضمّن — لا حاجة إلى تثبيت منفصل.</span>',
    dlMacDetail: 'Apple Silicon · 12+',
    dlWinDetail: 'x64 · 10+',
    dlLinuxDetail: 'x64',
    dlNote: 'جميع الحزم متاحة في صفحة <a href="https://github.com/e-onux/syncdeck/releases">GitHub Releases</a>',

    footDesc:
      'غلاف سطح مكتب هادئ لمحرك rclone مفتوح المصدر. من تطوير <a href="https://sidrelabs.com">Sidre Labs</a>.',
    footProduct: 'المنتج',
    footModesLink: 'أوضاع المزامنة',
    footSource: 'الكود المصدري',
    footReleases: 'الإصدارات',
    footContact: 'التواصل',
    footIssues: 'الإبلاغ عن مشكلة',
    footTrademark: 'rclone علامة تجارية لفريق المشروع مفتوح المصدر المستقل.',
    footLang: 'اللغة',
  },
};
