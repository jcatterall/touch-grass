# Tracking Service Architecture & Rewrite Guidance

This document captures a detailed summary of the existing Android tracking implementation, the React Native bridge, the interactions between the background `TrackingService`, `HeartbeatManager`, and notifications, identified risks/edge-cases, and concrete recommendations for a more robust rewrite.

Files referenced
- `android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt`
- `android/app/src/main/java/com/touchgrass/tracking/TrackingModule.kt`
- `android/app/src/main/java/com/touchgrass/tracking/TrackingPackage.kt`

Overview
- Purpose: background movement tracking (auto/manual) that accumulates distance and elapsed time, exposes progress/events to JS, supports a low-power IDLE mode using motion detection, and persists sessions.
- Core components:
  - `TrackingService` (foreground service): GPS management, session lifecycle, notification, persistence, timers.
  - `TrackingModule` (RN bridge): start/stop/bind, promise APIs, event relay to JS, binding lifecycle.
  - `HeartbeatManager` (external scheduler): schedules periodic maintenance/keepalive.

High-level responsibilities
- `TrackingService`
  - Lifecycle states: `IDLE` (GPS off, waiting for motion), `TRACKING` (GPS on, accumulating).
  - GPS power modes: `OFF`, `LOW_POWER`, `HIGH_ACCURACY` (velocity-driven switching).
  - Location handling: receives fused-location updates and runs acceptance/filter logic, vehicle filtering, idle detection, stop-timeout and stationary buffer, periodic elapsed flush.
  - Persistence: writes to `SessionRepository` (Room) and `MMKVStore` / SharedPreferences for transient state.
  - Notification: single foreground notification slot with progress and blocker state.

- `TrackingModule` (React Native bridge)
  - Methods exposed to JS (Promise-based): `startTracking`, `stopTracking`, `getProgress`, `getUnsavedSession`, `getDailyTotalNative`, `startIdleService`, `stopIdleService`, `getIsAutoTracking`, plus `addListener`/`removeListeners` stubs.
  - Events emitted to JS: `onTrackingProgress`, `onGoalReached`, `onTrackingStopped`, `onTrackingStarted`.
  - Binding behavior: `initialize()` attempts a bind-only-if-running, `startTracking()` uses `startForegroundService` then `bindService` with `BIND_AUTO_CREATE`.

Key constants and configuration
- Notification: `CHANNEL_ID = "touchgrass_tracking"`, `NOTIFICATION_ID = 1001`.
- Intent actions: `ACTION_START_IDLE`, `ACTION_STOP_BACKGROUND`, `ACTION_BLOCKER_STARTED`, `ACTION_BLOCKER_STOPPED`.
- Extras: `EXTRA_GOAL_TYPE`, `EXTRA_GOAL_VALUE`, `EXTRA_GOAL_UNIT`.
- SharedPreferences name: `touchgrass_tracking_prefs` with keys `unsaved_distance`, `unsaved_elapsed`, `unsaved_goal_reached`, `unsaved_date`.
- Thresholds & timers:
  - `MOVEMENT_THRESHOLD_M = 10m` (relaxed to 2-5m when activity is confirmed `WALKING`/`RUNNING`/`ON_BICYCLE`)
  - `STOP_TIMEOUT_MS = 15_000ms` (15s, GPS-only fallback; activity `STILL` triggers faster closure)
  - `STATIONARY_BUFFER_MS = 5_000ms` (5s, minimal buffer since `STILL` activity is primary signal)
  - `VEHICLE_SPEED_KMH = 25 km/h` (GPS-only fallback when activity confidence is low)
  - `ELAPSED_FLUSH_INTERVAL_MS = 30_000ms` (30s)
  - `ACTIVITY_CONFIDENCE_THRESHOLD = 70-75%`

Location processing & session accumulation (detailed)
- Source: `FusedLocationProviderClient` with `LocationRequest.Builder(priority, intervalMs)` and `setMinUpdateDistanceMeters`.
- **Activity-based filtering (primary)**: Use `DetectedActivity` from the motion library as the primary signal for user state. This eliminates many GPS heuristics:
  - `DetectedActivity.IN_VEHICLE` (confidence ≥ 70–75%) → pause distance accumulation immediately, set GPS to `LOW_POWER`.
  - `DetectedActivity.WALKING`, `RUNNING`, `ON_BICYCLE` (confidence ≥ 70–75%) → enable `HIGH_ACCURACY` GPS, relax delta acceptance to `2–5m`, and allow distance accumulation.
  - `DetectedActivity.STILL` (confidence ≥ 70–75%) → immediately end session (no stationary buffer needed).
  - `UNKNOWN` or low confidence → apply GPS speed/accuracy heuristics as fallback only.
- Delta acceptance logic between `lastLocation` and `location`:
  - `delta = prev.distanceTo(location)`
  - **If activity is confirmed (`WALKING`/`RUNNING`/`ON_BICYCLE`)**: Accept deltas ≥ 2–5m and ≤ `maxPlausibleDelta`. Skip counter-based checks.
  - **If activity is `UNKNOWN` or low confidence**: Use GPS-based filtering:
    - `speedMs = location.speed`, `speedKmh = speedMs * 3.6`
    - `effectiveFilter = max(10m, speedMs * 1.5)` (min 10m)
    - `maxPlausibleDelta = max(200m, location.accuracy * 10)`
    - Accept if `delta >= effectiveFilter && delta < maxPlausibleDelta`.
  - Bogus jump if `delta >= maxPlausibleDelta` — skip it.
- On accepted delta: `distanceMeters += delta`, `sessionRepository.accumulateDaily(delta, 0L, false)`.

Idle & stop detection
- **Activity-based idle detection (primary)**: When `DetectedActivity.STILL` is reported with confidence ≥ 70–75%, immediately end the session. No stationary buffer or GPS timeout needed. This is the dominant path for session closure.
- GPS passive fallback: If activity is `UNKNOWN` or low confidence, schedule `stopTimeoutRunnable` after each delivered fix. If no fixes for `STOP_TIMEOUT_MS (15s)`, trigger a brief 5s stationary buffer before ending session.
- **Activity hysteresis**: Require 2+ consecutive activity events within 10s (or sustained activity > 10–15s) before switching critical modes (vehicle↔non-vehicle, STILL) to avoid flapping.

Notifications
- Notification displays title (progress or goal reached), body with progress summary, optional "App blocker on" text when `blockerActive`.
- Built via `NotificationCompat.Builder` and updated via `NotificationManager.notify(NOTIFICATION_ID, notification)`.
- `startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)` used for Android Q+ when entering IDLE/TRACKING.
- Notification updates are throttled to at most once every 15s unless `goalReached`.

HeartbeatManager ↔ TrackingService ↔ Notifications (detailed)
- Purpose of `HeartbeatManager` (inferred from usage): schedule periodic maintenance / keepalive so service can survive background constraints.
- Call-sites:
  - `TrackingService.onStartCommand()` for `ACTION_START_IDLE` → `HeartbeatManager.schedule(this)`.
  - `startTrackingSession()` → `HeartbeatManager.schedule(this)`.
  - `onDestroy()` → `HeartbeatManager.cancel(this)`.
- Typical lifecycle interactions:
  1. JS calls `TrackingModule.startIdleService()` → `MotionTrackingBridge.init()` → start `TrackingService` with `ACTION_START_IDLE`.
  2. `TrackingService` sets state to IDLE, builds notification, calls `startForeground(...)`, and schedules heartbeat.
  3. When motion detected, `MotionTrackingBridge` signals `ACTION_MOTION_STARTED`; `TrackingService` transitions to TRACKING, starts session, calls `startForeground(...)` (TRACKING notification), sets GPS to low/high as appropriate, and re-schedules heartbeat.
  4. When motion stops or stop-timeout fires, `stationaryBufferRunnable` flushes elapsed to MMKV, closes session (Room), `saveSessionToPrefs()`, resets tracking state, and rebuilds notification for IDLE. Heartbeat remains scheduled while IDLE.
  5. `AppBlockerService` may send `ACTION_BLOCKER_STARTED` / `ACTION_BLOCKER_STOPPED` to toggle `blockerActive` and call `refreshNotification()`.
- Important invariants:
  - `startForeground` must be called promptly after `startForegroundService` on Android O+/Q to avoid termination.
  - Last progress should be persisted frequently so a heartbeat-triggered restart can rebuild the notification correctly.

Edge cases & risks
- Race on `startForegroundService()` + immediate `bindService()` in `TrackingModule.startTracking()` — service needs to call `startForeground()` quickly.
- Duplicate or overlapping heartbeat starts could cause double scheduling or repeated start commands if `HeartbeatManager` is not idempotent.
- Lost events when RN JS not active — events are only emitted when RN instance is active; consider buffering last progress for delivery on reconnect.
- Mixed persistence: Room + MMKV + SharedPreferences all used for overlapping concerns — leads to potential inconsistent state if not carefully synchronized.
- Handler Runnables and multi-starts: ensure duplicates are correctly removed and do not leak across restarts.

Rewrite recommendations (concrete)
- **Activity-based state machine (simplified)**: Design location processing to use `DetectedActivity` as the dominant signal, with GPS heuristics as fallback only:
  - `LocationProcessor` receives both location fixes and activity events, processing them on a single dispatcher.
  - For `IN_VEHICLE` (confidence ≥ 70–75%): pause distance accumulation, set GPS to `LOW_POWER`.
  - For `WALKING`, `RUNNING`, `ON_BICYCLE` (confidence ≥ 70–75%): relax delta acceptance to 2–5m, prefer `HIGH_ACCURACY` GPS, enable accumulation.
  - For `STILL` (confidence ≥ 70–75%): end session immediately (no buffer or timeout needed).
  - For `UNKNOWN` or low confidence: fall back to GPS-based speed/accuracy filters (effectiveFilter, maxPlausibleDelta).
  - Include hysteresis (2+ consecutive events within 10s) to prevent mode flapping, especially for vehicle↔non-vehicle transitions.
  - **Result**: Eliminate `IDLE_FIX_COUNT_THRESHOLD`, reduce `STOP_TIMEOUT_MS` to 15s (GPS-only fallback), reduce `STATIONARY_BUFFER_MS` to 5s (minimal), simplify session lifetime.
- API surface: keep promise-based start/stop plus well-defined events; prefer these method names and signatures:
  - `startTracking({ type, value, unit }): Promise<void>`
  - `stopTracking(): Promise<void>`
  - `startIdle(): Promise<void>`
  - `stopIdle(): Promise<void>`
  - `getProgress(): Promise<{distanceMeters, elapsedSeconds, goalReached}>`
  - `getUnsavedSession(): Promise<...>`
  - `getDailyTotalNative(dateString?): Promise<...>`
  - `isAutoTracking(): Promise<boolean>`
- Streaming: expose a `StateFlow`/`SharedFlow` (Kotlin) or equivalent from the service for progress updates; the RN bridge subscribes and emits to JS. Buffer last snapshot for reconnects.
- Decouple concerns:
  - `LocationProcessor` — pure Kotlin class implementing activity-aware delta acceptance, vehicle filter logic, and STILL-based session closure. Encapsulates confidence thresholds and hysteresis counters. Add unit tests for all activity transitions and GPS fallback paths.
  - `SessionManager` — handles accumulating/closing sessions and atomic persistence to Room/MMKV. Simplifies closure logic: triggered directly by STILL activity or GPS timeout.
  - `NotificationHelper` — builds/updates notifications from `TrackingState` snapshots; idempotent.
  - `HeartbeatManager` — explicit idempotent API; prefer using WorkManager/JobScheduler for periodic flush/maintenance. Less critical now that sessions close faster via activity signals.
- Storage: consolidate transient vs durable storage. Use Room for durable session data and MMKV for small flags/fast counters. Migrate `touchgrass_tracking_prefs` into unified adapter on first-run.
- Binding & lifecycle
  - Use coroutine-backed bind-with-retry in `TrackingModule` and subscribe to `StateFlow` rather than relying solely on Binder callbacks.
  - Buffer events in service and deliver last snapshot on bind.
  - Pass activity type metadata through the motion bridge: include `EXTRA_ACTIVITY_TYPE` (DetectedActivity int) and `EXTRA_ACTIVITY_CONFIDENCE` (0–100) with motion intents.
- Concurrency
  - Keep all mutable state on a single coroutine dispatcher; mark cross-thread fields `@Volatile` or use atomics.
  - Cancel coroutines and remove Handler callbacks in `onDestroy()`.
- Notifications & heartbeat
  - Implement a WorkManager worker for periodic flushes (replace or augment `HeartbeatManager`), and ensure the worker flushes persisted elapsed before any restart.
  - Rehydrate persisted progress on `onCreate()` and call `startForeground()` early to avoid kills.

Proposed data & event contracts (explicit)
- `trackingProgress` event: `{ distanceMeters:number, elapsedSeconds:number, goalReached:boolean, activityType?:"WALKING"|"RUNNING"|"ON_BICYCLE"|"IN_VEHICLE"|"STILL"|"UNKNOWN", activityConfidence?:number, timestampMs?:number }`
- `trackingStarted`: `{ mode:"manual"|"auto", goalType?:string, goalValue?:number, goalUnit?:string, activityType?:string }`
- `trackingStopped`: `{ reason:"user"|"stationary"|"permission"|"vehicle"|"error", lastActivityType?:string }`
- `goalReached`: `{ distanceMeters:number, elapsedSeconds:number }`
- `unsavedSession`: `{ date:string, distanceMeters:number, elapsedSeconds:number, goalsReached:boolean }`
- Motion bridge intents include: `EXTRA_ACTIVITY_TYPE` (int: DetectedActivity constant), `EXTRA_ACTIVITY_CONFIDENCE` (int 0–100), `EXTRA_ACTIVITY_TIMESTAMP_MS` (epoch ms when detected)

Migration notes
- Continue reading existing `touchgrass_tracking_prefs` and MMKV keys; migrate into unified storage on first run.
- Preserve notification channel id and intent action strings for backwards compatibility.

Next steps
- Options you can request me to implement next:
  1. Produce a Kotlin interface and skeleton for a rewritten `TrackingService` that exposes `StateFlow` and uses `LocationProcessor` + `NotificationHelper`.
  2. Scaffold `LocationProcessor` (pure Kotlin) with unit tests for delta acceptance, vehicle filter and idle detection.
  3. Create a `HeartbeatManager` rewrite that uses WorkManager and an example Worker for periodic flush.

File created: [docs/tracking-service-architecture.md](docs/tracking-service-architecture.md)

---

## Guidance: Motion implementation notes (DO NOT IMPLEMENT)

These notes describe how the current motion-detection components interact with the `TrackingService`. They are guidance only and are not intended as an implementation specification.

- Components involved (existing):
  - `MotionService` — the motion-detection engine that runs independently of GPS. Responsible for low-power sampling (accelerometer/other sensors) and detecting activity state transitions.
  - `MotionTrackingBridge` — lightweight bridge used by `TrackingModule` and `TrackingService` for signalling. Emits intent actions `ACTION_MOTION_STARTED` and `ACTION_MOTION_STOPPED` with optional extras like `EXTRA_ACTIVITY_TYPE`.
  - `MotionSessionController` — higher-level controller that can reset motion state and coordinate session-level behavior.

- How motion is used by `TrackingService` (current behavior):
  - `startIdleService()` from JS initializes `MotionTrackingBridge` and starts `MotionService`.
  - While in `IDLE` state the service keeps GPS off and relies on `MotionService` to wake it via `ACTION_MOTION_STARTED` when genuine movement is detected.
  - On `ACTION_MOTION_STARTED` the service transitions to `TRACKING` and starts a GPS session (calls `startTrackingSession`).
  - On `ACTION_MOTION_STOPPED` (or GPS-based stationary detection) the service arms a stationary buffer and may end the session after `STATIONARY_BUFFER_MS` if no motion resumes.

- Design guidance / considerations (NOT for immediate implementation):
  - Keep motion detection logic separate from location-processing. Motion should be a low-power trigger only — avoid using it to determine fine-grained distance accumulation.
  - Make motion signals idempotent and include activity-type metadata (walking/running/cycling/vehicle) so the service can apply mode-specific heuristics (e.g., ignore short vehicle-like spikes unless sustained).
  - Provide a small hysteresis or debounce in `MotionService` to avoid rapid start/stop flapping at activity boundaries. The existing stationary buffer is useful; keep it but tune thresholds using field data.
  - Ensure the bridge supplies a reliable timestamp with motion events so the `TrackingService` can reconcile motion events with GPS fix timestamps for accurate elapsed/distance accounting.
  - Expose a health-check or diagnostic event from `MotionService` (sample rate, last-sample-ts) so the service can detect sensor failures or low-power suspensions.
  - When migrating to a new architecture, design the bridge to allow both intent-based signals and a direct IPC/Flow subscription so the service can optionally subscribe when bound.
  - For testing, provide a deterministic mock of `MotionService` that can inject START/STOP with configurable timing to validate stationary buffer and stop-timeout interactions.

- Testing & telemetry guidance:
  - Log activity-type and motion confidence (if available) on transitions. Capture these in debug logs and in limited telemetry to tune parameters in the field.
  - Correlate motion events with GPS fix quality (accuracy, speed) to refine rules that prevent false starts indoors or in vehicles.

These notes are guidance only and intentionally avoid prescriptive implementation steps. Use them to inform API and architecture choices for the motion subsystem during a rewrite.

### ActivityType integration (Motion DetectedActivity)

Use the `DetectedActivity` activity type from the motion library as a primary signal for high-level user state and fall back to GPS-derived speed/velocity when activity confidence is low or ambiguous.

Mapping (DetectedActivity -> canonical):
- `DetectedActivity.WALKING`  -> `WALKING`
- `DetectedActivity.RUNNING`  -> `RUNNING`
- `DetectedActivity.ON_BICYCLE` -> `ON_BICYCLE`
- `DetectedActivity.IN_VEHICLE` -> `IN_VEHICLE`
- `DetectedActivity.STILL`    -> `STILL`
- otherwise -> `UNKNOWN`

Recommended behavior rules:
- If activity == `IN_VEHICLE` and confidence >= threshold:
  - Pause distance accumulation (same effect as current `VEHICLE_SPEED_KMH` filter).
  - Set GPS mode to `LOW_POWER`.
- If activity == `WALKING` | `RUNNING` | `ON_BICYCLE` and confidence >= threshold:
  - Prefer `HIGH_ACCURACY` GPS mode and allow distance accumulation.
- If activity == `STILL` and confidence >= threshold:
  - Arm the stationary buffer immediately (short-circuit GPS-only idle detection).
- If `UNKNOWN` or confidence < threshold:
  - Fall back to the existing GPS speed/accuracy heuristics (`effectiveFilter`, `maxPlausibleDelta`).

Confidence & hysteresis:
- Start with a confidence threshold of 70–75% (tune with telemetry).
- Require short hysteresis before switching critical modes to avoid flapping:
  - Example: require 2 consecutive matching activity events within 10s, or a sustained activity > 10–15s.
  - For vehicle->non-vehicle transitions, require similar confirmation to avoid false un-pauses.

Reconciliation with GPS (safety):
- Always cross-check activity with GPS speed to avoid misclassification impacts:
  - If activity==`IN_VEHICLE` but GPS speed remains low for a sustained period, mark ambiguous and delay full vehicle-mode actions until confirmed.
  - If activity==`WALKING`/`RUNNING` but GPS speed is inconsistent (very high), be conservative: require repeated confirmations or higher confidence before trusting activity.

Integration points & data contract:
- Ensure `MotionTrackingBridge` / `MotionService` include these extras with motion intents:
  - `EXTRA_ACTIVITY_TYPE` (int: DetectedActivity constant)
  - `EXTRA_ACTIVITY_CONFIDENCE` (int 0..100)
  - `EXTRA_ACTIVITY_TIMESTAMP_MS` (optional — epoch ms when detected)
- In `TrackingService.onStartCommand()` handle `ACTION_MOTION_STARTED` / `ACTION_MOTION_STOPPED` by delegating to `handleMotionActivity(activityType, confidence, ts)` rather than only toggling GPS by velocity.

Concise Kotlin pseudocode (for reference)
```kotlin
private var lastActivity: Int? = null
private var consecutiveActivityCount = 0
private val ACTIVITY_CONF_THRESHOLD = 75
private val ACTIVITY_CONFIRM_COUNT = 2

fun handleMotionActivity(activityType: Int, confidence: Int, ts: Long = System.currentTimeMillis()) {
  if (confidence < ACTIVITY_CONF_THRESHOLD) {
    // low confidence — fallback to GPS heuristics
    return
  }

  if (lastActivity == activityType) {
    consecutiveActivityCount += 1
  } else {
    lastActivity = activityType
    consecutiveActivityCount = 1
  }

  if (consecutiveActivityCount < ACTIVITY_CONFIRM_COUNT) return

  when (activityType) {
    DetectedActivity.IN_VEHICLE -> {
      pauseDistanceAccumulation()
      setGpsPriority(GpsMode.LOW_POWER)
    }
    DetectedActivity.WALKING, DetectedActivity.RUNNING, DetectedActivity.ON_BICYCLE -> {
      setGpsPriority(GpsMode.HIGH_ACCURACY)
      resumeDistanceAccumulation()
    }
    DetectedActivity.STILL -> {
      handler.removeCallbacks(stopTimeoutRunnable)
      handler.postDelayed(stationaryBufferRunnable, STATIONARY_BUFFER_MS)
    }
    else -> {
      // UNKNOWN — no change; rely on GPS
    }
  }
}
```

Telemetry and tuning guidance:
- Log `activityType`, `confidence`, whether it was applied, and any GPS speed disagreement for offline tuning.
- Collect histograms of confidence vs correct outcome to tune threshold and hysteresis.

Edge cases & caveats:
- Activity recognition can be noisy indoors or when sensors are disabled; always preserve the GPS-based fallbacks and plausibility checks.
- Ensure timestamps are present on bridge events so late events do not incorrectly alter current state.
- Provide a mockable motion interface for deterministic unit and integration testing (inject START/STOP/activity events).

These additions are guidance for how to incorporate activity recognition into the tracking logic; they are intended to reduce reliance on raw speed heuristics while preserving safety through cross-checks and hysteresis.
