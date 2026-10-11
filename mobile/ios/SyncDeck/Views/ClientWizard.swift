import SwiftUI

/// Three-step "new client" flow, like the desktop wizard: connection type,
/// credentials and name, then create (OAuth providers authorize in the browser
/// as part of creating).
struct ClientWizard: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var type: BackendType?

    var body: some View {
        NavigationStack {
            ProviderList { type = $0 }
                .navigationTitle("New client")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                }
                .navigationDestination(item: $type) { type in
                    ClientForm(type: type) { dismiss() }
                }
        }
        .task {
            if store.backendTypes.isEmpty { await store.reloadClients() }
        }
    }

    /// Providers the desktop app puts first.
    static let featured = ["drive", "onedrive", "dropbox", "s3", "b2", "sftp", "webdav", "smb", "pcloud", "box", "protondrive", "ftp", "crypt"]

    static func isOAuth(_ type: BackendType) -> Bool {
        let names = Set(type.options.map(\.name))
        return names.contains("token") && names.contains("client_id")
    }

    /// Hand-picked fields for common providers (labels like the desktop
    /// wizard); everything else is generated from the engine's option list.
    static let curatedFields: [String: [String]] = [
        "s3": ["provider", "access_key_id", "secret_access_key", "region", "endpoint"],
        "b2": ["account", "key"],
        "sftp": ["host", "user", "port", "pass"],
        "webdav": ["url", "vendor", "user", "pass"],
        "crypt": ["remote", "password", "password2"],
        "smb": ["host", "user", "pass", "port", "domain"],
        "ftp": ["host", "user", "pass", "port", "tls", "explicit_tls"],
        "protondrive": ["username", "password", "2fa"],
    ]
}

private struct ProviderList: View {
    @Environment(AppStore.self) private var store
    let onSelect: (BackendType) -> Void
    @State private var query = ""

    private var filtered: [BackendType] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return store.backendTypes }
        return store.backendTypes.filter {
            $0.description.lowercased().contains(q) || $0.name.lowercased().contains(q)
        }
    }

    var body: some View {
        List {
            Section {
                Text("Choose the kind of cloud you want to connect. SyncDeck creates the matching configuration in the background.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if store.backendTypes.isEmpty {
                ProgressView()
            }
            let featured = filtered.filter { ClientWizard.featured.contains($0.id) }
                .sorted { (ClientWizard.featured.firstIndex(of: $0.id) ?? 99) < (ClientWizard.featured.firstIndex(of: $1.id) ?? 99) }
            let others = filtered.filter { !ClientWizard.featured.contains($0.id) }
            if !featured.isEmpty {
                Section("Popular") { ForEach(featured) { row($0) } }
            }
            if !others.isEmpty {
                Section("All providers") { ForEach(others) { row($0) } }
            }
        }
        .searchable(text: $query, prompt: Text("Search clients"))
    }

    private func row(_ type: BackendType) -> some View {
        Button {
            onSelect(type)
        } label: {
            HStack(spacing: 12) {
                ProviderIcon(type: type.id)
                VStack(alignment: .leading) {
                    Text(type.description).foregroundStyle(.primary)
                    Text(type.name).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
            }
        }
    }
}

private struct ClientForm: View {
    @Environment(AppStore.self) private var store
    let type: BackendType
    let onDone: () -> Void

    @State private var name = ""
    @State private var values: [String: String] = [:]
    @State private var showAdvanced = false
    @State private var phase: Phase = .editing
    @State private var testResult: TestResult?
    @State private var question: RemoteService.ConfigQuestion?
    @State private var createdName: String?

    enum Phase: Equatable { case editing, testing, creating, done, failed(String) }
    enum TestResult: Equatable { case ok, failed(String) }

    private var oauth: Bool { ClientWizard.isOAuth(type) }

    private var mainOptions: [BackendOption] {
        if let curated = ClientWizard.curatedFields[type.id] {
            return curated.compactMap { key in type.options.first { $0.name == key } }
        }
        if oauth {
            return ["client_id", "client_secret"].compactMap { key in type.options.first { $0.name == key } }
        }
        return type.options.filter { !$0.advanced && !Self.hidden.contains($0.name) }
    }

    private var advancedOptions: [BackendOption] {
        let main = Set(mainOptions.map(\.name))
        return type.options.filter { !main.contains($0.name) && !Self.hidden.contains($0.name) }
    }

    /// Managed by the OAuth flow itself.
    static let hidden: Set<String> = ["token", "auth_url", "token_url", "client_credentials", "config_is_local"]

    private var missingRequired: Bool {
        mainOptions.contains { $0.required && (values[$0.name] ?? "").trimmingCharacters(in: .whitespaces).isEmpty }
    }

    private var cleanName: String { RemoteService.sanitizeName(name) }

    var body: some View {
        Group {
            if let question, let createdName {
                ConfigQuestionForm(question: question, busy: phase == .creating) { answer in
                    Task { await respond(answer, to: question, name: createdName) }
                }
            } else {
                form
            }
        }
        .navigationTitle(type.description)
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled(phase == .creating)
        .onAppear {
            if name.isEmpty { name = suggestedName() }
        }
    }

    private var form: some View {
        Form {
            Section {
                TextField("e.g. Work Drive", text: $name)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            } header: {
                Text("Client name")
            } footer: {
                if !cleanName.isEmpty && cleanName != name {
                    Text("Saved as \(cleanName)")
                }
            }

            if !mainOptions.isEmpty {
                Section {
                    ForEach(mainOptions) { option in field(option) }
                } header: {
                    Text(oauth ? "OAuth (optional)" : "Credentials")
                } footer: {
                    Text(oauth
                         ? "Leave empty to use rclone's own client. Authorize in the browser; SyncDeck keeps the access token in its local engine config."
                         : "Credentials are stored only in the local engine config on this iPhone and are never sent anywhere else.")
                }
            }

            if !advancedOptions.isEmpty {
                Section {
                    DisclosureGroup("Advanced options", isExpanded: $showAdvanced) {
                        ForEach(advancedOptions) { option in field(option) }
                    }
                }
            }

            Section {
                if !oauth {
                    Button {
                        Task { await test() }
                    } label: {
                        HStack {
                            Text(phase == .testing ? "Testing…" : "Test connection")
                            Spacer()
                            switch testResult {
                            case .ok: Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                            case .failed: Image(systemName: "xmark.circle.fill").foregroundStyle(.red)
                            case nil: EmptyView()
                            }
                        }
                    }
                    .disabled(phase != .editing || missingRequired)
                    if case .failed(let message) = testResult {
                        Text(message).font(.footnote).foregroundStyle(.red)
                    }
                }
                Button {
                    Task { await create() }
                } label: {
                    HStack {
                        Spacer()
                        if phase == .creating { ProgressView().padding(.trailing, 6) }
                        Text(phase == .creating ? (oauth ? "Authorizing…" : "Creating…") : (oauth ? "Authorize in browser" : "Create client"))
                            .bold()
                        Spacer()
                    }
                }
                .disabled(phase == .creating || phase == .testing || cleanName.isEmpty || missingRequired)
                if phase == .creating && oauth {
                    Button("Cancel", role: .cancel) { OAuthBroker.shared.cancel() }
                }
                if case .failed(let message) = phase {
                    Text(message).font(.footnote).foregroundStyle(.red)
                }
                if phase == .done {
                    Label("Client created", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                }
            }
        }
    }

    @ViewBuilder private func field(_ option: BackendOption) -> some View {
        let binding = Binding(
            get: { values[option.name] ?? "" },
            set: { values[option.name] = $0 }
        )
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(option.name).font(.caption).foregroundStyle(.secondary)
                if !option.required { Text("optional").font(.caption2).foregroundStyle(.tertiary) }
                Spacer()
                if !option.examples.isEmpty {
                    Menu {
                        ForEach(option.examples, id: \.value) { example in
                            Button {
                                values[option.name] = example.value
                            } label: {
                                Text(example.help.isEmpty ? example.value : "\(example.value) · \(example.help.components(separatedBy: .newlines).first ?? "")")
                            }
                        }
                    } label: {
                        Image(systemName: "list.bullet").font(.caption)
                    }
                }
            }
            if type.id == "crypt" && option.name == "remote" && !store.clients.isEmpty {
                Picker("Client", selection: binding) {
                    Text("Choose…").tag("")
                    ForEach(store.clients) { client in
                        Text("\(client.name):").tag("\(client.name):")
                    }
                    if !(values[option.name] ?? "").isEmpty, !store.clients.contains(where: { "\($0.name):" == values[option.name] }) {
                        Text(values[option.name] ?? "").tag(values[option.name] ?? "")
                    }
                }
                TextField("archive:secret (existing remote:path)", text: binding)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            } else if option.type == "bool" {
                Toggle(option.shortHelp, isOn: Binding(
                    get: { (values[option.name] ?? option.defaultValue) == "true" },
                    set: { values[option.name] = $0 ? "true" : "false" }
                ))
                .font(.footnote)
            } else if option.secret {
                SecureField(option.shortHelp, text: binding)
            } else {
                TextField(option.defaultValue.isEmpty ? option.shortHelp : option.defaultValue, text: binding)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(option.type == "int" || option.name == "port" ? .numbersAndPunctuation : .default)
            }
            if !option.shortHelp.isEmpty && option.type != "bool" {
                Text(option.shortHelp).font(.caption2).foregroundStyle(.secondary).lineLimit(2)
            }
        }
    }

    private func suggestedName() -> String {
        let base = type.name
        var candidate = base
        var n = 2
        while store.clients.contains(where: { $0.name == candidate }) {
            candidate = "\(base)\(n)"
            n += 1
        }
        return candidate
    }

    private var parameters: [String: String] {
        values.filter { !$0.value.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    private func test() async {
        phase = .testing
        testResult = nil
        defer { phase = .editing }
        var fields: [(String, String)] = []
        for (key, value) in parameters.sorted(by: { $0.key < $1.key }) {
            let secret = type.options.first { $0.name == key }?.secret ?? false
            let isPassword = secret && ["pass", "password", "password2", "key_file_pass"].contains(key)
            fields.append((key, isPassword ? ((try? await RcloneEngine.shared.obscure(value)) ?? value) : value))
        }
        let target = RcloneArgs.connectionString(type: type.id, fields: fields)
        if let failure = await RemoteService.test(target) {
            testResult = .failed(failure)
        } else {
            testResult = .ok
        }
    }

    private func create() async {
        let target = cleanName
        guard !target.isEmpty else { return }
        if store.clients.contains(where: { $0.name == target }) {
            phase = .failed(String(localized: "A client named \(target) already exists."))
            return
        }
        phase = .creating
        if oauth { OAuthBroker.shared.begin() }
        defer { if oauth { OAuthBroker.shared.end() } }
        do {
            createdName = target
            question = try await RemoteService.create(name: target, type: type.id, parameters: parameters)
            if question == nil { await finish() } else { phase = .editing }
        } catch {
            // A half-created OAuth remote has no token; don't leave it behind.
            try? await RemoteService.delete(target)
            createdName = nil
            phase = .failed(RcloneArgs.firstMeaningfulLine(error.localizedDescription))
        }
    }

    private func respond(_ answer: String, to current: RemoteService.ConfigQuestion, name: String) async {
        phase = .creating
        if oauth { OAuthBroker.shared.begin() }
        defer { if oauth { OAuthBroker.shared.end() } }
        do {
            question = try await RemoteService.answer(name: name, question: current, result: answer)
            if question == nil { await finish() } else { phase = .editing }
        } catch {
            question = nil
            phase = .failed(RcloneArgs.firstMeaningfulLine(error.localizedDescription))
        }
    }

    private func finish() async {
        phase = .done
        await store.reloadClients()
        await store.refreshAdvisories()
        try? await Task.sleep(for: .milliseconds(600))
        onDone()
    }
}
