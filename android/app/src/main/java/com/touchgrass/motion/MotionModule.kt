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
                val gpsActive = MotionSessionController.currentState == MotionState.MOVING
                val variance = MotionEngine.getVariance()
                MotionEventEmitter.emitStateUpdate(activity, stepDetected, gpsActive, variance)
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

            MotionService.start(reactApplicationContext)

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
            MotionService.stop(reactApplicationContext)
            MotionSessionController.reset()
            Log.i(TAG, "stopMonitoring() — service stopped")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "stopMonitoring() failed", e)
            promise.reject("STOP_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun isMonitoring(promise: Promise) {
        promise.resolve(MotionService.isServiceRunning() && MotionEngine.isRunning())
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

            val result = Arguments.createMap().apply {
                putString("activity", activity)
                putBoolean("stepDetected", stepDetected)
                putBoolean("gpsActive", gpsActive)
                putDouble("variance", variance.toDouble())
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
        // No-op: required for RN NativeEventEmitter
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
                map.getDouble("stepStopTimeoutMs").toLong() else 10_000L,
            varianceStopThreshold = if (map.hasKey("varianceStopThreshold"))
                map.getDouble("varianceStopThreshold").toFloat() else 0.12f,
            stopConfirmWindowMs = if (map.hasKey("stopConfirmWindowMs"))
                map.getDouble("stopConfirmWindowMs").toLong() else 10_000L,
            transitionGraceMs = if (map.hasKey("transitionGraceMs"))
                map.getDouble("transitionGraceMs").toLong() else 5_000L,
            stepStopTimeoutCyclingMs = if (map.hasKey("stepStopTimeoutCyclingMs"))
                map.getDouble("stepStopTimeoutCyclingMs").toLong() else 20_000L,
            varianceStartThreshold = if (map.hasKey("varianceStartThreshold"))
                map.getDouble("varianceStartThreshold").toFloat() else 0.30f,
        )
    }
}
