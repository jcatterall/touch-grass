package com.touchgrass.motion

import android.content.Context
import android.content.Intent
import android.util.Log
import com.touchgrass.tracking.TrackingConstants
import com.touchgrass.tracking.TrackingService

/**
 * Native-to-native bridge between MotionService and TrackingService.
 *
 * When MotionSessionController transitions to MOVING, [onMotionStarted] fires an
 * ACTION_MOTION_STARTED intent at TrackingService, carrying the activity type as
 * an integer extra (matching the encoding in MotionIntentParser):
 *   0 = IN_VEHICLE, 1 = ON_BICYCLE, 2 = RUNNING, 3 = WALKING, 4 = STILL
 *
 * When motion stops, [onMotionStopped] fires ACTION_MOTION_STOPPED.
 * TrackingService's new controller handles both signals deterministically.
 *
 * No JS involvement — all signalling is pure Kotlin IPC.
 */
object MotionTrackingBridge {

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
    fun onMotionStarted(activityType: String) {
        val ctx = appContext ?: return
        Log.d(TAG, "onMotionStarted: $activityType")

        val typeCode = activityTypeToCode(activityType)
        val intent = Intent(ctx, TrackingService::class.java).apply {
            action = TrackingConstants.ACTION_MOTION_STARTED
            putExtra(TrackingConstants.EXTRA_ACTIVITY_TYPE, typeCode)
            putExtra(TrackingConstants.EXTRA_ACTIVITY_CONFIDENCE, 80) // MotionEngine confirmed
            putExtra(TrackingConstants.EXTRA_ACTIVITY_TIMESTAMP, System.currentTimeMillis())
        }
        try {
            ctx.startService(intent)
        } catch (e: Exception) {
            Log.w(TAG, "Could not signal TrackingService (may not be running)", e)
        }
    }

    /**
     * Called when MotionSessionController transitions to STOPPED.
     *
     * @param activityType The last known activity type string.
     * @param reason       Stop reason: "inactivity_timeout", "vehicle_detected", "manual".
     */
    fun onMotionStopped(activityType: String, reason: String) {
        val ctx = appContext ?: return
        Log.d(TAG, "onMotionStopped: $activityType reason=$reason")

        // Map reason to a STILL signal so TrackingController ends the session cleanly.
        val typeCode = if (reason == "vehicle_detected") {
            activityTypeToCode("vehicle")
        } else {
            activityTypeToCode(activityType)
        }

        val intent = Intent(ctx, TrackingService::class.java).apply {
            action = TrackingConstants.ACTION_MOTION_STOPPED
            putExtra(TrackingConstants.EXTRA_ACTIVITY_TYPE, typeCode)
            putExtra(TrackingConstants.EXTRA_ACTIVITY_CONFIDENCE, 80)
            putExtra(TrackingConstants.EXTRA_ACTIVITY_TIMESTAMP, System.currentTimeMillis())
        }
        try {
            ctx.startService(intent)
        } catch (e: Exception) {
            Log.w(TAG, "Could not signal TrackingService (may not be running)", e)
        }
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
