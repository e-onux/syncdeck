import SwiftUI

struct RootView: View {
    @Environment(AppStore.self) private var store
    @State private var tab: Tab = .profiles

    enum Tab: Hashable { case profiles, clients, settings }

    var body: some View {
        Group {
            if store.engineReady {
                TabView(selection: $tab) {
                    ProfilesView()
                        .tabItem { Label("Profiles", systemImage: "arrow.triangle.2.circlepath") }
                        .tag(Tab.profiles)
                    ClientsView()
                        .tabItem { Label("Clients", systemImage: "cloud") }
                        .badge(store.authAlerts.isEmpty ? 0 : store.authAlerts.count)
                        .tag(Tab.clients)
                    SettingsView()
                        .tabItem { Label("Settings", systemImage: "gearshape") }
                        .tag(Tab.settings)
                }
            } else {
                EngineStartingView()
            }
        }
    }
}

private struct EngineStartingView: View {
    @State private var waited = false

    var body: some View {
        VStack(spacing: 16) {
            if waited {
                Image(systemName: "exclamationmark.triangle")
                    .font(.largeTitle)
                    .foregroundStyle(.orange)
                Text("SyncDeck engine is not running")
                    .font(.headline)
                Text("The bundled sync engine could not be started. Reinstall SyncDeck or rebuild it with the engine included.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            } else {
                ProgressView()
                Text("Starting engine…")
                    .foregroundStyle(.secondary)
            }
        }
        .padding(32)
        .task {
            try? await Task.sleep(for: .seconds(8))
            waited = true
        }
    }
}
