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

                if store.profiles.isEmpty {
                    ContentUnavailableView {
                        Label("No profiles yet", systemImage: "arrow.triangle.2.circlepath")
                    } description: {
                        Text("A profile syncs a folder on this iPhone with a cloud location. Add a client first, then create a profile.")
                    } actions: {
                        Button("New profile", action: addProfile)
                            .buttonStyle(.borderedProminent)
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
                    Button(action: addProfile) {
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

    private func addProfile() {
        var profile = SyncProfile(name: String(localized: "New profile"))
        if let first = store.clients.first {
            profile.destination = .remote("\(first.name):")
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
