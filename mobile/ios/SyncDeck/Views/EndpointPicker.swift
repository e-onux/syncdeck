import SwiftUI
import UniformTypeIdentifiers

/// Chooses one side of a profile: a folder inside the app (visible in the
/// Files app), any folder the Files app can reach, or a cloud location.
struct EndpointPicker: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let current: Endpoint
    var cloudOnly = false
    let onPick: (Endpoint) -> Void

    @State private var importing = false
    @State private var importError: String?

    var body: some View {
        NavigationStack {
            List {
                if !cloudOnly {
                Section {
                    NavigationLink {
                        FolderBrowser(source: .local, path: current.kind == .appFolder ? current.path : "", onPick: pick)
                    } label: {
                        Label("On this iPhone (SyncDeck folder)", systemImage: "iphone")
                    }
                    Button {
                        importing = true
                    } label: {
                        Label("Choose a folder in Files…", systemImage: "folder.badge.plus")
                    }
                } header: {
                    Text("Local")
                } footer: {
                    Text("The SyncDeck folder appears in the Files app under On My iPhone. Folders from Files, iCloud Drive or a USB drive are remembered with permission.")
                }
                }

                Section("Cloud") {
                    if store.clients.isEmpty {
                        Text("No clients yet. Add one under Clients.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(store.clients) { client in
                        NavigationLink {
                            FolderBrowser(
                                source: .remote(client.name),
                                path: current.remoteName == client.name ? Self.subpath(of: current.path) : "",
                                onPick: pick
                            )
                        } label: {
                            Label {
                                Text(client.name)
                            } icon: {
                                ProviderIcon(type: client.type)
                            }
                        }
                    }
                }

                if let importError {
                    Text(importError).foregroundStyle(.red).font(.footnote)
                }
            }
            .navigationTitle("Choose location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.folder]) { result in
                switch result {
                case .success(let url):
                    do {
                        pick(try EndpointResolver.bookmark(for: url))
                    } catch {
                        importError = error.localizedDescription
                    }
                case .failure(let error):
                    importError = error.localizedDescription
                }
            }
        }
    }

    private func pick(_ endpoint: Endpoint) {
        onPick(endpoint)
        dismiss()
    }

    static func subpath(of remotePath: String) -> String {
        guard let colon = remotePath.firstIndex(of: ":") else { return "" }
        return String(remotePath[remotePath.index(after: colon)...])
    }
}

/// Folder navigation shared by the app folder and cloud remotes, with
/// breadcrumbs, new-folder and "select this folder".
struct FolderBrowser: View {
    enum Source: Hashable {
        case local
        case remote(String)
    }

    let source: Source
    @State var path: String
    let onPick: (Endpoint) -> Void

    @State private var entries: [RemoteEntry] = []
    @State private var loading = true
    @State private var error: String?
    /// The chosen folder does not exist yet; it is created on the first run.
    @State private var notCreatedYet = false
    @State private var newFolderPrompt = false
    @State private var newFolderName = ""
    @State private var creating = false

    private var title: String {
        switch source {
        case .local: path.isEmpty ? "SyncDeck" : (path as NSString).lastPathComponent
        case .remote(let name): path.isEmpty ? name : (path as NSString).lastPathComponent
        }
    }

    private var fullPath: String {
        switch source {
        case .local: path
        case .remote(let name): "\(name):\(path)"
        }
    }

    var body: some View {
        List {
            Section {
                breadcrumbs
            }
            Section {
                if loading {
                    HStack { ProgressView(); Text("Loading…").foregroundStyle(.secondary) }
                } else if notCreatedYet {
                    Label("This folder does not exist yet. It is created on the first run.", systemImage: "folder.badge.plus")
                        .foregroundStyle(.secondary)
                        .font(.footnote)
                } else if let error {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                        .font(.footnote)
                } else if entries.isEmpty {
                    Text("This folder is empty.").foregroundStyle(.secondary)
                }
                ForEach(entries) { entry in
                    if entry.isDir {
                        Button {
                            path = path.isEmpty ? entry.name : "\(path)/\(entry.name)"
                        } label: {
                            HStack {
                                Label {
                                    Text(entry.name).foregroundStyle(.primary)
                                } icon: {
                                    Image(systemName: "folder.fill").foregroundStyle(.tint)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                            }
                        }
                    } else {
                        HStack {
                            Label(entry.name, systemImage: "doc")
                            Spacer()
                            Text(RcloneArgs.humanBytes(Double(entry.size)))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    newFolderName = ""
                    newFolderPrompt = true
                } label: {
                    Label("New folder", systemImage: "folder.badge.plus")
                }
            }
            ToolbarItem(placement: .bottomBar) {
                Button {
                    switch source {
                    case .local: onPick(.appFolder(path))
                    case .remote: onPick(.remote(fullPath))
                    }
                } label: {
                    Text("Select this folder").bold().frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .alert("New folder", isPresented: $newFolderPrompt) {
            TextField("Folder name", text: $newFolderName)
            Button("Cancel", role: .cancel) {}
            Button("Create") { Task { await createFolder() } }
        } message: {
            Text("Folder name cannot contain / or \\.")
        }
        .task(id: path) { await load() }
        .refreshable { await load() }
    }

    private var breadcrumbs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 4) {
                Button(rootTitle) { path = "" }
                let parts = path.split(separator: "/").map(String.init)
                ForEach(parts.indices, id: \.self) { index in
                    Image(systemName: "chevron.right").font(.caption2).foregroundStyle(.tertiary)
                    Button(parts[index]) { path = parts[0...index].joined(separator: "/") }
                }
            }
            .font(.footnote)
            .buttonStyle(.borderless)
        }
    }

    private var rootTitle: String {
        switch source {
        case .local: "SyncDeck"
        case .remote(let name): "\(name):"
        }
    }

    private func load() async {
        loading = true
        error = nil
        notCreatedYet = false
        defer { loading = false }
        do {
            switch source {
            case .local:
                let url = Paths.appFolder(path)
                try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
                let keys: [URLResourceKey] = [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey]
                let urls = try FileManager.default.contentsOfDirectory(at: url, includingPropertiesForKeys: keys, options: [.skipsHiddenFiles])
                entries = urls.map { item in
                    let values = try? item.resourceValues(forKeys: Set(keys))
                    return RemoteEntry(
                        name: item.lastPathComponent,
                        isDir: values?.isDirectory ?? false,
                        size: Int64(values?.fileSize ?? 0),
                        modified: values?.contentModificationDate
                    )
                }
                .sorted { a, b in a.isDir == b.isDir ? a.name.localizedStandardCompare(b.name) == .orderedAscending : a.isDir }
            case .remote:
                entries = try await RemoteService.list(fullPath)
            }
        } catch {
            entries = []
            let raw = error.localizedDescription.lowercased()
            if !path.isEmpty, raw.contains("not found") {
                notCreatedYet = true
            } else {
                self.error = Friendly.error(error.localizedDescription)
            }
        }
    }

    private func createFolder() async {
        let name = newFolderName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !name.contains("/"), !name.contains("\\") else {
            error = String(localized: "Folder name cannot contain / or \\.")
            return
        }
        let child = path.isEmpty ? name : "\(path)/\(name)"
        do {
            switch source {
            case .local:
                try FileManager.default.createDirectory(at: Paths.appFolder(child), withIntermediateDirectories: true)
            case .remote(let remote):
                try await RemoteService.mkdir("\(remote):\(child)")
            }
            path = child
        } catch {
            self.error = Friendly.error(error.localizedDescription)
        }
    }
}
