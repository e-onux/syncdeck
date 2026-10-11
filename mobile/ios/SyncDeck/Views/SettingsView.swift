import SwiftUI

struct SettingsView: View {
    @Environment(AppStore.self) private var store
    @State private var checking = false

    var body: some View {
        @Bindable var store = store
        NavigationStack {
            Form {
                Section("Interface") {
                    Picker("Theme", selection: $store.theme) {
                        Text("System").tag(AppTheme.system)
                        Text("Light").tag(AppTheme.light)
                        Text("Dark").tag(AppTheme.dark)
                    }
                    Picker("Accent color", selection: $store.accent) {
                        ForEach(AccentName.allCases) { accent in
                            Label {
                                Text(accent.rawValue.capitalized)
                            } icon: {
                                Image(systemName: "circle.fill").foregroundStyle(Color(hex: accent.hex))
                            }
                            .tag(accent)
                        }
                    }
                    Button {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        LabeledContent("Language") {
                            Text(Locale.current.localizedString(forLanguageCode: Locale.current.language.languageCode?.identifier ?? "en") ?? "")
                        }
                    }
                    .foregroundStyle(.primary)
                }

                Section {
                    Toggle("Background sync", isOn: $store.backgroundSync)
                } header: {
                    Text("System")
                } footer: {
                    Text("Runs scheduled profiles when you open SyncDeck and in the background when iOS grants time. Background App Refresh must be on for SyncDeck in iOS Settings.")
                }

                Section {
                    LabeledContent("Sync engine", value: store.engineVersion.map { "rclone v\($0)" } ?? "-")
                    LabeledContent("Version", value: AppVersion.current)
                    Button {
                        Task {
                            checking = true
                            await store.refreshAdvisories(force: true)
                            checking = false
                        }
                    } label: {
                        HStack {
                            Text("Check for notices")
                            Spacer()
                            if checking { ProgressView() }
                        }
                    }
                } header: {
                    Text("Engine")
                } footer: {
                    Text("On iPhone the engine is built into the app and updates with it.")
                }

                Section("About") {
                    Text("SyncDeck is a graphical wrapper around the independent open-source rclone project. All transfers are performed by the rclone engine; SyncDeck presents it with a friendly interface. rclone is bundled with the app, no separate install needed.")
                        .font(.footnote)
                    Link(destination: URL(string: "https://rclone.org")!) {
                        Label("rclone.org", systemImage: "link")
                    }
                    Link(destination: URL(string: "https://sidrelabs.com/syncdeck")!) {
                        Label("sidrelabs.com/syncdeck", systemImage: "globe")
                    }
                    Link(destination: URL(string: "https://github.com/e-onux/syncdeck")!) {
                        Label("Source code", systemImage: "chevron.left.forwardslash.chevron.right")
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }
}
