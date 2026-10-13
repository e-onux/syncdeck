import XCTest
@testable import SyncDeck

/// The well-known services list, checked against the engine linked into the
/// app (the desktop CI checks the same file against the rclone CLI).
@MainActor
final class PresetTests: XCTestCase {
    private var catalog: PresetCatalog { .shared }

    func testBundledCopyMatchesSharedSource() throws {
        // Simulator tests can read the host checkout next to this file.
        let source = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("sources/provider-presets.json")
        let bundled = try XCTUnwrap(Bundle.main.url(forResource: "provider-presets", withExtension: "json"))
        XCTAssertEqual(try Data(contentsOf: bundled), try Data(contentsOf: source), "run scripts/build-strings.py")
        XCTAssertGreaterThan(catalog.presets.count, 40)
    }

    func testEveryPresetResolvesAgainstTheEngine() async throws {
        RcloneEngine.shared.start(configPath: Paths.rcloneConfig.path)
        let types = try await RemoteService.backendTypes()
        for preset in catalog.presets {
            let type = try XCTUnwrap(types.first { $0.id == preset.backend }, "\(preset.id): backend \(preset.backend) not in engine")
            let options = preset.options(in: type)
            XCTAssertEqual(options.map(\.name), preset.fields, "\(preset.id): every field needs an option for \(preset.provider ?? "-")")
            for (key, value) in preset.set ?? [:] {
                let choices = type.options.filter { $0.name == key }.flatMap(\.examples).map(\.value)
                XCTAssertFalse(choices.isEmpty, "\(preset.id): \(key) is not a choice option")
                XCTAssertTrue(choices.contains(value), "\(preset.id): \(key)=\(value) not offered by rclone")
            }
        }
    }

    func testResolvesProviderSpecificVariants() async throws {
        RcloneEngine.shared.start(configPath: Paths.rcloneConfig.path)
        let types = try await RemoteService.backendTypes()
        let s3 = try XCTUnwrap(types.first { $0.id == "s3" })
        let scaleway = try XCTUnwrap(catalog.presets.first { $0.id == "scaleway" })
        let region = try XCTUnwrap(scaleway.options(in: s3).first { $0.name == "region" })
        XCTAssertTrue(region.examples.contains { $0.value == "fr-par" }, "Scaleway's own region list")
        XCTAssertFalse(region.examples.contains { $0.value == "us-east-1" }, "not AWS's")
        XCTAssertTrue(Presets.matches(filter: "!AWS,Ceph", provider: "Wasabi"))
        XCTAssertFalse(Presets.matches(filter: "AWS", provider: "Wasabi"))
    }

    func testRecognisesTheServiceOfAnExistingRemote() {
        XCTAssertEqual(catalog.preset(type: "s3", settings: ["provider": "Wasabi"])?.id, "wasabi")
        XCTAssertEqual(catalog.preset(type: "webdav", settings: ["vendor": "owncloud"])?.id, "owncloud")
        XCTAssertNil(catalog.preset(type: "s3", settings: ["provider": "Other"]), "ambiguous: many services use Other")
    }

    func testLabelsAreLocalized() throws {
        let group = try XCTUnwrap(catalog.groups.first { $0.id == "s3" })
        XCTAssertEqual(group.label.text(for: "tr"), "S3 uyumlu depolama")
        XCTAssertEqual(group.tag?.text(for: "de"), "S3-kompatibel")
        let other = try XCTUnwrap(catalog.presets.first { $0.id == "webdav-other" })
        XCTAssertEqual(other.name.text(for: "xx"), "Other WebDAV server")
        XCTAssertTrue(try XCTUnwrap(catalog.presets.first { $0.id == "nextcloud" }).matches("nextc"))
    }

    /// A Nextcloud-style client made from the preset (vendor fixed, three
    /// fields) really connects, against the local WebDAV test server.
    func testPresetCreatesWorkingClient() async throws {
        let env = ProcessInfo.processInfo.environment
        let url = env["SYNCDECK_IT_WEBDAV_URL"] ?? ""
        try XCTSkipIf(url.isEmpty, "integration servers not configured")
        RcloneEngine.shared.start(configPath: Paths.rcloneConfig.path)
        let preset = try XCTUnwrap(catalog.presets.first { $0.id == "webdav-other" })
        var params = ["url": url, "user": env["SYNCDECK_IT_USER"] ?? "", "pass": env["SYNCDECK_IT_PASS"] ?? ""]
        params.merge(preset.set ?? [:]) { _, fixed in fixed }
        try? await RemoteService.delete("it-preset")
        _ = try await RemoteService.create(name: "it-preset", type: preset.backend, parameters: params)
        defer { Task { try? await RemoteService.delete("it-preset") } }
        let failure = await RemoteService.test("it-preset:")
        XCTAssertNil(failure)
        let settings = await RemoteService.configSection("it-preset")
        XCTAssertEqual(settings["vendor"], "other")
    }
}
