import Foundation

/// The same remote advisory feed the desktop app polls (docs/advisories.md):
/// lets a provider-specific notice reach users without shipping a build.
enum AdvisoryFeed {
    static let url = URL(string: "https://raw.githubusercontent.com/e-onux/syncdeck/main/advisories.json")!
    static let ttl: TimeInterval = 6 * 60 * 60

    private struct Feed: Codable {
        var advisories: [Advisory]
    }

    private struct Cache: Codable {
        var at: Date
        var advisories: [Advisory]
    }

    static func load(force: Bool = false) async -> [Advisory] {
        let cached = try? JSONDecoder().decode(Cache.self, from: Data(contentsOf: Paths.advisoryCache))
        if !force, let cached, Date().timeIntervalSince(cached.at) < ttl { return cached.advisories }
        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 6
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let advisories = try decode(data)
            if let encoded = try? JSONEncoder().encode(Cache(at: Date(), advisories: advisories)) {
                try? encoded.write(to: Paths.advisoryCache, options: .atomic)
            }
            return advisories
        } catch {
            return cached?.advisories ?? []
        }
    }

    /// Accepts a bare array or `{ "advisories": [...] }`. Entries that do not
    /// parse are skipped rather than failing the whole feed.
    static func decode(_ data: Data) throws -> [Advisory] {
        let json = try JSONSerialization.jsonObject(with: data)
        let list = (json as? [[String: Any]]) ?? ((json as? [String: Any])?["advisories"] as? [[String: Any]]) ?? []
        return list.compactMap { item in
            guard let raw = try? JSONSerialization.data(withJSONObject: item) else { return nil }
            return try? JSONDecoder().decode(Advisory.self, from: raw)
        }
    }

    /// Advisories relevant to this install: matching a configured provider (or
    /// global) and not already fixed by the running engine/app version.
    static func applicable(_ advisories: [Advisory], providers: Set<String>, engineVersion: String?, appVersion: String) -> [Advisory] {
        advisories.filter { advisory in
            if let wanted = advisory.providers, !wanted.isEmpty, providers.isDisjoint(with: wanted) { return false }
            if let min = advisory.minRcloneVersion, let engine = engineVersion, AppVersion.isAtLeast(engine, min) { return false }
            if let min = advisory.minAppVersion, AppVersion.isAtLeast(appVersion, min) { return false }
            return true
        }
    }
}
