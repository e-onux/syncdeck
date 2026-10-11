import Foundation

enum SyncMode: String, Codable, CaseIterable, Identifiable, Sendable {
    case sync, copy, move, bisync, check
    var id: String { rawValue }

    /// `createEmptySrcDirs` is only valid for the file-moving commands.
    var supportsEmptyDirs: Bool { self == .sync || self == .copy || self == .move }
}

/// One side of a profile. Local paths are never stored absolute: the app's
/// sandbox path changes on every reinstall, so a folder inside the app is kept
/// relative to Documents and an outside folder (Files app, iCloud Drive, a USB
/// drive) as a security-scoped bookmark.
struct Endpoint: Codable, Hashable, Sendable {
    enum Kind: String, Codable, Sendable {
        case appFolder
        case external
        case remote
    }

    var kind: Kind
    /// appFolder: path relative to Documents. external: display name.
    /// remote: the rclone path, e.g. "gdrive:Backups".
    var path: String
    var bookmark: Data?

    static let empty = Endpoint(kind: .remote, path: "")

    static func appFolder(_ relative: String) -> Endpoint {
        Endpoint(kind: .appFolder, path: relative.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
    }

    static func remote(_ path: String) -> Endpoint {
        Endpoint(kind: .remote, path: path)
    }

    var isEmpty: Bool { kind == .remote && path.isEmpty }
    var isCloud: Bool { kind == .remote && !path.isEmpty }
    var remoteName: String? { kind == .remote ? RcloneArgs.remoteName(of: path) : nil }

    var displayPath: String {
        switch kind {
        case .appFolder: path.isEmpty ? "SyncDeck" : "SyncDeck/\(path)"
        case .external: path
        case .remote: path
        }
    }
}

struct SyncProfile: Codable, Identifiable, Hashable, Sendable {
    var id: String = UUID().uuidString
    var name: String
    var source: Endpoint = .appFolder("")
    var destination: Endpoint = .empty
    var mode: SyncMode = .sync
    /// Allowed to run on its own (scheduled / background). Mirrors the desktop
    /// "run at login" switch.
    var enabled: Bool = true
    var extraArgs: String = ""
    /// Background cadence in minutes. 0 = manual only.
    var intervalMinutes: Int = 0

    var remoteNames: [String] {
        [source.remoteName, destination.remoteName].compactMap { $0 }
    }

    var direction: TransferEvent.Direction {
        switch (source.isCloud, destination.isCloud) {
        case (true, false): .download
        case (false, true): .upload
        default: .unknown
        }
    }
}

struct RunStats: Codable, Hashable, Sendable {
    var bytes: Double = 0
    var files: Int = 0
    var checks: Int = 0
    var deletes: Int = 0
    var errors: Int = 0
    var elapsed: Double = 0
}

struct RunRecord: Codable, Identifiable, Hashable, Sendable {
    var id: String = UUID().uuidString
    var ok: Bool
    var output: String
    var finishedAt: Date
    var stats: RunStats = RunStats()
    var dryRun: Bool = false
    var trigger: Trigger = .manual

    enum Trigger: String, Codable, Sendable {
        case manual, scheduled, background
    }
}

struct AuthAlert: Codable, Hashable, Sendable {
    var message: String
    var detectedAt: Date
}

struct RemoteClient: Identifiable, Hashable, Sendable {
    var name: String
    var type: String
    var id: String { name }
}

struct BackendOption: Identifiable, Hashable, Sendable {
    struct Example: Hashable, Sendable {
        var value: String
        var help: String
    }

    var name: String
    var help: String
    var required: Bool
    var advanced: Bool
    var secret: Bool
    var type: String
    var defaultValue: String
    var exclusive: Bool
    var examples: [Example]
    var id: String { name }

    var shortHelp: String {
        help.components(separatedBy: .newlines).first?.trimmingCharacters(in: .whitespaces) ?? ""
    }
}

struct BackendType: Identifiable, Hashable, Sendable {
    var id: String
    var name: String
    var description: String
    var options: [BackendOption]
}

struct RemoteEntry: Identifiable, Hashable, Sendable {
    var name: String
    var isDir: Bool
    var size: Int64
    var modified: Date?
    var id: String { name }
}

struct QuotaInfo: Hashable, Sendable {
    var total: Double?
    var used: Double?
    var free: Double?
}

struct TransferEvent: Identifiable, Hashable, Sendable {
    enum Direction: String, Sendable { case upload, download, unknown }
    enum Status: String, Sendable { case active, done, deleted, error }

    var id: String
    var name: String
    var direction: Direction
    var pct: Double
    var status: Status
    var size: Double = 0
}

struct Advisory: Codable, Identifiable, Hashable, Sendable {
    enum Severity: String, Codable, Sendable { case info, warning, critical }

    var id: String
    var severity: Severity?
    var providers: [String]?
    var minRcloneVersion: String?
    var minAppVersion: String?
    var url: String?
    var action: String?
    var message: LocalizedMessage

    /// The feed allows either a plain string or a { "tr": ..., "en": ... } map.
    enum LocalizedMessage: Codable, Hashable, Sendable {
        case plain(String)
        case localized([String: String])

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let text = try? container.decode(String.self) {
                self = .plain(text)
            } else {
                self = .localized(try container.decode([String: String].self))
            }
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.singleValueContainer()
            switch self {
            case .plain(let text): try container.encode(text)
            case .localized(let map): try container.encode(map)
            }
        }

        func text(for language: String) -> String {
            switch self {
            case .plain(let text): return text
            case .localized(let map):
                return map[language] ?? map["en"] ?? map.values.first ?? ""
            }
        }
    }
}

enum AppVersion {
    static var current: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    }

    /// Numeric dotted comparison: "1.74.10" > "1.74.9".
    static func isAtLeast(_ version: String, _ minimum: String) -> Bool {
        let a = version.split(separator: ".").map { Int($0) ?? 0 }
        let b = minimum.split(separator: ".").map { Int($0) ?? 0 }
        for i in 0..<max(a.count, b.count) {
            let x = i < a.count ? a[i] : 0
            let y = i < b.count ? b[i] : 0
            if x != y { return x > y }
        }
        return true
    }
}
