import SwiftUI

struct ProfileDetailView: View {
    @Environment(AppStore.self) private var store
    @Environment(SyncRunner.self) private var runner
    @Environment(\.dismiss) private var dismiss
    let profileID: String

    @State private var draft = SyncProfile(name: "")
    @State private var loaded = false
    @State private var picking: Side?
    @State private var confirmDelete = false
    @State private var showAdvanced = false

    enum Side: String, Identifiable {
        case source, destination
        var id: String { rawValue }
    }

    static let schedulePresets: [(Int, LocalizedStringKey)] = [
        (0, "Manual"), (15, "15 min"), (30, "30 min"), (60, "Hourly"), (360, "6 hours"), (1440, "Daily"),
    ]

    private var running: RunProgress? { runner.running[profileID] }
    private var isRunning: Bool { running != nil }

    var body: some View {
        Form {
            Section {
                TextField("Profile name", text: $draft.name)
                    .font(.headline)
            }

            if draft.isPhotoBackup {
                photoSections
            } else {
                folderSections
            }

            Section {
                Picker("Run frequency", selection: $draft.intervalMinutes) {
                    ForEach(Self.schedulePresets, id: \.0) { minutes, title in
                        Text(title).tag(minutes)
                    }
                    if !Self.schedulePresets.contains(where: { $0.0 == draft.intervalMinutes }) {
                        Text("\(draft.intervalMinutes) min").tag(draft.intervalMinutes)
                    }
                }
                Toggle("Run automatically", isOn: $draft.enabled)
            } header: {
                Text("Schedule")
            } footer: {
                Text("Enabled profiles run at this frequency when you open the app and in the background when iOS allows it. iOS decides the exact time.")
            }

            if !draft.isPhotoBackup {
                advancedSection
            }

            runSection

            if !store.history(profileID).isEmpty {
                Section {
                    ForEach(store.history(profileID)) { record in
                        NavigationLink {
                            RunRecordView(record: record)
                        } label: {
                            RunRecordRow(record: record)
                        }
                    }
                } header: {
                    Text("History")
                } footer: {
                    Button("Clear history", role: .destructive) { store.clearHistory(profileID) }
                        .font(.footnote)
                }
            }

            Section {
                Button("Delete profile", role: .destructive) { confirmDelete = true }
                    .disabled(isRunning)
            }
        }
        .navigationTitle(draft.name.isEmpty ? String(localized: "New profile") : draft.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if isRunning {
                    Button(running?.stopping == true ? "Stopping…" : "Stop", role: .destructive) {
                        runner.stop(profileID)
                    }
                    .disabled(running?.stopping == true)
                } else {
                    Button {
                        store.upsert(draft)
                        Task { await runner.run(draft) }
                    } label: {
                        Label("Run now", systemImage: "play.fill")
                    }
                    .disabled(draft.source.isEmpty || draft.destination.isEmpty)
                }
            }
        }
        .sheet(item: $picking) { side in
            EndpointPicker(current: side == .source ? draft.source : draft.destination, cloudOnly: draft.isPhotoBackup) { picked in
                if side == .source { draft.source = picked } else { draft.destination = picked }
            }
        }
        .confirmationDialog("Delete this profile?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete profile", role: .destructive) {
                store.deleteProfile(profileID)
                dismiss()
            }
        }
        .onAppear {
            guard !loaded, let profile = store.profile(profileID) else { return }
            draft = profile
            loaded = true
            showAdvanced = !profile.extraArgs.isEmpty
        }
        .onChange(of: draft) { _, value in
            if loaded { store.upsert(value) }
        }
    }

    @ViewBuilder private var folderSections: some View {
        Section("Route") {
            endpointRow(.source, title: "Source", endpoint: draft.source)
            Button {
                (draft.source, draft.destination) = (draft.destination, draft.source)
            } label: {
                Label("Swap source and destination", systemImage: "arrow.up.arrow.down")
            }
            .disabled(isRunning)
            endpointRow(.destination, title: "Destination", endpoint: draft.destination)
        }

        Section {
            Picker("Sync mode", selection: $draft.mode) {
                ForEach(SyncMode.allCases) { mode in
                    Label(mode.title, systemImage: mode.symbol).tag(mode)
                }
            }
            .pickerStyle(.navigationLink)
            Text(draft.mode.detail)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    static let keepPresets: [(Int, LocalizedStringKey)] = [
        (0, "Nothing, move everything"), (7, "Last 7 days"), (30, "Last 30 days"), (90, "Last 3 months"), (365, "Last year"),
    ]

    private var photoOptions: Binding<PhotoOptions> {
        Binding(get: { draft.photo ?? PhotoOptions() }, set: { draft.photo = $0 })
    }

    @ViewBuilder private var photoSections: some View {
        Section {
            HStack {
                Label("Photos", systemImage: "photo.on.rectangle")
                Spacer()
                Image(systemName: "arrow.right").foregroundStyle(.secondary)
            }
            endpointRow(.destination, title: "Save to", endpoint: draft.destination)
        } footer: {
            Text("Photos and videos are stored in year and month folders, with their original names and dates.")
        }

        Section {
            Toggle("Include videos", isOn: photoOptions.includeVideos)
            Toggle(isOn: photoOptions.deleteAfterUpload) {
                VStack(alignment: .leading) {
                    Text("Remove from iPhone after upload")
                    Text("Only after each file is verified in the cloud").font(.caption).foregroundStyle(.secondary)
                }
            }
            Picker("Keep on iPhone", selection: photoOptions.keepRecentDays) {
                ForEach(Self.keepPresets, id: \.0) { days, title in
                    Text(title).tag(days)
                }
            }
        } header: {
            Text("Free up space")
        } footer: {
            Text("iOS asks you to confirm before anything is removed. Removed items stay in Recently Deleted for 30 days; empty it in Photos to get the space back right away. If iCloud Photos is on, removing also removes them from iCloud Photos.")
        }

        if !store.pendingDeletion(profileID).isEmpty {
            Section {
                Button {
                    Task { _ = try? await runner.removeBackedUpPhotos(profileID: profileID) }
                } label: {
                    Label("Remove \(store.pendingDeletion(profileID).count) backed-up items from iPhone", systemImage: "trash")
                }
            }
        }
    }

    @ViewBuilder private var advancedSection: some View {
        Section {
            DisclosureGroup("Advanced options", isExpanded: $showAdvanced) {
                optionToggle(.checksum, title: "Verify after transfer", hint: "Compare checksums")
                optionToggle(.dryrun, title: "Dry run first", hint: "Show changes without writing anything")
                optionToggle(.bwlimit, title: "Bandwidth limit", hint: "Limit to 8 MiB/s while running")
                VStack(alignment: .leading, spacing: 6) {
                    Text("Extra rclone arguments").font(.subheadline)
                    TextField("--exclude \"*.tmp\" --transfers 2", text: $draft.extraArgs, axis: .vertical)
                        .font(.system(.footnote, design: .monospaced))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Text("Supported: filters (--exclude, --include, --max-age, --min-size…), --transfers, --checkers, --ignore-existing, --update, --size-only, --max-delete, --backup-dir and the toggles above.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func endpointRow(_ side: Side, title: LocalizedStringKey, endpoint: Endpoint) -> some View {
        Button {
            picking = side
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.caption).foregroundStyle(.secondary)
                HStack {
                    EndpointLabel(endpoint: endpoint, store: store)
                    Spacer()
                    Text(endpoint.isCloud ? "cloud" : endpoint.isEmpty ? "" : "local")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .foregroundStyle(.primary)
        .disabled(isRunning)
    }

    private func optionToggle(_ option: RcloneArgs.Option, title: LocalizedStringKey, hint: LocalizedStringKey) -> some View {
        Toggle(isOn: Binding(
            get: { RcloneArgs.hasFlag(draft.extraArgs, option.flag) },
            set: { draft.extraArgs = RcloneArgs.setFlag(draft.extraArgs, option.flag, on: $0) }
        )) {
            VStack(alignment: .leading) {
                Text(title)
                Text(hint).font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder private var runSection: some View {
        if let progress = running {
            Section("Status") {
                LiveProgressView(progress: progress)
            }
            if !progress.transfers.isEmpty {
                Section("Transfers") {
                    ForEach(progress.transfers) { event in
                        TransferRow(event: event)
                    }
                }
            }
            Section("Activity") {
                LogView(lines: progress.log)
            }
        } else if let last = store.lastRun(profileID) {
            Section("Last run") {
                RunRecordRow(record: last)
                if !last.ok {
                    ErrorDetail(raw: last.output, message: last.message)
                }
            }
        } else {
            Section("Activity") {
                Text("No runs yet. Try the profile with \"Run now\".")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct LiveProgressView: View {
    let progress: RunProgress

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(progress.stopping ? String(localized: "Stopping…") : (progress.phase ?? String(localized: "Syncing")))
                    .font(.headline)
                Spacer()
                if let fraction = progress.fraction {
                    Text(fraction, format: .percent.precision(.fractionLength(0)))
                        .font(.headline.monospacedDigit())
                }
            }
            if progress.itemsTotal > 0 {
                ProgressView(value: Double(progress.itemsDone), total: Double(progress.itemsTotal)) {
                    Text("\(progress.itemsDone) of \(progress.itemsTotal) photos and videos")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            if let fraction = progress.fraction {
                ProgressView(value: fraction)
            } else {
                ProgressView().progressViewStyle(.linear)
            }
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 4) {
                GridRow {
                    stat("Speed", "\(RcloneArgs.humanBytes(progress.speed))/s")
                    stat("Files", "\(progress.files)/\(max(progress.totalFiles, progress.files))")
                    stat("ETA", progress.eta.map(RcloneArgs.humanDuration) ?? "-")
                }
                GridRow {
                    stat("Transferred", "\(RcloneArgs.humanBytes(progress.bytes)) / \(RcloneArgs.humanBytes(progress.totalBytes))")
                        .gridCellColumns(2)
                    stat("Errors", "\(progress.errors)")
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func stat(_ title: LocalizedStringKey, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).font(.caption2).foregroundStyle(.secondary)
            Text(value).font(.footnote.monospacedDigit())
        }
    }
}

struct TransferRow: View {
    let event: TransferEvent

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundStyle(event.status == .error ? .red : event.status == .done ? .green : .accentColor)
            VStack(alignment: .leading, spacing: 3) {
                Text(event.name)
                    .font(.footnote)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if event.status == .active {
                    ProgressView(value: event.pct, total: 100)
                }
            }
            Spacer()
            Text("\(Int(event.pct))%")
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
        }
    }

    private var icon: String {
        switch event.status {
        case .done: "checkmark.circle.fill"
        case .error: "xmark.circle.fill"
        case .deleted: "trash"
        case .active: event.direction == .download ? "arrow.down.circle" : "arrow.up.circle"
        }
    }
}

struct LogView: View {
    let lines: [String]

    var body: some View {
        if lines.isEmpty {
            Text("Waiting for output…").font(.footnote).foregroundStyle(.secondary)
        } else {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                            Text(line)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(line.hasPrefix("✗") ? .red : .primary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .id(index)
                        }
                    }
                    .textSelection(.enabled)
                }
                .frame(maxHeight: 260)
                .onChange(of: lines.count) { _, count in
                    proxy.scrollTo(count - 1, anchor: .bottom)
                }
            }
        }
    }
}

struct RunRecordRow: View {
    let record: RunRecord

    var body: some View {
        HStack {
            Image(systemName: record.ok ? "checkmark.circle.fill" : "xmark.octagon.fill")
                .foregroundStyle(record.ok ? .green : .red)
            VStack(alignment: .leading, spacing: 2) {
                Text(record.finishedAt, format: .dateTime.day().month().hour().minute())
                    .font(.subheadline)
                Text(summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            if record.dryRun {
                Text("dry run").font(.caption2).foregroundStyle(.secondary)
            }
            if record.trigger != .manual {
                Image(systemName: "clock").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private var summary: String {
        let s = record.stats
        if !record.ok { return record.message ?? Friendly.error(record.output) }
        if s.photosVerified > 0 || s.photosRemoved > 0 {
            var parts = [String(localized: "\(s.photosVerified) backed up")]
            if s.photosRemoved > 0 { parts.append(String(localized: "\(s.photosRemoved) removed")) }
            if s.bytesFreed > 0 { parts.append(String(localized: "\(RcloneArgs.humanBytes(s.bytesFreed)) freed")) }
            return parts.joined(separator: " · ")
        }
        return [String(localized: "\(s.files) files"), RcloneArgs.humanBytes(s.bytes), RcloneArgs.humanDuration(s.elapsed)].joined(separator: " · ")
    }
}

struct RunRecordView: View {
    let record: RunRecord

    var body: some View {
        List {
            Section {
                RunRecordRow(record: record)
                LabeledContent("Files", value: "\(record.stats.files)")
                LabeledContent("Transferred", value: RcloneArgs.humanBytes(record.stats.bytes))
                LabeledContent("Checked", value: "\(record.stats.checks)")
                LabeledContent("Deleted", value: "\(record.stats.deletes)")
                LabeledContent("Errors", value: "\(record.stats.errors)")
                LabeledContent("Duration", value: RcloneArgs.humanDuration(record.stats.elapsed))
            }
            Section("Output") {
                Text(record.output)
                    .font(.system(.caption, design: .monospaced))
                    .textSelection(.enabled)
            }
        }
        .navigationTitle("Run")
        .toolbar {
            ShareLink(item: record.output)
        }
    }
}
