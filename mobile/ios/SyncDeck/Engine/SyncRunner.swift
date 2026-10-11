import Foundation
import Observation
import UIKit

/// Live state of one running profile, the phone counterpart of the desktop
/// `sync:progress` event.
struct RunProgress: Equatable {
    var jobID: Int?
    var stopping = false
    var bytes: Double = 0
    var totalBytes: Double = 0
    var speed: Double = 0
    var eta: Double?
    var files = 0
    var totalFiles = 0
    var checks = 0
    var deletes = 0
    var errors = 0
    var elapsed: Double = 0
    var transfers: [TransferEvent] = []
    var log: [String] = []

    var fraction: Double? {
        guard totalBytes > 0 else { return nil }
        return min(1, bytes / totalBytes)
    }
}

@MainActor
@Observable
final class SyncRunner {
    static let liveLogLimit = 200
    static let transferLimit = 34

    private(set) var running: [String: RunProgress] = [:]
    private var stopRequested: Set<String> = []
    private let store: AppStore

    init(store: AppStore) {
        self.store = store
    }

    func isRunning(_ id: String) -> Bool { running[id] != nil }
    var anyRunning: Bool { !running.isEmpty }

    func stop(_ id: String) {
        guard var progress = running[id] else { return }
        stopRequested.insert(id)
        progress.stopping = true
        running[id] = progress
        if let job = progress.jobID {
            Task { try? await RcloneEngine.shared.call("job/stop", ["jobid": job]) }
        }
    }

    /// Runs a profile to completion and records the result. Returns whether it
    /// succeeded. A second call for a profile that is already running is a no-op.
    @discardableResult
    func run(_ profile: SyncProfile, trigger: RunRecord.Trigger = .manual) async -> Bool {
        guard running[profile.id] == nil else { return false }
        running[profile.id] = RunProgress()
        stopRequested.remove(profile.id)

        let background = UIApplication.shared.beginBackgroundTask(withName: "sync-\(profile.id)") { }
        defer {
            if background != .invalid { UIApplication.shared.endBackgroundTask(background) }
        }

        let started = Date()
        var record: RunRecord
        do {
            record = try await execute(profile, resync: false)
        } catch {
            // A bisync pair with no prior listings needs a --resync baseline.
            // rclone says so in its log; a pair that never completed a run is
            // treated the same way, since resync copies both ways and never
            // deletes anything.
            let neverSynced = !store.history(profile.id).contains { $0.ok }
            if profile.mode == .bisync,
               RcloneArgs.needsBisyncResync(error.localizedDescription) || neverSynced,
               !stopRequested.contains(profile.id) {
                append(profile.id, String(localized: "First bisync run: establishing a baseline (resync)…"))
                do {
                    record = try await execute(profile, resync: true)
                } catch {
                    record = failure(error, profile: profile)
                }
            } else {
                record = failure(error, profile: profile)
            }
        }
        record.trigger = trigger
        if record.stats.elapsed == 0 { record.stats.elapsed = Date().timeIntervalSince(started) }
        store.record(record, for: profile)
        running[profile.id] = nil
        stopRequested.remove(profile.id)
        return record.ok
    }

    /// Runs every due scheduled profile one after another.
    func runDue(trigger: RunRecord.Trigger) async {
        for profile in store.dueProfiles() where !isRunning(profile.id) {
            await run(profile, trigger: trigger)
        }
    }

    // MARK: - Internals

    private func failure(_ error: Error, profile: SyncProfile) -> RunRecord {
        let stopped = stopRequested.contains(profile.id)
        let message = stopped ? String(localized: "Stopped by user.") : error.localizedDescription
        let log = running[profile.id]?.log ?? []
        return RunRecord(
            ok: false,
            output: (log + [message]).joined(separator: "\n"),
            finishedAt: Date(),
            stats: stats(from: running[profile.id]),
            dryRun: RcloneArgs.rcOptions(from: profile.extraArgs).config["DryRun"] as? Bool ?? false
        )
    }

    private func stats(from progress: RunProgress?) -> RunStats {
        guard let p = progress else { return RunStats() }
        return RunStats(bytes: p.bytes, files: p.files, checks: p.checks, deletes: p.deletes, errors: p.errors, elapsed: p.elapsed)
    }

    private func append(_ id: String, _ line: String) {
        guard var progress = running[id] else { return }
        progress.log.append(line)
        if progress.log.count > Self.liveLogLimit {
            progress.log.removeFirst(progress.log.count - Self.liveLogLimit)
        }
        running[id] = progress
    }

    private func execute(_ profile: SyncProfile, resync: Bool) async throws -> RunRecord {
        let source = try EndpointResolver.resolve(profile.source)
        defer { source.close() }
        let destination = try EndpointResolver.resolve(profile.destination)
        defer { destination.close() }

        let options = RcloneArgs.rcOptions(from: profile.extraArgs)
        if !options.ignored.isEmpty {
            append(profile.id, String(localized: "Ignored on iPhone: \(options.ignored.joined(separator: " "))"))
        }
        let dryRun = options.config["DryRun"] as? Bool ?? false

        var params: [String: Any] = ["_async": true]
        if !options.config.isEmpty { params["_config"] = options.config }
        if !options.filter.isEmpty { params["_filter"] = options.filter }

        let method: String
        switch profile.mode {
        case .sync, .copy, .move:
            method = "sync/\(profile.mode.rawValue)"
            params["srcFs"] = source.fsPath
            params["dstFs"] = destination.fsPath
            params["createEmptySrcDirs"] = true
        case .bisync:
            method = "sync/bisync"
            params["path1"] = source.fsPath
            params["path2"] = destination.fsPath
            params["resync"] = resync
            params["dryRun"] = dryRun
            params["createEmptySrcDirs"] = true
            params["resilient"] = true
            try? FileManager.default.createDirectory(at: Paths.bisyncWorkdir, withIntermediateDirectories: true)
            params["workdir"] = Paths.bisyncWorkdir.path
        case .check:
            method = "operations/check"
            params["srcFs"] = source.fsPath
            params["dstFs"] = destination.fsPath
            params["combined"] = true
        }

        let engine = RcloneEngine.shared
        if let rate = options.bwlimit {
            try? await engine.call("core/bwlimit", ["rate": rate])
        }
        defer {
            if options.bwlimit != nil {
                Task { try? await RcloneEngine.shared.call("core/bwlimit", ["rate": "off"]) }
            }
        }

        append(profile.id, "\(profile.mode.rawValue) \(profile.source.displayPath) → \(profile.destination.displayPath)\(dryRun ? " (dry run)" : "")")
        // rclone reports why a run failed (e.g. bisync needing --resync) only
        // in its log; mirror warnings and errors into this run's live log.
        let profileID = profile.id
        let engineLines = LockedLines()
        let logSubscription = EngineLog.shared.subscribe { line in
            guard let entry = Self.engineLogEntry(line) else { return }
            engineLines.append(entry)
            Task { @MainActor [weak self] in self?.append(profileID, entry) }
        }
        defer { EngineLog.shared.unsubscribe(logSubscription) }

        let started = try await engine.call(method, params)
        guard let jobID = (started["jobid"] as? NSNumber)?.intValue else {
            throw EngineError(method: method, status: 500, message: "No job id returned")
        }
        if var progress = running[profile.id] {
            progress.jobID = jobID
            running[profile.id] = progress
        }
        if stopRequested.contains(profile.id) {
            try? await engine.call("job/stop", ["jobid": jobID])
        }

        let group = "job/\(jobID)"
        var seenTransfers: Set<String> = []
        var status: [String: Any] = [:]
        while true {
            try? await Task.sleep(for: .milliseconds(500))
            status = (try? await engine.call("job/status", ["jobid": jobID])) ?? status
            await refreshStats(profile: profile, group: group, seen: &seenTransfers)
            if status["finished"] as? Bool == true { break }
        }
        await refreshStats(profile: profile, group: group, seen: &seenTransfers)
        try? await engine.call("core/stats-delete", ["group": group])

        var success = status["success"] as? Bool ?? false
        var error = (status["error"] as? String) ?? ""
        var lines = running[profile.id]?.log ?? []
        if profile.mode == .check, let output = status["output"] as? [String: Any] {
            lines.append(contentsOf: Self.checkSummary(output))
            // Differences are not an rc error: check reports them in its output.
            if output["success"] as? Bool == false {
                success = false
                error = output["status"] as? String ?? error
            }
        }
        let progress = running[profile.id]
        lines.append(Self.summaryLine(progress))
        if !success {
            // rclone logs the reason just before the job ends; give the pipe
            // reader a moment, then take the lines from the buffer (they may
            // still be hopping to the main actor) so the error carries it.
            try? await Task.sleep(for: .milliseconds(300))
            let missing = engineLines.all.filter { !lines.contains($0) }
            throw EngineError(method: method, status: 500, message: (lines + missing + [error]).joined(separator: "\n"))
        }
        return RunRecord(ok: true, output: lines.joined(separator: "\n"), finishedAt: Date(), stats: stats(from: progress), dryRun: dryRun)
    }

    private func refreshStats(profile: SyncProfile, group: String, seen: inout Set<String>) async {
        let engine = RcloneEngine.shared
        guard let stats = try? await engine.call("core/stats", ["group": group]) else { return }
        let transferred = (try? await engine.call("core/transferred", ["group": group]))?["transferred"] as? [[String: Any]] ?? []
        guard var progress = running[profile.id] else { return }

        func number(_ key: String) -> Double { (stats[key] as? NSNumber)?.doubleValue ?? 0 }
        progress.bytes = number("bytes")
        progress.totalBytes = number("totalBytes")
        progress.speed = number("speed")
        progress.eta = (stats["eta"] as? NSNumber)?.doubleValue
        progress.files = Int(number("transfers"))
        progress.totalFiles = Int(number("totalTransfers"))
        progress.checks = Int(number("checks"))
        progress.deletes = Int(number("deletes"))
        progress.errors = Int(number("errors"))
        progress.elapsed = number("elapsedTime")

        var events: [TransferEvent] = []
        for item in stats["transferring"] as? [[String: Any]] ?? [] {
            let name = item["name"] as? String ?? ""
            events.append(TransferEvent(
                id: "active-\(name)",
                name: name,
                direction: profile.direction,
                pct: (item["percentage"] as? NSNumber)?.doubleValue ?? 0,
                status: .active,
                size: (item["size"] as? NSNumber)?.doubleValue ?? 0
            ))
        }
        for item in transferred.reversed() {
            let name = item["name"] as? String ?? ""
            let error = item["error"] as? String ?? ""
            let checked = item["checked"] as? Bool ?? false
            let key = "\(name)|\(item["completed_at"] as? String ?? "")"
            if !checked && !seen.contains(key) {
                seen.insert(key)
                let size = (item["size"] as? NSNumber)?.doubleValue ?? 0
                progress.log.append(error.isEmpty ? "✓ \(name) (\(RcloneArgs.humanBytes(size)))" : "✗ \(name): \(error)")
            }
            if events.count < Self.transferLimit, !checked, !events.contains(where: { $0.name == name }) {
                events.append(TransferEvent(
                    id: "done-\(key)",
                    name: name,
                    direction: profile.direction,
                    pct: 100,
                    status: error.isEmpty ? .done : .error,
                    size: (item["size"] as? NSNumber)?.doubleValue ?? 0
                ))
            }
        }
        if progress.log.count > Self.liveLogLimit {
            progress.log.removeFirst(progress.log.count - Self.liveLogLimit)
        }
        progress.transfers = Array(events.prefix(Self.transferLimit))
        running[profile.id] = progress
    }

    /// "ERROR : dir/file: reason" from an rclone log line, or nil for lines
    /// that do not belong in a run log (OAuth chatter, info noise).
    nonisolated static func engineLogEntry(_ line: String) -> String? {
        guard let range = line.range(of: #"\b(ERROR|NOTICE|CRITICAL)\s*:\s*"#, options: .regularExpression) else { return nil }
        let level = line[range].trimmingCharacters(in: CharacterSet(charactersIn: ": ").union(.whitespaces))
        let message = line[range.upperBound...].trimmingCharacters(in: .whitespaces)
        guard !message.isEmpty, !message.contains("127.0.0.1:53682") else { return nil }
        return "\(level == "NOTICE" ? "•" : "✗") \(message)"
    }

    nonisolated static func summaryLine(_ progress: RunProgress?) -> String {
        guard let p = progress else { return "" }
        var parts = [
            String(localized: "\(p.files) files"),
            RcloneArgs.humanBytes(p.bytes),
        ]
        if p.checks > 0 { parts.append(String(localized: "\(p.checks) checked")) }
        if p.deletes > 0 { parts.append(String(localized: "\(p.deletes) deleted")) }
        if p.errors > 0 { parts.append(String(localized: "\(p.errors) errors")) }
        parts.append(RcloneArgs.humanDuration(p.elapsed))
        return parts.joined(separator: " · ")
    }

    /// Human summary of an `operations/check` result with `combined` output.
    nonisolated static func checkSummary(_ output: [String: Any]) -> [String] {
        let combined = output["combined"] as? [String] ?? []
        var counts: [Character: Int] = [:]
        for line in combined {
            if let marker = line.first { counts[marker, default: 0] += 1 }
        }
        var lines: [String] = []
        lines.append(String(localized: "Identical: \(counts["=", default: 0])"))
        lines.append(String(localized: "Different: \(counts["*", default: 0])"))
        lines.append(String(localized: "Only in source: \(counts["+", default: 0])"))
        lines.append(String(localized: "Only in destination: \(counts["-", default: 0])"))
        if let errors = counts["!"], errors > 0 { lines.append(String(localized: "Errors: \(errors)")) }
        lines.append(contentsOf: combined.filter { !$0.hasPrefix("=") }.prefix(100))
        return lines
    }
}

/// Lines collected from the engine log thread for one run.
private final class LockedLines: @unchecked Sendable {
    private let lock = NSLock()
    private var lines: [String] = []

    func append(_ line: String) {
        lock.lock()
        lines.append(line)
        lock.unlock()
    }

    var all: [String] {
        lock.lock()
        defer { lock.unlock() }
        return lines
    }
}
