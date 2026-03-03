package com.touchgrass.tracking

import android.content.Intent
import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.Manifest
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.lifecycle.LifecycleService
import androidx.core.content.ContextCompat
import com.touchgrass.MMKVStore
import com.touchgrass.MMKVMetricsStore
import com.touchgrass.motion.MotionEngine
import com.touchgrass.motion.MotionSessionController
import com.touchgrass.motion.MotionTrackingSink
import com.touchgrass.storage.SessionRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.flow.StateFlow

/**
 * Motion-driven foreground tracking service.
 *
 * Architecture overview:
 *
 *                              TrackingController.onMotion()  ◀── onLocation
 *                                        │                              │
 *                              SessionManager (distance/elapsed)   GpsManager
 *                                        │
 *                              MutableStateFlow<TrackingState>
 *                                        │
 *                              NotificationHelper.build()
 *
 * Key design rules:
 *  · startForeground() is called in onCreate() before any other work.
 *  · The service is START_STICKY so the OS restarts it after a kill.
 *  · GPS is OFF while IDLE; TrackingController enables it only when moving.
 *  · All state mutations happen on the main looper (GpsManager callback + Handler).
 *  · No legacy handlers, scattered booleans, or SharedPreferences tracking state.
 *
 * RN integration (future):
 *  · Subscribe to [state] flow from a bound TrackingModule, map to JS events.
 */
class TrackingService : LifecycleService() {

    companion object {
        private const val TAG = "TrackingService"
        private const val SESSION_CHECKPOINT_INTERVAL_MS = 15_000L
        private const val SESSION_CHECKPOINT_DISTANCE_DELTA_M = 25.0
        private const val SESSION_CHECKPOINT_ELAPSED_DELTA_S = 15L
    }

    // ── Dependencies ──────────────────────────────────────────────────────────

    private lateinit var notificationController: NotificationController
    private lateinit var gpsManager: GpsManager
    private lateinit var controller: TrackingController
    private lateinit var repo: SessionRepository

    // Tracks the previous mode so handleStateChange can detect transitions.
    private var prevMode = TrackingMode.IDLE

    // ── State stream (RN-bridge ready) ────────────────────────────────────────

    private val _sessionState = MutableStateFlow(TrackingSessionState())
    val sessionState: StateFlow<TrackingSessionState> = _sessionState

    // Legacy stream consumed by NotificationHelper + RN callbacks today.
    private val _state = MutableStateFlow(TrackingState())
    val state: StateFlow<TrackingState> = _state

    // ── Listener callbacks (used by TrackingModule while bound) ───────────────

    var onProgressUpdate: ((Double, Long, Boolean) -> Unit)? = null
    var onSessionStateUpdate: ((TrackingSessionState) -> Unit)? = null
    var onGoalReachedCallback: (() -> Unit)? = null
    var onTrackingStoppedCallback: (() -> Unit)? = null

    // ── Notification throttle ─────────────────────────────────────────────────

    private var lastNotificationMs = 0L

    // Track whether the AppBlocker overlay is running so we can append it to the notification.
    private var blockerActive = false

    // Whether we've merged persisted daily totals into the controller state.
    private var baselineMerged = false

    // Whether motion monitoring is enabled (MotionEngine running in this process).
    private var motionEnabled = false

    // In-flight session checkpoint markers.
    private var lastSessionCheckpointMs = 0L
    private var lastSessionCheckpointDistance = 0.0
    private var lastSessionCheckpointElapsed = 0L

    // ── Binder (for TrackingModule to access progress values) ─────────────────

    private val binder = TrackingBinder()

    inner class TrackingBinder : Binder() {
        fun getService(): TrackingService = this@TrackingService
    }

    override fun onBind(intent: Intent): IBinder {
        super.onBind(intent)
        return binder
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()

        try {
            MMKVStore.init(applicationContext)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to init MMKVStore", e)
        }
        try {
            MMKVMetricsStore.init(applicationContext)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to init MMKVMetricsStore", e)
        }

        notificationController = NotificationController(this)
        notificationController.ensureChannel()
        repo = SessionRepository(this)

        // Wire: GPS fix → controller
        gpsManager = GpsManager(this) { location ->
            controller.onLocation(location)
        }

        // Wire: state change → StateFlow + notification + RN callbacks
        controller = TrackingController(
            gps = gpsManager,
            processor = LocationProcessor(),
            sessions = SessionManager(),
            onStateChanged = { newState ->
                _sessionState.value = newState
                val legacy = newState.toLegacyTrackingState()
                _state.value = legacy
                handleStateChange(newSessionState = newState, newLegacyState = legacy)
            },
            goalReachedEvaluator = { todayDistanceMeters, todayElapsedSeconds ->
                computeGoalsReachedFromTotals(todayDistanceMeters, todayElapsedSeconds)
            },
            onSessionFinalised = { distanceMeters, elapsedSeconds, goalReached ->
                // Persist the just-finished session using session-scoped values.
                repo.closeSession(distanceMeters, elapsedSeconds, goalReached)
            }
        )

        DayRolloverScheduler.scheduleNext(this)
        rolloverIfNeeded(source = "on_create", restartManualSession = false)
        persistPlanActivitySnapshotFromMmkv("on_create")

        // Merge persisted daily totals into controller state before posting foreground
        applyCurrentDayBaseline(includeMmkvFallback = true)

        // Must call startForeground before returning from onCreate.
        postForeground(controller.currentState().toLegacyTrackingState())
        Log.d(TAG, "Service created")

        // Stage 5: deliver motion transitions directly into the controller (no intent IPC).
        MotionSessionController.trackingSink = object : MotionTrackingSink {
            override fun onMotionStarted(activityType: String): Boolean {
                if (!hasLocationPermission()) return false
                if (!MMKVStore.isIdleMonitoringEnabled()) return false
                controller.onMotion(activityType.toActivitySnapshotStarted())
                return controller.currentState().mode == TrackingMode.TRACKING_AUTO
            }

            override fun onMotionStopped(activityType: String, reason: String) {
                if (!hasLocationPermission()) return
                if (reason == "vehicle_detected") {
                    controller.onMotion(ActivitySnapshot(
                        type = ActivityType.IN_VEHICLE,
                        confidence = 80,
                        timestampMs = System.currentTimeMillis(),
                        confirmed = true
                    ))
                } else {
                    controller.onMotionStopped()
                }
            }

            override fun onArActivityChanged(activityType: String, isActive: Boolean) {
                val type = activityType.toActivityType()
                controller.onArActivityChanged(type, isActive)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        DayRolloverScheduler.scheduleNext(this)
        rolloverIfNeeded(source = "on_start_command", restartManualSession = true)

        // Stage 1: START_STICKY restart can deliver a null intent.
        // Never interpret that as a user-initiated manual start.
        if (intent == null) {
            Log.w(TAG, "onStartCommand: null intent (likely START_STICKY restart) — fail-closed to IDLE")
            MMKVStore.setAutoTracking(false)
            MMKVStore.setTrackingMode("idle")
            MMKVStore.bumpTrackingRevision()
            MMKVStore.setTodayLastUpdateMs(System.currentTimeMillis())
            if (MMKVStore.isIdleMonitoringEnabled()) {
                Log.d(TAG, "Restoring idle monitoring after sticky restart")
                startMotionIfNeeded()
            } else {
                stopMotionIfRunning()
            }
            refreshNotification()
            return START_STICKY
        }

        val action = intent.action

        // Manual start is represented by an intent with no action and goal extras.
        // Unknown non-null actions should be treated as no-ops, not as manual starts.
        if (action != null && action.isNotBlank() &&
            action != TrackingConstants.ACTION_START_IDLE &&
            action != TrackingConstants.ACTION_STOP_BACKGROUND &&
            action != TrackingConstants.ACTION_STOP_SESSION_ONLY &&
            action != TrackingConstants.ACTION_AR_TRANSITION_REPLAY &&
            action != TrackingConstants.ACTION_BLOCKER_STARTED &&
            action != TrackingConstants.ACTION_BLOCKER_STOPPED &&
            action != TrackingConstants.ACTION_GOALS_UPDATED &&
            action != TrackingConstants.ACTION_DAY_ROLLOVER
        ) {
            Log.w(TAG, "Unknown action=$action — ignoring")
            return START_STICKY
        }

        when (action) {

            TrackingConstants.ACTION_DAY_ROLLOVER -> {
                persistPlanActivitySnapshotForDate(
                    date = MMKVStore.getCurrentDay(),
                    hasActivePlans = MMKVStore.isPlanActiveToday(),
                    source = "action_day_rollover_before_reset",
                )
                DayRolloverScheduler.scheduleNext(this)
                rolloverIfNeeded(source = "alarm_day_rollover", restartManualSession = true)
                persistPlanActivitySnapshotFromMmkv("action_day_rollover_after_reset")
                return START_STICKY
            }

            // ── Idle lifecycle (background tracking enabled from JS) ──────────

            TrackingConstants.ACTION_START_IDLE -> {
                Log.d(TAG, "ACTION_START_IDLE — entering idle watch mode")
                MMKVStore.setAutoTracking(false)
                MMKVStore.setTrackingMode("idle")
                MMKVStore.setIdleMonitoringEnabled(true)
                startMotionIfNeeded()
                // Controller stays in IDLE; GPS stays OFF.
                return START_STICKY
            }

            TrackingConstants.ACTION_STOP_BACKGROUND -> {
                Log.d(TAG, "ACTION_STOP_BACKGROUND — force-stopping all tracking and disabling motion monitoring")
                MMKVStore.setIdleMonitoringEnabled(false)

                // Hard-stop contract: disabling auto/background tracking must end
                // any active session (auto or manual) and publish canonical IDLE
                // before motion/service teardown.
                val currentMode = controller.currentState().mode
                val isActive = currentMode == TrackingMode.TRACKING_AUTO ||
                        currentMode == TrackingMode.TRACKING_MANUAL
                if (isActive) {
                    controller.stopActiveSession()
                }

                stopMotionIfRunning()
                refreshNotification()
                return START_STICKY
            }

            TrackingConstants.ACTION_STOP_SESSION_ONLY -> {
                Log.d(TAG, "ACTION_STOP_SESSION_ONLY — stopping active session only")
                val currentMode = controller.currentState().mode
                val isActive = currentMode == TrackingMode.TRACKING_AUTO ||
                        currentMode == TrackingMode.TRACKING_MANUAL
                if (isActive) {
                    controller.stopActiveSession()
                }
                refreshNotification()
                return START_STICKY
            }

            TrackingConstants.ACTION_AR_TRANSITION_REPLAY -> {
                if (!MMKVStore.isIdleMonitoringEnabled()) {
                    Log.d(TAG, "ACTION_AR_TRANSITION_REPLAY ignored: idle monitoring disabled")
                    return START_STICKY
                }

                val type = intent.getIntExtra(TrackingConstants.EXTRA_AR_ACTIVITY_TYPE, -1)
                val isEntering = intent.getBooleanExtra(TrackingConstants.EXTRA_AR_IS_ENTERING, false)
                val eventTimeNanos = intent.getLongExtra(TrackingConstants.EXTRA_AR_EVENT_TIME_NANOS, 0L)

                if (type < 0) {
                    Log.w(TAG, "ACTION_AR_TRANSITION_REPLAY ignored: invalid activity type")
                    startMotionIfNeeded()
                    return START_STICKY
                }

                // Always ensure monitoring is active before replaying the transition.
                startMotionIfNeeded()

                val lastReplayNanos = MMKVStore.getLastArReplayEventNanos()
                if (eventTimeNanos > 0L && eventTimeNanos == lastReplayNanos) {
                    Log.d(TAG, "ACTION_AR_TRANSITION_REPLAY deduped: nanos=$eventTimeNanos")
                    return START_STICKY
                }

                MotionEngine.onActivityTransitionDetected(type = type, isEntering = isEntering)
                if (eventTimeNanos > 0L) {
                    MMKVStore.setLastArReplayEventNanos(eventTimeNanos)
                }
                return START_STICKY
            }

            TrackingConstants.ACTION_BLOCKER_STARTED -> {
                blockerActive = true
                refreshNotification()
                return START_STICKY
            }

            TrackingConstants.ACTION_BLOCKER_STOPPED -> {
                blockerActive = false
                refreshNotification()
                return START_STICKY
            }

            TrackingConstants.ACTION_GOALS_UPDATED -> {
                persistPlanActivitySnapshotFromMmkv("action_goals_updated")
                Log.d(TAG, "ACTION_GOALS_UPDATED — refreshing notification")
                refreshNotification()
                return START_STICKY
            }

            // ── Manual session start (from JS Play button) ────────────────────

            else -> {
                val goalType  = intent?.getStringExtra(TrackingConstants.EXTRA_GOAL_TYPE) ?: "distance"
                val goalValue = intent?.getDoubleExtra(TrackingConstants.EXTRA_GOAL_VALUE, 5000.0) ?: 5000.0
                val goalUnit  = intent?.getStringExtra(TrackingConstants.EXTRA_GOAL_UNIT) ?: "km"
                Log.d(TAG, "Manual start: type=$goalType value=$goalValue unit=$goalUnit")

                // Do NOT persist the goal extras into MMKV's aggregated plan-goal keys.
                // Those keys are owned by the JS aggregation layer so the notification
                // always reflects the aggregate of all active plans (never a sentinel).

                rolloverIfNeeded(source = "manual_start", restartManualSession = false)
                persistPlanActivitySnapshotFromMmkv("manual_start")
                controller.startManualSession()
                // Fast-path projection is published from handleStateChange().
                Log.d(TAG, "Manual start requested")
                return START_STICKY
            }
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "Service destroyed")
        // Close any in-flight session so data isn't lost on process kill.
        val s = controller.currentState()
        if (s.mode == TrackingMode.TRACKING_AUTO || s.mode == TrackingMode.TRACKING_MANUAL) {
            repo.closeSession(s.sessionDistanceMeters, s.sessionElapsedSeconds, s.goalReached)
        }
        gpsManager.stop()
        stopMotionIfRunning()
        MMKVStore.setAutoTracking(false)
        MMKVStore.setTrackingMode("idle")

        // Restore default sink to avoid leaking this service instance.
        MotionSessionController.trackingSink = object : MotionTrackingSink {
            override fun onMotionStarted(activityType: String): Boolean = false
            override fun onMotionStopped(activityType: String, reason: String) {}
            override fun onArActivityChanged(activityType: String, isActive: Boolean) {}
        }
        super.onDestroy()
    }

    // ── Public surface for TrackingModule ─────────────────────────────────────

    fun stopTracking() {
        controller.stopActiveSession()
    }

    fun stopManualSession() {
        controller.stopManualSession()
    }

    val distanceMeters: Double get() = _state.value.distanceMeters
    val elapsedSeconds: Long   get() = _state.value.elapsedSeconds
    val goalReached: Boolean   get() = _state.value.goalReached

    val currentSessionState: TrackingSessionState get() = _sessionState.value

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * Called on every [TrackingState] change from the controller.
     * Responsible for:
     *  · Forwarding progress to bound TrackingModule listeners.
     *  · Throttled notification refresh.
     *  · MMKV sync so JS can read state without a bound service.
     */
    private fun handleStateChange(newSessionState: TrackingSessionState, newLegacyState: TrackingState) {
        val projectedGoalsReached =
            computeGoalsReachedFromTotals(newLegacyState.distanceMeters, newLegacyState.elapsedSeconds) ||
                newLegacyState.goalReached
        val projectedSessionState = if (newSessionState.goalReached == projectedGoalsReached) {
            newSessionState
        } else {
            newSessionState.copy(goalReached = projectedGoalsReached)
        }
        val projectedLegacyState = if (newLegacyState.goalReached == projectedGoalsReached) {
            newLegacyState
        } else {
            newLegacyState.copy(goalReached = projectedGoalsReached)
        }

        _sessionState.value = projectedSessionState
        _state.value = projectedLegacyState

        val nowTracking = newSessionState.mode == TrackingMode.TRACKING_AUTO ||
                          newSessionState.mode == TrackingMode.TRACKING_MANUAL
        val wasTracking = prevMode == TrackingMode.TRACKING_AUTO ||
                          prevMode == TrackingMode.TRACKING_MANUAL
        val wasIdle = prevMode == TrackingMode.IDLE || prevMode == TrackingMode.PAUSED_VEHICLE

        // ── Session lifecycle → Room ──────────────────────────────────────────
        if (wasIdle && nowTracking) {
            val mode = if (projectedSessionState.mode == TrackingMode.TRACKING_MANUAL) "manual" else "auto"
            repo.startSession(mode)
            lastSessionCheckpointMs = 0L
            lastSessionCheckpointDistance = 0.0
            lastSessionCheckpointElapsed = 0L
        }
        // Session close is handled by TrackingController.onSessionFinalised.

        if (nowTracking) {
            maybeCheckpointSession(projectedSessionState, force = wasIdle)
        } else if (wasTracking) {
            lastSessionCheckpointMs = 0L
            lastSessionCheckpointDistance = 0.0
            lastSessionCheckpointElapsed = 0L
        }

        prevMode = projectedSessionState.mode

        // Stage 6: in-process runtime snapshot (avoid MMKV reads for in-process consumers)
        TrackingRuntimeState.isTrackingActive = nowTracking

        // ── MMKV sync (fast-path for JS on foreground resume) ─────────────────
        MMKVStore.setAutoTracking(nowTracking)
        val trackingMode = when (newSessionState.mode) {
            TrackingMode.TRACKING_MANUAL -> "manual"
            TrackingMode.TRACKING_AUTO -> "auto"
            else -> "idle"
        }
        MMKVStore.setTrackingMode(trackingMode)
        val projectedDistance = projectedLegacyState.distanceMeters
        val projectedElapsed = projectedLegacyState.elapsedSeconds
        // Project canonical totals into MMKV as absolute values.
        // This makes Room the single source of truth while keeping JS reads synchronous.
        MMKVStore.setTodayDistance(projectedDistance)
        MMKVStore.setTodayElapsed(projectedElapsed)
        MMKVStore.setGoalsReached(projectedGoalsReached)
        MMKVStore.bumpTrackingRevision()
        // Commit marker written last so multi-process readers can treat it as "snapshot complete".
        MMKVStore.setTodayLastUpdateMs(System.currentTimeMillis())

        // Forward to bound module
        onProgressUpdate?.invoke(projectedLegacyState.distanceMeters, projectedLegacyState.elapsedSeconds, projectedLegacyState.goalReached)
        onSessionStateUpdate?.invoke(projectedSessionState)

        if (projectedGoalsReached) {
            onGoalReachedCallback?.invoke()
        }

        if (projectedSessionState.mode == TrackingMode.IDLE) {
            onTrackingStoppedCallback?.invoke()
        }

        // Throttled notification update
        val now = System.currentTimeMillis()
        if (now - lastNotificationMs >= TrackingConstants.NOTIFICATION_THROTTLE_MS || projectedLegacyState.goalReached) {
            lastNotificationMs = now
            refreshNotification(projectedLegacyState)
        }
    }

    private fun computeGoalsReachedFromTotals(distanceMeters: Double, elapsedSeconds: Long): Boolean {
        val distanceGoalMeters = goalDistanceMetersOrNull()
        val timeGoalSeconds = goalTimeSecondsOrNull()

        val hasDistanceGoal = distanceGoalMeters != null
        val hasTimeGoal = timeGoalSeconds != null
        if (!hasDistanceGoal && !hasTimeGoal) return false

        val distanceMet = !hasDistanceGoal || distanceMeters >= (distanceGoalMeters ?: 0.0)
        val timeMet = !hasTimeGoal || elapsedSeconds >= (timeGoalSeconds ?: 0L)
        return distanceMet && timeMet
    }

    private fun goalDistanceMetersOrNull(): Double? {
        val raw = MMKVStore.getGoalDistanceValue()
        if (raw <= 0.0) return null
        val unit = MMKVStore.getGoalDistanceUnit().lowercase(Locale.US)
        return when (unit) {
            "m", "meter", "meters" -> raw
            "km", "kilometer", "kilometers" -> raw * 1000.0
            "mi", "mile", "miles" -> raw * 1609.34
            else -> raw
        }
    }

    private fun goalTimeSecondsOrNull(): Long? {
        val raw = MMKVStore.getGoalTimeValue()
        if (raw <= 0.0) return null
        val unit = MMKVStore.getGoalTimeUnit().lowercase(Locale.US)
        val seconds = when (unit) {
            "s", "sec", "secs", "second", "seconds" -> raw
            "m", "min", "mins", "minute", "minutes" -> raw * 60.0
            "h", "hr", "hrs", "hour", "hours" -> raw * 3600.0
            else -> raw
        }
        return seconds.toLong()
    }

    private fun refreshNotification(s: TrackingState = _state.value) {
        // If there are no active plans and nothing to display, cancel notification
        // Always refresh the persistent notification; the builder will decide
        // whether to show progress, a "no active blocks" message, or a
        // blocked-apps count.
        notificationController.update(s)
    }

    private fun maybeCheckpointSession(s: TrackingSessionState, force: Boolean = false) {
        val now = System.currentTimeMillis()
        val distanceDelta = kotlin.math.abs(s.sessionDistanceMeters - lastSessionCheckpointDistance)
        val elapsedDelta = kotlin.math.abs(s.sessionElapsedSeconds - lastSessionCheckpointElapsed)
        val shouldCheckpoint = force ||
            lastSessionCheckpointMs == 0L ||
            (now - lastSessionCheckpointMs) >= SESSION_CHECKPOINT_INTERVAL_MS ||
            distanceDelta >= SESSION_CHECKPOINT_DISTANCE_DELTA_M ||
            elapsedDelta >= SESSION_CHECKPOINT_ELAPSED_DELTA_S

        if (!shouldCheckpoint) return

        repo.checkpointCurrentSession(
            distanceMeters = s.sessionDistanceMeters,
            elapsedSeconds = s.sessionElapsedSeconds,
            goalReached = s.goalReached
        )
        lastSessionCheckpointMs = now
        lastSessionCheckpointDistance = s.sessionDistanceMeters
        lastSessionCheckpointElapsed = s.sessionElapsedSeconds
    }

    private fun rolloverIfNeeded(source: String, restartManualSession: Boolean): Boolean {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val previousDay = MMKVStore.getCurrentDay()
        if (previousDay == today) {
            return false
        }

        val wasManual = controller.currentState().mode == TrackingMode.TRACKING_MANUAL
        val wasActive = wasManual || controller.currentState().mode == TrackingMode.TRACKING_AUTO

        if (wasActive) {
            controller.stopActiveSession()
        }

        persistPlanActivitySnapshotForDate(
            date = previousDay,
            hasActivePlans = MMKVStore.isPlanActiveToday(),
            source = "rollover_before_reset",
        )

        MMKVStore.rolloverToTodayIfNeeded()
        applyCurrentDayBaseline(includeMmkvFallback = false)

        if (restartManualSession && wasManual) {
            controller.startManualSession()
        }

        refreshNotification()
        Log.d(TAG, "Day rollover applied source=$source previousDay=$previousDay today=$today")
        return true
    }

    private fun persistPlanActivitySnapshotFromMmkv(source: String) {
        val date = MMKVStore.getPlanDay().ifBlank {
            SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        }
        persistPlanActivitySnapshotForDate(
            date = date,
            hasActivePlans = MMKVStore.isPlanActiveToday(),
            source = source,
        )
    }

    private fun persistPlanActivitySnapshotForDate(date: String, hasActivePlans: Boolean, source: String) {
        if (!date.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) return
        try {
            MMKVMetricsStore.writePlanDayActivity(date, hasActivePlans)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to persist plan-day activity source=$source date=$date", e)
        }
    }

    private fun applyCurrentDayBaseline(includeMmkvFallback: Boolean) {
        if (baselineMerged && includeMmkvFallback) return

        runBlocking {
            try {
                val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                val daily = repo.getDailyTotal(today)
                val openSession = repo.getLatestOpenSessionForDate(today)
                val roomDistance = (daily?.distanceMeters ?: 0.0) + (openSession?.distanceMeters ?: 0.0)
                val roomElapsed = (daily?.elapsedSeconds ?: 0L) + (openSession?.elapsedSeconds ?: 0L)
                val roomGoalReached = (daily?.goalsReached ?: false) || (openSession?.goalReached ?: false)

                val mmkvDay = MMKVStore.getCurrentDay()
                val mmkvDist = MMKVStore.getTodayDistanceSafe()
                val mmkvElapsed = MMKVStore.getTodayElapsedSafe()
                val mmkvGoalsReached = MMKVStore.getGoalsReachedSafe()

                val baseline = computeStartupBaseline(
                    roomDistanceMeters = roomDistance,
                    roomElapsedSeconds = roomElapsed,
                    roomGoalReached = roomGoalReached,
                    mmkvDistanceMeters = mmkvDist,
                    mmkvElapsedSeconds = mmkvElapsed,
                    mmkvGoalReached = mmkvGoalsReached,
                    includeMmkvFallback = includeMmkvFallback && mmkvDay == today,
                )

                if (baseline != null) {
                    controller.applyBaseline(baseline.distanceMeters, baseline.elapsedSeconds)
                    if (includeMmkvFallback && daily == null && (mmkvDist > 0.0 || mmkvElapsed > 0L || mmkvGoalsReached)) {
                        repo.seedDailyTotalIfMissing(today, mmkvDist, mmkvElapsed, mmkvGoalsReached)
                    }
                } else {
                    controller.applyBaseline(0.0, 0L)
                }

                if (includeMmkvFallback) {
                    baselineMerged = true
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed merging persisted totals: ${e.message}")
            }
        }
    }

    /** Call startForeground immediately — required before any async work. */
    private fun postForeground(s: TrackingState) {
        val notification = notificationController.build(s)

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val type = resolveForegroundType()
                if (type == null) {
                    Log.w(
                        TAG,
                        "Cannot start foreground service: missing runtime permission for HEALTH/LOCATION foreground types; stopping self"
                    )
                    stopSelf()
                    return
                }
                startForeground(
                    TrackingConstants.NOTIFICATION_ID,
                    notification,
                    type
                )
            } else {
                startForeground(TrackingConstants.NOTIFICATION_ID, notification)
            }
        } catch (se: SecurityException) {
            // If the platform still rejects the foreground promotion (e.g. not
            // in an eligible state), fail closed by stopping the service so the
            // app process doesn't crash.
            Log.e(TAG, "Failed to start foreground with resolved service type; stopping self", se)
            stopSelf()
        }
    }

    private fun resolveForegroundType(): Int? {
        val hasLocation = TrackingPermissionGate.hasLocationPermission(this)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return if (hasLocation) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else null
        }

        val hasHealthRuntime = TrackingPermissionGate.hasActivityRecognitionPermission(this)
        return when {
            hasHealthRuntime && hasLocation -> ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH or ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            hasHealthRuntime -> ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
            hasLocation -> ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            else -> null
        }
    }

    private fun hasLocationPermission(): Boolean {
        return TrackingPermissionGate.hasLocationPermission(this)
    }

    private fun hasActivityRecognitionPermission(): Boolean {
        return TrackingPermissionGate.hasActivityRecognitionPermission(this)
    }

    private fun startMotionIfNeeded() {
        if (motionEnabled) return
        try {
            MotionSessionController.reset()
            MotionEngine.start(this, MotionSessionController.config)
            motionEnabled = true
            Log.i(TAG, "MotionEngine started inside TrackingService")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to start MotionEngine", e)
        }
    }

    private fun stopMotionIfRunning() {
        if (!motionEnabled) return
        try {
            MotionEngine.stop()
        } catch (_: Exception) {
        } finally {
            motionEnabled = false
            MotionSessionController.reset()
            Log.i(TAG, "MotionEngine stopped")
        }
    }

    private fun String.toActivitySnapshotStarted(): ActivitySnapshot {
        val type = this.toActivityType()
        return ActivitySnapshot(
            type = type,
            confidence = 80,
            timestampMs = System.currentTimeMillis(),
            confirmed = true
        )
    }

    private fun String.toActivityType(): ActivityType = when (this.lowercase()) {
        "walking" -> ActivityType.WALKING
        "running" -> ActivityType.RUNNING
        "cycling", "on_bicycle" -> ActivityType.ON_BICYCLE
        "vehicle", "in_vehicle" -> ActivityType.IN_VEHICLE
        "still" -> ActivityType.STILL
        else -> ActivityType.UNKNOWN
    }
}
