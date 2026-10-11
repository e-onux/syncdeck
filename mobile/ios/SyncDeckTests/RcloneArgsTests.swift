import XCTest
@testable import SyncDeck

/// Mirrors app/test/rclone.test.ts so the phone and desktop apps interpret a
/// profile's arguments identically.
final class RcloneArgsTests: XCTestCase {
    func testTokenizeKeepsQuotedRuns() {
        XCTAssertEqual(RcloneArgs.tokenize(#"--exclude "My Files/*" --dry-run"#), ["--exclude", #""My Files/*""#, "--dry-run"])
        XCTAssertEqual(RcloneArgs.tokenize("   "), [])
    }

    func testSetFlagAddsAndRemovesWithValue() {
        var extra = RcloneArgs.setFlag("", "--bwlimit 8M", on: true)
        XCTAssertEqual(extra, "--bwlimit 8M")
        XCTAssertTrue(RcloneArgs.hasFlag(extra, "--bwlimit 8M"))
        extra = RcloneArgs.setFlag(extra + " --checksum", "--bwlimit 8M", on: false)
        XCTAssertEqual(extra, "--checksum")
        XCTAssertEqual(RcloneArgs.setFlag(extra, "--checksum", on: true), "--checksum")
    }

    func testConnectionStringQuotesSpecialValues() {
        let s = RcloneArgs.connectionString(type: "webdav", fields: [("url", "http://127.0.0.1:8080"), ("user", "me"), ("empty", " ")])
        XCTAssertEqual(s, #":webdav,url="http://127.0.0.1:8080",user=me:"#)
        XCTAssertEqual(RcloneArgs.connectionString(type: "s3", fields: []), ":s3:")
    }

    func testLooksRemote() {
        XCTAssertTrue(RcloneArgs.looksRemote("gdrive:"))
        XCTAssertTrue(RcloneArgs.looksRemote("work drive:Backups/2026"))
        XCTAssertFalse(RcloneArgs.looksRemote("/var/mobile/Documents"))
        XCTAssertFalse(RcloneArgs.looksRemote("C:\\Users"))
        XCTAssertEqual(RcloneArgs.remoteName(of: "gdrive:Backups"), "gdrive")
    }

    func testHumanBytes() {
        XCTAssertEqual(RcloneArgs.humanBytes(512), "512 B")
        XCTAssertEqual(RcloneArgs.humanBytes(1536), "1.50 KiB")
        XCTAssertEqual(RcloneArgs.humanBytes(150 * 1024 * 1024), "150 MiB")
    }

    func testAuthErrorDetection() {
        XCTAssertTrue(RcloneArgs.isAuthError("Failed to create file system: couldn't fetch token: invalid_grant"))
        XCTAssertTrue(RcloneArgs.isAuthError("AADSTS70000: token expired"))
        XCTAssertFalse(RcloneArgs.isAuthError("directory not found"))
        XCTAssertEqual(RcloneArgs.firstMeaningfulLine("a\n\noauth2: cannot fetch token\nlast"), "oauth2: cannot fetch token")
        XCTAssertTrue(RcloneArgs.needsBisyncResync("Bisync aborted. Must run --resync to recover."))
    }

    func testRcOptionsMapping() {
        let o = RcloneArgs.rcOptions(from: #"--dry-run --checksum --transfers 2 --exclude "*.tmp" --exclude=.DS_Store --max-age 7d --bwlimit 8M --delete-excluded --weird"#)
        XCTAssertEqual(o.config["DryRun"], true)
        XCTAssertEqual(o.config["CheckSum"], true)
        XCTAssertEqual(o.config["Transfers"], 2)
        XCTAssertEqual(o.filter["ExcludeRule"], ["*.tmp", ".DS_Store"])
        XCTAssertEqual(o.filter["MaxAge"], "7d")
        XCTAssertEqual(o.filter["DeleteExcluded"], true)
        XCTAssertEqual(o.bwlimit, "8M")
        XCTAssertEqual(o.ignored, ["--weird"])
    }

    func testVersionComparison() {
        XCTAssertTrue(AppVersion.isAtLeast("1.74.10", "1.74.9"))
        XCTAssertFalse(AppVersion.isAtLeast("1.74.3", "1.75"))
        XCTAssertTrue(AppVersion.isAtLeast("0.3.6", "0.3.6"))
    }
}

final class ServiceParsingTests: XCTestCase {
    func testSplitRemotePath() {
        XCTAssertEqual(RemoteService.split("gdrive:a/b").fs, "gdrive:")
        XCTAssertEqual(RemoteService.split("gdrive:a/b").remote, "a/b")
        XCTAssertEqual(RemoteService.split(":webdav,url=x:").fs, ":webdav,url=x:")
    }

    func testSanitizeName() {
        XCTAssertEqual(RemoteService.sanitizeName(" Work Drive: "), "Work-Drive-")
    }

    func testAdvisoryFiltering() throws {
        let json = """
        {"advisories":[
          {"id":"a","providers":["drive"],"message":{"en":"Drive","tr":"Drive tr"}},
          {"id":"b","minRcloneVersion":"1.70.0","message":"old engine"},
          {"id":"c","minAppVersion":"9.0.0","message":"old app"},
          {"id":"bad"}
        ]}
        """
        let all = try AdvisoryFeed.decode(Data(json.utf8))
        XCTAssertEqual(all.map(\.id), ["a", "b", "c"])
        let visible = AdvisoryFeed.applicable(all, providers: ["onedrive"], engineVersion: "1.75.2", appVersion: "0.3.6")
        XCTAssertEqual(visible.map(\.id), ["c"])
        XCTAssertEqual(all[0].message.text(for: "tr"), "Drive tr")
    }

    func testOAuthURLExtraction() {
        let line = "2026/10/11 NOTICE: Please go to the following link: http://127.0.0.1:53682/auth?state=AbC_12-x"
        XCTAssertEqual(OAuthBroker.extractAuthURL(line)?.absoluteString, "http://127.0.0.1:53682/auth?state=AbC_12-x")
        XCTAssertNil(OAuthBroker.extractAuthURL("nothing here"))
    }

    func testEngineLogEntry() {
        XCTAssertEqual(SyncRunner.engineLogEntry("2026/10/11 08:01:02 ERROR : a.txt: failed to copy"), "✗ a.txt: failed to copy")
        XCTAssertEqual(SyncRunner.engineLogEntry("2026/10/11 NOTICE: Bisync critical error: Must run --resync to recover."), "• Bisync critical error: Must run --resync to recover.")
        XCTAssertNil(SyncRunner.engineLogEntry("2026/10/11 INFO  : a.txt: Copied (new)"))
        XCTAssertNil(SyncRunner.engineLogEntry("NOTICE: Please go to the following link: http://127.0.0.1:53682/auth?state=x"))
    }

    func testCheckSummary() {
        let lines = SyncRunner.checkSummary(["combined": ["= a", "* b", "+ c", "- d", "= e"]])
        XCTAssertTrue(lines.contains("Identical: 2"))
        XCTAssertTrue(lines.contains("* b"))
        XCTAssertFalse(lines.contains("= a"))
    }
}
