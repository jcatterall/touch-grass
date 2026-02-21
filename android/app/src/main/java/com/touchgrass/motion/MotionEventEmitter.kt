package com.touchgrass.motion

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Bridges motion tracking events to React Native via RCTDeviceEventEmitter.
 *
 * Events emitted:
 *   MotionStarted       — { activityType: string }
 *   MotionAutoPaused    — { activityType: string }
 *   MotionResumed       — { activityType: string }
 *   MotionStopped       — { activityType: string, reason: string }
 *   MotionStateUpdate   — { activity: string, stepDetected: boolean, gpsActive: boolean }
 *
 * Thread-safety: All emit calls use reactContext safely. The emitter
 * checks for an active catalyst instance before dispatching.
 */
object MotionEventEmitter {

    private const val TAG = "MotionEventEmitter"

    // Event names — must match the JS-side NativeEventEmitter subscription keys
    const val EVENT_STARTED = "MotionStarted"
    const val EVENT_AUTO_PAUSED = "MotionAutoPaused"
    const val EVENT_RESUMED = "MotionResumed"
    const val EVENT_STOPPED = "MotionStopped"
    const val EVENT_STATE_UPDATE = "MotionStateUpdate"

    /** All event names this emitter supports (used by MotionModule). */
    val ALL_EVENTS = listOf(EVENT_STARTED, EVENT_AUTO_PAUSED, EVENT_RESUMED, EVENT_STOPPED, EVENT_STATE_UPDATE)

    @Volatile
    private var reactContext: ReactApplicationContext? = null

    /**
     * Must be called from MotionModule.initialize() to provide the bridge context.
     */
    fun setReactContext(ctx: ReactApplicationContext?) {
        reactContext = ctx
    }

    // ─────────────────────────────────────────────
    // Public emit methods
    // ─────────────────────────────────────────────

    fun emitStarted(activityType: String) {
        val params = Arguments.createMap().apply {
            putString("activityType", activityType)
        }
        emit(EVENT_STARTED, params)
    }

    fun emitAutoPaused(activityType: String) {
        val params = Arguments.createMap().apply {
            putString("activityType", activityType)
        }
        emit(EVENT_AUTO_PAUSED, params)
    }

    fun emitResumed(activityType: String) {
        val params = Arguments.createMap().apply {
            putString("activityType", activityType)
        }
        emit(EVENT_RESUMED, params)
    }

    fun emitStopped(activityType: String, reason: String) {
        val params = Arguments.createMap().apply {
            putString("activityType", activityType)
            putString("reason", reason)
        }
        emit(EVENT_STOPPED, params)
    }

    fun emitStateUpdate(activity: String, stepDetected: Boolean, gpsActive: Boolean) {
        val params = Arguments.createMap().apply {
            putString("activity", activity)
            putBoolean("stepDetected", stepDetected)
            putBoolean("gpsActive", gpsActive)
        }
        emit(EVENT_STATE_UPDATE, params)
    }

    // ─────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────

    private fun emit(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        val ctx = reactContext
        if (ctx == null || !ctx.hasActiveReactInstance()) {
            Log.w(TAG, "Cannot emit $eventName — no active React instance")
            return
        }

        try {
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
            Log.d(TAG, "Emitted $eventName: $params")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to emit $eventName", e)
        }
    }
}
