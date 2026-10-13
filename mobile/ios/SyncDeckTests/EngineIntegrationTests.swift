import XCTest
@testable import SyncDeck

/// End-to-end checks against the real linked rclone engine and local test
/// servers. Run them with `scripts/integration-test.sh`, which starts a WebDAV
/// and an SFTP server on 127.0.0.1 with throwaway credentials and passes them
/// in; without those variables the suite is skipped.
@MainActor
final class EngineIntegrationTests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }
    private var webdavURL: String { env["SYNCDECK_IT_WEBDAV_URL"] ?? "" }
    private var sftpPort: String { env["SYNCDECK_IT_SFTP_PORT"] ?? "" }
    private var user: String { env["SYNCDECK_IT_USER"] ?? "" }
    private var pass: String { env["SYNCDECK_IT_PASS"] ?? "" }

    private let dav = "it-webdav"
    private let sftp = "it-sftp"
    private let crypt = "it-crypt"
    private var run = UUID().uuidString.prefix(8)

    private var store: AppStore!
    private var runner: SyncRunner!
    private var localRoot: String { "it-\(run)" }

    override func setUp() async throws {
        try XCTSkipIf(webdavURL.isEmpty || pass.isEmpty, "integration servers not configured")
        RcloneEngine.shared.start(configPath: Paths.rcloneConfig.path)
        let stateURL = FileManager.default.temporaryDirectory.appendingPathComponent("it-state-\(run).json")
        store = AppStore(stateURL: stateURL)
        runner = SyncRunner(store: store)
        for name in [dav, sftp, crypt] { try? await RemoteService.delete(name) }
    }

    override func tearDown() async throws {
        guard !webdavURL.isEmpty else { return }
        for name in [crypt, dav, sftp] { try? await RemoteService.delete(name) }
        try? FileManager.default.removeItem(at: Paths.appFolder(localRoot))
    }

    // MARK: helpers

    private func writeLocal(_ relative: String, _ text: String) throws {
        let url = Paths.appFolder(localRoot).appendingPathComponent(relative)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data(text.utf8).write(to: url)
    }

    private func localNames(_ sub: String = "") throws -> [String] {
        let url = sub.isEmpty ? Paths.appFolder(localRoot) : Paths.appFolder(localRoot).appendingPathComponent(sub)
        return try FileManager.default.contentsOfDirectory(atPath: url.path).filter { !$0.hasPrefix(".") }.sorted()
    }

    private func remoteNames(_ path: String) async throws -> [String] {
        try await RemoteService.list(path).map(\.name).sorted()
    }

    private func makeWebdav() async throws {
        let question = try await RemoteService.create(name: dav, type: "webdav", parameters: [
            "url": webdavURL, "vendor": "other", "user": user, "pass": pass,
        ])
        XCTAssertNil(question)
    }

    private func profile(_ mode: SyncMode, to remote: String, extra: String = "") -> SyncProfile {
        var p = SyncProfile(name: "it \(mode.rawValue)")
        p.source = .appFolder(localRoot)
        p.destination = .remote(remote)
        p.mode = mode
        p.extraArgs = extra
        store.upsert(p)
        return p
    }

    // MARK: tests

    func testEngineAndCatalogue() async throws {
        let version = await RcloneEngine.shared.version()
        XCTAssertNotNil(version)
        let types = try await RemoteService.backendTypes().map(\.id)
        for id in ["drive", "onedrive", "dropbox", "s3", "b2", "sftp", "webdav", "smb", "crypt", "box", "pcloud", "protondrive", "ftp"] {
            XCTAssertTrue(types.contains(id), "missing backend \(id)")
        }
        XCTAssertFalse(types.contains("local"))
        let obscured = try await RcloneEngine.shared.obscure("secret")
        XCTAssertNotEqual(obscured, "secret")
    }

    func testClientLifecycleAndBrowsing() async throws {
        // Pre-save connection test, good and bad credentials.
        let good = RcloneArgs.connectionString(type: "webdav", fields: [
            ("url", webdavURL), ("vendor", "other"), ("user", user), ("pass", try await RcloneEngine.shared.obscure(pass)),
        ])
        let goodResult = await RemoteService.test(good)
        XCTAssertNil(goodResult)
        let bad = RcloneArgs.connectionString(type: "webdav", fields: [
            ("url", webdavURL), ("user", user), ("pass", try await RcloneEngine.shared.obscure("wrong")),
        ])
        let badResult = await RemoteService.test(bad)
        XCTAssertNotNil(badResult)

        try await makeWebdav()
        let clients = try await RemoteService.clients()
        XCTAssertTrue(clients.contains { $0.name == dav && $0.type == "webdav" })
        let section = await RemoteService.configSection(dav)
        XCTAssertEqual(section["url"], webdavURL)
        XCTAssertNotEqual(section["pass"], pass, "password must be stored obscured")
        let savedResult = await RemoteService.test(dav)
        XCTAssertNil(savedResult)

        let folder = "it-\(run)"
        try await RemoteService.mkdir("\(dav):\(folder)/nested")
        let entries = try await RemoteService.list("\(dav):\(folder)")
        XCTAssertEqual(entries.map(\.name), ["nested"])
        XCTAssertTrue(entries[0].isDir)
        _ = await RemoteService.about(dav)

        try await RemoteService.delete(dav)
        let after = try await RemoteService.clients()
        XCTAssertFalse(after.contains { $0.name == dav })
    }

    func testSftpClient() async throws {
        let question = try await RemoteService.create(name: sftp, type: "sftp", parameters: [
            "host": "127.0.0.1", "port": sftpPort, "user": user, "pass": pass,
        ])
        XCTAssertNil(question)
        let result = await RemoteService.test(sftp)
        XCTAssertNil(result)
        try writeLocal("a.txt", "hello sftp")
        let ok = await runner.run(profile(.copy, to: "\(sftp):it-\(run)"))
        XCTAssertTrue(ok, store.profiles.first.flatMap { store.lastRun($0.id)?.output } ?? "")
        let names = try await remoteNames("\(sftp):it-\(run)")
        XCTAssertEqual(names, ["a.txt"])
    }

    func testTransferModes() async throws {
        try await makeWebdav()
        let target = "\(dav):it-\(run)"
        try writeLocal("one.txt", "1")
        try writeLocal("dir/two.txt", "22")
        try writeLocal("skip.tmp", "x")

        // Dry run writes nothing.
        let dry = profile(.copy, to: target, extra: "--dry-run")
        let dryOK = await runner.run(dry)
        XCTAssertTrue(dryOK)
        XCTAssertEqual(store.lastRun(dry.id)?.dryRun, true)
        let afterDry = (try? await remoteNames(target)) ?? []
        XCTAssertEqual(afterDry, [])

        // Copy with a filter and the bandwidth toggle.
        let copy = profile(.copy, to: target, extra: "--exclude *.tmp --bwlimit 8M --checksum")
        let copyOK = await runner.run(copy)
        XCTAssertTrue(copyOK, store.lastRun(copy.id)?.output ?? "")
        let copied = try await remoteNames(target)
        XCTAssertEqual(copied, ["dir", "one.txt"])
        XCTAssertGreaterThanOrEqual(store.lastRun(copy.id)?.stats.files ?? 0, 2)
        XCTAssertTrue(store.lastRun(copy.id)?.output.contains("✓") ?? false)

        // Verify: identical apart from the excluded file.
        let check = profile(.check, to: target, extra: "--exclude *.tmp")
        let checkOK = await runner.run(check)
        XCTAssertTrue(checkOK, store.lastRun(check.id)?.output ?? "")
        XCTAssertTrue(store.lastRun(check.id)?.output.contains(String(localized: "Identical: \(2)")) ?? false, store.lastRun(check.id)?.output ?? "")

        // Mirror sync deletes what the source no longer has.
        try FileManager.default.removeItem(at: Paths.appFolder(localRoot).appendingPathComponent("one.txt"))
        let sync = profile(.sync, to: target, extra: "--exclude *.tmp")
        let syncOK = await runner.run(sync)
        XCTAssertTrue(syncOK, store.lastRun(sync.id)?.output ?? "")
        let mirrored = try await remoteNames(target)
        XCTAssertEqual(mirrored, ["dir"])

        // A mismatch makes check fail and reports it.
        try writeLocal("new.txt", "n")
        let mismatch = await runner.run(check)
        XCTAssertFalse(mismatch)
        XCTAssertTrue(store.lastRun(check.id)?.output.contains(String(localized: "Only in source: \(1)")) ?? false, store.lastRun(check.id)?.output ?? "")

        // Move empties the source of transferred files.
        let move = profile(.move, to: "\(target)-moved")
        let moveOK = await runner.run(move)
        XCTAssertTrue(moveOK, store.lastRun(move.id)?.output ?? "")
        let moved = try await remoteNames("\(target)-moved")
        XCTAssertTrue(moved.contains("new.txt"))
        let leftLocal = try localNames()
        XCTAssertFalse(leftLocal.contains("new.txt"))
        XCTAssertEqual(store.history(move.id).count, 1)
    }

    func testBisyncEstablishesBaselineThenSyncsBothWays() async throws {
        try await makeWebdav()
        let target = "\(dav):it-\(run)-bi"
        try await RemoteService.mkdir(target)
        try writeLocal("local.txt", "L")
        let bisync = profile(.bisync, to: target)

        let first = await runner.run(bisync)
        XCTAssertTrue(first, store.lastRun(bisync.id)?.output ?? "")
        let afterFirst = try await remoteNames(target)
        XCTAssertTrue(afterFirst.contains("local.txt"))

        // A file created on the remote side comes back down on the next run.
        let remoteFile = "\(target)/remote.txt"
        let source = Paths.appFolder(localRoot).appendingPathComponent("local.txt").path
        let (fs, remote) = RemoteService.split(remoteFile)
        try await RcloneEngine.shared.call("operations/copyfile", [
            "srcFs": "/", "srcRemote": String(source.dropFirst()), "dstFs": fs, "dstRemote": remote,
        ])
        let second = await runner.run(bisync)
        XCTAssertTrue(second, store.lastRun(bisync.id)?.output ?? "")
        let local = try localNames()
        XCTAssertEqual(local, ["local.txt", "remote.txt"])
    }

    func testCryptOverWebdav() async throws {
        try await makeWebdav()
        let question = try await RemoteService.create(name: crypt, type: "crypt", parameters: [
            "remote": "\(dav):it-\(run)-crypt", "password": "correct horse battery",
        ])
        XCTAssertNil(question)
        try writeLocal("secret.txt", "top secret")
        let copy = profile(.copy, to: "\(crypt):")
        let ok = await runner.run(copy)
        XCTAssertTrue(ok, store.lastRun(copy.id)?.output ?? "")
        let decrypted = try await remoteNames("\(crypt):")
        XCTAssertEqual(decrypted, ["secret.txt"])
        let raw = try await remoteNames("\(dav):it-\(run)-crypt")
        XCTAssertEqual(raw.count, 1)
        XCTAssertNotEqual(raw.first, "secret.txt", "names must be encrypted on the underlying remote")
    }

    func testStopCancelsRun() async throws {
        try await makeWebdav()
        for i in 0..<40 { try writeLocal("big\(i).bin", String(repeating: "x", count: 256 * 1024)) }
        let copy = profile(.copy, to: "\(dav):it-\(run)-stop", extra: "--bwlimit 256k --transfers 1")
        let task = Task { await runner.run(copy) }
        while runner.running[copy.id]?.jobID == nil { try await Task.sleep(for: .milliseconds(100)) }
        try await Task.sleep(for: .seconds(1))
        XCTAssertGreaterThan(runner.running[copy.id]?.totalBytes ?? 0, 0)
        runner.stop(copy.id)
        let ok = await task.value
        XCTAssertFalse(ok)
        XCTAssertTrue(store.lastRun(copy.id)?.output.contains(String(localized: "Stopped by user.")) ?? false, store.lastRun(copy.id)?.output ?? "")
        XCTAssertFalse(runner.isRunning(copy.id))
    }

    func testAuthFailureRaisesAlertAndSuccessClearsIt() async throws {
        _ = try await RemoteService.create(name: dav, type: "webdav", parameters: [
            "url": webdavURL, "vendor": "other", "user": user, "pass": "wrong-password",
        ])
        try writeLocal("a.txt", "a")
        let copy = profile(.copy, to: "\(dav):it-\(run)-auth")
        let failed = await runner.run(copy)
        XCTAssertFalse(failed)
        XCTAssertNotNil(store.authAlerts[dav], store.lastRun(copy.id)?.output ?? "")

        try await makeWebdav()
        let ok = await runner.run(copy)
        XCTAssertTrue(ok, store.lastRun(copy.id)?.output ?? "")
        XCTAssertNil(store.authAlerts[dav])
    }

    /// The OAuth plumbing without signing in: rclone's local sign-in link is
    /// captured from the engine log, it redirects to the provider, and
    /// cancelling unblocks the config call and leaves no half-made client.
    func testOAuthLinkCaptureAndCancel() async throws {
        let name = "it-drive"
        try? await RemoteService.delete(name)
        let broker = OAuthBroker.shared
        broker.begin()
        defer { broker.end() }
        // rclone 1.75+ first asks whether to keep using its shared Drive
        // client_id (being retired); the app shows that question, here it is
        // answered "yes" so the flow moves on to the browser step.
        let create = Task { () -> RemoteService.ConfigQuestion? in
            var question = try await RemoteService.create(name: name, type: "drive", parameters: [:])
            while let current = question, current.option.name == "config_shared_client_id" {
                question = try await RemoteService.answer(name: name, question: current, result: "true")
            }
            return question
        }

        var waited = 0
        while broker.authURL == nil && waited < 150 {
            try await Task.sleep(for: .milliseconds(100))
            waited += 1
        }
        let link = try XCTUnwrap(broker.authURL, "sign-in link was not captured from the engine log")
        XCTAssertEqual(link.host, "127.0.0.1")

        // The local server must hand the browser on to Google's consent page.
        final class NoRedirect: NSObject, URLSessionTaskDelegate {
            func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest) async -> URLRequest? { nil }
        }
        let (_, response) = try await URLSession.shared.data(from: link, delegate: NoRedirect())
        let location = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Location") ?? ""
        XCTAssertTrue(location.hasPrefix("https://accounts.google.com/"), location)

        broker.cancel()
        do {
            _ = try await create.value
            XCTFail("create should fail once the sign-in is cancelled")
        } catch {
            XCTAssertFalse(error.localizedDescription.isEmpty)
        }
        try? await RemoteService.delete(name)
        let clients = try await RemoteService.clients()
        XCTAssertFalse(clients.contains { $0.name == name })
    }

    /// A folder outside the app, linked through a bookmark, synced from one of
    /// its subfolders (the Files picker case), both directions.
    func testLinkedFolderSubfolderSync() async throws {
        try await makeWebdav()
        let outside = FileManager.default.temporaryDirectory.appendingPathComponent("linked-\(run)", isDirectory: true)
        let sub = outside.appendingPathComponent("Work/2026", isDirectory: true)
        try FileManager.default.createDirectory(at: sub, withIntermediateDirectories: true)
        try Data("report".utf8).write(to: sub.appendingPathComponent("report.txt"))
        try Data("ignore".utf8).write(to: outside.appendingPathComponent("top.txt"))
        defer { try? FileManager.default.removeItem(at: outside) }

        let folder = try EndpointResolver.link(outside)
        XCTAssertEqual(folder.name, outside.lastPathComponent)
        store.link(folder)
        XCTAssertEqual(store.linkedFolders.count, 1)

        var p = SyncProfile(name: "linked")
        p.source = Endpoint(kind: .external, path: folder.name, bookmark: folder.bookmark, subpath: "Work/2026")
        p.destination = .remote("\(dav):it-\(run)-linked")
        p.mode = .sync
        XCTAssertEqual(p.source.displayPath, "\(folder.name) › Work › 2026")
        store.upsert(p)

        let up = await runner.run(p)
        XCTAssertTrue(up, store.lastRun(p.id)?.output ?? "")
        let uploaded = try await remoteNames("\(dav):it-\(run)-linked")
        XCTAssertEqual(uploaded, ["report.txt"], "only the chosen subfolder is synced")

        // And back down into a new subfolder of the linked folder.
        var down = SyncProfile(name: "linked-down")
        down.source = .remote("\(dav):it-\(run)-linked")
        down.destination = Endpoint(kind: .external, path: folder.name, bookmark: folder.bookmark, subpath: "Restored")
        down.mode = .copy
        store.upsert(down)
        let ok = await runner.run(down)
        XCTAssertTrue(ok, store.lastRun(down.id)?.output ?? "")
        let restored = try FileManager.default.contentsOfDirectory(atPath: outside.appendingPathComponent("Restored").path)
        XCTAssertEqual(restored, ["report.txt"])
        store.unlink(folder.id)
        XCTAssertTrue(store.linkedFolders.isEmpty)
    }

    func testScheduling() async throws {
        var p = profile(.copy, to: "\(dav):x")
        XCTAssertTrue(store.dueProfiles().isEmpty, "manual profiles are never due")
        p.intervalMinutes = 15
        store.upsert(p)
        XCTAssertEqual(store.dueProfiles().map(\.id), [p.id], "never-run scheduled profile is due")
        store.record(RunRecord(ok: true, output: "", finishedAt: Date()), for: p)
        XCTAssertTrue(store.dueProfiles().isEmpty)
        XCTAssertEqual(store.dueProfiles(now: Date().addingTimeInterval(16 * 60)).map(\.id), [p.id])
        p.enabled = false
        store.upsert(p)
        XCTAssertTrue(store.dueProfiles(now: Date().addingTimeInterval(3600)).isEmpty)

        // A photo profile still being set up (no destination) never runs on
        // its own, and running it by hand explains why in plain words.
        var draft = SyncProfile(name: "unfinished")
        draft.source = .photos
        draft.photo = PhotoOptions()
        draft.intervalMinutes = 1440
        store.upsert(draft)
        XCTAssertFalse(store.dueProfiles().contains { $0.id == draft.id })
        XCTAssertNil(store.nextDueDate().flatMap { _ in store.dueProfiles().first { $0.id == draft.id } })
        let ok = await runner.run(draft)
        XCTAssertFalse(ok)
        XCTAssertEqual(store.lastRun(draft.id)?.message, SyncRunner.PhotoBackupError.notCloud.localizedDescription)
    }
}
