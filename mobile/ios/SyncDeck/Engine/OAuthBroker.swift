import Foundation
import Observation
import SafariServices
import UIKit

/// Bridges rclone's OAuth flow to the phone. During `config/create` rclone
/// starts a tiny web server on 127.0.0.1:53682 and logs a sign-in link; this
/// watches the engine log for that link and opens it in an in-app Safari
/// sheet. The provider redirects back to that local server, rclone exchanges
/// the code, the blocking config call returns and `end()` closes the sheet.
@MainActor
@Observable
final class OAuthBroker: NSObject {
    static let shared = OAuthBroker()

    /// The sign-in link while a browser sheet is open.
    private(set) var authURL: URL?

    private var subscription: UUID?
    private weak var safari: SFSafariViewController?

    override private init() {}

    func begin() {
        authURL = nil
        guard subscription == nil else { return }
        subscription = EngineLog.shared.subscribe { line in
            guard let url = OAuthBroker.extractAuthURL(line) else { return }
            Task { @MainActor in OAuthBroker.shared.present(url) }
        }
    }

    /// The config call returned (success or failure): close everything.
    func end() {
        if let subscription { EngineLog.shared.unsubscribe(subscription) }
        subscription = nil
        authURL = nil
        safari?.dismiss(animated: true)
        safari = nil
    }

    /// Tell rclone's local server the sign-in was refused, so the blocked config
    /// call returns (and frees port 53682) instead of waiting forever.
    func cancel() {
        defer {
            authURL = nil
            safari?.dismiss(animated: true)
            safari = nil
        }
        guard let url = authURL,
              let state = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "state" })?.value
        else { return }
        var components = URLComponents()
        components.scheme = "http"
        components.host = url.host
        components.port = url.port
        components.path = "/"
        components.queryItems = [
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "error", value: "access_denied"),
            URLQueryItem(name: "error_description", value: "Cancelled in SyncDeck"),
        ]
        if let target = components.url {
            URLSession.shared.dataTask(with: target).resume()
        }
    }

    private func present(_ url: URL) {
        guard subscription != nil, authURL != url else { return }
        authURL = url
        let controller = SFSafariViewController(url: url)
        controller.dismissButtonStyle = .cancel
        controller.delegate = self
        safari = controller
        Self.topViewController()?.present(controller, animated: true)
    }

    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive } ?? UIApplication.shared.connectedScenes.first as? UIWindowScene
        var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }

    nonisolated static func extractAuthURL(_ line: String) -> URL? {
        guard let range = line.range(of: #"http://127\.0\.0\.1:\d+/auth\?state=[A-Za-z0-9_\-]+"#, options: .regularExpression)
        else { return nil }
        return URL(string: String(line[range]))
    }
}

extension OAuthBroker: SFSafariViewControllerDelegate {
    nonisolated func safariViewControllerDidFinish(_ controller: SFSafariViewController) {
        Task { @MainActor in
            // Closed by the user before rclone finished: release the flow.
            if OAuthBroker.shared.authURL != nil { OAuthBroker.shared.cancel() }
        }
    }
}
