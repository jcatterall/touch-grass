package com.touchgrass.motion

import android.content.Context
import android.content.Intent
import android.util.Log
import com.touchgrass.tracking.TrackingService

/**
 * Bridge between MotionTracker and TrackingService.
 *
 * When MotionSessionController emits state changes (MOVING/STOPPED),
 * this bridge signals TrackingService to start or stop its GPS session
 * without any JS involvement — pure native-to-native communication.
 *
 * This preserves the background operation requirement: when the app is
 * backgrounded or terminated, motion detection continues via MotionService
 * and TrackingService responds to these intent signals.
 */
object MotionTrackingBridge {

    private const val TAG = "MotionTrackingBridge"

    /** Intent action sent to TrackingService when motion starts. */
    const val ACTION_MOTION_STARTED = "com.touchgrass.action.MOTION_STARTED"

    /** Intent action sent to TrackingService when motion stops or is auto-paused long enough. */
    const val ACTION_MOTION_STOPPED = "com.touchgrass.action.MOTION_STOPPED"

    /** Extras key for the detected activity type (walking/running/cycling). */
    const val EXTRA_ACTIVITY_TYPE = "activity_type"

    /** Extras key for the stop reason (inactivity_timeout/vehicle_detected/manual). */
    const val EXTRA_STOP_REASON = "stop_reason"

    @Volatile
    private var appContext: Context? = null

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    /**
     * Called when MotionSessionController transitions to MOVING.
     * Signals TrackingService to start or continue a GPS tracking session.
     */
    fun onMotionStarted(activityType: String) {
        val ctx = appContext ?: return
        Log.d(TAG, "onMotionStarted: $activityType → signalling TrackingService")
        val intent = Intent(ctx, TrackingService::class.java).apply {
            action = ACTION_MOTION_STARTED
            putExtra(EXTRA_ACTIVITY_TYPE, activityType)
        }
        try {
            ctx.startService(intent)
        } catch (e: Exception) {
            Log.w(TAG, "Could not signal TrackingService (service may not be running)", e)
        }
    }

    /**
     * Called when MotionSessionController transitions to STOPPED.
     * Signals TrackingService to end the GPS tracking session.
     */
    fun onMotionStopped(activityType: String, reason: String) {
        val ctx = appContext ?: return
        Log.d(TAG, "onMotionStopped: $activityType reason=$reason → signalling TrackingService")
        val intent = Intent(ctx, TrackingService::class.java).apply {
            action = ACTION_MOTION_STOPPED
            putExtra(EXTRA_ACTIVITY_TYPE, activityType)
            putExtra(EXTRA_STOP_REASON, reason)
        }
        try {
            ctx.startService(intent)
        } catch (e: Exception) {
            Log.w(TAG, "Could not signal TrackingService (service may not be running)", e)
        }
    }
}
