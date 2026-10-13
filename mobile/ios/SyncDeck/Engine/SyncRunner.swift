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
    /// Photo backups: what is happening now and how many items are done.
    var phase: String?
    var itemsDone = 0
    var itemsTotal = 0

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
    /// Swapped in tests; PhotoKit asks the user before every deletion.
    var photoLibrary: PhotoLibrary = PhotoKitLibrary.shared
    /// Items exported, uploaded and verified per round. Small enough that
    /// the temporary copies never need much free space on a full phone.
    var photoBatchSize = 25
    /// iOS can only show its delete confirmation while the app is on screen.
    var canAskToDelete: () -> Bool = { UIApplication.shared.applicationState == .active }

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
            record = try await (profile.isPhotoBackup ? executePhotos(profile) : execute(profile, resync: false))
        } catch {
            // A bisync pair with no prior listings needs a --resync baseline.
            // rclone says so in its log; a pair that never completed a run is
            // treated the same way, since resync copies both ways and never
            // deletes anything.
            let neverSynced = !store.history(profile.id).contains { $0.ok }
            if profile.mode == .bisync, !profile.isPhotoBackup,
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
        var record = RunRecord(
            ok: false,
            output: (log + [message]).joined(separator: "\n"),
            finishedAt: Date(),
            stats: stats(from: running[profile.id]),
            dryRun: RcloneArgs.rcOptions(from: profile.extraArgs).config["DryRun"] as? Bool ?? false
        )
        // The app's own errors are already written for people; only rclone's
        // output needs interpreting.
        if stopped {
            record.message = String(localized: "Stopped.")
        } else if !(error is EngineError) {
            record.message = error.localizedDescription
        }
        return record
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
        let (status, engineLines) = try await runJob(profile, method: method, params: params)

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
            // Log lines may still be hopping to the main actor; take them from
            // the job's own buffer so the error always carries rclone's reason.
            let missing = engineLines.filter { !lines.contains($0) }
            throw EngineError(method: method, status: 500, message: (lines + missing + [error]).joined(separator: "\n"))
        }
        return RunRecord(ok: true, output: lines.joined(separator: "\n"), finishedAt: Date(), stats: stats(from: progress), dryRun: dryRun)
    }

    // MARK: - Photo backup ("free up space")

    enum PhotoBackupError: LocalizedError {
        case noAccess, notCloud

        var errorDescription: String? {
            switch self {
            case .noAccess: String(localized: "SyncDeck has no access to your photos. Allow it in Settings › SyncDeck › Photos.")
            case .notCloud: String(localized: "Choose a cloud folder as the destination for your photos.")
            }
        }
    }

    private func setPhase(_ id: String, _ phase: String?, done: Int? = nil, total: Int? = nil) {
        guard var progress = running[id] else { return }
        progress.phase = phase
        if let done { progress.itemsDone = done }
        if let total { progress.itemsTotal = total }
        running[id] = progress
    }

    /// Photos and videos to the cloud, in small rounds: export a batch to a
    /// temporary folder, upload it, then have rclone compare every file with
    /// what is now in the cloud (size, and checksum where the provider has
    /// one). Only items whose every file matched count as backed up, and only
    /// those are ever offered for removal from the device.
    private func executePhotos(_ profile: SyncProfile) async throws -> RunRecord {
        let options = profile.photo ?? PhotoOptions()
        guard profile.destination.isCloud else { throw PhotoBackupError.notCloud }
        guard await photoLibrary.requestAccess() else { throw PhotoBackupError.noAccess }
        let destination = try EndpointResolver.resolve(profile.destination)
        defer { destination.close() }

        let cutoff = options.keepRecentDays > 0 ? Date().addingTimeInterval(-Double(options.keepRecentDays) * 86_400) : nil
        let done = store.uploadedPhotos(profile.id)
        let candidates = await photoLibrary.items(includeVideos: options.includeVideos, createdBefore: cutoff)
        let todo = candidates.filter { !done.contains($0.id) }
        append(profile.id, String(localized: "\(todo.count) photos and videos to back up"))
        setPhase(profile.id, nil, done: 0, total: todo.count)

        let staging = Paths.caches.appendingPathComponent("photo-staging/\(profile.id)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: staging) }

        var verified: [PhotoItem] = []
        var failed = 0
        var stats = RunStats()
        var processed = 0
        for start in stride(from: 0, to: todo.count, by: max(1, photoBatchSize)) {
            if stopRequested.contains(profile.id) { throw CancellationError() }
            let batch = Array(todo[start..<min(todo.count, start + photoBatchSize)])
            try? FileManager.default.removeItem(at: staging)
            try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: true)

            setPhase(profile.id, String(localized: "Preparing photos…"))
            var exported: [PhotoItem] = []
            for item in batch {
                do {
                    try await photoLibrary.export(item, to: staging)
                    exported.append(item)
                } catch {
                    failed += 1
                    append(profile.id, "✗ " + String(localized: "Could not read \(item.resources.first?.relativePath ?? item.id): \(error.localizedDescription)"))
                }
            }
            guard !exported.isEmpty else { processed += batch.count; continue }

            setPhase(profile.id, String(localized: "Uploading…"))
            let (copyStatus, copyLog) = try await runJob(profile, method: "sync/copy", params: [
                "srcFs": staging.path, "dstFs": destination.fsPath, "createEmptySrcDirs": false,
            ])
            if let p = running[profile.id] {
                stats.bytes += p.bytes
                stats.files += p.files
                stats.errors += p.errors
                stats.elapsed += p.elapsed
            }
            if copyStatus["success"] as? Bool != true {
                if stopRequested.contains(profile.id) { throw CancellationError() }
                let reason = (copyLog + [copyStatus["error"] as? String ?? ""]).joined(separator: "\n")
                throw EngineError(method: "sync/copy", status: 500, message: reason)
            }

            // Independent check after the upload: every file must exist in the
            // cloud with the same size (and checksum where both sides have one).
            setPhase(profile.id, String(localized: "Verifying…"))
            let (checkStatus, _) = try await runJob(profile, method: "operations/check", params: [
                "srcFs": staging.path, "dstFs": destination.fsPath, "oneWay": true, "combined": true,
            ])
            let combined = (checkStatus["output"] as? [String: Any])?["combined"] as? [String] ?? []
            let matched = Self.matchedPaths(combined)
            var verifiedNow: [String] = []
            for item in exported {
                if item.resources.allSatisfy({ matched.contains($0.relativePath) }) {
                    verified.append(item)
                    verifiedNow.append(item.id)
                } else {
                    failed += 1
                    append(profile.id, "✗ " + String(localized: "Not verified, kept on iPhone: \(item.resources.first?.relativePath ?? item.id)"))
                }
            }
            store.markUploaded(verifiedNow, profile: profile.id)
            processed += batch.count
            setPhase(profile.id, nil, done: processed)
            try? FileManager.default.removeItem(at: staging)
        }

        stats.photosVerified = verified.count
        append(profile.id, String(localized: "\(verified.count) backed up and verified in the cloud"))

        if options.deleteAfterUpload {
            let pending = Array(Set(store.pendingDeletion(profile.id) + verified.map(\.id)))
            store.setPendingDeletion(pending, profile: profile.id)
            // iOS only shows its delete confirmation while the app is open.
            if !pending.isEmpty, canAskToDelete() {
                setPhase(profile.id, String(localized: "Waiting for your confirmation…"))
                let removed = try await removeBackedUpPhotos(profileID: profile.id)
                stats.photosRemoved = removed
                if removed > 0 {
                    stats.bytesFreed = Double(verified.reduce(0) { $0 + $1.totalSize })
                    append(profile.id, String(localized: "\(removed) removed from iPhone (in Recently Deleted for 30 days)"))
                } else {
                    append(profile.id, String(localized: "Removal from iPhone was not confirmed; nothing was deleted."))
                }
            }
        }

        var lines = running[profile.id]?.log ?? []
        lines.append(Self.summaryLine(running[profile.id]))
        if failed > 0 {
            throw EngineError(method: "photos", status: 500, message: (lines + [String(localized: "\(failed) items could not be backed up and stay on the iPhone.")]).joined(separator: "\n"))
        }
        return RunRecord(ok: true, output: lines.joined(separator: "\n"), finishedAt: Date(), stats: stats)
    }

    /// Asks iOS to remove the profile's verified, still-pending items. Only
    /// ids recorded as uploaded and verified are ever passed on.
    @discardableResult
    func removeBackedUpPhotos(profileID: String) async throws -> Int {
        let uploaded = store.uploadedPhotos(profileID)
        let ids = store.pendingDeletion(profileID).filter { uploaded.contains($0) }
        guard !ids.isEmpty else { return 0 }
        guard try await photoLibrary.delete(ids) else { return 0 }
        store.setPendingDeletion([], profile: profileID)
        return ids.count
    }

    /// Paths rclone's check reported as identical ("= path").
    nonisolated static func matchedPaths(_ combined: [String]) -> Set<String> {
        Set(combined.compactMap { line in
            line.hasPrefix("= ") ? String(line.dropFirst(2)) : nil
        })
    }

    /// Starts an async rc job for a profile, follows its progress until it
    /// ends and returns the final job status plus the engine log lines seen
    /// while it ran.
    private func runJob(_ profile: SyncProfile, method: String, params: [String: Any]) async throws -> (status: [String: Any], log: [String]) {
        let engine = RcloneEngine.shared
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

        var params = params
        params["_async"] = true
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
        if status["success"] as? Bool != true {
            // The reason is logged just before the job ends; let the pipe catch up.
            try? await Task.sleep(for: .milliseconds(300))
        }
        if var progress = running[profile.id] {
            progress.jobID = nil
            running[profile.id] = progress
        }
        return (status, engineLines.all)
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
