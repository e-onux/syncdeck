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
    /// Photo backups: asset ids already uploaded and verified, per profile, so
    /// a later run (or one that keeps photos on the device) skips them.
    var uploadedPhotos: [String: [String]] = [:]
    /// Verified items whose removal from the device is still waiting for the
    /// user's confirmation (iOS asks; it cannot be done in the background).
    var pendingPhotoDeletion: [String: [String]] = [:]
    /// Folders outside the app the person linked from the Files picker.
    var linkedFolders: [LinkedFolder] = []

    init() {}

    /// Every field is optional on disk so a state file written by an older
    /// version (without newer fields) still loads instead of being discarded.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        profiles = try c.decodeIfPresent([SyncProfile].self, forKey: .profiles) ?? []
        history = try c.decodeIfPresent([String: [RunRecord]].self, forKey: .history) ?? [:]
        authAlerts = try c.decodeIfPresent([String: AuthAlert].self, forKey: .authAlerts) ?? [:]
        dismissedAdvisories = try c.decodeIfPresent([String].self, forKey: .dismissedAdvisories) ?? []
        backgroundSync = try c.decodeIfPresent(Bool.self, forKey: .backgroundSync) ?? true
        theme = try c.decodeIfPresent(AppTheme.self, forKey: .theme) ?? .system
        accent = try c.decodeIfPresent(AccentName.self, forKey: .accent) ?? .mint
        uploadedPhotos = try c.decodeIfPresent([String: [String]].self, forKey: .uploadedPhotos) ?? [:]
        pendingPhotoDeletion = try c.decodeIfPresent([String: [String]].self, forKey: .pendingPhotoDeletion) ?? [:]
        linkedFolders = try c.decodeIfPresent([LinkedFolder].self, forKey: .linkedFolders) ?? []
    }
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
        state.uploadedPhotos[id] = nil
        state.pendingPhotoDeletion[id] = nil
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
            // A profile still being set up (no destination yet) must not run on its own.
            guard !profile.source.isEmpty, !profile.destination.isEmpty else { return false }
            guard let last = lastRun(profile.id)?.finishedAt else { return true }
            return now.timeIntervalSince(last) >= Double(profile.intervalMinutes * 60)
        }
    }

    /// The earliest moment a scheduled profile becomes due, for BGTaskScheduler.
    func nextDueDate(now: Date = Date()) -> Date? {
        state.profiles
            .filter { $0.enabled && $0.intervalMinutes > 0 && !$0.source.isEmpty && !$0.destination.isEmpty }
            .map { profile -> Date in
                guard let last = lastRun(profile.id)?.finishedAt else { return now }
                return last.addingTimeInterval(Double(profile.intervalMinutes * 60))
            }
            .min()
    }

    // MARK: - Photo backup bookkeeping

    func uploadedPhotos(_ id: String) -> Set<String> { Set(state.uploadedPhotos[id] ?? []) }

    func markUploaded(_ ids: [String], profile: String) {
        var set = uploadedPhotos(profile)
        set.formUnion(ids)
        state.uploadedPhotos[profile] = Array(set)
        save()
    }

    func pendingDeletion(_ id: String) -> [String] { state.pendingPhotoDeletion[id] ?? [] }

    var totalPendingDeletion: Int { state.pendingPhotoDeletion.values.reduce(0) { $0 + $1.count } }

    func setPendingDeletion(_ ids: [String], profile: String) {
        state.pendingPhotoDeletion[profile] = ids.isEmpty ? nil : ids
        save()
    }

    // MARK: - Linked folders

    var linkedFolders: [LinkedFolder] { state.linkedFolders }

    /// Adds a folder, or refreshes the bookmark of one with the same name.
    @discardableResult
    func link(_ folder: LinkedFolder) -> LinkedFolder {
        if let index = state.linkedFolders.firstIndex(where: { $0.name == folder.name }) {
            state.linkedFolders[index].bookmark = folder.bookmark
            save()
            return state.linkedFolders[index]
        }
        state.linkedFolders.append(folder)
        save()
        return folder
    }

    func unlink(_ id: String) {
        state.linkedFolders.removeAll { $0.id == id }
        save()
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
