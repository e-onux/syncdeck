import Foundation
import Rclone

/// A failed rclone rc call. `message` is rclone's own error text.
struct EngineError: LocalizedError, Sendable {
    let method: String
    let status: Int
    let message: String

    var errorDescription: String? { message }
}

/// In-process rclone. iOS cannot spawn child processes, so instead of shelling
/// out to the rclone CLI like the desktop app, the phone app links librclone
/// (built by `mobile/engine` via gomobile) and talks to it through rclone's
/// remote-control API: every call is `method` + JSON in, JSON out.
final class RcloneEngine: @unchecked Sendable {
    static let shared = RcloneEngine()

    private let lock = NSLock()
    private var started = false

    private init() {}

    /// Boots the engine and points it at the app's own config file. Safe to
    /// call more than once.
    func start(configPath: String) {
        lock.lock()
        defer { lock.unlock() }
        guard !started else { return }
        SyncdeckengineInitialize()
        started = true
        _ = try? callSync("config/setpath", ["path": configPath])
    }

    /// Blocking rc call. Use the async overload from UI code.
    @discardableResult
    func callSync(_ method: String, _ params: [String: Any] = [:]) throws -> [String: Any] {
        let input: String
        if params.isEmpty {
            input = "{}"
        } else {
            let data = try JSONSerialization.data(withJSONObject: params)
            input = String(decoding: data, as: UTF8.self)
        }
        guard let result = SyncdeckengineRPC(method, input) else {
            throw EngineError(method: method, status: 500, message: "Engine returned no result")
        }
        let object = Self.decode(result.output)
        guard result.status == 200 else {
            let message = (object["error"] as? String) ?? result.output
            throw EngineError(method: method, status: result.status, message: message)
        }
        return object
    }

    /// Runs the rc call off the main thread. Some calls block for a long time
    /// (an OAuth `config/create` waits for the browser), so each call gets its
    /// own worker instead of sharing a serial queue.
    @discardableResult
    func call(_ method: String, _ params: [String: Any] = [:]) async throws -> [String: Any] {
        try await withCheckedThrowingContinuation { continuation in
            Thread.detachNewThread { [self] in
                do {
                    continuation.resume(returning: try callSync(method, params))
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private static func decode(_ text: String) -> [String: Any] {
        guard let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return [:] }
        return object
    }
}

extension RcloneEngine {
    /// "1.74.4" from "v1.74.4".
    func version() async -> String? {
        guard let out = try? await call("core/version"), let raw = out["version"] as? String else { return nil }
        return raw.hasPrefix("v") ? String(raw.dropFirst()) : raw
    }

    func obscure(_ clear: String) async throws -> String {
        let out = try await call("core/obscure", ["clear": clear])
        return out["obscured"] as? String ?? clear
    }
}
