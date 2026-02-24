package com.touchgrass.tracking

import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.Manifest
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.lifecycle.LifecycleService
import androidx.core.content.ContextCompat
import com.touchgrass.HeartbeatManager
import com.touchgrass.MMKVStore
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
 *   MotionService ──(intent)──▶ TrackingService.onStartCommand
 *                                        │
 *                              MotionIntentParser.parse()
 *                                        │
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
    }

    // ── Dependencies ──────────────────────────────────────────────────────────

    private lateinit var notificationHelper: NotificationHelper
    private lateinit var gpsManager: GpsManager
    private lateinit var controller: TrackingController
    private lateinit var repo: SessionRepository

    // Tracks the previous mode so handleStateChange can detect transitions.
    private var prevMode = TrackingMode.IDLE

    // ── State stream (RN-bridge ready) ────────────────────────────────────────

    private val _state = MutableStateFlow(TrackingState())
    val state: StateFlow<TrackingState> = _state

    // ── Listener callbacks (used by TrackingModule while bound) ───────────────

    var onProgressUpdate: ((Double, Long, Boolean) -> Unit)? = null
    var onGoalReachedCallback: (() -> Unit)? = null
    var onTrackingStoppedCallback: (() -> Unit)? = null

    // ── Notification throttle ─────────────────────────────────────────────────

    private var lastNotificationMs = 0L

    // Track whether the AppBlocker overlay is running so we can append it to the notification.
    private var blockerActive = false

    // Whether we've merged persisted daily totals into the controller state.
    private var baselineMerged = false

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

        notificationHelper = NotificationHelper(this)
        notificationHelper.ensureChannel()
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
                _state.value = newState
                handleStateChange(newState)
            }
        )

        // Merge persisted daily totals into controller state before posting foreground
        if (!baselineMerged) {
            runBlocking {
                try {
                    val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                    val daily = repo.getDailyTotal(today)
                    if (daily != null) {
                        Log.d(TAG, "Merging persisted daily totals: distance=${daily.distanceMeters} elapsed=${daily.elapsedSeconds}")
                        controller.applyBaseline(daily.distanceMeters, daily.elapsedSeconds)
                        baselineMerged = true
                    } else {
                        // Fallback to MMKV fast-path if Room has no aggregate yet.
                        val mmkvDist = MMKVStore.getTodayDistance()
                        val mmkvElapsed = MMKVStore.getTodayElapsed()
                        if (mmkvDist > 0.0 || mmkvElapsed > 0L) {
                            Log.d(TAG, "Merging MMKV baseline: distance=$mmkvDist elapsed=$mmkvElapsed")
                            controller.applyBaseline(mmkvDist, mmkvElapsed)
                            baselineMerged = true
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed merging persisted totals: ${e.message}")
                }
            }
        }

        // Must call startForeground before returning from onCreate.
        postForeground(controller.currentState())
        Log.d(TAG, "Service created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)

        when (intent?.action) {

            // ── Idle lifecycle (background tracking enabled from JS) ──────────

            TrackingConstants.ACTION_START_IDLE -> {
                Log.d(TAG, "ACTION_START_IDLE — entering idle watch mode")
                MMKVStore.setAutoTracking(false)
                HeartbeatManager.schedule(this)
                // Controller stays in IDLE; GPS stays OFF.
                return START_STICKY
            }

            TrackingConstants.ACTION_STOP_BACKGROUND -> {
                Log.d(TAG, "ACTION_STOP_BACKGROUND — stopping service")
                HeartbeatManager.cancel(this)
                stopSelf()
                return START_NOT_STICKY
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
                Log.d(TAG, "ACTION_GOALS_UPDATED — refreshing notification")
                refreshNotification()
                return START_STICKY
            }

            // ── Motion signals from MotionTrackingBridge ──────────────────────

            TrackingConstants.ACTION_MOTION_STARTED -> {
                val snapshot = MotionIntentParser.parse(intent)
                if (snapshot != null) {
                    Log.d(TAG, "MOTION_STARTED: ${snapshot.type} conf=${snapshot.confidence}")
                    controller.onMotion(snapshot)
                }
                return START_STICKY
            }

            TrackingConstants.ACTION_MOTION_STOPPED -> {
                Log.d(TAG, "MOTION_STOPPED — arming stationary buffer")
                // Parse for a specific activity type if provided; otherwise signal generic stop.
                val snapshot = MotionIntentParser.parse(intent)
                if (snapshot != null) {
                    controller.onMotion(snapshot)
                } else {
                    controller.onMotionStopped()
                }
                return START_STICKY
            }

            // ── Manual session start (from JS Play button) ────────────────────

            else -> {
                val goalType  = intent?.getStringExtra(TrackingConstants.EXTRA_GOAL_TYPE) ?: "distance"
                val goalValue = intent?.getDoubleExtra(TrackingConstants.EXTRA_GOAL_VALUE, 5000.0) ?: 5000.0
                val goalUnit  = intent?.getStringExtra(TrackingConstants.EXTRA_GOAL_UNIT) ?: "km"
                Log.d(TAG, "Manual start: type=$goalType value=$goalValue unit=$goalUnit")

                // Persist goal so the notification and getProgress() can read it.
                MMKVStore.setGoal(goalType, goalValue, goalUnit)

                controller.startManualSession()
                // Ensure fast-path readers (JS, MotionModule) observe manual
                // tracking immediately by writing the MMKV flag and elapsed.
                MMKVStore.setAutoTracking(true)
                MMKVStore.setTodayElapsed(controller.currentState().elapsedSeconds)
                Log.d(TAG, "Manual start — MMKV set: is_auto_tracking=true elapsed=${controller.currentState().elapsedSeconds}")
                HeartbeatManager.schedule(this)
                return START_STICKY
            }
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "Service destroyed")
        // Close any in-flight session so data isn't lost on process kill.
        val s = controller.currentState()
        if (s.mode == TrackingMode.TRACKING_AUTO || s.mode == TrackingMode.TRACKING_MANUAL) {
            repo.closeSession(s.distanceMeters, s.elapsedSeconds, s.goalReached)
        }
        gpsManager.stop()
        HeartbeatManager.cancel(this)
        MMKVStore.setAutoTracking(false)
        super.onDestroy()
    }

    // ── Public surface for TrackingModule ─────────────────────────────────────

    fun stopTracking() {
        controller.stopManualSession()
        HeartbeatManager.cancel(this)
    }

    val distanceMeters: Double get() = _state.value.distanceMeters
    val elapsedSeconds: Long   get() = _state.value.elapsedSeconds
    val goalReached: Boolean   get() = _state.value.goalReached

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * Called on every [TrackingState] change from the controller.
     * Responsible for:
     *  · Forwarding progress to bound TrackingModule listeners.
     *  · Throttled notification refresh.
     *  · MMKV sync so JS can read state without a bound service.
     */
    private fun handleStateChange(newState: TrackingState) {
        val nowTracking = newState.mode == TrackingMode.TRACKING_AUTO ||
                          newState.mode == TrackingMode.TRACKING_MANUAL
        val wasTracking = prevMode == TrackingMode.TRACKING_AUTO ||
                          prevMode == TrackingMode.TRACKING_MANUAL
        val wasIdle = prevMode == TrackingMode.IDLE || prevMode == TrackingMode.PAUSED_VEHICLE

        // ── Session lifecycle → Room ──────────────────────────────────────────
        if (wasIdle && nowTracking) {
            val mode = if (newState.mode == TrackingMode.TRACKING_MANUAL) "manual" else "auto"
            repo.startSession(mode)
        }
        if (wasTracking && newState.mode == TrackingMode.IDLE) {
            repo.closeSession(newState.distanceMeters, newState.elapsedSeconds, newState.goalReached)
        }

        prevMode = newState.mode

        // ── MMKV sync (fast-path for JS on foreground resume) ─────────────────
        MMKVStore.setAutoTracking(nowTracking)
        if (nowTracking) {
            // Elapsed is absolute (not a delta) so write directly rather than accumulate.
            MMKVStore.setTodayElapsed(newState.elapsedSeconds)
        }

        // Forward to bound module
        onProgressUpdate?.invoke(newState.distanceMeters, newState.elapsedSeconds, newState.goalReached)

        if (newState.goalReached) {
            MMKVStore.setGoalsReached(true)
            onGoalReachedCallback?.invoke()
        }

        if (newState.mode == TrackingMode.IDLE) {
            onTrackingStoppedCallback?.invoke()
        }

        // Throttled notification update
        val now = System.currentTimeMillis()
        if (now - lastNotificationMs >= TrackingConstants.NOTIFICATION_THROTTLE_MS || newState.goalReached) {
            lastNotificationMs = now
            refreshNotification(newState)
        }
    }

    private fun refreshNotification(s: TrackingState = _state.value) {
        // If there are no active plans and nothing to display, cancel notification
        // Always refresh the persistent notification; the builder will decide
        // whether to show progress, a "no active blocks" message, or a
        // blocked-apps count.
        val n = notificationHelper.build(s)
        getSystemService(NotificationManager::class.java).notify(TrackingConstants.NOTIFICATION_ID, n)
    }

    /** Call startForeground immediately — required before any async work. */
    private fun postForeground(s: TrackingState) {
        val notification = notificationHelper.build(s)

        // Starting a location-type foreground service without location
        // permission will crash on Android 14+ with a SecurityException.
        // If we don't currently hold runtime location permission, stop the
        // service instead of attempting to enter the foreground.
        if (!hasLocationPermission()) {
            Log.w(TAG, "Missing location permission; stopping TrackingService instead of starting foreground")
            stopSelf()
            return
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    TrackingConstants.NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                )
            } else {
                startForeground(TrackingConstants.NOTIFICATION_ID, notification)
            }
        } catch (se: SecurityException) {
            // If the platform still rejects the foreground promotion (e.g. not
            // in an eligible state), fail closed by stopping the service so the
            // app process doesn't crash.
            Log.e(TAG, "Failed to start foreground with location type; stopping self", se)
            stopSelf()
        }
    }

    private fun hasLocationPermission(): Boolean {
        // Check for either fine or coarse location permission at runtime.
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
        return fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED
    }
}
