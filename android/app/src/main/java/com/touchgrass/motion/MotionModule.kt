package com.touchgrass.motion

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.touchgrass.tracking.TrackingConstants
import com.touchgrass.tracking.TrackingRuntimeState
import com.touchgrass.tracking.TrackingService
import android.content.Intent

/**
 * React Native native module exposing the motion tracking API to JavaScript.
 *
 * JS API:
 *   MotionModule.startMonitoring(config?)      → Promise<void>
 *   MotionModule.stopMonitoring()              → Promise<void>
 *   MotionModule.isMonitoring()                → Promise<boolean>
 *   MotionModule.getState()                    → Promise<{ state, activityType }>
 *   MotionModule.getDetailedMotionState()      → Promise<{ activity, stepDetected, gpsActive, variance }>
 *   MotionModule.configure(config)             → void
 *
 * Events (via NativeEventEmitter):
 *   MotionStateChanged — { state, activityType, confidence, distanceMeters, timestamp }
 *   MotionStateUpdate  — { activity, stepDetected, gpsActive, variance }
 */
@ReactModule(name = MotionModule.MODULE_NAME)
class MotionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "MotionModule"
        private const val TAG = "MotionModule"
        private const val STATE_UPDATE_INTERVAL_MS = 500L
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var stateUpdateRunnable: Runnable? = null

    override fun getName(): String = MODULE_NAME

    override fun initialize() {
        super.initialize()
        MotionEventEmitter.setReactContext(reactApplicationContext)
        startStateUpdates()
    }

    override fun invalidate() {
        super.invalidate()
        stopStateUpdates()
        MotionEventEmitter.setReactContext(null)
    }

    // ── State Update Polling ──────────────────────────────────────────────────

    private fun startStateUpdates() {
        stopStateUpdates()
        stateUpdateRunnable = object : Runnable {
            override fun run() {
                val activity = MotionSessionController.currentActivityType
                val stepDetected = MotionEngine.isStepDetectedRecently()
                // Consider GPS active when the motion state is MOVING OR when the
                // native TrackingService indicates an active session.
                val gpsActive = MotionSessionController.currentState == MotionState.MOVING || TrackingRuntimeState.isTrackingActive
                val variance = MotionEngine.getVariance()
                val cadence = MotionEngine.getCadence()
                MotionEventEmitter.emitStateUpdate(activity, stepDetected, gpsActive, variance, cadence)
                mainHandler.postDelayed(this, STATE_UPDATE_INTERVAL_MS)
            }
        }
        mainHandler.postDelayed(stateUpdateRunnable!!, STATE_UPDATE_INTERVAL_MS)
        Log.d(TAG, "State updates started (interval: ${STATE_UPDATE_INTERVAL_MS}ms)")
    }

    private fun stopStateUpdates() {
        stateUpdateRunnable?.let { mainHandler.removeCallbacks(it) }
        stateUpdateRunnable = null
    }

    // ── React Methods ─────────────────────────────────────────────────────────

    @ReactMethod
    fun startMonitoring(configMap: ReadableMap?, promise: Promise) {
        try {
            val missingPermissions = checkRequiredPermissions()
            if (missingPermissions.isNotEmpty()) {
                promise.reject(
                    "PERMISSION_DENIED",
                    "Missing permissions: ${missingPermissions.joinToString()}"
                )
                return
            }

            val config = buildConfig(configMap)
            MotionSessionController.config = config
            MotionSessionController.reset()

            // Stage 5: motion monitoring is hosted by TrackingService (single orchestrator).
            val intent = Intent(reactApplicationContext, TrackingService::class.java).apply {
                action = TrackingConstants.ACTION_START_IDLE
            }
            ContextCompat.startForegroundService(reactApplicationContext, intent)

            Log.i(TAG, "startMonitoring() — service started")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "startMonitoring() failed", e)
            promise.reject("START_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun stopMonitoring(promise: Promise) {
        try {
            MotionSessionController.reset()
            val intent = Intent(reactApplicationContext, TrackingService::class.java).apply {
                action = TrackingConstants.ACTION_STOP_BACKGROUND
            }
            reactApplicationContext.startService(intent)
            Log.i(TAG, "stopMonitoring() — service stopped")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "stopMonitoring() failed", e)
            promise.reject("STOP_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun isMonitoring(promise: Promise) {
        promise.resolve(MotionEngine.isRunning())
    }

    @ReactMethod
    fun getState(promise: Promise) {
        val state = MotionSessionController.currentState.name
        val type = MotionSessionController.currentActivityType
        val result = Arguments.createMap().apply {
            putString("state", state)
            putString("activityType", type)
        }
        promise.resolve(result)
    }

    @ReactMethod
    fun getDetailedMotionState(promise: Promise) {
        try {
            val activity = MotionSessionController.currentActivityType
            val stepDetected = MotionEngine.isStepDetectedRecently()
            val gpsActive = MotionSessionController.currentState == MotionState.MOVING
            val variance = MotionEngine.getVariance()
            val cadence = MotionEngine.getCadence()

            val result = Arguments.createMap().apply {
                putString("activity", activity)
                putBoolean("stepDetected", stepDetected)
                putBoolean("gpsActive", gpsActive)
                putDouble("variance", variance.toDouble())
                putDouble("cadence", cadence.toDouble())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "getDetailedMotionState() failed", e)
            promise.reject("GET_DETAILED_STATE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun configure(configMap: ReadableMap) {
        val config = buildConfig(configMap)
        MotionSessionController.config = config
        Log.i(TAG, "Configuration updated")
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // When subscribing to MotionStateChanged, immediately replay current state so the
        // subscriber doesn't miss state that existed before it subscribed.
        if (eventName == MotionEventEmitter.EVENT_STATE_CHANGED) {
            val state = MotionSessionController.currentState
            val activityType = MotionSessionController.currentActivityType
            mainHandler.post {
                MotionEventEmitter.emitStateChanged(
                    state = state,
                    activityType = activityType,
                    confidence = 1.0f,
                    distanceMeters = 0.0,
                    timestamp = System.currentTimeMillis(),
                    lastKnownActivity = MotionSessionController.lastKnownRealActivityType,
                    trackingSignalled = false
                )
                Log.d(TAG, "State replay on subscribe: $state ($activityType)")
            }
        }
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // No-op: required for RN NativeEventEmitter
    }

    // ── Permissions ───────────────────────────────────────────────────────────

    private fun checkRequiredPermissions(): List<String> {
        val missing = mutableListOf<String>()
        val ctx = reactApplicationContext

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION)
                != PackageManager.PERMISSION_GRANTED
            ) {
                missing.add(Manifest.permission.ACTIVITY_RECOGNITION)
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                missing.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        return missing
    }

    // ── Config Builder ────────────────────────────────────────────────────────

    private fun buildConfig(map: ReadableMap?): MotionConfig {
        if (map == null) return MotionConfig()

        return MotionConfig(
            movementConfirmWindowMs = if (map.hasKey("movementConfirmWindowMs"))
                map.getDouble("movementConfirmWindowMs").toLong() else 4_000L,
            movementConfidenceThreshold = if (map.hasKey("movementConfidenceThreshold"))
                map.getDouble("movementConfidenceThreshold").toFloat() else 0.30f,
            stepStopTimeoutMs = if (map.hasKey("stepStopTimeoutMs"))
                map.getDouble("stepStopTimeoutMs").toLong() else 7_000L,
            varianceStopThreshold = if (map.hasKey("varianceStopThreshold"))
                map.getDouble("varianceStopThreshold").toFloat() else 0.12f,
            stopConfirmWindowMs = if (map.hasKey("stopConfirmWindowMs"))
                map.getDouble("stopConfirmWindowMs").toLong() else 9_000L,
            transitionGraceMs = if (map.hasKey("transitionGraceMs"))
                map.getDouble("transitionGraceMs").toLong() else 3_500L,
            stepStopTimeoutCyclingMs = if (map.hasKey("stepStopTimeoutCyclingMs"))
                map.getDouble("stepStopTimeoutCyclingMs").toLong() else 20_000L,
            varianceStartThreshold = if (map.hasKey("varianceStartThreshold"))
                map.getDouble("varianceStartThreshold").toFloat() else 0.18f,
            varianceStartDebounceMs = if (map.hasKey("varianceStartDebounceMs"))
                map.getDouble("varianceStartDebounceMs").toLong() else 500L,
            corroborationMinSignals = if (map.hasKey("corroborationMinSignals"))
                map.getInt("corroborationMinSignals") else 2,
            corroborationWindowMs = if (map.hasKey("corroborationWindowMs"))
                map.getDouble("corroborationWindowMs").toLong() else 3_000L,
            cadenceConfirmMinStepsSec = if (map.hasKey("cadenceConfirmMinStepsSec"))
                map.getDouble("cadenceConfirmMinStepsSec").toFloat() else 0.8f,
            cadenceMeasureWindowMs = if (map.hasKey("cadenceMeasureWindowMs"))
                map.getDouble("cadenceMeasureWindowMs").toLong() else 5_000L,
            stationaryLockVariance = if (map.hasKey("stationaryLockVariance"))
                map.getDouble("stationaryLockVariance").toFloat() else 0.08f,
            stationaryLockDurationMs = if (map.hasKey("stationaryLockDurationMs"))
                map.getDouble("stationaryLockDurationMs").toLong() else 30_000L,
            stationaryUnlockVariance = if (map.hasKey("stationaryUnlockVariance"))
                map.getDouble("stationaryUnlockVariance").toFloat() else 0.35f,
            cadenceDropThreshold = if (map.hasKey("cadenceDropThreshold"))
                map.getDouble("cadenceDropThreshold").toFloat() else 0.3f,
            cadenceDropDurationMs = if (map.hasKey("cadenceDropDurationMs"))
                map.getDouble("cadenceDropDurationMs").toLong() else 5_000L,
            microMovementVarianceGuard = if (map.hasKey("microMovementVarianceGuard"))
                map.getDouble("microMovementVarianceGuard").toFloat() else 0.20f,
        )
    }
}
