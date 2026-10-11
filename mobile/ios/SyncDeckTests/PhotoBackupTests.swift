import Photos
import XCTest
@testable import SyncDeck

/// The "free up space" flow: photos go to the cloud, are verified there, and
/// only verified ones are removed from the device. Runs against the local
/// WebDAV server from scripts/integration-test.sh; skipped without it.
@MainActor
final class PhotoBackupTests: XCTestCase {
    /// A scripted photo library. Deletions are recorded instead of shown.
    final class FakeLibrary: PhotoLibrary, @unchecked Sendable {
        var items: [PhotoItem] = []
        var contents: [String: Data] = [:]
        /// Items whose export throws (unreadable original).
        var unreadable: Set<String> = []
        /// Items whose file lands under another name than declared, so the
        /// cloud never has the declared file (an incomplete upload).
        var misplaced: Set<String> = []
        var allowDeletion = true
        private(set) var deleted: [String] = []
        private(set) var deleteRequests = 0

        func requestAccess() async -> Bool { true }

        func items(includeVideos: Bool, createdBefore: Date?) async -> [PhotoItem] {
            items.filter { item in
                (includeVideos || !item.isVideo) && (createdBefore.map { item.created < $0 } ?? true)
            }
        }

        func export(_ item: PhotoItem, to folder: URL) async throws {
            if unreadable.contains(item.id) { throw CocoaError(.fileReadUnknown) }
            for resource in item.resources {
                let path = misplaced.contains(item.id) ? resource.relativePath + ".partial" : resource.relativePath
                let url = folder.appendingPathComponent(path)
                try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
                try contents[resource.relativePath, default: Data()].write(to: url)
            }
        }

        func delete(_ ids: [String]) async throws -> Bool {
            deleteRequests += 1
            guard allowDeletion else { return false }
            deleted.append(contentsOf: ids)
            items.removeAll { ids.contains($0.id) }
            return true
        }

        func add(_ id: String, daysAgo: Double, files: [String], video: Bool = false) {
            let created = Date().addingTimeInterval(-daysAgo * 86_400)
            let folder = PhotoKitLibrary.folder(for: created)
            var resources: [PhotoItem.Resource] = []
            for name in files {
                let path = "\(folder)/\(name)"
                let data = Data((0..<(2048 + name.count * 17)).map { UInt8(($0 * 31 + id.count) % 251) })
                contents[path] = data
                resources.append(.init(relativePath: path, size: Int64(data.count)))
            }
            items.append(PhotoItem(id: id, created: created, isVideo: video, resources: resources))
        }
    }

    private var env: [String: String] { ProcessInfo.processInfo.environment }
    private var webdavURL: String { env["SYNCDECK_IT_WEBDAV_URL"] ?? "" }
    private let dav = "it-photos"
    private let run = UUID().uuidString.prefix(8)
    private var store: AppStore!
    private var runner: SyncRunner!
    private var library: FakeLibrary!

    override func setUp() async throws {
        try XCTSkipIf(webdavURL.isEmpty, "integration servers not configured")
        RcloneEngine.shared.start(configPath: Paths.rcloneConfig.path)
        try? await RemoteService.delete(dav)
        _ = try await RemoteService.create(name: dav, type: "webdav", parameters: [
            "url": webdavURL, "vendor": "other",
            "user": env["SYNCDECK_IT_USER"] ?? "", "pass": env["SYNCDECK_IT_PASS"] ?? "",
        ])
        store = AppStore(stateURL: FileManager.default.temporaryDirectory.appendingPathComponent("photo-state-\(run).json"))
        runner = SyncRunner(store: store)
        library = FakeLibrary()
        runner.photoLibrary = library
        runner.photoBatchSize = 3
        runner.canAskToDelete = { true }
    }

    override func tearDown() async throws {
        guard !webdavURL.isEmpty else { return }
        try? await RemoteService.delete(dav)
    }

    private func profile(deleteAfter: Bool = true, keepDays: Int = 30, videos: Bool = true) -> SyncProfile {
        var p = SyncProfile(name: "photos")
        p.source = .photos
        p.destination = .remote("\(dav):photos-\(run)")
        p.mode = .copy
        p.photo = PhotoOptions(includeVideos: videos, deleteAfterUpload: deleteAfter, keepRecentDays: keepDays)
        store.upsert(p)
        return p
    }

    private func cloudFiles() async throws -> Set<String> {
        let out = try await RcloneEngine.shared.call("operations/list", [
            "fs": "\(dav):photos-\(run)", "remote": "", "opt": ["recurse": true, "filesOnly": true],
        ])
        return Set((out["list"] as? [[String: Any]] ?? []).compactMap { $0["Path"] as? String })
    }

    /// The critical scenario: old photos and videos (including a Live Photo
    /// pair) end up in the cloud in year/month folders and are then removed
    /// from the device; recent ones stay.
    func testBacksUpVerifiesThenRemovesOnlyVerified() async throws {
        library.add("old-photo", daysAgo: 400, files: ["IMG_0001.HEIC"])
        library.add("live-photo", daysAgo: 200, files: ["IMG_0002.HEIC", "IMG_0002.MOV"])
        library.add("edited", daysAgo: 120, files: ["IMG_0003.JPG", "IMG_0003_edited.JPG"])
        library.add("video", daysAgo: 90, files: ["IMG_0004.MOV"], video: true)
        library.add("recent", daysAgo: 2, files: ["IMG_0005.HEIC"])
        let p = profile()

        let ok = await runner.run(p)
        XCTAssertTrue(ok, store.lastRun(p.id)?.output ?? "")

        let files = try await cloudFiles()
        let expected = library.contents.keys.filter { !$0.contains("IMG_0005") }
        XCTAssertEqual(files, Set(expected), "every file of every older item must be in the cloud")
        XCTAssertEqual(Set(library.deleted), ["old-photo", "live-photo", "edited", "video"])
        XCTAssertEqual(library.items.map(\.id), ["recent"], "recent photos stay on the device")
        let stats = try XCTUnwrap(store.lastRun(p.id)?.stats)
        XCTAssertEqual(stats.photosVerified, 4)
        XCTAssertEqual(stats.photosRemoved, 4)
        XCTAssertGreaterThan(stats.bytesFreed, 0)
        XCTAssertEqual(library.deleteRequests, 1, "one confirmation for the whole run")
        XCTAssertTrue(store.pendingDeletion(p.id).isEmpty)

        // Nothing left to do on the next run: no upload, no deletion prompt.
        let again = await runner.run(p)
        XCTAssertTrue(again)
        XCTAssertEqual(library.deleteRequests, 1)
    }

    /// Anything not verified in the cloud must never be deleted.
    func testUnverifiedItemsAreNeverDeleted() async throws {
        library.add("good", daysAgo: 100, files: ["A.HEIC"])
        library.add("unreadable", daysAgo: 100, files: ["B.HEIC"])
        library.add("half-uploaded", daysAgo: 100, files: ["C.HEIC", "C.MOV"])
        library.misplaced = ["half-uploaded"]
        library.unreadable = ["unreadable"]
        let p = profile()

        let ok = await runner.run(p)
        XCTAssertFalse(ok, "a run with items left behind must not report full success")
        XCTAssertEqual(library.deleted, ["good"])
        XCTAssertEqual(Set(library.items.map(\.id)), ["unreadable", "half-uploaded"])
        XCTAssertEqual(store.uploadedPhotos(p.id), ["good"])
        let output = store.lastRun(p.id)?.output ?? ""
        XCTAssertTrue(output.contains("2"), output)
    }

    /// Declining the iOS prompt deletes nothing; the items stay pending and
    /// can be removed later from the app.
    func testDeclinedConfirmationKeepsPhotosAndCanBeRetried() async throws {
        library.add("one", daysAgo: 60, files: ["X.HEIC"])
        library.add("two", daysAgo: 60, files: ["Y.HEIC"])
        library.allowDeletion = false
        let p = profile()

        let ok = await runner.run(p)
        XCTAssertTrue(ok)
        XCTAssertTrue(library.deleted.isEmpty)
        XCTAssertEqual(Set(store.pendingDeletion(p.id)), ["one", "two"])
        XCTAssertEqual(store.lastRun(p.id)?.stats.photosRemoved, 0)

        library.allowDeletion = true
        let removed = try await runner.removeBackedUpPhotos(profileID: p.id)
        XCTAssertEqual(removed, 2)
        XCTAssertEqual(Set(library.deleted), ["one", "two"])
        XCTAssertTrue(store.pendingDeletion(p.id).isEmpty)
    }

    /// In the background iOS cannot ask, so verified items wait for the user.
    func testBackgroundRunDefersRemoval() async throws {
        library.add("bg", daysAgo: 60, files: ["BG.HEIC"])
        runner.canAskToDelete = { false }
        let p = profile()
        let ok = await runner.run(p, trigger: .background)
        XCTAssertTrue(ok)
        XCTAssertEqual(library.deleteRequests, 0)
        XCTAssertEqual(store.pendingDeletion(p.id), ["bg"])
        XCTAssertEqual(store.totalPendingDeletion, 1)
    }

    func testKeepOnDeviceAndPhotosOnly() async throws {
        library.add("pic", daysAgo: 60, files: ["P.HEIC"])
        library.add("clip", daysAgo: 60, files: ["V.MOV"], video: true)
        let p = profile(deleteAfter: false, videos: false)
        let ok = await runner.run(p)
        XCTAssertTrue(ok)
        let files = try await cloudFiles()
        XCTAssertEqual(files.count, 1)
        XCTAssertTrue(files.first?.hasSuffix("P.HEIC") ?? false)
        XCTAssertEqual(library.deleteRequests, 0)
        XCTAssertTrue(store.pendingDeletion(p.id).isEmpty)
    }

    /// The real PhotoKit export of the simulator's photo library, uploaded and
    /// verified; deletion is recorded (iOS would show its confirmation).
    func testRealPhotoLibraryExport() async throws {
        // Never prompt here: nobody can answer it on CI.
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        try XCTSkipUnless(status == .authorized, "photo access not granted (status \(status.rawValue); scripts/integration-test.sh grants it)")
        final class RealExport: PhotoLibrary, @unchecked Sendable {
            let real = PhotoKitLibrary.shared
            var deleted: [String] = []
            func requestAccess() async -> Bool { true }
            func items(includeVideos: Bool, createdBefore: Date?) async -> [PhotoItem] {
                await real.items(includeVideos: includeVideos, createdBefore: createdBefore)
            }
            func export(_ item: PhotoItem, to folder: URL) async throws { try await real.export(item, to: folder) }
            func delete(_ ids: [String]) async throws -> Bool { deleted.append(contentsOf: ids); return true }
        }
        let real = RealExport()
        runner.photoLibrary = real
        let all = await real.items(includeVideos: true, createdBefore: nil)
        try XCTSkipIf(all.isEmpty, "simulator photo library is empty")

        let p = profile(keepDays: 0)
        let ok = await runner.run(p)
        XCTAssertTrue(ok, store.lastRun(p.id)?.output ?? "")
        let files = try await cloudFiles()
        for item in all {
            for resource in item.resources {
                XCTAssertTrue(files.contains(resource.relativePath), "missing \(resource.relativePath)")
            }
        }
        XCTAssertEqual(Set(real.deleted), Set(all.map(\.id)))
    }

    func testMatchedPathsParsing() {
        XCTAssertEqual(SyncRunner.matchedPaths(["= 2026/01/a.jpg", "* 2026/01/b.jpg", "+ c", "! d"]), ["2026/01/a.jpg"])
    }
}
