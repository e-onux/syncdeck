import Foundation

enum Paths {
    /// Shown in the Files app as "On My iPhone > SyncDeck" (UIFileSharingEnabled).
    static var documents: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    static var support: URL {
        let url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("SyncDeck", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static var caches: URL {
        let url = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("SyncDeck", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    /// rclone's own config (remotes and their tokens). Kept out of Documents
    /// so it is never exposed in the Files app.
    static var rcloneConfig: URL { support.appendingPathComponent("rclone.conf") }
    static var state: URL { support.appendingPathComponent("state.json") }
    static var advisoryCache: URL { caches.appendingPathComponent("advisories.json") }
    static var bisyncWorkdir: URL { support.appendingPathComponent("bisync", isDirectory: true) }

    static func appFolder(_ relative: String) -> URL {
        relative.isEmpty ? documents : documents.appendingPathComponent(relative, isDirectory: true)
    }
}

/// An endpoint resolved to something rclone can open. For bookmarked folders
/// the security scope stays open until `close()`.
struct ResolvedEndpoint {
    let fsPath: String
    private let scopedURL: URL?

    init(fsPath: String, scopedURL: URL? = nil) {
        self.fsPath = fsPath
        self.scopedURL = scopedURL
    }

    func close() {
        scopedURL?.stopAccessingSecurityScopedResource()
    }
}

enum EndpointResolver {
    enum Failure: LocalizedError {
        case empty, staleBookmark(String), noAccess(String)

        var errorDescription: String? {
            switch self {
            case .empty: String(localized: "Source and destination are required.")
            case .staleBookmark(let name): String(localized: "Access to \"\(name)\" was lost. Pick the folder again.")
            case .noAccess(let name): String(localized: "No permission to open \"\(name)\".")
            }
        }
    }

    static func resolve(_ endpoint: Endpoint) throws -> ResolvedEndpoint {
        switch endpoint.kind {
        case .remote:
            guard !endpoint.path.isEmpty else { throw Failure.empty }
            return ResolvedEndpoint(fsPath: endpoint.path)
        case .appFolder:
            let url = Paths.appFolder(endpoint.path)
            try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
            return ResolvedEndpoint(fsPath: url.path)
        case .photos:
            // The photo library is not a folder; the photo backup exports it.
            throw Failure.empty
        case .external:
            guard let data = endpoint.bookmark else { throw Failure.staleBookmark(endpoint.path) }
            var stale = false
            let url = try URL(resolvingBookmarkData: data, bookmarkDataIsStale: &stale)
            guard url.startAccessingSecurityScopedResource() else { throw Failure.noAccess(endpoint.path) }
            return ResolvedEndpoint(fsPath: url.path, scopedURL: url)
        }
    }

    static func bookmark(for url: URL) throws -> Endpoint {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let data = try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
        return Endpoint(kind: .external, path: url.lastPathComponent, bookmark: data)
    }
}
