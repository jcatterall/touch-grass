package com.touchgrass.motion

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Bridges motion tracking events to React Native via RCTDeviceEventEmitter.
 *
 * Primary event:
 *   MotionStateChanged — emitted on every state transition with full payload:
 *     { state, activityType, confidence, distanceMeters, timestamp }
 *
 * Debug/polling event:
 *   MotionStateUpdate  — emitted every ~500ms with live sensor readings:
 *     { activity, stepDetected, gpsActive, variance }
 *
 * Thread-safety: all emit calls check for an active catalyst instance before dispatching.
 */
object MotionEventEmitter {

    private const val TAG = "MotionEventEmitter"

    /** Emitted on every state machine transition. Single source of truth for React Native. */
    const val EVENT_STATE_CHANGED = "MotionStateChanged"

    /** Emitted periodically for live debug UI updates. */
    const val EVENT_STATE_UPDATE = "MotionStateUpdate"

    /** All events this emitter supports (used by MotionModule for addListener bookkeeping). */
    val ALL_EVENTS = listOf(EVENT_STATE_CHANGED, EVENT_STATE_UPDATE)

    @Volatile
    private var reactContext: ReactApplicationContext? = null

    /**
     * Must be called from MotionModule.initialize() to provide the bridge context.
     */
    fun setReactContext(ctx: ReactApplicationContext?) {
        reactContext = ctx
    }

    // ── Public emit methods ───────────────────────────────────────────────────

    /**
     * Emits a MotionStateChanged event on every state transition.
     *
     * @param state         New MotionState enum value.
     * @param activityType  Current activity string ("walking", "running", "cycling", "unknown").
     * @param confidence    Movement confidence score [0.0, 1.0].
     * @param distanceMeters Distance accumulated in the current session.
     * @param timestamp     Epoch millis when the transition occurred.
     */
    fun emitStateChanged(
        state: MotionState,
        activityType: String,
        confidence: Float,
        distanceMeters: Double,
        timestamp: Long,
        lastKnownActivity: String,
        trackingSignalled: Boolean,
        trackingBlockedReason: String?
    ) {
        val params = Arguments.createMap().apply {
            putString("state", state.name)
            putString("activityType", activityType)
            putDouble("confidence", confidence.toDouble())
            putDouble("distanceMeters", distanceMeters)
            putDouble("timestamp", timestamp.toDouble())
            putString("lastKnownActivity", lastKnownActivity)
            putBoolean("trackingSignalled", trackingSignalled)
            if (trackingBlockedReason == null) {
                putNull("trackingBlockedReason")
            } else {
                putString("trackingBlockedReason", trackingBlockedReason)
            }
        }
        emit(EVENT_STATE_CHANGED, params)
    }

    /**
     * Emits a periodic debug update with live sensor readings.
     *
     * @param activity      Current activity type string.
     * @param stepDetected  Whether a step was detected recently.
     * @param gpsActive     Whether GPS tracking is currently active.
     * @param variance      Current accelerometer variance.
     * @param cadence       Current cadence in steps/sec.
     */
    fun emitStateUpdate(
        activity: String,
        stepDetected: Boolean,
        gpsActive: Boolean,
        variance: Float = 0f,
        cadence: Float = 0f
    ) {
        val params = Arguments.createMap().apply {
            putString("activity", activity)
            putBoolean("stepDetected", stepDetected)
            putBoolean("gpsActive", gpsActive)
            putDouble("variance", variance.toDouble())
            putDouble("cadence", cadence.toDouble())
        }
        emit(EVENT_STATE_UPDATE, params)
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private fun emit(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        val ctx = reactContext
        if (ctx == null || !ctx.hasActiveReactInstance()) {
            Log.w(TAG, "Cannot emit $eventName — no active React instance")
            return
        }

        try {
            Log.d(TAG, "Emitting $eventName")
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to emit $eventName", e)
        }
    }
}
