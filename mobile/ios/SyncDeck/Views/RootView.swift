import SwiftUI

struct RootView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var tab: Tab = .profiles
    @State private var splash = true

    enum Tab: Hashable { case profiles, clients, settings }

    var body: some View {
        content
            .overlay {
                if splash {
                    SplashView().transition(.opacity)
                }
            }
            .task {
                // Play the animation through, then wait (briefly) for the engine
                // so the app does not open on the "starting" placeholder.
                try? await Task.sleep(for: reduceMotion ? .milliseconds(600) : SplashView.duration)
                for _ in 0..<40 where !store.engineReady {
                    try? await Task.sleep(for: .milliseconds(100))
                }
                withAnimation(.easeOut(duration: 0.35)) { splash = false }
            }
    }

    private var content: some View {
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
