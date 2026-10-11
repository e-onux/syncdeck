import Foundation
import Photos

/// One photo or video in the device library and the files it is made of.
struct PhotoItem: Identifiable, Hashable, Sendable {
    struct Resource: Hashable, Sendable {
        /// Path relative to the backup folder, e.g. "2026/10/IMG_0001.HEIC".
        var relativePath: String
        var size: Int64
    }

    var id: String
    var created: Date
    var isVideo: Bool
    var resources: [Resource]

    var totalSize: Int64 { resources.reduce(0) { $0 + $1.size } }
}

/// The parts of the photo library the "free up space" flow needs. The real
/// implementation is PhotoKit; tests swap the deletion step out because iOS
/// asks the user to confirm every deletion.
protocol PhotoLibrary: Sendable {
    func requestAccess() async -> Bool
    func items(includeVideos: Bool, createdBefore: Date?) async -> [PhotoItem]
    /// Writes every resource of `item` below `folder`, at its relative path.
    func export(_ item: PhotoItem, to folder: URL) async throws
    /// Removes the items from the device. iOS shows its own confirmation and
    /// moves them to Recently Deleted. Returns false if the user declined.
    func delete(_ ids: [String]) async throws -> Bool
}

final class PhotoKitLibrary: PhotoLibrary, @unchecked Sendable {
    static let shared = PhotoKitLibrary()

    func requestAccess() async -> Bool {
        let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        return status == .authorized || status == .limited
    }

    func items(includeVideos: Bool, createdBefore: Date?) async -> [PhotoItem] {
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
        var predicates = [NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)]
        if includeVideos {
            predicates = [NSPredicate(format: "mediaType == %d OR mediaType == %d", PHAssetMediaType.image.rawValue, PHAssetMediaType.video.rawValue)]
        }
        if let createdBefore {
            predicates.append(NSPredicate(format: "creationDate < %@", createdBefore as NSDate))
        }
        options.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
        let result = PHAsset.fetchAssets(with: options)

        var items: [PhotoItem] = []
        var usedPaths: Set<String> = []
        result.enumerateObjects { asset, _, _ in
            let resources = Self.backupResources(of: asset)
            guard !resources.isEmpty else { return }
            let created = asset.creationDate ?? Date(timeIntervalSince1970: 0)
            let folder = Self.folder(for: created)
            var files: [PhotoItem.Resource] = []
            for resource in resources {
                var name = Self.fileName(resource.resource, edited: resource.edited)
                // Camera counters wrap (IMG_0001 again); keep both files.
                if usedPaths.contains("\(folder)/\(name)") {
                    name = Self.disambiguate(name, with: asset.localIdentifier)
                }
                usedPaths.insert("\(folder)/\(name)")
                let size = (resource.resource.value(forKey: "fileSize") as? NSNumber)?.int64Value ?? 0
                files.append(.init(relativePath: "\(folder)/\(name)", size: size))
            }
            items.append(PhotoItem(id: asset.localIdentifier, created: created, isVideo: asset.mediaType == .video, resources: files))
        }
        return items
    }

    func export(_ item: PhotoItem, to folder: URL) async throws {
        guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [item.id], options: nil).firstObject else {
            throw CocoaError(.fileNoSuchFile)
        }
        let resources = Self.backupResources(of: asset)
        let options = PHAssetResourceRequestOptions()
        // Originals may only be in iCloud ("Optimize iPhone Storage").
        options.isNetworkAccessAllowed = true
        for (resource, file) in zip(resources, item.resources) {
            let target = folder.appendingPathComponent(file.relativePath)
            try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? FileManager.default.removeItem(at: target)
            try await PHAssetResourceManager.default().writeData(for: resource.resource, toFile: target, options: options)
            // Keep the capture date on the uploaded file.
            try? FileManager.default.setAttributes([.modificationDate: item.created, .creationDate: item.created], ofItemAtPath: target.path)
        }
    }

    func delete(_ ids: [String]) async throws -> Bool {
        guard !ids.isEmpty else { return true }
        let assets = PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
        do {
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.deleteAssets(assets)
            }
            return true
        } catch let error as NSError where error.domain == "PHPhotosErrorDomain" && error.code == 3072 {
            // PHPhotosError.userCancelled: the user tapped "Don't Allow".
            return false
        }
    }

    // MARK: - Helpers

    private struct BackupResource {
        var resource: PHAssetResource
        var edited: Bool
    }

    /// The original photo/video, the edited version if there is one, and the
    /// video half of a Live Photo. Nothing that would be lost on deletion is
    /// left out.
    private static func backupResources(of asset: PHAsset) -> [BackupResource] {
        let all = PHAssetResource.assetResources(for: asset)
        var picked: [BackupResource] = []
        let originals: [PHAssetResourceType] = [.photo, .video, .pairedVideo, .alternatePhoto]
        let edits: [PHAssetResourceType] = [.fullSizePhoto, .fullSizeVideo, .fullSizePairedVideo]
        for resource in all where originals.contains(resource.type) {
            picked.append(BackupResource(resource: resource, edited: false))
        }
        for resource in all where edits.contains(resource.type) {
            picked.append(BackupResource(resource: resource, edited: true))
        }
        return picked
    }

    static func folder(for date: Date) -> String {
        let parts = Calendar(identifier: .gregorian).dateComponents([.year, .month], from: date)
        return String(format: "%04d/%02d", parts.year ?? 1970, parts.month ?? 1)
    }

    private static func fileName(_ resource: PHAssetResource, edited: Bool) -> String {
        let original = resource.originalFilename.isEmpty ? "photo" : resource.originalFilename
        guard edited else { return original }
        let base = (original as NSString).deletingPathExtension
        let ext = (original as NSString).pathExtension
        return ext.isEmpty ? "\(base)_edited" : "\(base)_edited.\(ext)"
    }

    static func disambiguate(_ name: String, with id: String) -> String {
        let tag = String(id.prefix(8)).replacingOccurrences(of: "/", with: "")
        let base = (name as NSString).deletingPathExtension
        let ext = (name as NSString).pathExtension
        return ext.isEmpty ? "\(base)_\(tag)" : "\(base)_\(tag).\(ext)"
    }
}
