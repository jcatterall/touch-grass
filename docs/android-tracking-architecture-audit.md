# TouchGrass Android Tracking / Motion / Notifications — Architecture Audit & Rewrite Plan

Date: 2026-02-24

## Overview

### What this system is supposed to do (Android)

- **Motion detection** runs continuously while “idle tracking” is enabled, and decides when the user is moving vs stationary (walking/running/biking vs still/in-vehicle).
- **Tracking** turns GPS on only when movement is detected, accumulates distance/time, and ends the session after a short stationary buffer.
- **Notification** shows a single persistent foreground-service notification with progress (distance/time goals) and basic status.
- **Background reliability**: the system should keep working while the app UI is not running, across process death/service restarts, and under Android 12–15 background execution restrictions.

### High-level summary of current approach

TouchGrass now runs a **single orchestrator foreground service** (`TrackingService`) that hosts both **motion detection** (`MotionEngine`) and **GPS tracking** (`GpsManager` + `TrackingController`). `AppBlockerService` remains a separate foreground service for the overlay use-case.

Key properties of the implemented architecture:

- **No motion intent IPC**: motion → tracking is delivered **in-process** via a sink installed into `MotionSessionController`.
- **Notification ownership is split**: each foreground service owns its own notification ID/channel (no cross-service races).
- **Persistence is single-writer**: Room is authoritative; MMKV is an absolute-value snapshot written from `TrackingService`.
- **No periodic heartbeat**: WorkManager “liveness” scheduling has been removed.

## Module Feature Map (Android)

### Tracking

#### TrackingService — android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt

Link: [TrackingService.kt](../android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt)

- **Responsibilities**
	- Runs a **combined foreground service** (`foregroundServiceType="location|health"`).
	- Owns the tracking notification via `NotificationController`.
	- Orchestrates dependencies: `MotionEngine`, `GpsManager`, `TrackingController`, `SessionRepository`.
	- Receives Intents for:
		- idle mode start/stop
		- goals updated
		- app-blocker started/stopped
		- manual session start (default branch)
	- Exposes a Binder so `TrackingModule` can subscribe to callbacks.

- **State/data owned**
	- In-memory:
		- `_sessionState: MutableStateFlow<TrackingSessionState>` (canonical)
		- `_state: MutableStateFlow<TrackingState>` (legacy projection for notification/JS)
		- `prevMode`, `lastNotificationMs`
		- callback lambdas for RN binding (`onProgressUpdate`, etc.)
		- `blockerActive` (currently not projected into notification)
		- `baselineMerged` flag
	- Persisted / external:
		- **MMKV** fast-path snapshot (`MMKVStore`) is written from `handleStateChange()` as absolute values.
		- **Room** session + daily totals via `SessionRepository`.

- **Inputs (who calls it, when)**
	- `TrackingModule.startTracking()` calls `startForegroundService()` with goal extras.
	- `TrackingModule.startIdleService()` calls `startForegroundService(ACTION_START_IDLE)`.
	- `MotionModule.startMonitoring()` starts `TrackingService` with `ACTION_START_IDLE`.
	- `AppBlockerService` calls `startService(ACTION_BLOCKER_STARTED/STOPPED)`.

- **Outputs (how it emits results)**
	- Updates `_state` via controller callback.
	- Emits to RN via **bound-service callbacks** (not via Flow collection): `onProgressUpdate`, `onGoalReachedCallback`, `onTrackingStoppedCallback`.
	- Updates notification via `NotificationController`.
	- Writes MMKV state for “fast-path” JS reads.

- **Public surface area**
	- `state: StateFlow<TrackingState>` (not currently consumed outside service except as future intent)
	- `stopTracking()`
	- `distanceMeters`, `elapsedSeconds`, `goalReached`

#### TrackingController — android/app/src/main/java/com/touchgrass/tracking/TrackingController.kt

Link: [TrackingController.kt](../android/app/src/main/java/com/touchgrass/tracking/TrackingController.kt)

- **Responsibilities**
	- Core tracking state machine driven by motion + location.
	- Controls GPS power mode via `GpsManager.setMode()`.
	- Accumulates distance/time via `SessionManager`.
	- Publishes `TrackingSessionState` snapshots through `onStateChanged` callback.

- **State/data owned**
	- In-memory:
		- `state: TrackingSessionState`, `lastLocation`, daily baseline offsets
		- main-thread `Handler` with:
			- stationary buffer runnable
			- manual session ticker runnable (1s)
	- Persisted side effects: none (persistence is owned by `TrackingService` / `SessionRepository`).

- **Inputs/outputs**
	- Inputs: `onMotion(ActivitySnapshot)`, `onMotionStopped()`, `onLocation(Location)`, `startManualSession()`, `stopManualSession()`, `applyBaseline()`.
	- Output: `onStateChanged(state)` callback.

#### GpsManager — android/app/src/main/java/com/touchgrass/tracking/GpsManager.kt

Link: [GpsManager.kt](../android/app/src/main/java/com/touchgrass/tracking/GpsManager.kt)

- **Responsibilities**
	- Manages `FusedLocationProviderClient` updates.
	- Switches between `GpsMode` (OFF/LOW_POWER/BALANCED/HIGH_ACCURACY).

- **State/data owned**
	- In-memory: `currentMode`, `LocationCallback`.

- **Inputs/outputs**
	- Input: `setMode(GpsMode)`.
	- Output: invokes provided `onLocation(Location)` callback on main looper.

#### SessionManager — android/app/src/main/java/com/touchgrass/tracking/SessionManager.kt

Link: [SessionManager.kt](../android/app/src/main/java/com/touchgrass/tracking/SessionManager.kt)

- **Responsibilities**
	- In-memory accumulation for one active session: distance + elapsed.

#### LocationProcessor — android/app/src/main/java/com/touchgrass/tracking/LocationProcessor.kt

Link: [LocationProcessor.kt](../android/app/src/main/java/com/touchgrass/tracking/LocationProcessor.kt)

- **Responsibilities**
	- Stateless filtering of GPS deltas (vehicle suppression, accuracy/jump guard, min delta thresholds).

#### SessionRepository (Room) — android/app/src/main/java/com/touchgrass/storage/SessionRepository.kt

Link: [SessionRepository.kt](../android/app/src/main/java/com/touchgrass/storage/SessionRepository.kt)

- **Responsibilities**
	- Starts/closes sessions in Room.
	- Maintains a per-day aggregate (`accumulateDaily`).

- **State/data owned**
	- In-memory: `currentSessionId` and `sessionMode` (NOT persisted).
	- Persistent: session rows + daily aggregate (via DAO).

### Motion

Motion detection is hosted *inside* `TrackingService` (single orchestrator). `MotionModule` and `TrackingModule` start/stop `TrackingService` in “idle monitoring” mode.

#### MotionEngine — android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt

Link: [MotionEngine.kt](../android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt)

- **Responsibilities**
	- Registers sensors (step detector, accelerometer, gyroscope) on a `HandlerThread`.
	- Schedules inactivity checks.
	- Registers Activity Recognition **Transition API** callbacks via `ActivityTransitionReceiver`.
	- Produces movement confidence and calls `MotionSessionController`.

- **State/data owned**
	- Threaded state: ring buffers, timestamps, stationary lock, cadence drop tracking.

#### MotionSessionController — android/app/src/main/java/com/touchgrass/motion/MotionSessionController.kt

Link: [MotionSessionController.kt](../android/app/src/main/java/com/touchgrass/motion/MotionSessionController.kt)

- **Responsibilities**
	- Main-looper state machine (IDLE/POTENTIAL_MOVEMENT/MOVING/POTENTIAL_STOP).
	- Decides when to emit start/stop signals to the tracking layer.
	- Manages stop evaluation timers.

- **Outputs**
	- Calls a pluggable `MotionTrackingSink` (installed by `TrackingService`) on state transitions.

#### ActivityTransitionReceiver — android/app/src/main/java/com/touchgrass/motion/ActivityTransitionReceiver.kt

Link: [ActivityTransitionReceiver.kt](../android/app/src/main/java/com/touchgrass/motion/ActivityTransitionReceiver.kt)

- **Responsibilities**
	- Receives Activity Transition PendingIntent broadcasts from Google Play Services.
	- Validates presence of `ActivityTransitionResult` and forwards to `MotionEngine`.

### Notifications

#### NotificationController — android/app/src/main/java/com/touchgrass/tracking/NotificationController.kt

Link: [NotificationController.kt](../android/app/src/main/java/com/touchgrass/tracking/NotificationController.kt)

- **Responsibilities**
	- Single owner for the tracking foreground notification lifecycle.
	- Ensures the channel `touchgrass_tracking` exists (delegates to `NotificationHelper`).
	- Calls `startForeground()` and `NotificationManager.notify()` using `TrackingConstants.NOTIFICATION_ID`.

#### NotificationHelper — android/app/src/main/java/com/touchgrass/tracking/NotificationHelper.kt

Link: [NotificationHelper.kt](../android/app/src/main/java/com/touchgrass/tracking/NotificationHelper.kt)

- **Responsibilities**
	- Renders a Notification from `TrackingState` and MMKV goal + blocker count.

- **State/data owned**
	- Stateless builder.

### Background scheduling

Removed (Stage 7). Tracking no longer schedules a periodic WorkManager liveness job.

### Cross-layer persistence / fast-path

#### MMKVStore — android/app/src/main/java/com/touchgrass/MMKVStore.kt

Link: [MMKVStore.kt](../android/app/src/main/java/com/touchgrass/MMKVStore.kt)

- **Responsibilities**
	- Cross-process key/value store used by services + JS.
	- Stores daily totals, goal config, “is auto tracking”, blocked count.

### Other coupled component (notification ownership)

#### AppBlockerService — android/app/src/main/java/com/touchgrass/AppBlockerService.kt

Link: [AppBlockerService.kt](../android/app/src/main/java/com/touchgrass/AppBlockerService.kt)

- **Why it matters here**
	- Runs as a separate foreground service for the overlay use-case.
	- Owns its own notification ID/channel (no longer races tracking).

## Lifecycle & Data Flow (End-to-End)

### Start tracking (manual)

Sequence (today):

1. JS → `TrackingModule.startTracking()` → `Context.startForegroundService(TrackingService)` with goal extras.
2. `TrackingService.onCreate()`:
	 - creates notification channel
	 - constructs controller + GPS manager
	 - merges baseline totals from Room/MMKV (blocking `runBlocking`)
	 - calls `startForeground()` via `postForeground()`.
3. `TrackingService.onStartCommand()` default branch:
	 - persists goal to MMKV
	 - `controller.startManualSession()`
	 - writes MMKV `is_auto_tracking=true` and elapsed
	 - schedules notification updates (throttled)

Text diagram:

JS → TrackingModule → TrackingService (FGS location|health)
	→ TrackingController (manual) → SessionManager
	→ StateFlow + callbacks → NotificationController → NotificationManager

### Start tracking (auto / motion-driven)

1. JS → `TrackingModule.startIdleService()`:
	 - `startForegroundService(TrackingService, ACTION_START_IDLE)`
	 - `TrackingService` starts `MotionEngine`.
2. `TrackingService` is already foreground and hosting motion + tracking.
3. `MotionEngine` detects movement → `MotionSessionController` transitions.
4. `MotionSessionController.trackingSink` (installed by `TrackingService`) calls into `TrackingController.onMotion(...)` in-process.
5. `TrackingController` transitions to tracking mode and enables `GpsManager` HIGH_ACCURACY.

### Ongoing updates (motion + location → aggregation → persistence → notification → UI)

Today’s update loop:

- Motion:
	- Sensors/AR → `MotionEngine` → `MotionSessionController` → in-process sink → `TrackingController.onMotion()`.
- Location:
	- `GpsManager` callback → `TrackingController.onLocation()`:
		- filters delta via `LocationProcessor`
		- `SessionManager.addDistance()`
		- publishes updated `TrackingSessionState` (and legacy projection).
- Service state side effects:
	- `TrackingService.handleStateChange()`:
		- writes MMKV snapshot (absolute distance/elapsed + flags)
		- triggers Room session open/close transitions
		- throttles notification updates (15s)
		- notifies bound RN callbacks.

### Stop tracking

Stop paths:

- Manual stop:
	- JS → `TrackingModule.stopTracking()` → `TrackingService.stopTracking()` → `TrackingController.stopManualSession()` → `finaliseSession()`.
- Auto stop:
	- Motion state machine transitions to IDLE → in-process sink → `TrackingController.onMotionStopped()` → stationary buffer → `finaliseSession()`.
- App blocker stop:
	- `AppBlockerService.onDestroy()` sends `ACTION_BLOCKER_STOPPED`.

### Foreground vs background

What differs today:

- **Foreground services**:
	- Tracking runs as a combined *location|health* FGS.
	- Blocker runs as *specialUse* FGS.
	- Each owns its own notification ID/channel.
- **UI consumption**:
	- When RN is bound, `TrackingService` pushes progress through callbacks.
	- When RN is not bound, JS reads MMKV keys for fast progress.

What should not differ:

- Computation and session lifecycle should be identical regardless of whether RN is alive/bound.
- Notification rendering should be a pure projection of canonical state (not driven by three services racing).

### Restart behavior (process death / service restart / boot)

- `TrackingService` returns `START_STICKY` in most cases.
- Sticky restart can deliver `intent == null`. The current code treats this as a **no-op restart**: it refreshes the notification (best-effort) and returns `START_STICKY` without starting a session.
- Manual start only occurs on a **non-null** intent with **no action** (goal extras). Unknown non-null actions are ignored.
- `SessionRepository` stores `currentSessionId` only in memory; on process death it cannot reliably close or resume a session.
- Boot behavior:
	- Manifest requests `RECEIVE_BOOT_COMPLETED`, but there is no BootReceiver declared in the manifest. This permission appears unused for tracking.

## Problems & Complexity Analysis

### 1) `START_STICKY` + `null` intent causes unintended manual tracking start

**Status (2026-02-24): Fixed (Stage 1).**

- Where:
	- [TrackingService.onStartCommand()](../android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt)
- What happened previously:
	- A sticky restart delivering `intent == null` could fall into the manual-start branch.
- Why it’s fragile:
	- This creates phantom sessions and MMKV state flips after OS kills / restarts.
- Simplification direction:
	- Treat `intent == null` as a no-op restart and restore from persisted state only.
	- Require explicit actions for start/stop; never start tracking from the default branch.

### 2) Notification ownership is a three-way race (Tracking vs Motion vs AppBlocker)

**Status (2026-02-24): Fixed (Stage 4).**

- Where:
	- [TrackingService.refreshNotification()](../android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt)
- What happened previously:
	- Multiple foreground services reused the same notification ID/channel.
- What happens now:
	- `TrackingService` is the only owner of the tracking foreground notification lifecycle via `NotificationController` (ID: `TrackingConstants.NOTIFICATION_ID`, channel: `touchgrass_tracking`).
	- `AppBlockerService` runs its own foreground notification (ID: `2003`, channel: `touchgrass_blocker`) and no longer posts into the tracking notification slot.
	- The blocker still sends `ACTION_BLOCKER_STARTED/STOPPED` to `TrackingService` as a best-effort signal so tracking can optionally reflect blocker state in its own UI/notification.
- Why it’s fragile:
	- Leads to inconsistent / flickering progress, wrong content, or stale status.
	- Makes it unclear which service “owns” foreground importance.
- Simplification direction:
	- Make **exactly one component** responsible for rendering/updating the persistent notification (a dedicated `NotificationController` collecting from a single StateFlow).
	- If multiple FGS must exist, use separate notification IDs and explicitly decide which one should remain foreground.

### 3) MotionService creates a channel that doesn’t match the notification it posts

**Status (2026-02-24): Obsolete (Stage 5 removed MotionService).**

This issue applied to the pre-Stage-5 split-service design.

### 4) Multiple sources of truth for “distance/elapsed” cause double counting and incoherent persistence

**Status (2026-02-24): Fixed (Stage 3).**

- Where:
	- Baseline merge in [TrackingService.onCreate()](../android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt)
	- Baseline offsets in [TrackingController.applyBaseline()](../android/app/src/main/java/com/touchgrass/tracking/TrackingController.kt)
	- Room writes in [SessionRepository.closeSession()](../android/app/src/main/java/com/touchgrass/storage/SessionRepository.kt)
	- MMKV writes in [MMKVStore](../android/app/src/main/java/com/touchgrass/MMKVStore.kt)
- What happens now:
	- `TrackingController` maintains a daily baseline (`baseDistanceMeters/baseElapsedSeconds`) that is merged once at startup.
	- Canonical state (`TrackingSessionState`) carries **both** session-scoped and daily-scoped totals:
		- `sessionDistanceMeters/sessionElapsedSeconds` are session-only.
		- `todayDistanceMeters/todayElapsedSeconds` are computed as `base + session`.
	- On session finalisation, `TrackingController` calls `onSessionFinalised(sessionDistance, sessionElapsed, goalReached)`.
	- `TrackingService` persists **session-scoped** values via `SessionRepository.closeSession(distanceMeters, elapsedSeconds, ...)`, and the repository accumulates daily totals by those session deltas.
	- MMKV is updated as a **single-writer absolute snapshot** from `TrackingService` (for JS fast-path reads), not as an accumulation bus.
- Why it was fragile previously:
	- Persisting `baseline + session` into an “accumulate daily” API inflated totals (baseline double-counting).
	- Multiple writers to MMKV made “today totals” ambiguous (delta vs absolute).
- Simplification direction:
	- Make the canonical state explicitly include separate fields:
		- `sessionDistanceMeters`, `sessionElapsedSeconds`
		- `todayDistanceMeters`, `todayElapsedSeconds`
	- Persist **session deltas** and/or compute daily totals deterministically in one place (repository), not in controller + MMKV simultaneously.

### 5) Background service start restrictions: MotionTrackingBridge uses `startService()`

**Status (2026-02-24): Fixed (Stage 5 removed intent IPC).**

- What happened previously:
	- Motion code used service-to-service intent starts.
- Risk (Android 8+):
	- Starting a background service from the background can throw `IllegalStateException` unless using `startForegroundService()` (and then promoting to foreground quickly).
	- This failure path is swallowed by catch-all exception logging, so tracking can silently fail to start.
- Simplification direction:
	- Avoid service-to-service intent bridges entirely by consolidating to a single orchestrator service.
	- If keeping two services, use `ContextCompat.startForegroundService()` for `TrackingService` and handle failures explicitly.

### 6) Main-thread blocking in service startup

- Where:
	- [TrackingService.onCreate()](../android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt) uses `runBlocking { repo.getDailyTotal(...) }`.
- Why it’s risky:
	- Blocks the main thread during service creation.
	- Increases risk of ANR or missing the foreground start deadline under load.
- Simplification direction:
	- Call `startForeground()` immediately with a minimal “Starting…” notification.
	- Load baseline on `Dispatchers.IO` and update state asynchronously.

### 7) Redundant work and excessive coupling to MMKV

**Status (2026-02-24): Partially fixed (Stages 3 & 6).**

- Where:
	- [TrackingService.handleStateChange()](../android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt) writes MMKV snapshot.
	- [MotionModule](../android/app/src/main/java/com/touchgrass/motion/MotionModule.kt) emits debug updates every 500ms.
- Why it’s overcomplicated:
	- MMKV as a shared “bus” increases coupling between modules.
- Simplification direction:
	- Single writer policy: only `TrackingService` updates persisted fast-path snapshots.
	- Prefer events/streams for UI where possible; keep polling limited to debug-only scenarios.

### 8) Heartbeat WorkManager job is complexity without clear correctness value

**Status (2026-02-24): Removed (Stage 7).**

- Where:
	- Previously: `HeartbeatManager` WorkManager periodic job.
- Why it’s questionable:
	- Periodic WorkManager (3m) adds scheduler overhead and wakes.
	- The rationale (“quiet FGS deprioritized”) is not a stable platform contract.
- Simplification direction:
	- Prefer correctness via an actual foreground service doing real work (sensors/location callbacks) and a proper ongoing notification.
	- If a watchdog is needed, implement an explicit “staleness detector” in state (e.g., `lastUpdateMs`) and restart engine only when stale.

### 9) PendingIntent mutability is overly permissive

- Where:
	- [MotionEngine.getActivityPendingIntent()](../android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt)
- What happens now:
	- Uses `PendingIntent.FLAG_MUTABLE`.
- Simplification direction:
	- Use `FLAG_IMMUTABLE` unless you have a concrete need for mutability.

## Target Architecture (Android Rewrite)

Note: this section is the original rewrite target. The current implementation achieves most of these goals using `TrackingService` + `TrackingController` + `TrackingSessionState` directly (without a standalone `TrackingEngine` / `TrackingStateStore` split).

### Goals

- **Single source of truth** for tracking session state (including explicit separation of session vs daily totals).
- **Reactive, efficient updates** using `StateFlow`, with throttled projections for notification and UI.
- **Clear boundaries**: service lifecycle/orchestration vs engines (motion/location) vs persistence vs notifications.
- **Foreground/background parity**: same engines + same state model regardless of UI presence.
- **Notification as a projection**: derived from canonical state, not updated ad-hoc.
- **Android 12–15 compliant**: foreground service start constraints, startForeground deadlines, background restrictions.

### Opinionated proposal

**Consolidate to one foreground service** that owns both motion detection and tracking, rather than a MotionService + TrackingService split.

- Manifest: a single service (e.g., `TrackingForegroundService`) declared with `foregroundServiceType="location|health"` (and retain the existing permissions).
- Runtime: service calls `startForeground()` once, and never shares its notification ID with other services.

Proposed component diagram:

Sensors + ActivityRecognition
	→ MotionEventSource
Location (FusedLocationProvider)
	→ LocationEventSource

MotionEventSource + LocationEventSource
	→ TrackingEngine
	→ TrackingStateStore (StateFlow)
		 → NotificationController (throttled)
		 → RN bridge (optional binding/events)
		 → TrackingRepository (persistence & recovery)

### Canonical state model (single source of truth)

Define a single model, owned by `TrackingStateStore`:

Implementation note (2026-02-24): the shipped model is [TrackingSessionState.kt](../android/app/src/main/java/com/touchgrass/tracking/TrackingSessionState.kt) and is a simplified variant of the below proposal (it uses `TrackingMode`/`GpsMode` and explicit `session*` + `today*` totals).

```kotlin
sealed interface SessionStatus { data object Off; data object Running; data object Paused }

data class TrackingSessionState(
		val status: SessionStatus,
		val sessionId: String?,
		val startedAtElapsedRealtimeMs: Long?,

		// Session-scoped
		val sessionDistanceMeters: Double,
		val sessionElapsedSeconds: Long,

		// Daily-scoped (persisted)
		val todayDistanceMeters: Double,
		val todayElapsedSeconds: Long,
		val goalReached: Boolean,

		// Signals + quality
		val activityType: ActivityType,
		val activityConfidence: Int,
		val gpsMode: GpsMode,
		val locationPermission: Boolean,
		val backgroundLocationPermission: Boolean,
		val lastMotionEventMs: Long,
		val lastLocationFixMs: Long,

		// Derived/projection helpers
		val lastUpdateMs: Long,
)
```

Key rule: notification/UI render from this model only. No “baseline offsets” in random layers.

### Reactive update strategy

- Internals:
	- `TrackingStateStore.state: StateFlow<TrackingSessionState>` updated by the engine.
- Throttling:
	- `NotificationController` updates at most every **5–15 seconds** or on meaningful change (status change, goal reached, gps mode change).
	- Persistence flush policy: persist to Room on:
		- session start
		- session stop
		- periodic checkpoint (e.g., every 30–60s) while running
		- goal reached
- UI:
	- If RN binds, it subscribes to state stream (or events), not individual callbacks.

### Clear boundaries (what lives where)

- **TrackingForegroundService**
	- Owns lifecycle (`onCreate/onStartCommand/onDestroy`), permission gating, foreground promotion, and starts/stops the engine.
	- Does not compute distance/time.

- **TrackingEngine**
	- Pure-ish computation: ingests motion + locations and produces state updates.
	- No persistence and no MMKV writes.

- **MotionEventSource**
	- Wraps sensors + ActivityRecognition; exposes a Flow of motion/activity events.
	- No direct service-to-service intents.

- **LocationEventSource**
	- Wraps `FusedLocationProviderClient`; exposes Flow of locations.

- **TrackingRepository**
	- Persists sessions and daily totals.
	- Restores last known state on process start.

- **TrackingStateStore**
	- Owns the canonical `TrackingSessionState` and applies updates.
	- Provides a “fast-path snapshot” writer if JS requires synchronous reads.

- **NotificationController**
	- Collects from `TrackingStateStore.state` and renders using a `NotificationRenderer`.
	- Owns notification ID and channel.

### Foreground/background strategy (Android 12+ / 14+ / 15)

- Use a foreground service for any period where you request continuous sensors and/or background location.
- Do not rely on WorkManager to “keep a service alive”. Use WorkManager for deferred uploads/cleanup only.
- Ensure `startForeground()` is called immediately with a minimal notification; enrich once state is ready.

### Persistence & recovery

- Persist:
	- Daily totals and last session checkpoint periodically.
	- Store an explicit `activeSessionId` and last checkpoint so restart can resume.
- Recovery:
	- On service/process restart, repository loads last checkpoint and state store resumes.
	- If permissions are missing, transition to `Off` state and stop location updates.

## Module Contracts (Android)

Concrete suggested contracts (prose APIs):

### TrackingForegroundService

- Inputs:
	- Intents: `ACTION_START_IDLE`, `ACTION_START_MANUAL`, `ACTION_STOP`, `ACTION_GOALS_UPDATED`.
- Outputs:
	- Starts/stops foreground.
	- Exposes optional binding for RN to subscribe to state.
- Threading:
	- Does not block main thread.

### TrackingEngine

- Inputs:
	- `Flow<MotionEvent>`
	- `Flow<Location>`
	- `GoalConfig` updates
- Output:
	- `Flow<TrackingUpdate>` or direct calls into `TrackingStateStore.reduce(update)`.

### MotionEventSource

- Inputs:
	- config (thresholds)
- Output:
	- `Flow<MotionEvent>` (activity transitions, movement start/stop)

### TrackingStateStore

- Inputs:
	- `reduce(update)` calls from engine
	- `restore(snapshot)` from repository
- Outputs:
	- `state: StateFlow<TrackingSessionState>`
	- `fastPathSnapshotFlow` (optional)

### NotificationController

- Inputs:
	- `StateFlow<TrackingSessionState>`
- Outputs:
	- `NotificationManager.notify(id, notification)`
- Rules:
	- Throttle updates, and only it touches the ongoing notification.

### TrackingRepository

- Inputs:
	- `onSessionStart/Checkpoint/Stop` data
- Outputs:
	- `restoreLastState()`

## Migration Plan (Staged Rewrite)

Status: Stages 1–7 have been implemented in the current codebase as of 2026-02-24. This plan is retained as historical context for why the architecture looks the way it does.

### Stage 1 — Fix the highest-risk lifecycle bugs (no architecture change yet)

- Goals:
	- Fix `null` intent handling in `TrackingService.onStartCommand()`.
	- Stop accidental manual session start on sticky restarts.
- Files:
	- [TrackingService.kt](../android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt)
- Validation:
	- Force-stop process, wait for sticky restart, verify no session starts.

### Stage 2 — Establish a canonical state model (without changing consumers)

- Goals:
	- Introduce `TrackingSessionState` with explicit session vs daily totals.
	- Make `TrackingController` report session-only values.
- Files:
	- Add: `android/app/src/main/java/com/touchgrass/tracking/TrackingSessionState.kt`
	- Touch: `TrackingState.kt`, `TrackingController.kt`, `TrackingService.kt`
- Compatibility:
	- Adapter maps new state to old `TrackingState` fields temporarily.

### Stage 3 — Remove baseline offsets and fix persistence semantics

- Goals:
	- Stop double counting daily totals.
	- Make Room write paths accept deltas/checkpoints, not “baseline + session”.
- Files:
	- [SessionRepository.kt](../android/app/src/main/java/com/touchgrass/storage/SessionRepository.kt)
	- [TrackingService.kt](../android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt)
- Validation:
	- Run 2 short sessions; ensure daily total equals sum of session distances.

### Stage 4 — Consolidate notification ownership

- Goals:
	- Create `NotificationController` that exclusively owns notification ID + updates.
	- Ensure other foreground services (e.g. blocker overlay) do not reuse the tracking notification ID.
- Files:
	- Add: `android/app/src/main/java/com/touchgrass/tracking/NotificationController.kt`
	- Touch: `NotificationHelper.kt`, `TrackingService.kt`, `AppBlockerService.kt`
- Risk:
	- Foreground importance must remain stable while blocker overlay is active.
- Mitigation:
	- If blocker still needs a service, give it a separate notification ID or convert it to a non-FGS where feasible.

### Stage 5 — Collapse MotionService + TrackingService into one orchestrator

- Goals:
	- Remove `MotionTrackingBridge` intent IPC.
	- Run motion + GPS engines inside one service with combined FGS types.
- Files:
	- Touch: `TrackingService.kt`, manifest service declarations, `MotionModule.kt`, `TrackingModule.kt`
	- Remove/retire: `MotionService` and motion intent IPC

### Stage 6 — Reduce MMKV to a single-writer fast-path snapshot

- Goals:
	- Only the state store writes MMKV snapshots at throttled intervals.
	- Motion debug UI reads from state flow/events instead of polling MMKV.
- Files:
	- [MMKVStore.kt](../android/app/src/main/java/com/touchgrass/MMKVStore.kt)
	- [MotionModule.kt](../android/app/src/main/java/com/touchgrass/motion/MotionModule.kt)
	- [TrackingModule.kt](../android/app/src/main/java/com/touchgrass/tracking/TrackingModule.kt)

### Stage 7 — Remove HeartbeatManager (or gate behind diagnostics)

- Goals:
	- Remove periodic WorkManager “liveness” job.
- Files:
	- [TrackingService.kt](../android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt)

## Test & Validation Matrix

Target: Android 10–15 (API 29–35)

### Functional scenarios

- Start manual tracking → lock screen → walk for 2–5 minutes → verify:
	- distance increases
	- elapsed ticks
	- notification updates at intended throttle
- Start idle tracking → keep app backgrounded → start walking → verify:
	- motion transitions to MOVING
	- GPS turns on
	- notification shows progress
- Stop:
	- manual stop button
	- stop via motion idle timeout
	- vehicle detection

### Lifecycle / robustness

- Kill app process while tracking is running (Developer option “Don’t keep activities” + `adb shell am kill`):
	- verify state recovery does not start phantom sessions
	- verify service restart behavior
- Swipe away app from recents while tracking continues:
	- verify service remains foreground and continues
- Revoke permissions mid-session:
	- revoke location → verify service stops location updates and transitions state to Off/Paused with clear notification
	- revoke notifications (Android 13+) → verify you handle lack of permission gracefully
- Battery saver / background restrictions:
	- enable battery saver; restrict background for the app; verify it behaves predictably
- Reboot device (only if you truly want auto-resume):
	- ensure either (a) no auto-resume and no stale state, or (b) explicit boot restore works

### Temporary instrumentation (recommended during rewrite)

- Add structured logs for:
	- state transitions (old → new)
	- session start/stop + IDs
	- persistence checkpoints
	- notification updates (reason + throttle)
	- permissions snapshot

## Open Questions & Assumptions

- Is distance meant to be **GPS-based only**, or can steps contribute?
- What is the desired “progress” semantics:
	- per-session vs per-day total (today’s total)?
- Must tracking survive **device reboot** automatically, or only survive process/service kills while enabled?
- What is the acceptable notification update cadence (e.g., 5s vs 15s), and must it be “real-time”?
- Is idle motion monitoring intended to run without location permission (health-only), or should enabling monitoring require location permission?
- Should AppBlocker truly run as its own FGS (specialUse), or can it be reworked to avoid competing for the same notification slot?

