import Foundation
import Observation

/// Everything the app persists itself (rclone keeps remotes in rclone.conf).
struct PersistedState: Codable {
    var profiles: [SyncProfile] = []
    var history: [String: [RunRecord]] = [:]
    var authAlerts: [String: AuthAlert] = [:]
    var dismissedAdvisories: [String] = []
    var backgroundSync = true
    var theme: AppTheme = .system
    var accent: AccentName = .mint
}

enum AppTheme: String, Codable, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }
}

enum AccentName: String, Codable, CaseIterable, Identifiable {
    case mint, teal, lime, amber
    var id: String { rawValue }

    /// Same palette as the desktop app.
    var hex: UInt32 {
        switch self {
        case .mint: 0x5FD6B6
        case .teal: 0x3FB8C7
        case .lime: 0x9BD65F
        case .amber: 0xE0A458
        }
    }
}

@MainActor
@Observable
final class AppStore {
    static let historyLimit = 20

    private(set) var state: PersistedState
    var engineVersion: String?
    var engineReady = false
    var clients: [RemoteClient] = []
    var backendTypes: [BackendType] = []
    var advisories: [Advisory] = []
    private let stateURL: URL

    init(stateURL: URL = Paths.state) {
        self.stateURL = stateURL
        if let data = try? Data(contentsOf: stateURL),
           let decoded = try? Self.decoder.decode(PersistedState.self, from: data) {
            state = decoded
        } else {
            state = PersistedState()
        }
    }

    // MARK: - Persistence

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        return e
    }()

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    private func save() {
        guard let data = try? Self.encoder.encode(state) else { return }
        try? data.write(to: stateURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    // MARK: - Profiles

    var profiles: [SyncProfile] { state.profiles }

    func profile(_ id: String) -> SyncProfile? {
        state.profiles.first { $0.id == id }
    }

    func upsert(_ profile: SyncProfile) {
        var clean = profile
        clean.name = clean.name.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.name.isEmpty { clean.name = String(localized: "New profile") }
        clean.extraArgs = clean.extraArgs.trimmingCharacters(in: .whitespacesAndNewlines)
        clean.intervalMinutes = max(0, clean.intervalMinutes)
        if let index = state.profiles.firstIndex(where: { $0.id == clean.id }) {
            state.profiles[index] = clean
        } else {
            state.profiles.append(clean)
        }
        save()
    }

    func deleteProfile(_ id: String) {
        state.profiles.removeAll { $0.id == id }
        state.history[id] = nil
        save()
    }

    func moveProfiles(from: IndexSet, to: Int) {
        state.profiles.move(fromOffsets: from, toOffset: to)
        save()
    }

    // MARK: - Run history

    func lastRun(_ id: String) -> RunRecord? { state.history[id]?.first }
    func history(_ id: String) -> [RunRecord] { state.history[id] ?? [] }

    func record(_ run: RunRecord, for profile: SyncProfile) {
        var list = state.history[profile.id] ?? []
        list.insert(run, at: 0)
        state.history[profile.id] = Array(list.prefix(Self.historyLimit))
        if run.ok {
            for name in profile.remoteNames { state.authAlerts[name] = nil }
        } else if RcloneArgs.isAuthError(run.output) {
            let alert = AuthAlert(message: RcloneArgs.firstMeaningfulLine(run.output), detectedAt: run.finishedAt)
            for name in profile.remoteNames { state.authAlerts[name] = alert }
        }
        save()
    }

    func clearHistory(_ id: String) {
        state.history[id] = nil
        save()
    }

    /// Enabled, scheduled profiles whose interval has elapsed.
    func dueProfiles(now: Date = Date()) -> [SyncProfile] {
        state.profiles.filter { profile in
            guard profile.enabled, profile.intervalMinutes > 0 else { return false }
            guard let last = lastRun(profile.id)?.finishedAt else { return true }
            return now.timeIntervalSince(last) >= Double(profile.intervalMinutes * 60)
        }
    }

    /// The earliest moment a scheduled profile becomes due, for BGTaskScheduler.
    func nextDueDate(now: Date = Date()) -> Date? {
        state.profiles
            .filter { $0.enabled && $0.intervalMinutes > 0 }
            .map { profile -> Date in
                guard let last = lastRun(profile.id)?.finishedAt else { return now }
                return last.addingTimeInterval(Double(profile.intervalMinutes * 60))
            }
            .min()
    }

    // MARK: - Auth alerts

    var authAlerts: [String: AuthAlert] { state.authAlerts }

    func clearAuthAlert(_ name: String) {
        state.authAlerts[name] = nil
        save()
    }

    // MARK: - Settings

    var backgroundSync: Bool {
        get { state.backgroundSync }
        set { state.backgroundSync = newValue; save() }
    }

    var theme: AppTheme {
        get { state.theme }
        set { state.theme = newValue; save() }
    }

    var accent: AccentName {
        get { state.accent }
        set { state.accent = newValue; save() }
    }

    // MARK: - Advisories

    var visibleAdvisories: [Advisory] {
        advisories.filter { !state.dismissedAdvisories.contains($0.id) }
    }

    func dismissAdvisory(_ id: String) {
        guard !state.dismissedAdvisories.contains(id) else { return }
        state.dismissedAdvisories.append(id)
        save()
    }

    // MARK: - Clients (rclone remotes)

    func client(_ name: String) -> RemoteClient? { clients.first { $0.name == name } }

    func backendType(_ id: String) -> BackendType? { backendTypes.first { $0.id == id } }

    /// After a remote is deleted, drop alerts for it. Profiles that point at it
    /// are left alone so the user can see and fix them.
    func forgetClient(_ name: String) {
        state.authAlerts[name] = nil
        save()
    }
}
