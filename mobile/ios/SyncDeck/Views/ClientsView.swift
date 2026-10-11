import SwiftUI

struct ClientsView: View {
    @Environment(AppStore.self) private var store
    @State private var showWizard = false
    @State private var reconnecting: String?

    var body: some View {
        NavigationStack {
            List {
                NoticesSection(onReauthorize: { reconnecting = $0 })
                if store.clients.isEmpty {
                    ContentUnavailableView {
                        Label("No clients yet", systemImage: "cloud")
                    } description: {
                        Text("No clients yet. Start by adding one.")
                    } actions: {
                        Button("New client") { showWizard = true }
                            .buttonStyle(.borderedProminent)
                    }
                    .listRowBackground(Color.clear)
                } else {
                    Section("Defined clients") {
                        ForEach(store.clients) { client in
                            NavigationLink {
                                ClientDetailView(client: client)
                            } label: {
                                ClientRow(client: client)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Clients")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showWizard = true
                    } label: {
                        Label("New client", systemImage: "plus")
                    }
                }
            }
            .refreshable { await store.reloadClients() }
            .sheet(isPresented: $showWizard) {
                ClientWizard()
            }
            .reconnectSheet(name: $reconnecting)
        }
    }
}

private struct ClientRow: View {
    @Environment(AppStore.self) private var store
    let client: RemoteClient
    @State private var quota: QuotaInfo?

    var body: some View {
        HStack(spacing: 12) {
            ProviderIcon(type: client.type, size: 26)
            VStack(alignment: .leading, spacing: 2) {
                Text(client.name).font(.headline)
                HStack(spacing: 6) {
                    Text(Friendly.providerName(client.type, fallback: store.backendType(client.type)?.description))
                    if let free = quota?.free {
                        Text("· \(RcloneArgs.humanBytes(free)) free")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
            Spacer()
            if store.authAlerts[client.name] != nil {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                    .accessibilityLabel(Text("Session expired"))
            }
        }
        .task(id: client.name) { quota = await RemoteService.about(client.name) }
    }
}

struct ClientDetailView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let client: RemoteClient

    @State private var quota: QuotaInfo?
    @State private var quotaLoaded = false
    @State private var testState: TestState = .idle
    @State private var settings: [String: String] = [:]
    @State private var confirmDelete = false
    @State private var reconnecting: ReconnectTarget?
    @State private var error: String?

    enum TestState: Equatable { case idle, running, ok, failed(String) }

    private var isOAuth: Bool {
        guard let type = store.backendType(client.type) else { return false }
        return ClientWizard.isOAuth(type)
    }

    var body: some View {
        List {
            Section {
                LabeledContent("Name", value: client.name)
                LabeledContent("Type", value: Friendly.providerName(client.type, fallback: store.backendType(client.type)?.description))
                if store.authAlerts[client.name] != nil {
                    Banner(style: .warning, text: Friendly.error("token expired"), actionTitle: "Sign in again") {
                        reconnecting = ReconnectTarget(name: client.name, signIn: true)
                    }
                }
            }

            Section("Storage") {
                if let quota {
                    if let total = quota.total { LabeledContent("Total", value: RcloneArgs.humanBytes(total)) }
                    if let used = quota.used { LabeledContent("Used", value: RcloneArgs.humanBytes(used)) }
                    if let free = quota.free { LabeledContent("Free", value: RcloneArgs.humanBytes(free)) }
                    if let total = quota.total, let used = quota.used, total > 0 {
                        ProgressView(value: min(1, used / total))
                    }
                } else if quotaLoaded {
                    Text("This provider does not report quota.").foregroundStyle(.secondary)
                } else {
                    ProgressView()
                }
            }

            Section {
                Button {
                    Task { await test() }
                } label: {
                    HStack {
                        Label("Test connection", systemImage: "bolt.horizontal")
                        Spacer()
                        switch testState {
                        case .idle: EmptyView()
                        case .running: ProgressView()
                        case .ok: Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                        case .failed: Image(systemName: "xmark.circle.fill").foregroundStyle(.red)
                        }
                    }
                }
                if case .failed(let message) = testState {
                    ErrorDetail(raw: message)
                }
                NavigationLink {
                    FolderBrowser(source: .remote(client.name), path: "", onPick: { _ in })
                } label: {
                    Label("Browse files", systemImage: "folder")
                }
                if isOAuth {
                    Button {
                        reconnecting = ReconnectTarget(name: client.name, signIn: true)
                    } label: {
                        Label("Sign in again", systemImage: "person.crop.circle.badge.checkmark")
                    }
                }
            }

            Section {
                DisclosureGroup("Technical details") {
                    ForEach(settings.sorted { $0.key < $1.key }, id: \.key) { key, value in
                        LabeledContent(key) {
                            Text(Self.isSecretKey(key) ? "••••••" : value)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                        .font(.footnote)
                    }
                    if isOAuth {
                        Button {
                            reconnecting = ReconnectTarget(name: client.name, signIn: false)
                        } label: {
                            Label("Run setup again", systemImage: "slider.horizontal.3")
                        }
                    }
                }
            }

            Section {
                Button("Delete", role: .destructive) { confirmDelete = true }
                if let error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
            }
        }
        .navigationTitle(client.name)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .confirmationDialog(
            String(localized: "Delete client \"\(client.name)\"? This cannot be undone."),
            isPresented: $confirmDelete,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task {
                    do {
                        try await RemoteService.delete(client.name)
                        store.forgetClient(client.name)
                        await store.reloadClients()
                        dismiss()
                    } catch {
                        self.error = error.localizedDescription
                    }
                }
            }
        }
        .sheet(item: $reconnecting, onDismiss: { Task { await load() } }) { target in
            ReconnectView(name: target.name, signIn: target.signIn)
        }
    }

    static func isSecretKey(_ key: String) -> Bool {
        ["token", "pass", "password", "password2", "secret", "key", "client_secret", "secret_access_key", "session_token"]
            .contains { key == $0 || key.hasSuffix("_\($0)") }
    }

    private func load() async {
        quota = await RemoteService.about(client.name)
        quotaLoaded = true
        settings = await RemoteService.configSection(client.name).filter { $0.key != "type" }
    }

    private func test() async {
        testState = .running
        if let failure = await RemoteService.test("\(client.name):") {
            testState = .failed(failure)
        } else {
            testState = .ok
            store.clearAuthAlert(client.name)
        }
    }
}

// MARK: - Re-authorization

private struct ReconnectSheet: ViewModifier {
    @Binding var name: String?

    func body(content: Content) -> some View {
        content.sheet(item: Binding(
            get: { name.map(ReconnectTarget.init) },
            set: { name = $0?.name }
        )) { target in
            ReconnectView(name: target.name, signIn: true)
        }
    }

    struct ReconnectTarget: Identifiable {
        let name: String
        var id: String { name }
    }
}

struct ReconnectTarget: Identifiable {
    let name: String
    /// false: keep the token and only answer the setup questions again.
    let signIn: Bool
    var id: String { "\(name)|\(signIn)" }
}

extension View {
    func reconnectSheet(name: Binding<String?>) -> some View {
        modifier(ReconnectSheet(name: name))
    }
}

private struct ReconnectView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let name: String
    var signIn = true

    @State private var phase: Phase = .authorizing
    @State private var question: RemoteService.ConfigQuestion?
    @State private var answering = false

    enum Phase: Equatable { case authorizing, done, failed(String) }

    var body: some View {
        NavigationStack {
            Group {
                if let question {
                    ConfigQuestionForm(question: question, busy: answering) { answer in
                        Task { await respond(answer, to: question) }
                    }
                } else {
                    VStack(spacing: 16) {
                    switch phase {
                    case .authorizing:
                        ProgressView()
                        if signIn {
                            Text("Waiting for sign-in…").font(.headline)
                            Text("Sign in in the browser sheet; SyncDeck stores the refreshed token in its local engine config.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                        }
                    case .done:
                        Image(systemName: "checkmark.circle.fill").font(.largeTitle).foregroundStyle(.green)
                        Text(signIn ? "Authorized" : "Client updated").font(.headline)
                    case .failed(let message):
                        Image(systemName: "xmark.octagon.fill").font(.largeTitle).foregroundStyle(.red)
                        ErrorDetail(raw: message)
                    }
                    }
                    .padding(24)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle(name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(phase == .authorizing ? "Cancel" : "Close") {
                        if phase == .authorizing { OAuthBroker.shared.cancel() }
                        dismiss()
                    }
                }
            }
        }
        .interactiveDismissDisabled(phase == .authorizing)
        .task { await start() }
    }

    private func start() async {
        OAuthBroker.shared.begin()
        defer { OAuthBroker.shared.end() }
        do {
            question = try await (signIn ? RemoteService.reconnect(name) : RemoteService.reconfigure(name))
            if question == nil { finish() }
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    private func respond(_ answer: String, to current: RemoteService.ConfigQuestion) async {
        answering = true
        OAuthBroker.shared.begin()
        defer {
            answering = false
            OAuthBroker.shared.end()
        }
        do {
            question = try await RemoteService.reply(name: name, question: current, result: answer)
            if question == nil { finish() }
        } catch {
            question = nil
            phase = .failed(error.localizedDescription)
        }
    }

    private func finish() {
        store.clearAuthAlert(name)
        phase = .done
        Task {
            await store.reloadClients()
            try? await Task.sleep(for: .seconds(1))
            dismiss()
        }
    }
}

/// Renders one rclone config question (an option with help text, examples and
/// a default) and returns the user's answer. A question that only carries an
/// error (rclone's ConfigError) shows the error and continues with an empty
/// answer, which makes rclone ask its previous question again.
struct ConfigQuestionForm: View {
    let question: RemoteService.ConfigQuestion
    var busy = false
    let onSubmit: (String) -> Void
    @State private var value = ""

    private var option: BackendOption { question.option }

    /// rclone can list the same id twice (OneDrive returns a drive under two
    /// names); keep the first so only one row shows as selected.
    private var examples: [BackendOption.Example] {
        var seen: Set<String> = []
        return option.examples.filter { seen.insert($0.value).inserted }
    }

    var body: some View {
        Form {
            Section {
                if !option.help.isEmpty {
                    Text(option.help).font(.footnote)
                }
                if let error = question.error {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
            }
            if question.hasOption {
                Section {
                    if !examples.isEmpty {
                        Picker(option.name, selection: $value) {
                            ForEach(examples, id: \.value) { example in
                                // rclone puts the readable name (a drive or site
                                // name) in the help and an id in the value.
                                VStack(alignment: .leading) {
                                    Text(example.help.isEmpty ? example.value : example.help)
                                    if !example.help.isEmpty {
                                        Text(example.value).font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                                .tag(example.value)
                            }
                        }
                        .pickerStyle(.inline)
                        .labelsHidden()
                    }
                    if examples.isEmpty || !option.exclusive {
                        if option.secret {
                            SecureField(option.name, text: $value)
                        } else {
                            TextField(option.name, text: $value)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }
                    }
                }
            }
            Section {
                Button {
                    onSubmit(question.hasOption ? value : "")
                } label: {
                    HStack {
                        Text("Continue").bold()
                        if busy {
                            Spacer()
                            ProgressView()
                        }
                    }
                }
                .disabled(busy)
            }
        }
        // A new question reuses this view; start from its own default instead
        // of carrying over the previous answer.
        .task(id: "\(question.state)|\(option.name)|\(question.error ?? "")") {
            value = option.defaultValue.isEmpty ? (examples.first?.value ?? "") : option.defaultValue
        }
    }
}
