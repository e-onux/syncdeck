import SwiftUI

@main
struct SyncDeckApp: App {
    @State private var store: AppStore
    @State private var runner: SyncRunner
    @Environment(\.scenePhase) private var scenePhase

    init() {
        EngineLog.shared.start()
        let store = AppStore()
        let runner = SyncRunner(store: store)
        _store = State(initialValue: store)
        _runner = State(initialValue: runner)
        // Must happen before launch finishes, or iOS drops the task handlers.
        BackgroundScheduler.register(store: store, runner: runner)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(runner)
                .tint(Color(hex: store.accent.hex))
                .preferredColorScheme(store.theme.colorScheme)
                .task { await bootstrap() }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .background:
                BackgroundScheduler.schedule()
            case .active:
                guard store.engineReady else { return }
                Task {
                    await store.refreshAdvisories()
                    if store.backgroundSync { await runner.runDue(trigger: .scheduled) }
                }
            default:
                break
            }
        }
    }

    @MainActor
    private func bootstrap() async {
        guard !store.engineReady else { return }
        RcloneEngine.shared.start(configPath: Paths.rcloneConfig.path)
        store.engineVersion = await RcloneEngine.shared.version()
        store.engineReady = store.engineVersion != nil
        guard store.engineReady else { return }
        await store.reloadClients()
        await store.refreshAdvisories()
        // Seed the app folder so it shows up in the Files app right away.
        try? FileManager.default.createDirectory(at: Paths.documents, withIntermediateDirectories: true)
        if store.backgroundSync { await runner.runDue(trigger: .scheduled) }
    }
}

extension AppStore {
    func reloadClients() async {
        clients = (try? await RemoteService.clients()) ?? []
        if backendTypes.isEmpty {
            backendTypes = (try? await RemoteService.backendTypes()) ?? []
        }
    }

    func refreshAdvisories(force: Bool = false) async {
        let all = await AdvisoryFeed.load(force: force)
        advisories = AdvisoryFeed.applicable(
            all,
            providers: Set(clients.map(\.type)),
            engineVersion: engineVersion,
            appVersion: AppVersion.current
        )
    }
}

extension AppTheme {
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
