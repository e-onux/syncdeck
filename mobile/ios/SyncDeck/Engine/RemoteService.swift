import Foundation

/// rclone config/operations calls for clients (remotes). Mirrors the desktop
/// main process handlers (`remote:*`), but over rc instead of the CLI.
enum RemoteService {
    private static var engine: RcloneEngine { .shared }

    static func clients() async throws -> [RemoteClient] {
        let dump = try await engine.call("config/dump")
        return dump.compactMap { name, value -> RemoteClient? in
            guard let section = value as? [String: Any] else { return nil }
            return RemoteClient(name: name, type: section["type"] as? String ?? "")
        }
        .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    /// The backend catalogue from the linked engine, so the wizard only ever
    /// offers providers that are actually compiled in.
    static func backendTypes() async throws -> [BackendType] {
        let out = try await engine.call("config/providers")
        let providers = out["providers"] as? [[String: Any]] ?? []
        return providers.compactMap { provider -> BackendType? in
            guard let name = provider["Name"] as? String, !(provider["Hide"] as? Bool ?? false) else { return nil }
            // Internal helpers that make no sense as a standalone client.
            if ["local", "alias", "memory", "tardigrade"].contains(name) { return nil }
            let options = (provider["Options"] as? [[String: Any]] ?? []).compactMap(parseOption)
            return BackendType(
                id: provider["Prefix"] as? String ?? name,
                name: name,
                description: provider["Description"] as? String ?? name,
                options: options
            )
        }
        .sorted { $0.description.localizedCaseInsensitiveCompare($1.description) == .orderedAscending }
    }

    static func parseOption(_ raw: [String: Any]) -> BackendOption? {
        guard let name = raw["Name"] as? String else { return nil }
        if let hide = raw["Hide"] as? Int, hide != 0 { return nil }
        let examples = (raw["Examples"] as? [[String: Any]] ?? []).map {
            BackendOption.Example(value: stringValue($0["Value"]), help: $0["Help"] as? String ?? "")
        }
        return BackendOption(
            name: name,
            help: raw["Help"] as? String ?? "",
            required: raw["Required"] as? Bool ?? false,
            advanced: raw["Advanced"] as? Bool ?? false,
            secret: (raw["IsPassword"] as? Bool ?? false) || (raw["Sensitive"] as? Bool ?? false),
            type: raw["Type"] as? String ?? "string",
            defaultValue: stringValue(raw["DefaultStr"] ?? raw["Default"]),
            exclusive: raw["Exclusive"] as? Bool ?? false,
            examples: examples
        )
    }

    private static func stringValue(_ value: Any?) -> String {
        switch value {
        case let s as String: s
        case let b as Bool: b ? "true" : "false"
        case let n as NSNumber: n.stringValue
        case nil: ""
        default: "\(value!)"
        }
    }

    /// Splits "name:sub/dir" into the rc `fs` and `remote` parameters.
    static func split(_ path: String) -> (fs: String, remote: String) {
        if path.hasPrefix(":") {
            // Connection string: the fs ends at the last colon of the config part.
            if let end = path.lastIndex(of: ":"), end != path.startIndex {
                return (String(path[...end]), String(path[path.index(after: end)...]))
            }
        }
        guard let colon = path.firstIndex(of: ":") else { return (path, "") }
        return (String(path[...colon]), String(path[path.index(after: colon)...]))
    }

    static func list(_ path: String) async throws -> [RemoteEntry] {
        let (fs, remote) = split(path)
        let out = try await engine.call("operations/list", ["fs": fs, "remote": remote, "opt": ["noModTime": false]])
        let items = out["list"] as? [[String: Any]] ?? []
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return items.map { item in
            let modTime = item["ModTime"] as? String
            return RemoteEntry(
                name: item["Name"] as? String ?? "",
                isDir: item["IsDir"] as? Bool ?? false,
                size: (item["Size"] as? NSNumber)?.int64Value ?? 0,
                modified: modTime.flatMap { iso.date(from: $0) ?? ISO8601DateFormatter().date(from: $0) }
            )
        }
        .sorted { a, b in
            a.isDir == b.isDir ? a.name.localizedStandardCompare(b.name) == .orderedAscending : a.isDir
        }
    }

    static func mkdir(_ path: String) async throws {
        let (fs, remote) = split(path)
        try await engine.call("operations/mkdir", ["fs": fs, "remote": remote])
    }

    static func about(_ name: String) async -> QuotaInfo? {
        let target = name.hasSuffix(":") ? name : "\(name):"
        guard let out = try? await engine.call("operations/about", ["fs": target]) else { return nil }
        func number(_ key: String) -> Double? { (out[key] as? NSNumber)?.doubleValue }
        let info = QuotaInfo(total: number("total"), used: number("used"), free: number("free"))
        return info.total == nil && info.used == nil && info.free == nil ? nil : info
    }

    /// Reachability check: list the root of a saved remote or an on-the-fly
    /// connection string. Returns nil on success, else rclone's error.
    static func test(_ target: String) async -> String? {
        let path = target.contains(":") ? target : "\(target):"
        do {
            _ = try await list(path)
            return nil
        } catch {
            return RcloneArgs.firstMeaningfulLine(error.localizedDescription)
        }
    }

    static func delete(_ name: String) async throws {
        let clean = name.hasSuffix(":") ? String(name.dropLast()) : name
        try await engine.call("config/delete", ["name": clean])
    }

    static func sanitizeName(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"[:\s/\\]+"#, with: "-", options: .regularExpression)
    }

    /// A question rclone's config state machine asks after the main settings
    /// (e.g. which OneDrive drive to use).
    struct ConfigQuestion: Identifiable {
        var state: String
        var option: BackendOption
        var error: String?
        var id: String { state }
    }

    static func parseQuestion(_ out: [String: Any]) -> ConfigQuestion? {
        guard let state = out["State"] as? String, !state.isEmpty else { return nil }
        let raw = out["Option"] as? [String: Any] ?? [:]
        let option = parseOption(raw) ?? BackendOption(
            name: "value", help: "", required: false, advanced: false, secret: false,
            type: "string", defaultValue: "", exclusive: false, examples: []
        )
        let error = (out["Error"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        return ConfigQuestion(state: state, option: option, error: error)
    }

    /// Ephemeral answers that keep rclone's config flow non-interactive on a
    /// phone: authenticate through the app's own browser sheet, never try to
    /// launch a desktop browser, and refresh an existing token on reconnect.
    static let oauthDefaults: [String: String] = [
        "config_is_local": "true",
        "config_auth_no_browser": "true",
        "config_refresh_token": "true",
    ]

    /// Creates (or, for OAuth backends, authorizes and creates) a remote.
    /// Returns a follow-up question if rclone needs one more answer.
    static func create(name: String, type: String, parameters: [String: String]) async throws -> ConfigQuestion? {
        var params = parameters.filter { !$0.value.isEmpty }
        for (k, v) in oauthDefaults where params[k] == nil { params[k] = v }
        let out = try await engine.call("config/create", [
            "name": name,
            "type": type,
            "parameters": params,
            "opt": ["obscure": true, "nonInteractive": true],
        ])
        return parseQuestion(out)
    }

    static func answer(name: String, question: ConfigQuestion, result: String) async throws -> ConfigQuestion? {
        let out = try await engine.call("config/update", [
            "name": name,
            "parameters": oauthDefaults,
            "opt": ["nonInteractive": true, "continue": true, "state": question.state, "result": result, "obscure": question.option.secret],
        ])
        return parseQuestion(out)
    }

    /// Re-runs the OAuth web flow for an existing remote and refreshes its
    /// token in place, keeping all other settings (`rclone config reconnect`).
    static func reconnect(_ name: String) async throws -> ConfigQuestion? {
        let clean = name.hasSuffix(":") ? String(name.dropLast()) : name
        let out = try await engine.call("config/update", [
            "name": clean,
            "parameters": oauthDefaults,
            "opt": ["nonInteractive": true],
        ])
        return parseQuestion(out)
    }

    static func configSection(_ name: String) async -> [String: String] {
        guard let out = try? await engine.call("config/get", ["name": name]) else { return [:] }
        return out.compactMapValues { $0 as? String }
    }
}
