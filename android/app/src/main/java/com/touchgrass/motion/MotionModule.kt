package com.touchgrass.motion

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
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
 *   MotionModule.startMonitoring(config?)  → Promise<void>
 *   MotionModule.stopMonitoring()          → Promise<void>
 *   MotionModule.isMonitoring()            → Promise<boolean>
 *   MotionModule.getState()                → Promise<{ state: string, activityType: string }>
 *   MotionModule.configure(config)         → void
 *
 * Events (via NativeEventEmitter):
 *   MotionStarted, MotionAutoPaused, MotionResumed, MotionStopped
 */
@ReactModule(name = MotionModule.MODULE_NAME)
class MotionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "MotionModule"
        private const val TAG = "MotionModule"
    }

    override fun getName(): String = MODULE_NAME

    override fun initialize() {
        super.initialize()
        MotionEventEmitter.setReactContext(reactApplicationContext)
    }

    override fun invalidate() {
        super.invalidate()
        MotionEventEmitter.setReactContext(null)
    }

    // ── React Methods ───────────────────────────────────────────

    /**
     * Starts the motion tracking foreground service and sensor engine.
     *
     * @param configMap Optional JS object with configuration overrides.
     * @param promise Resolves when the service is started, or rejects if
     *   required permissions are missing.
     */
    @ReactMethod
    fun startMonitoring(configMap: ReadableMap?, promise: Promise) {
        try {
            // Check permissions
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

            // Start foreground service (which starts MotionEngine)
            MotionService.start(reactApplicationContext)

            Log.i(TAG, "startMonitoring() — service started")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "startMonitoring() failed", e)
            promise.reject("START_FAILED", e.message, e)
        }
    }

    /**
     * Stops the motion tracking service and all sensors.
     */
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

    /**
     * Returns whether the motion tracking service is currently active.
     */
    @ReactMethod
    fun isMonitoring(promise: Promise) {
        promise.resolve(MotionService.isServiceRunning() && MotionEngine.isRunning())
    }

    /**
     * Returns the current motion state as a string.
     */
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

    /**
     * Updates the configuration without restarting the service.
     */
    @ReactMethod
    fun configure(configMap: ReadableMap) {
        val config = buildConfig(configMap)
        MotionSessionController.config = config
        Log.i(TAG, "Configuration updated")
    }

    /**
     * Required for NativeEventEmitter to register listeners without warning.
     */
    @ReactMethod
    fun addListener(eventName: String) {
        // No-op: required for RN event emitter
    }

    /**
     * Required for NativeEventEmitter to remove listeners without warning.
     */
    @ReactMethod
    fun removeListeners(count: Int) {
        // No-op: required for RN event emitter
    }

    // ── Permissions ─────────────────────────────────────────────

    private fun checkRequiredPermissions(): List<String> {
        val missing = mutableListOf<String>()
        val ctx = reactApplicationContext

        // Activity Recognition (Android 10+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION)
                != PackageManager.PERMISSION_GRANTED
            ) {
                missing.add(Manifest.permission.ACTIVITY_RECOGNITION)
            }
        }

        // POST_NOTIFICATIONS (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                missing.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        return missing
    }

    // ── Config Builder ──────────────────────────────────────────

    private fun buildConfig(map: ReadableMap?): MotionConfig {
        if (map == null) return MotionConfig()

        return MotionConfig(
            autoPauseDelayWalkRun = if (map.hasKey("autoPauseDelayWalkRun"))
                map.getDouble("autoPauseDelayWalkRun").toLong() else 5_000L,
            autoPauseDelayCycling = if (map.hasKey("autoPauseDelayCycling"))
                map.getDouble("autoPauseDelayCycling").toLong() else 12_000L,
            stopDelay = if (map.hasKey("stopDelay"))
                map.getDouble("stopDelay").toLong() else 20_000L,
            movementConfidenceThreshold = if (map.hasKey("movementConfidenceThreshold"))
                map.getDouble("movementConfidenceThreshold").toFloat() else 0.6f,
            varianceThreshold = if (map.hasKey("varianceThreshold"))
                map.getDouble("varianceThreshold").toFloat() else 0.3f
        )
    }
}
