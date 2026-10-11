import Foundation

/// Pure rclone argument and path helpers. Ported from the desktop app's
/// `src/lib/rclone.ts` and `electron/lib/engine.cjs` so both apps read a
/// profile's extra arguments the same way. Covered by `SyncDeckTests`.
enum RcloneArgs {
    enum Option: String, CaseIterable, Identifiable {
        case checksum, dryrun, bwlimit
        var id: String { rawValue }

        var flag: String {
            switch self {
            case .checksum: "--checksum"
            case .dryrun: "--dry-run"
            case .bwlimit: "--bwlimit 8M"
            }
        }
    }

    /// Splits on whitespace, keeping "double quoted" runs together.
    static func tokenize(_ input: String) -> [String] {
        var tokens: [String] = []
        var current = ""
        var quoted = false
        var hasToken = false
        for char in input {
            if char == "\"" {
                quoted.toggle()
                current.append(char)
                hasToken = true
            } else if char.isWhitespace && !quoted {
                if hasToken { tokens.append(current) }
                current = ""
                hasToken = false
            } else {
                current.append(char)
                hasToken = true
            }
        }
        if hasToken { tokens.append(current) }
        return tokens
    }

    static func hasFlag(_ extra: String, _ flag: String) -> Bool {
        let name = flag.split(separator: " ").first.map(String.init) ?? flag
        return tokenize(extra).contains(name)
    }

    static func setFlag(_ extra: String, _ flag: String, on: Bool) -> String {
        var tokens = tokenize(extra)
        let parts = flag.split(separator: " ").map(String.init)
        guard let name = parts.first else { return extra }
        let index = tokens.firstIndex(of: name)
        if on {
            if index == nil { tokens.append(contentsOf: parts) }
        } else if let index {
            let count = parts.count > 1 ? min(2, tokens.count - index) : 1
            tokens.removeSubrange(index..<(index + count))
        }
        return tokens.joined(separator: " ")
    }

    /// rclone connection string for a one-off reachability test before saving,
    /// e.g. `:webdav,url=https://x,user=me:`.
    static func connectionString(type: String, fields: [(String, String)]) -> String {
        let parts = fields
            .filter { !$0.1.trimmingCharacters(in: .whitespaces).isEmpty }
            .map { key, value -> String in
                let needsQuote = value.contains(where: { " \t,:\"'".contains($0) })
                return needsQuote ? "\(key)=\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\"" : "\(key)=\(value)"
            }
        return ":\(type)\(parts.isEmpty ? "" : "," + parts.joined(separator: ",")):"
    }

    /// An rclone remote path looks like "name:" or "name:path", not a local
    /// "/var/..." path.
    static func looksRemote(_ path: String) -> Bool {
        path.range(of: #"^[A-Za-z0-9][\w .+-]*:(?![\\/])"#, options: .regularExpression) != nil
    }

    /// "gdrive" from "gdrive:Backups".
    static func remoteName(of path: String) -> String? {
        guard looksRemote(path), let colon = path.firstIndex(of: ":") else { return nil }
        return String(path[..<colon]).trimmingCharacters(in: .whitespaces)
    }

    static func humanBytes(_ value: Double) -> String {
        guard value.isFinite, value >= 0 else { return "0 B" }
        if value < 1024 { return "\(Int(value.rounded())) B" }
        let units = ["KiB", "MiB", "GiB", "TiB", "PiB"]
        var v = value / 1024
        var i = 0
        while v >= 1024 && i < units.count - 1 {
            v /= 1024
            i += 1
        }
        let digits = v >= 100 ? 0 : v >= 10 ? 1 : 2
        return String(format: "%.\(digits)f %@", v, units[i])
    }

    static func humanDuration(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "-" }
        let s = Int(seconds.rounded())
        if s < 60 { return "\(s)s" }
        if s < 3600 { return "\(s / 60)m \(s % 60)s" }
        return "\(s / 3600)h \((s % 3600) / 60)m"
    }

    // MARK: - Errors

    static let authErrorPatterns: [String] = [
        #"oauth2:\s*cannot fetch token"#,
        #"invalid_grant"#,
        #"token (?:has )?(?:been )?expired(?: or revoked)?"#,
        #"(?:could not|couldn't|failed to|unable to) (?:refresh|fetch|get) (?:the )?token"#,
        #"refresh token .*(?:expired|revoked|invalid)"#,
        #"\b401\b[^\n]*\bunauthorized\b"#,
        #"\b403\b[^\n]*\b(?:access denied|forbidden|insufficient)"#,
        #"InvalidAuthenticationToken"#,
        #"\bAADSTS\d+"#,
        #"authentication (?:failed|required|error)"#,
        #"not authenticated"#,
        #"credentials? (?:are )?(?:invalid|expired|missing)"#,
    ]

    private static func matches(_ text: String, _ pattern: String) -> Bool {
        text.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }

    static func stripAnsi(_ text: String) -> String {
        text.replacingOccurrences(of: "\u{1B}\\[[0-9;]*m", with: "", options: .regularExpression)
    }

    static func isAuthError(_ text: String) -> Bool {
        let clean = stripAnsi(text)
        return authErrorPatterns.contains { matches(clean, $0) }
    }

    static func firstMeaningfulLine(_ text: String) -> String {
        let lines = stripAnsi(text)
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        if let matched = lines.first(where: { line in authErrorPatterns.contains { matches(line, $0) } }) {
            return matched
        }
        return lines.last ?? ""
    }

    static func needsBisyncResync(_ text: String) -> Bool {
        let clean = stripAnsi(text)
        return matches(clean, "Must run --resync to recover") || matches(clean, "cannot find prior Path1 or Path2 listings")
    }

    // MARK: - Extra arguments to rc options

    /// What a profile's free-form extra arguments turn into for an rc call.
    /// The desktop app passes them to the rclone CLI verbatim; over rc they
    /// have to be mapped onto `_config` (global options) and `_filter`.
    struct RcOptions: Equatable {
        var config: [String: AnyHashable] = [:]
        var filter: [String: AnyHashable] = [:]
        var bwlimit: String?
        var ignored: [String] = []
    }

    private static let boolConfigFlags: [String: String] = [
        "--dry-run": "DryRun",
        "-n": "DryRun",
        "--checksum": "CheckSum",
        "-c": "CheckSum",
        "--ignore-existing": "IgnoreExisting",
        "--ignore-times": "IgnoreTimes",
        "-I": "IgnoreTimes",
        "--update": "UpdateOlder",
        "-u": "UpdateOlder",
        "--size-only": "SizeOnly",
        "--no-traverse": "NoTraverse",
        "--track-renames": "TrackRenames",
        "--no-update-modtime": "NoUpdateModTime",
        "--ignore-size": "IgnoreSize",
        "--delete-before": "DeleteMode:before",
        "--delete-during": "DeleteMode:during",
        "--delete-after": "DeleteMode:after",
    ]

    private static let intConfigFlags: [String: String] = [
        "--transfers": "Transfers",
        "--checkers": "Checkers",
        "--retries": "Retries",
        "--low-level-retries": "LowLevelRetries",
        "--max-delete": "MaxDelete",
    ]

    private static let stringConfigFlags: [String: String] = [
        "--max-transfer": "MaxTransfer",
        "--backup-dir": "BackupDir",
        "--suffix": "Suffix",
        "--compare-dest": "CompareDest",
        "--copy-dest": "CopyDest",
    ]

    private static let listFilterFlags: [String: String] = [
        "--exclude": "ExcludeRule",
        "--include": "IncludeRule",
        "--filter": "FilterRule",
        "--exclude-if-present": "ExcludeFile",
    ]

    private static let stringFilterFlags: [String: String] = [
        "--max-age": "MaxAge",
        "--min-age": "MinAge",
        "--max-size": "MaxSize",
        "--min-size": "MinSize",
    ]

    private static func unquote(_ value: String) -> String {
        value.replacingOccurrences(of: "\"", with: "")
    }

    static func rcOptions(from extra: String) -> RcOptions {
        var out = RcOptions()
        var tokens = tokenize(extra)[...]
        while let token = tokens.popFirst() {
            var name = token
            var inlineValue: String?
            if token.hasPrefix("--"), let eq = token.firstIndex(of: "=") {
                name = String(token[..<eq])
                inlineValue = unquote(String(token[token.index(after: eq)...]))
            }
            func value() -> String? {
                if let inlineValue { return inlineValue }
                return tokens.popFirst().map(unquote)
            }

            if let key = boolConfigFlags[name] {
                if key.hasPrefix("DeleteMode:") {
                    out.config["DeleteMode"] = String(key.dropFirst("DeleteMode:".count))
                } else {
                    out.config[key] = inlineValue.map { $0 != "false" } ?? true
                }
            } else if let key = intConfigFlags[name], let raw = value() {
                if let number = Int(raw) { out.config[key] = number } else { out.ignored.append("\(name) \(raw)") }
            } else if let key = stringConfigFlags[name], let raw = value() {
                out.config[key] = raw
            } else if let key = listFilterFlags[name], let raw = value() {
                var list = (out.filter[key] as? [String]) ?? []
                list.append(raw)
                out.filter[key] = list
            } else if let key = stringFilterFlags[name], let raw = value() {
                out.filter[key] = raw
            } else if name == "--delete-excluded" {
                out.filter["DeleteExcluded"] = true
            } else if name == "--bwlimit", let raw = value() {
                out.bwlimit = raw
            } else {
                out.ignored.append(token)
            }
        }
        return out
    }
}
