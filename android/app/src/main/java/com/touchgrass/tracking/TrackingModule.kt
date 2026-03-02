package com.touchgrass.tracking

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.IBinder
import android.util.Log
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.Build
import androidx.core.content.ContextCompat
import android.Manifest
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.touchgrass.storage.SessionRepository
import com.touchgrass.motion.MotionSessionController
import com.touchgrass.MMKVStore
import com.touchgrass.MMKVMetricsStore
import com.touchgrass.storage.TrackingDatabase
import com.touchgrass.storage.DailyTotalEntity
import com.touchgrass.storage.computeGoalStreaksInRange
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.max

class TrackingModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    override fun getName(): String = "TrackingModule"

    private var trackingService: TrackingService? = null
    private var bound = false

    private val mainHandler = Handler(Looper.getMainLooper())
    private var isForeground = false
    private var listenerCount = 0

    private var lastAnchorSentElapsedRealtimeMs = 0L
    private var lastAnchorSnapshot: AnchorSnapshot? = null

    private val stopGraceMs = 300L

    private data class AnchorSnapshot(
        val isTracking: Boolean,
        val mode: TrackingMode,
        val shouldTick: Boolean,
        val todayDistanceMeters: Double,
        val todayElapsedSeconds: Long,
        val goalReached: Boolean
    )

    private data class CurrentTotals(
        val distanceMeters: Double,
        val elapsedSeconds: Long,
        val goalReached: Boolean,
        val sessionCount: Int,
    )

    /**
     * If TrackingService is already running when the module initialises (e.g. app
     * re-foregrounded while a background session is active), bind to it so that
     * progress events flow to JS immediately.
     */
    override fun initialize() {
        super.initialize()
        reactApplicationContext.addLifecycleEventListener(this)
        // Best-effort initial foreground detection.
        isForeground = reactApplicationContext.currentActivity != null
        try {
            val intent = Intent(reactApplicationContext, TrackingService::class.java)
            val didBind = reactApplicationContext.bindService(intent, connection, 0)
            if (didBind) Log.d(TAG, "initialize: bound to already-running TrackingService")
        } catch (e: Exception) {
            Log.w(TAG, "initialize: could not bind to running service", e)
        }
    }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as TrackingService.TrackingBinder
            val svc = binder.getService()
            trackingService = svc
            bound = true
            Log.d(TAG, "Service connected")

            // Option B: emit efficient "anchor" snapshots rather than 1Hz elapsed deltas.
            svc.onSessionStateUpdate = { sessionState ->
                maybeEmitAnchor(sessionState)
            }

            svc.onGoalReachedCallback = {
                sendEvent("onGoalReached", Arguments.createMap())
                unbindService()
            }

            svc.onTrackingStoppedCallback = {
                sendEvent("onTrackingStopped", Arguments.createMap())
            }

            // Replay current state on bind so JS can anchor immediately.
            mainHandler.post {
                try {
                    maybeEmitAnchor(svc.currentSessionState, force = true)
                    if (svc.currentSessionState.mode == TrackingMode.TRACKING_AUTO ||
                        svc.currentSessionState.mode == TrackingMode.TRACKING_MANUAL
                    ) {
                        sendEvent("onTrackingStarted", Arguments.createMap())
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed initial state replay", e)
                }
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            Log.d(TAG, "Service disconnected")
            trackingService = null
            bound = false
        }
    }

    @ReactMethod
    fun startTracking(goalType: String, goalValue: Double, goalUnit: String, promise: Promise) {
        val svc = trackingService
        if (bound && svc != null) {
            val mode = svc.currentSessionState.mode
            val alreadyTracking = mode == TrackingMode.TRACKING_AUTO || mode == TrackingMode.TRACKING_MANUAL
            if (alreadyTracking) {
                Log.d(TAG, "Already tracking, ignoring duplicate start")
                promise.resolve(true)
                return
            }
        }

        try {
            if (!hasLocationPermission()) {
                Log.w(TAG, "startTracking called without location permission; not starting TrackingService")
                // Resolve "false" so JS can distinguish a no-op from success
                // without surfacing an error.
                promise.resolve(false)
                return
            }

            val context = reactApplicationContext
            val intent = Intent(context, TrackingService::class.java).apply {
                putExtra(TrackingConstants.EXTRA_GOAL_TYPE, goalType)
                putExtra(TrackingConstants.EXTRA_GOAL_VALUE, goalValue)
                putExtra(TrackingConstants.EXTRA_GOAL_UNIT, goalUnit)
            }

            Log.d(TAG, "Starting tracking: type=$goalType value=$goalValue unit=$goalUnit")
            context.startForegroundService(intent)
            context.bindService(intent, connection, Context.BIND_AUTO_CREATE)

            sendEvent("onTrackingStarted", Arguments.createMap())
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start tracking", e)
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopTracking(promise: Promise) {
        try {
            Log.d(TAG, "Stopping tracking")

            val svc = trackingService
            svc?.stopTracking()

            // Keep TrackingService alive so a single sticky notification can
            // continue showing current day plan status, even when no session is active.
            mainHandler.postDelayed({
                unbindService()
            }, stopGraceMs)

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop tracking", e)
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getProgress(promise: Promise) {
        try {
            val service = trackingService
            val isToday = MMKVStore.isCurrentDayToday()
            // If the JS layer calls getProgress while the service is not bound
            // (common on cold start / after background), fall back to MMKV's
            // projected "today totals" so UI can still show current progress.
            val distanceMeters = if (isToday) {
                service?.distanceMeters ?: MMKVStore.getTodayDistanceSafe()
            } else {
                0.0
            }
            val elapsedSeconds = if (isToday) {
                service?.elapsedSeconds ?: MMKVStore.getTodayElapsedSafe()
            } else {
                0L
            }
            val goalReached = if (isToday) {
                service?.goalReached ?: MMKVStore.getGoalsReachedSafe()
            } else {
                false
            }
            val result = Arguments.createMap().apply {
                putDouble("distanceMeters", distanceMeters)
                putDouble("elapsedSeconds", elapsedSeconds.toDouble())
                putBoolean("goalReached", goalReached)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Returns an "anchor" snapshot for Option B UI ticking.
     * JS can render a 1Hz timer in the foreground using this as the baseline.
     */
    @ReactMethod
    fun getTrackingAnchor(promise: Promise) {
        try {
            val service = trackingService
            val session = service?.currentSessionState

            // Best effort fallback when unbound: provide projected totals but do not
            // claim eligibility (fail-closed so JS never ticks incorrectly).
            if (session == null) {
                val persistedMode = MMKVStore.getTrackingMode().lowercase(Locale.US)
                val safeMode = when (persistedMode) {
                    "manual", "auto" -> persistedMode
                    else -> "idle"
                }
                val isTracking = safeMode == "manual" || safeMode == "auto"
                val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                val totals = runBlocking {
                    getCurrentTotalsForDate(
                        date = today,
                        includeMmkvTodayFallback = true,
                    )
                }
                val result = Arguments.createMap().apply {
                    putDouble("todayDistanceMeters", totals.distanceMeters)
                    putDouble("todayElapsedSeconds", totals.elapsedSeconds.toDouble())
                    putDouble("sessionDistanceMeters", 0.0)
                    putDouble("sessionElapsedSeconds", 0.0)
                    putBoolean("goalReached", totals.goalReached)
                    putBoolean("isTracking", isTracking)
                    putString("mode", safeMode)
                    putBoolean("shouldTick", false)
                    putDouble("lastUpdateMs", System.currentTimeMillis().toDouble())
                }
                promise.resolve(result)
                return
            }

            promise.resolve(buildAnchorPayload(session))
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Returns any unsaved session data from a previous run.
     * The new architecture holds sessions in-memory (SessionManager) with Room persistence
     * planned as a future extension. Returns null until persistence is wired.
     */
    @ReactMethod
    fun getUnsavedSession(promise: Promise) {
        promise.resolve(null)
    }

    /**
     * Returns today's reconciled totals from native persistence (Room daily + open session),
     * with same-day MMKV fallback for fast-path continuity after process restarts.
     */
    @ReactMethod
    fun getDailyTotalNative(promise: Promise) {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val total = getCurrentTotalsForDate(
                    date = today,
                    includeMmkvTodayFallback = true,
                )
                if (total.distanceMeters <= 0.0 && total.elapsedSeconds <= 0L && !total.goalReached) {
                    promise.resolve(null)
                } else {
                    val result = Arguments.createMap().apply {
                        putDouble("distanceMeters", total.distanceMeters)
                        putDouble("elapsedSeconds", total.elapsedSeconds.toDouble())
                        putBoolean("goalsReached", total.goalReached)
                    }
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get daily total", e)
                promise.reject("ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun getMetricsSummaryNative(period: String, anchorDate: String?, promise: Promise) {
        val normalizedPeriod = normalizePeriod(period)
        val endDate = normalizeDateOrToday(anchorDate)
        val range = resolveRange(normalizedPeriod, endDate)
        val dao = TrackingDatabase.getInstance(reactApplicationContext).trackingDao()
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

        CoroutineScope(Dispatchers.IO).launch {
            try {
                MMKVMetricsStore.init(reactApplicationContext)
                val installDay = MMKVMetricsStore.ensureInstallDaySeeded()
                val rows = dao.getDailyTotalsBetween(range.first, range.second)
                val blocking = MMKVMetricsStore.getBlockingTotalsBetween(range.first, range.second)
                val todayInRange = today in range.first..range.second
                val reconciledToday = if (todayInRange) {
                    getCurrentTotalsForDate(today, includeMmkvTodayFallback = true)
                } else {
                    null
                }
                val existingToday = rows.firstOrNull { it.date == today }

                var distanceMeters = 0.0
                var elapsedSeconds = 0L
                var sessions = 0
                var goalsReachedDays = 0
                for (row in rows) {
                    distanceMeters += row.distanceMeters
                    elapsedSeconds += row.elapsedSeconds
                    sessions += row.sessionCount
                    if (row.goalsReached) goalsReachedDays += 1
                }

                if (todayInRange && reconciledToday != null) {
                    if (existingToday != null) {
                        distanceMeters -= existingToday.distanceMeters
                        elapsedSeconds -= existingToday.elapsedSeconds
                        sessions -= existingToday.sessionCount
                        if (existingToday.goalsReached) goalsReachedDays -= 1
                    }

                    if (
                        reconciledToday.distanceMeters > 0.0 ||
                        reconciledToday.elapsedSeconds > 0L ||
                        reconciledToday.goalReached ||
                        reconciledToday.sessionCount > 0
                    ) {
                        distanceMeters += reconciledToday.distanceMeters
                        elapsedSeconds += reconciledToday.elapsedSeconds
                        sessions += reconciledToday.sessionCount
                        if (reconciledToday.goalReached) goalsReachedDays += 1
                    }
                }

                val streakRows = if (todayInRange && reconciledToday != null) {
                    val withoutToday = rows.filterNot { it.date == today }
                    if (
                        reconciledToday.distanceMeters > 0.0 ||
                        reconciledToday.elapsedSeconds > 0L ||
                        reconciledToday.goalReached ||
                        reconciledToday.sessionCount > 0
                    ) {
                        withoutToday + DailyTotalEntity(
                            date = today,
                            distanceMeters = reconciledToday.distanceMeters,
                            elapsedSeconds = reconciledToday.elapsedSeconds,
                            goalsReached = reconciledToday.goalReached,
                            sessionCount = reconciledToday.sessionCount,
                            lastUpdatedMs = System.currentTimeMillis(),
                        )
                    } else {
                        withoutToday
                    }
                } else {
                    rows
                }

                val activePlanDays = MMKVMetricsStore.getActivePlanDaysBetween(range.first, range.second)
                val seededHitDays = if (installDay in range.first..range.second) setOf(installDay) else emptySet()

                val streaks = computeGoalStreaksInRange(
                    startDate = range.first,
                    endDate = range.second,
                    rows = streakRows,
                    activePlanDays = activePlanDays,
                    seededHitDays = seededHitDays,
                )

                val result = Arguments.createMap().apply {
                    putString("period", normalizedPeriod)
                    putString("startDate", range.first)
                    putString("endDate", range.second)
                    putDouble("distanceMeters", distanceMeters)
                    putDouble("elapsedSeconds", elapsedSeconds.toDouble())
                    putDouble("sessions", sessions.toDouble())
                    putDouble("goalsReachedDays", goalsReachedDays.toDouble())
                    putDouble("blockedAttempts", blocking.blockedAttempts.toDouble())
                    putDouble("notificationsBlocked", blocking.notificationsBlocked.toDouble())
                    putDouble("currentGoalStreakDays", streaks.currentDays.toDouble())
                    putDouble("longestGoalStreakDays", streaks.longestDays.toDouble())
                    putDouble("computedAtMs", System.currentTimeMillis().toDouble())
                }
                promise.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to compute metrics summary", e)
                promise.reject("ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun getMetricsSeriesNative(period: String, anchorDate: String?, promise: Promise) {
        val normalizedPeriod = normalizePeriod(period)
        val endDate = normalizeDateOrToday(anchorDate)
        val range = if (normalizedPeriod == "alltime") {
            Pair(addDays(endDate, -29), endDate)
        } else {
            resolveRange(normalizedPeriod, endDate)
        }
        val dao = TrackingDatabase.getInstance(reactApplicationContext).trackingDao()
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

        CoroutineScope(Dispatchers.IO).launch {
            try {
                MMKVMetricsStore.init(reactApplicationContext)
                val installDay = MMKVMetricsStore.ensureInstallDaySeeded()
                val rows = dao.getDailyTotalsBetween(range.first, range.second)
                val byDate = rows.associateBy { it.date }
                val activePlanDays = MMKVMetricsStore.getActivePlanDaysBetween(range.first, range.second)
                val seededHitDays = if (installDay in range.first..range.second) setOf(installDay) else emptySet()
                val todayInRange = today in range.first..range.second
                val reconciledToday = if (todayInRange) {
                    getCurrentTotalsForDate(today, includeMmkvTodayFallback = true)
                } else {
                    null
                }

                val points = Arguments.createArray()
                var cursor = range.first
                while (cursor <= range.second) {
                    val row = byDate[cursor]
                    val hasReconciledTodaySignal =
                        reconciledToday != null &&
                            (
                                reconciledToday.distanceMeters > 0.0 ||
                                    reconciledToday.elapsedSeconds > 0L ||
                                    reconciledToday.goalReached ||
                                    reconciledToday.sessionCount > 0
                                )
                    val hasPersistedRowForDay = if (cursor == today && reconciledToday != null) {
                        row != null || hasReconciledTodaySignal
                    } else {
                        row != null
                    }
                    val pointDistance = if (cursor == today && reconciledToday != null) {
                        reconciledToday.distanceMeters
                    } else {
                        row?.distanceMeters ?: 0.0
                    }
                    val pointElapsed = if (cursor == today && reconciledToday != null) {
                        reconciledToday.elapsedSeconds
                    } else {
                        row?.elapsedSeconds ?: 0L
                    }
                    val pointGoalsReached = if (cursor == today && reconciledToday != null) {
                        reconciledToday.goalReached
                    } else {
                        row?.goalsReached ?: false
                    }
                    val pointSeededHit = seededHitDays.contains(cursor)
                    val pointHasActivePlans = activePlanDays.contains(cursor)
                    val pointSessions = if (cursor == today && reconciledToday != null) {
                        reconciledToday.sessionCount
                    } else {
                        row?.sessionCount ?: 0
                    }
                    val blockingDaily = MMKVMetricsStore.getBlockingDaily(cursor)
                    val point = Arguments.createMap().apply {
                        putString("date", cursor)
                        putDouble("distanceMeters", pointDistance)
                        putDouble("elapsedSeconds", pointElapsed.toDouble())
                        putBoolean("goalsReached", pointGoalsReached)
                        putString(
                            "streakState",
                            when {
                                pointSeededHit || pointGoalsReached -> "hit"
                                pointHasActivePlans -> "miss"
                                !hasPersistedRowForDay -> "neutral"
                                else -> "miss"
                            },
                        )
                        putDouble("sessions", pointSessions.toDouble())
                        putDouble(
                            "blockedAttempts",
                            (blockingDaily?.optInt("blockedAttempts", 0) ?: 0).toDouble(),
                        )
                        putDouble(
                            "notificationsBlocked",
                            (blockingDaily?.optInt("notificationsBlocked", 0) ?: 0).toDouble(),
                        )
                    }
                    points.pushMap(point)
                    cursor = addDays(cursor, 1)
                }

                val result = Arguments.createMap().apply {
                    putString("period", normalizedPeriod)
                    putString("startDate", range.first)
                    putString("endDate", range.second)
                    putArray("points", points)
                    putDouble("computedAtMs", System.currentTimeMillis().toDouble())
                }
                promise.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to compute metrics series", e)
                promise.reject("ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun ensureInstallDaySeededNative(date: String?, promise: Promise) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                MMKVMetricsStore.init(reactApplicationContext)
                val normalizedDate = normalizeDateOrToday(date)
                val installDay = MMKVMetricsStore.ensureInstallDaySeeded(normalizedDate)
                promise.resolve(installDay)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to seed install day", e)
                promise.reject("ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun writePlanDayActivityNative(date: String?, hasActivePlans: Boolean, promise: Promise) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val normalizedDate = normalizeDateOrToday(date)
                MMKVMetricsStore.init(reactApplicationContext)
                MMKVMetricsStore.writePlanDayActivity(normalizedDate, hasActivePlans)
                promise.resolve(true)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to persist plan-day activity", e)
                promise.reject("ERROR", e.message)
            }
        }
    }

    /**
        * Starts TrackingService in IDLE state. TrackingService hosts MotionEngine directly
        * (Stage 5: no MotionService / intent IPC).
     */
    @ReactMethod
    fun startIdleService(promise: Promise) {
        try {
            val context = reactApplicationContext

            if (!canStartTrackingForeground()) {
                Log.w(TAG, "startIdleService called without runtime HEALTH/LOCATION permissions; not starting TrackingService")
                promise.resolve(false)
                return
            }

            val trackingIntent = Intent(context, TrackingService::class.java).apply {
                action = TrackingConstants.ACTION_START_IDLE
            }
            ContextCompat.startForegroundService(context, trackingIntent)
            context.bindService(trackingIntent, connection, 0)

            Log.d(TAG, "Idle service started")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start idle service", e)
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Stops the background idle/tracking service and motion detection.
     */
    @ReactMethod
    fun stopIdleService(promise: Promise) {
        try {
            val context = reactApplicationContext
            // Fail-closed: clear the native flag before attempting to message the service.
            // This guarantees motion can never auto-start a session if auto tracking is disabled.
            MMKVStore.setIdleMonitoringEnabled(false)

            // Hard-stop contract: disabling auto/background tracking must force-stop
            // any active session (manual or auto) and converge to IDLE.
            trackingService?.stopTracking()

            // Optimistically project idle for unbound readers while native service
            // completes teardown/final projection.
            MMKVStore.setAutoTracking(false)
            MMKVStore.setTrackingMode("idle")
            MMKVStore.bumpTrackingRevision()
            MMKVStore.setTodayLastUpdateMs(System.currentTimeMillis())

            val intent = Intent(context, TrackingService::class.java).apply {
                action = TrackingConstants.ACTION_STOP_BACKGROUND
            }
            context.startService(intent)

            // Keep the binder alive briefly so JS can receive the final IDLE event
            // and state projection before we detach.
            mainHandler.postDelayed({
                unbindService()
                MotionSessionController.reset()
            }, stopGraceMs)

            Log.d(TAG, "Idle service stopped")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop idle service", e)
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getIsAutoTracking(promise: Promise) {
        promise.resolve(MMKVStore.isAutoTracking())
    }

    @ReactMethod
    fun notifyGoalsUpdated(promise: Promise) {
        try {
            val context = reactApplicationContext
            if (!canStartTrackingForeground()) {
                Log.w(TAG, "notifyGoalsUpdated skipped: missing runtime HEALTH/LOCATION permissions")
                promise.resolve(false)
                return
            }
            val intent = Intent(context, TrackingService::class.java).apply {
                action = TrackingConstants.ACTION_GOALS_UPDATED
            }
            ContextCompat.startForegroundService(context, intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.w(TAG, "notifyGoalsUpdated failed", e)
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount += 1

        // Replay anchor on subscribe so JS can start ticking immediately.
        if (eventName == EVENT_TRACKING_ANCHOR) {
            mainHandler.post {
                val svc = trackingService
                if (svc != null) {
                    maybeEmitAnchor(svc.currentSessionState, force = true)
                }
            }
        }
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount = (listenerCount - count).coerceAtLeast(0)
    }

    private fun unbindService() {
        if (bound) {
            try {
                trackingService?.onProgressUpdate = null
                trackingService?.onSessionStateUpdate = null
                trackingService?.onGoalReachedCallback = null
                trackingService?.onTrackingStoppedCallback = null
                reactApplicationContext.unbindService(connection)
            } catch (e: Exception) {
                Log.w(TAG, "Error unbinding service", e)
            }
            trackingService = null
            bound = false
        }
    }

    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        try {
            if (!reactApplicationContext.hasActiveReactInstance()) return
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to send event $eventName", e)
        }
    }

    private fun hasLocationPermission(): Boolean {
        return TrackingPermissionGate.hasLocationPermission(reactApplicationContext)
    }

    private fun hasActivityRecognitionPermission(): Boolean {
        return TrackingPermissionGate.hasActivityRecognitionPermission(reactApplicationContext)
    }

    private fun canStartTrackingForeground(): Boolean {
        return TrackingPermissionGate.canStartForegroundTracking(reactApplicationContext)
    }

    companion object {
        private const val TAG = "TrackingModule"
        private const val EVENT_TRACKING_ANCHOR = "onTrackingAnchor"
        private const val ANCHOR_RESYNC_MS = 15_000L
        private const val DISTANCE_DELTA_EMIT_METERS = 5.0
    }

    // ── Foreground lifecycle gating ─────────────────────────────────────────

    override fun onHostResume() {
        isForeground = true
        // On resume, replay anchor immediately so UI re-syncs.
        val svc = trackingService
        if (svc != null) {
            mainHandler.post {
                maybeEmitAnchor(svc.currentSessionState, force = true)
            }
        }
    }

    override fun onHostPause() {
        isForeground = false
    }

    override fun onHostDestroy() {
        isForeground = false
    }

    // ── Anchor emission ─────────────────────────────────────────────────────

    private fun buildAnchorPayload(s: TrackingSessionState): com.facebook.react.bridge.WritableMap {
        val isTracking = s.mode == TrackingMode.TRACKING_AUTO || s.mode == TrackingMode.TRACKING_MANUAL
        val modeString = when (s.mode) {
            TrackingMode.TRACKING_MANUAL -> "manual"
            TrackingMode.TRACKING_AUTO -> "auto"
            else -> "idle"
        }
        val isToday = MMKVStore.isCurrentDayToday()
        val todayDistance = if (isToday) s.todayDistanceMeters else 0.0
        val todayElapsed = if (isToday) s.todayElapsedSeconds else 0L
        val goalsReached = if (isToday) s.goalReached else false

        return Arguments.createMap().apply {
            putDouble("todayDistanceMeters", todayDistance)
            putDouble("todayElapsedSeconds", todayElapsed.toDouble())
            putDouble("sessionDistanceMeters", s.sessionDistanceMeters)
            putDouble("sessionElapsedSeconds", s.sessionElapsedSeconds.toDouble())
            putBoolean("goalReached", goalsReached)
            putBoolean("isTracking", isTracking)
            putString("mode", modeString)
            putBoolean("shouldTick", s.isTimeEligible)
            putDouble("lastUpdateMs", s.lastUpdateMs.toDouble())
        }
    }

    private fun maybeEmitAnchor(s: TrackingSessionState, force: Boolean = false) {
        if (!reactApplicationContext.hasActiveReactInstance()) return
        if (!isForeground) return
        if (listenerCount <= 0) return

        val isTracking = s.mode == TrackingMode.TRACKING_AUTO || s.mode == TrackingMode.TRACKING_MANUAL
        val snapshot = AnchorSnapshot(
            isTracking = isTracking,
            mode = s.mode,
            shouldTick = s.isTimeEligible,
            todayDistanceMeters = if (MMKVStore.isCurrentDayToday()) s.todayDistanceMeters else 0.0,
            todayElapsedSeconds = if (MMKVStore.isCurrentDayToday()) s.todayElapsedSeconds else 0L,
            goalReached = if (MMKVStore.isCurrentDayToday()) s.goalReached else false
        )

        val now = SystemClock.elapsedRealtime()
        val last = lastAnchorSnapshot

        val shouldEmit = force || last == null ||
                snapshot.isTracking != last.isTracking ||
                snapshot.mode != last.mode ||
                snapshot.shouldTick != last.shouldTick ||
                snapshot.goalReached != last.goalReached ||
                snapshot.todayElapsedSeconds < last.todayElapsedSeconds ||
                kotlin.math.abs(snapshot.todayDistanceMeters - last.todayDistanceMeters) >= DISTANCE_DELTA_EMIT_METERS ||
                (now - lastAnchorSentElapsedRealtimeMs) >= ANCHOR_RESYNC_MS

        if (!shouldEmit) return

        lastAnchorSnapshot = snapshot
        lastAnchorSentElapsedRealtimeMs = now
        sendEvent(EVENT_TRACKING_ANCHOR, buildAnchorPayload(s))
    }

    private fun normalizePeriod(period: String?): String {
        val raw = period?.lowercase(Locale.US) ?: "day"
        return when (raw) {
            "day", "week", "month", "alltime" -> raw
            else -> "day"
        }
    }

    private fun normalizeDateOrToday(anchorDate: String?): String {
        return if (!anchorDate.isNullOrBlank() && anchorDate.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) {
            anchorDate
        } else {
            SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        }
    }

    private fun resolveRange(period: String, endDate: String): Pair<String, String> {
        return when (period) {
            "day" -> Pair(endDate, endDate)
            "week" -> Pair(addDays(endDate, -6), endDate)
            "month" -> {
                val month = endDate.substring(0, 7)
                val start = "$month-01"
                val cal = Calendar.getInstance(Locale.US)
                cal.time = dateFormatter.parse(start) ?: Date()
                cal.add(Calendar.MONTH, 1)
                cal.add(Calendar.DAY_OF_MONTH, -1)
                Pair(start, dateFormatter.format(cal.time))
            }
            "alltime" -> Pair("1970-01-01", endDate)
            else -> Pair(endDate, endDate)
        }
    }

    private fun addDays(date: String, delta: Int): String {
        val cal = Calendar.getInstance(Locale.US)
        cal.time = dateFormatter.parse(date) ?: Date()
        cal.add(Calendar.DAY_OF_YEAR, delta)
        return dateFormatter.format(cal.time)
    }

    private suspend fun getCurrentTotalsForDate(
        date: String,
        includeMmkvTodayFallback: Boolean,
    ): CurrentTotals {
        val repo = SessionRepository(reactApplicationContext)
        val daily = repo.getDailyTotal(date)
        val openSession = repo.getLatestOpenSessionForDate(date)

        val includeTodayFallback =
            includeMmkvTodayFallback && date == SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

        val reconciled = reconcileDayTotals(
            dailyDistanceMeters = daily?.distanceMeters ?: 0.0,
            dailyElapsedSeconds = daily?.elapsedSeconds ?: 0L,
            dailyGoalReached = daily?.goalsReached ?: false,
            openSessionDistanceMeters = openSession?.distanceMeters ?: 0.0,
            openSessionElapsedSeconds = openSession?.elapsedSeconds ?: 0L,
            openSessionGoalReached = openSession?.goalReached ?: false,
            mmkvDistanceMeters = if (includeTodayFallback) MMKVStore.getTodayDistanceSafe() else 0.0,
            mmkvElapsedSeconds = if (includeTodayFallback) MMKVStore.getTodayElapsedSafe() else 0L,
            mmkvGoalReached = if (includeTodayFallback) MMKVStore.getGoalsReachedSafe() else false,
            includeMmkvFallback = includeTodayFallback,
        )

        val sessionCount = when {
            daily != null -> daily.sessionCount
            openSession != null -> 1
            else -> 0
        }

        return CurrentTotals(
            distanceMeters = reconciled.distanceMeters,
            elapsedSeconds = reconciled.elapsedSeconds,
            goalReached = reconciled.goalReached,
            sessionCount = sessionCount,
        )
    }

    private val dateFormatter: SimpleDateFormat
        get() = SimpleDateFormat("yyyy-MM-dd", Locale.US)
}
