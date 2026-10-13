import SwiftUI

struct ProfilesView: View {
    @Environment(AppStore.self) private var store
    @Environment(SyncRunner.self) private var runner
    @State private var path: [String] = []
    @State private var reconnecting: String?

    var body: some View {
        NavigationStack(path: $path) {
            List {
                NoticesSection(onReauthorize: { reconnecting = $0 })
                PendingPhotoRemovalSection()

                if store.profiles.isEmpty {
                    EmptyState(
                        symbol: "arrow.triangle.2.circlepath",
                        title: "No profiles yet",
                        message: "Free up space by moving photos and videos to your cloud, or keep a folder in sync."
                    ) {
                        Button {
                            addProfile(photos: true)
                        } label: {
                            Label("Free up space", systemImage: "photo.on.rectangle.angled")
                                .frame(maxWidth: .infinity)
                                // The icon otherwise takes the accent colour and vanishes on the filled button.
                                .foregroundStyle(.white)
                        }
                        .buttonStyle(.borderedProminent)
                        Button {
                            addProfile(photos: false)
                        } label: {
                            Label("Sync a folder", systemImage: "folder")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }
                    .listRowBackground(Color.clear)
                } else {
                    Section {
                        ForEach(store.profiles) { profile in
                            NavigationLink(value: profile.id) {
                                ProfileRow(profile: profile)
                            }
                            .swipeActions(edge: .leading) {
                                if runner.isRunning(profile.id) {
                                    Button("Stop", systemImage: "stop.fill") { runner.stop(profile.id) }
                                        .tint(.red)
                                } else {
                                    Button("Run now", systemImage: "play.fill") {
                                        Task { await runner.run(profile) }
                                    }
                                    .tint(.accentColor)
                                }
                            }
                            .swipeActions(edge: .trailing) {
                                Button("Delete", systemImage: "trash", role: .destructive) {
                                    store.deleteProfile(profile.id)
                                }
                                .disabled(runner.isRunning(profile.id))
                            }
                        }
                        .onMove { store.moveProfiles(from: $0, to: $1) }
                    } footer: {
                        Text("Swipe right to run, left to delete.")
                    }
                }
            }
            .navigationTitle("Profiles")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            addProfile(photos: true)
                        } label: {
                            Label("Free up space: photos to cloud", systemImage: "photo.on.rectangle.angled")
                        }
                        Button {
                            addProfile(photos: false)
                        } label: {
                            Label("Sync a folder", systemImage: "folder")
                        }
                    } label: {
                        Label("New profile", systemImage: "plus")
                    }
                }
                if !store.profiles.isEmpty {
                    ToolbarItem(placement: .topBarLeading) { EditButton() }
                }
            }
            .navigationDestination(for: String.self) { id in
                ProfileDetailView(profileID: id)
            }
            .refreshable { await store.reloadClients() }
            .reconnectSheet(name: $reconnecting)
        }
    }

    private func addProfile(photos: Bool) {
        var profile = SyncProfile(name: photos ? String(localized: "Photos to cloud") : String(localized: "New profile"))
        if photos {
            profile.source = .photos
            profile.mode = .copy
            profile.photo = PhotoOptions()
            profile.intervalMinutes = 1440
        }
        if let first = store.clients.first {
            profile.destination = .remote(photos ? "\(first.name):\(String(localized: "iPhone Photos"))" : "\(first.name):")
        }
        store.upsert(profile)
        path.append(profile.id)
    }
}

private struct ProfileRow: View {
    @Environment(AppStore.self) private var store
    @Environment(SyncRunner.self) private var runner
    let profile: SyncProfile

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(profile.name).font(.headline).lineLimit(1)
                ModeBadge(mode: profile.mode)
                if profile.intervalMinutes > 0 && profile.enabled {
                    Image(systemName: "clock")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel(Text("Scheduled"))
                }
                Spacer()
                status
            }
            HStack(spacing: 6) {
                EndpointLabel(endpoint: profile.source, store: store)
                Image(systemName: profile.mode == .bisync ? "arrow.left.arrow.right" : "arrow.right")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                EndpointLabel(endpoint: profile.destination, store: store)
            }
            .font(.caption)
            .labelStyle(CompactLabelStyle())
            if let progress = runner.running[profile.id] {
                if let fraction = progress.fraction {
                    ProgressView(value: fraction)
                } else {
                    ProgressView().progressViewStyle(.linear)
                }
            }
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder private var status: some View {
        if runner.isRunning(profile.id) {
            ProgressView().controlSize(.small)
        } else if let last = store.lastRun(profile.id) {
            Image(systemName: last.ok ? "checkmark.circle.fill" : "xmark.octagon.fill")
                .foregroundStyle(last.ok ? .green : .red)
                .accessibilityLabel(Text(last.ok ? "Last run succeeded" : "Last run failed"))
        }
    }
}

struct CompactLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.icon.foregroundStyle(.secondary)
            configuration.title
        }
    }
}

/// Photos that are safely in the cloud but still on the iPhone because iOS
/// could not ask for confirmation at the time (background run) or the user
/// declined. One tap removes them.
struct PendingPhotoRemovalSection: View {
    @Environment(AppStore.self) private var store
    @Environment(SyncRunner.self) private var runner
    @State private var working = false

    var body: some View {
        let profiles = store.profiles.filter { !store.pendingDeletion($0.id).isEmpty }
        if !profiles.isEmpty {
            Section {
                ForEach(profiles) { profile in
                    let count = store.pendingDeletion(profile.id).count
                    VStack(alignment: .leading, spacing: 8) {
                        Label {
                            Text("\(count) photos and videos are safely in your cloud and can be removed from this iPhone.")
                                .font(.subheadline)
                        } icon: {
                            Image(systemName: "checkmark.icloud.fill").foregroundStyle(.green)
                        }
                        Button {
                            Task {
                                working = true
                                _ = try? await runner.removeBackedUpPhotos(profileID: profile.id)
                                working = false
                            }
                        } label: {
                            HStack {
                                Text("Remove from iPhone")
                                if working { ProgressView().padding(.leading, 4) }
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(working)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }
}
