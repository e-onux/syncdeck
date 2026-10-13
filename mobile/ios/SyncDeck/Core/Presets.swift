import Foundation

/// Well-known services on standard protocols (S3, WebDAV, SFTP, SMB) for the
/// client wizard. The catalogue is sources/provider-presets.json, shared with
/// the desktop app and copied into the bundle by scripts/build-strings.py.
struct PresetCatalog: Decodable {
    var groups: [PresetGroup]
    var presets: [Preset]

    static let shared: PresetCatalog = {
        guard let url = Bundle.main.url(forResource: "provider-presets", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let catalog = try? JSONDecoder().decode(PresetCatalog.self, from: data)
        else { return PresetCatalog(groups: [], presets: []) }
        return catalog
    }()

    func presets(in group: String) -> [Preset] { presets.filter { $0.group == group } }

    /// The preset an existing remote was made from, when that is unambiguous
    /// (several services share e.g. provider "Other").
    func preset(type: String, settings: [String: String]) -> Preset? {
        let matches = presets.filter { preset in
            preset.backend == type && !(preset.set ?? [:]).isEmpty
                && (preset.set ?? [:]).allSatisfy { settings[$0.key]?.caseInsensitiveCompare($0.value) == .orderedSame }
        }
        return matches.count == 1 ? matches[0] : nil
    }
}

/// A string or a { "en": ..., "tr": ... } map.
enum LocalizedText: Decodable, Hashable, Sendable {
    case plain(String)
    case map([String: String])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let text = try? container.decode(String.self) {
            self = .plain(text)
        } else {
            self = .map(try container.decode([String: String].self))
        }
    }

    /// The catalogue uses the desktop app's language codes ("zh", not "zh-Hans").
    static var currentLanguage: String {
        let code = Locale.preferredLanguages.first.map { Locale(identifier: $0).language.languageCode?.identifier ?? "en" } ?? "en"
        return code
    }

    var text: String { text(for: Self.currentLanguage) }

    func text(for language: String) -> String {
        switch self {
        case .plain(let value): value
        case .map(let map): map[language] ?? map["en"] ?? map.values.first ?? ""
        }
    }
}

struct PresetGroup: Decodable, Identifiable, Hashable, Sendable {
    var id: String
    var label: LocalizedText
    var tag: LocalizedText?
}

struct Preset: Decodable, Identifiable, Hashable, Sendable {
    var id: String
    var name: LocalizedText
    var group: String
    var backend: String
    var icon: String?
    var tag: String?
    var set: [String: String]?
    var fields: [String]
    var required: [String]?
    var prefill: [String: String]?
    var hints: [String: String]?

    var displayName: String { name.text }

    /// "S3-compatible", "WebDAV", "SFTP"...
    var displayTag: String {
        if let tag { return tag }
        return PresetCatalog.shared.groups.first { $0.id == group }?.tag?.text ?? ""
    }

    var provider: String? { self.set?["provider"] }

    func matches(_ query: String) -> Bool {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return true }
        return "\(id) \(displayName) \(displayTag) \(backend)".lowercased().contains(q)
    }

    /// The fields to show, each taken from the rclone option variant meant for
    /// this service's provider, with the catalogue's required flags.
    func options(in type: BackendType) -> [BackendOption] {
        let requiredKeys = Set(required ?? [])
        return fields.compactMap { key in
            guard var option = Presets.resolve(type.options, name: key, provider: provider) else { return nil }
            option.required = requiredKeys.contains(key)
            return option
        }
    }
}

enum Presets {
    /// rclone's per-option provider filter: "" matches every provider, "A,B"
    /// only those, "!A,B" every provider except those.
    static func matches(filter: String, provider: String?) -> Bool {
        guard !filter.isEmpty, let provider else { return true }
        let negate = filter.hasPrefix("!")
        let list = (negate ? String(filter.dropFirst()) : filter).split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        return list.contains(provider) != negate
    }

    /// Some backends (s3) define the same option once per provider group; pick
    /// the variant meant for `provider`, preferring an explicit match.
    static func resolve(_ options: [BackendOption], name: String, provider: String?) -> BackendOption? {
        let candidates = options.filter { $0.name == name }
        guard var option = candidates.first(where: { !$0.provider.isEmpty && matches(filter: $0.provider, provider: provider) })
            ?? candidates.first(where: { matches(filter: $0.provider, provider: provider) })
        else { return nil }
        // Newer rclone keeps one option and filters each example instead.
        option.examples = option.examples.filter { matches(filter: $0.provider, provider: provider) }
        return option
    }
}
