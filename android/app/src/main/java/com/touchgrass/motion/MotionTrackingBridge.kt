package com.touchgrass.motion

import android.content.Context
import android.util.Log

/**
 * Legacy no-op sink.
 *
 * Stage 5+ uses in-process callbacks from [MotionEngine] -> [MotionSessionController] ->
 * the sink owned by TrackingService. This bridge previously performed intent IPC into
 * TrackingService, but that protocol has been removed.
 *
 * Kept only so any old references (e.g. MotionService) continue to compile.
 */
object MotionTrackingBridge : MotionTrackingSink {

    private const val TAG = "MotionTrackingBridge"

    @Volatile
    private var appContext: Context? = null

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    /**
     * Called when MotionSessionController transitions to MOVING.
     *
     * @param activityType String name as emitted by MotionEngine:
     *   "walking", "running", "cycling", "vehicle", "still", or "unknown".
     */
    override fun onMotionStarted(activityType: String): Boolean {
        Log.d(TAG, "onMotionStarted: $activityType")
        return false
    }

    /**
     * Called when MotionSessionController transitions to STOPPED.
     *
     * @param activityType The last known activity type string.
     * @param reason       Stop reason: "inactivity_timeout", "vehicle_detected", "manual".
     */
    override fun onMotionStopped(activityType: String, reason: String) {
        Log.d(TAG, "onMotionStopped: $activityType reason=$reason")
    }

    override fun onArActivityChanged(activityType: String, isActive: Boolean) {
        Log.d(TAG, "onArActivityChanged: $activityType isActive=$isActive")
    }

    /**
     * Maps the string activity names used by MotionEngine to the integer codes
     * expected by MotionIntentParser (mirrors Google Activity Recognition API):
     *   0 = IN_VEHICLE, 1 = ON_BICYCLE, 2 = RUNNING, 3 = WALKING, 4 = STILL, -1 = UNKNOWN
     */
    private fun activityTypeToCode(type: String): Int = when (type.lowercase()) {
        "vehicle", "in_vehicle" -> 0
        "cycling", "on_bicycle" -> 1
        "running"               -> 2
        "walking"               -> 3
        "still"                 -> 4
        else                    -> -1  // UNKNOWN
    }
}
