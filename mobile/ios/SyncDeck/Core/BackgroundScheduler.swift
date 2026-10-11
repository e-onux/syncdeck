import BackgroundTasks
import Foundation

/// iOS has no LaunchAgent: scheduled profiles run when the system grants the
/// app background time. A processing task (network required) does the real
/// work; an app-refresh task is a cheap second chance on devices that rarely
/// grant processing time. Neither fires at an exact minute; iOS decides.
@MainActor
enum BackgroundScheduler {
    static let processingID = "com.sidrelabs.syncdeck.sync"
    static let refreshID = "com.sidrelabs.syncdeck.refresh"

    private static weak var runner: SyncRunner?
    private static weak var store: AppStore?

    static func register(store: AppStore, runner: SyncRunner) {
        self.store = store
        self.runner = runner
        for id in [processingID, refreshID] {
            BGTaskScheduler.shared.register(forTaskWithIdentifier: id, using: nil) { task in
                Task { @MainActor in handle(task) }
            }
        }
    }

    static func schedule() {
        guard let store else { return }
        BGTaskScheduler.shared.cancelAllTaskRequests()
        guard store.backgroundSync, let next = store.nextDueDate() else { return }
        let earliest = max(next, Date().addingTimeInterval(15 * 60))

        let processing = BGProcessingTaskRequest(identifier: processingID)
        processing.requiresNetworkConnectivity = true
        processing.requiresExternalPower = false
        processing.earliestBeginDate = earliest
        try? BGTaskScheduler.shared.submit(processing)

        let refresh = BGAppRefreshTaskRequest(identifier: refreshID)
        refresh.earliestBeginDate = earliest
        try? BGTaskScheduler.shared.submit(refresh)
    }

    private static func handle(_ task: BGTask) {
        guard let runner, let store, store.backgroundSync else {
            task.setTaskCompleted(success: true)
            return
        }
        let work = Task { @MainActor in
            await runner.runDue(trigger: .background)
        }
        task.expirationHandler = {
            Task { @MainActor in
                for id in runner.running.keys { runner.stop(id) }
                work.cancel()
            }
        }
        Task { @MainActor in
            await work.value
            schedule()
            task.setTaskCompleted(success: true)
        }
    }
}
