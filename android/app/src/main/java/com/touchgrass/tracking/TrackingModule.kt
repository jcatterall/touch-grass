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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

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
        if (bound && trackingService != null) {
            Log.d(TAG, "Already tracking, ignoring duplicate start")
            promise.resolve(true)
            return
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

            // If background idle monitoring is enabled, do NOT stop the service.
            // We only ended the active session; the service should remain alive to
            // watch for motion.
            if (MMKVStore.isIdleMonitoringEnabled()) {
                promise.resolve(true)
                return
            }

            // Give TrackingService time to publish the final IDLE state, which
            // projects canonical totals into MMKV. Stopping/unbinding immediately
            // can race that projection and cause JS to read 0.
            val context = reactApplicationContext
            mainHandler.postDelayed({
                try {
                    context.stopService(Intent(context, TrackingService::class.java))
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to stop TrackingService", e)
                }
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
            // If the JS layer calls getProgress while the service is not bound
            // (common on cold start / after background), fall back to MMKV's
            // projected "today totals" so UI can still show current progress.
            val distanceMeters = service?.distanceMeters ?: MMKVStore.getTodayDistance()
            val elapsedSeconds = service?.elapsedSeconds ?: MMKVStore.getTodayElapsed()
            val goalReached = service?.goalReached ?: MMKVStore.getGoalsReached()
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
                val result = Arguments.createMap().apply {
                    putDouble("todayDistanceMeters", MMKVStore.getTodayDistance())
                    putDouble("todayElapsedSeconds", MMKVStore.getTodayElapsed().toDouble())
                    putDouble("sessionDistanceMeters", 0.0)
                    putDouble("sessionElapsedSeconds", 0.0)
                    putBoolean("goalReached", MMKVStore.getGoalsReached())
                    putBoolean("isTracking", false)
                    putString("mode", "idle")
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
     * Returns today's accumulated distance/elapsed/goalsReached from Room.
     */
    @ReactMethod
    fun getDailyTotalNative(promise: Promise) {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val repo = SessionRepository(reactApplicationContext)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val total = repo.getDailyTotal(today)
                if (total == null) {
                    promise.resolve(null)
                } else {
                    val result = Arguments.createMap().apply {
                        putDouble("distanceMeters", total.distanceMeters)
                        putDouble("elapsedSeconds", total.elapsedSeconds.toDouble())
                        putBoolean("goalsReached", total.goalsReached)
                    }
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get daily total", e)
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

            if (!hasLocationPermission()) {
                Log.w(TAG, "startIdleService called without location permission; not starting TrackingService")
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
            MotionSessionController.reset()

            val intent = Intent(context, TrackingService::class.java).apply {
                action = TrackingConstants.ACTION_STOP_BACKGROUND
            }
            context.startService(intent)
            unbindService()

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
            if (MMKVStore.isAutoTracking() && hasLocationPermission()) {
                val intent = Intent(context, TrackingService::class.java).apply {
                    action = TrackingConstants.ACTION_GOALS_UPDATED
                }
                ContextCompat.startForegroundService(context, intent)
            }
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
            if (!isForeground) return
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to send event $eventName", e)
        }
    }

    private fun hasLocationPermission(): Boolean {
        val context = reactApplicationContext
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
        return fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED
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

        return Arguments.createMap().apply {
            putDouble("todayDistanceMeters", s.todayDistanceMeters)
            putDouble("todayElapsedSeconds", s.todayElapsedSeconds.toDouble())
            putDouble("sessionDistanceMeters", s.sessionDistanceMeters)
            putDouble("sessionElapsedSeconds", s.sessionElapsedSeconds.toDouble())
            putBoolean("goalReached", s.goalReached)
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
            todayDistanceMeters = s.todayDistanceMeters,
            todayElapsedSeconds = s.todayElapsedSeconds,
            goalReached = s.goalReached
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
}
