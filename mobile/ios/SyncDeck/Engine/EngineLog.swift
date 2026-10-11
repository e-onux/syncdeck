import Foundation

/// rclone logs to stderr from Go, which on iOS goes nowhere the app can see.
/// This redirects file descriptor 2 into a pipe so the app can read those lines
/// (the OAuth flow prints its local sign-in URL there) while still echoing them
/// to the original stderr for the Xcode console.
final class EngineLog: @unchecked Sendable {
    static let shared = EngineLog()

    typealias Listener = @Sendable (String) -> Void

    private let lock = NSLock()
    private var listeners: [UUID: Listener] = [:]
    private var buffer = Data()
    private var pipe: Pipe?
    private var originalStderr: Int32 = -1

    private init() {}

    func start() {
        lock.lock()
        defer { lock.unlock() }
        guard pipe == nil else { return }
        let pipe = Pipe()
        originalStderr = dup(STDERR_FILENO)
        setvbuf(stderr, nil, _IONBF, 0)
        dup2(pipe.fileHandleForWriting.fileDescriptor, STDERR_FILENO)
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            self?.consume(handle.availableData)
        }
        self.pipe = pipe
    }

    @discardableResult
    func subscribe(_ listener: @escaping Listener) -> UUID {
        let id = UUID()
        lock.lock()
        listeners[id] = listener
        lock.unlock()
        return id
    }

    func unsubscribe(_ id: UUID) {
        lock.lock()
        listeners[id] = nil
        lock.unlock()
    }

    private func consume(_ data: Data) {
        guard !data.isEmpty else { return }
        if originalStderr >= 0 {
            data.withUnsafeBytes { raw in
                _ = write(originalStderr, raw.baseAddress, raw.count)
            }
        }
        lock.lock()
        buffer.append(data)
        var lines: [String] = []
        while let newline = buffer.firstIndex(of: 0x0A) {
            let line = buffer[buffer.startIndex..<newline]
            buffer.removeSubrange(buffer.startIndex...newline)
            let text = String(decoding: line, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty { lines.append(text) }
        }
        let targets = Array(listeners.values)
        lock.unlock()
        for line in lines {
            for listener in targets { listener(line) }
        }
    }
}
