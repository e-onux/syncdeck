import SwiftUI

/// Plain-language names and messages, so people never have to read rclone's
/// own vocabulary (backend ids, option keys, Go error strings) unless they open
/// a "Details" section.
enum Friendly {
    /// Provider names people recognise; rclone's descriptions are long and
    /// technical ("Amazon S3 Compliant Storage Providers including AWS, ...").
    static func providerName(_ id: String, fallback: String? = nil) -> String {
        switch id {
        case "drive": "Google Drive"
        case "onedrive": "OneDrive"
        case "dropbox": "Dropbox"
        case "box": "Box"
        case "pcloud": "pCloud"
        case "protondrive": "Proton Drive"
        case "s3": String(localized: "Amazon S3 & compatible")
        case "b2": "Backblaze B2"
        case "webdav": String(localized: "WebDAV / Nextcloud")
        case "sftp": String(localized: "SFTP server")
        case "smb": String(localized: "Windows share / NAS")
        case "ftp": String(localized: "FTP server")
        case "crypt": String(localized: "Encrypted folder")
        default: fallback ?? id
        }
    }

    /// Labels for the settings people fill in themselves.
    static func fieldLabel(_ key: String) -> String? {
        switch key {
        case "host": String(localized: "Server")
        case "user", "username": String(localized: "User name")
        case "pass", "password": String(localized: "Password")
        case "port": String(localized: "Port")
        case "url": String(localized: "Address (URL)")
        case "vendor": String(localized: "Server type")
        case "domain": String(localized: "Domain")
        case "provider": String(localized: "Provider")
        case "access_key_id": String(localized: "Access key")
        case "secret_access_key": String(localized: "Secret key")
        case "region": String(localized: "Region")
        case "endpoint": String(localized: "Endpoint")
        case "account": String(localized: "Key ID")
        case "key": String(localized: "Application key")
        case "remote": String(localized: "Folder to encrypt")
        case "password2": String(localized: "Second password (salt)")
        case "2fa": String(localized: "Two-factor code")
        case "tls": String(localized: "Use TLS")
        case "explicit_tls": String(localized: "Use explicit TLS")
        case "client_id": String(localized: "App ID")
        case "client_secret": String(localized: "App secret")
        default: nil
        }
    }

    /// A short, plain explanation of an rclone error. The raw text stays
    /// available under "Details".
    static func error(_ raw: String) -> String {
        let text = RcloneArgs.stripAnsi(raw).lowercased()
        func has(_ needles: String...) -> Bool { needles.contains { text.contains($0) } }
        if text.isEmpty { return String(localized: "Something went wrong.") }
        if has("stopped by user", String(localized: "Stopped by user.").lowercased(), "context canceled") {
            return String(localized: "Stopped.")
        }
        if RcloneArgs.isAuthError(raw) && !has("401 unauthorized: ", "password") {
            return String(localized: "The sign-in has expired. Sign in again to continue.")
        }
        if has("401", "unauthorized", "authentication failed", "permission denied (publickey", "login incorrect", "530 ") {
            return String(localized: "The user name or password is not accepted.")
        }
        if has("no such host", "network is unreachable", "not connected to the internet", "connection refused",
               "i/o timeout", "timed out", "tls handshake", "no route to host", "connection reset") {
            return String(localized: "The server cannot be reached. Check the internet connection and the address.")
        }
        if has("directory not found", "object not found", "not found", "404") {
            return String(localized: "The folder could not be found. It may have been moved or deleted.")
        }
        if has("quota", "insufficient storage", "507", "no space left", "storage is full") {
            return String(localized: "There is not enough space in the cloud.")
        }
        if has("403", "forbidden", "access denied", "permission denied") {
            return String(localized: "Access to this location is not allowed.")
        }
        if has("bisync") {
            return String(localized: "Two-way sync could not compare both sides. Try again; the next run rebuilds its baseline.")
        }
        return String(localized: "Something went wrong.")
    }
}

/// A friendly error line with the raw rclone text folded away.
struct ErrorDetail: View {
    let raw: String
    /// Use this instead of interpreting `raw` when the app already knows why.
    var message: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(message ?? Friendly.error(raw))
                .font(.footnote)
                .foregroundStyle(.red)
            DisclosureGroup {
                Text(RcloneArgs.stripAnsi(raw))
                    .font(.system(.caption2, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            } label: {
                Text("Details").font(.caption)
            }
        }
    }
}
