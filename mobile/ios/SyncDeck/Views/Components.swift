import SwiftUI
import UIKit

/// The desktop app's provider glyphs (sources/icons), shipped as template
/// images; falls back to a generic cloud.
struct ProviderIcon: View {
    let type: String
    var size: CGFloat = 22

    var body: some View {
        Group {
            if UIImage(named: "provider-\(type)") != nil {
                Image("provider-\(type)")
                    .resizable()
                    .renderingMode(.template)
                    .scaledToFit()
            } else {
                Image(systemName: "cloud")
                    .resizable()
                    .scaledToFit()
            }
        }
        .frame(width: size, height: size)
        .foregroundStyle(.tint)
        .accessibilityHidden(true)
    }
}

extension SyncMode {
    var title: LocalizedStringKey {
        switch self {
        case .sync: "Mirror sync"
        case .copy: "Copy only"
        case .move: "Move"
        case .bisync: "Two-way"
        case .check: "Verify"
        }
    }

    var tag: LocalizedStringKey {
        switch self {
        case .sync: "Mirror"
        case .copy: "Copy"
        case .move: "Move"
        case .bisync: "Two-way"
        case .check: "Check"
        }
    }

    var detail: LocalizedStringKey {
        switch self {
        case .sync: "Makes the destination an exact mirror of the source. Files missing from the source are deleted from the destination too."
        case .copy: "Only adds files and never deletes anything. Safe, with no irreversible data loss."
        case .move: "Moves files to the destination; files transferred successfully are deleted from the source."
        case .bisync: "Keeps both locations in sync in both directions; the first run safely sets up a baseline (resync)."
        case .check: "Compares source and destination without writing anything and reports the differences."
        }
    }

    var symbol: String {
        switch self {
        case .sync: "arrow.right.square"
        case .copy: "doc.on.doc"
        case .move: "arrow.right.doc.on.clipboard"
        case .bisync: "arrow.left.arrow.right"
        case .check: "checkmark.shield"
        }
    }
}

struct ModeBadge: View {
    let mode: SyncMode

    var body: some View {
        Text(mode.tag)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(.tint.opacity(0.15), in: Capsule())
            .foregroundStyle(.tint)
    }
}

struct EndpointLabel: View {
    let endpoint: Endpoint
    var store: AppStore? = nil

    var body: some View {
        Label {
            Text(endpoint.isEmpty ? String(localized: "No folder selected") : endpoint.displayPath)
                .lineLimit(1)
                .truncationMode(.middle)
                .foregroundStyle(endpoint.isEmpty ? .secondary : .primary)
        } icon: {
            switch endpoint.kind {
            case .appFolder: Image(systemName: "iphone")
            case .external: Image(systemName: "folder")
            case .remote:
                if let name = endpoint.remoteName, let type = store?.client(name)?.type {
                    ProviderIcon(type: type, size: 18)
                } else {
                    Image(systemName: "cloud")
                }
            }
        }
    }
}

struct Banner: View {
    enum Style { case info, warning, critical }

    let style: Style
    let text: String
    var actionTitle: LocalizedStringKey?
    var action: (() -> Void)?
    var onDismiss: (() -> Void)?

    private var color: Color {
        switch style {
        case .info: .blue
        case .warning: .orange
        case .critical: .red
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: style == .info ? "info.circle.fill" : "exclamationmark.triangle.fill")
                .foregroundStyle(color)
            VStack(alignment: .leading, spacing: 6) {
                Text(text).font(.subheadline)
                if let actionTitle, let action {
                    Button(actionTitle, action: action)
                        .font(.subheadline.weight(.semibold))
                }
            }
            Spacer(minLength: 0)
            if let onDismiss {
                Button(action: onDismiss) {
                    Image(systemName: "xmark").font(.caption.weight(.bold))
                }
                .buttonStyle(.borderless)
                .foregroundStyle(.secondary)
                .accessibilityLabel(Text("Dismiss"))
            }
        }
        .padding(12)
        .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
    }
}

/// Advisory and re-authorization notices shared by the Profiles and Clients tabs.
struct NoticesSection: View {
    @Environment(AppStore.self) private var store
    var onReauthorize: ((String) -> Void)?

    private var language: String { Locale.current.language.languageCode?.identifier ?? "en" }

    var body: some View {
        let alerts = store.authAlerts.sorted { $0.key < $1.key }
        if !store.visibleAdvisories.isEmpty || !alerts.isEmpty {
            Section {
                ForEach(alerts, id: \.key) { name, alert in
                    Banner(
                        style: .warning,
                        text: String(localized: "Session expired for \(name). Re-authorize to keep syncing.") + "\n" + alert.message,
                        actionTitle: onReauthorize == nil ? nil : "Re-authorize",
                        action: onReauthorize.map { handler in { handler(name) } }
                    )
                }
                ForEach(store.visibleAdvisories) { advisory in
                    Banner(
                        style: advisory.severity == .critical ? .critical : advisory.severity == .warning ? .warning : .info,
                        text: advisory.message.text(for: language),
                        actionTitle: advisory.url == nil ? nil : "Learn more",
                        action: advisory.url.flatMap(URL.init(string:)).map { url in { UIApplication.shared.open(url) } },
                        onDismiss: { store.dismissAdvisory(advisory.id) }
                    )
                }
            }
            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
            .listRowBackground(Color.clear)
        }
    }
}

extension Date {
    var relative: String {
        RelativeDateTimeFormatter().localizedString(for: self, relativeTo: Date())
    }
}
