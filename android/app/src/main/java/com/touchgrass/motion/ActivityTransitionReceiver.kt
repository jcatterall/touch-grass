package com.touchgrass.motion

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.ActivityTransitionResult
import com.touchgrass.MMKVStore
import com.touchgrass.tracking.TrackingConstants
import com.touchgrass.tracking.TrackingService

/**
 * BroadcastReceiver for Activity Recognition Transition API callbacks.
 *
 * Must be declared in AndroidManifest.xml with android:exported="true"
 * (required for PendingIntent delivery on Android 12+).
 *
 * This receiver is invoked by the system even when the app is in the
 * background, as long as the foreground service is running.
 */
class ActivityTransitionReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "ActivityTransition"
    }

    override fun onReceive(context: Context, intent: Intent) {
        try {
            MMKVStore.init(context.applicationContext)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to init MMKV in receiver", e)
        }

        if (!ActivityTransitionResult.hasResult(intent)) {
            Log.w(TAG, "Received intent without ActivityTransitionResult")
            return
        }

        val result = ActivityTransitionResult.extractResult(intent) ?: return
        val idleMonitoringEnabled = MMKVStore.isIdleMonitoringEnabled()
        val motionRunning = MotionEngine.isRunning()

        for (event in result.transitionEvents) {
            val isEntering = event.transitionType == com.google.android.gms.location.ActivityTransition.ACTIVITY_TRANSITION_ENTER
            val typeName = activityTypeName(event.activityType)

            Log.d(TAG, "Transition: $typeName ${if (isEntering) "ENTER" else "EXIT"}")

            if (idleMonitoringEnabled) {
                val bootstrapIntent = Intent(context, TrackingService::class.java).apply {
                    action = TrackingConstants.ACTION_AR_TRANSITION_REPLAY
                    putExtra(TrackingConstants.EXTRA_AR_ACTIVITY_TYPE, event.activityType)
                    putExtra(TrackingConstants.EXTRA_AR_IS_ENTERING, isEntering)
                    putExtra(TrackingConstants.EXTRA_AR_EVENT_TIME_NANOS, event.elapsedRealTimeNanos)
                }
                try {
                    ContextCompat.startForegroundService(context, bootstrapIntent)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed bootstrapping TrackingService from AR transition", e)
                }
            }

            if (motionRunning) {
                MotionEngine.onActivityTransitionDetected(
                    type = event.activityType,
                    isEntering = isEntering
                )
                if (event.elapsedRealTimeNanos > 0L) {
                    MMKVStore.setLastArReplayEventNanos(event.elapsedRealTimeNanos)
                }
            } else {
                Log.d(TAG, "MotionEngine not running; transition deferred to service replay")
            }
        }
    }

    private fun activityTypeName(type: Int): String = when (type) {
        com.google.android.gms.location.DetectedActivity.WALKING -> "WALKING"
        com.google.android.gms.location.DetectedActivity.RUNNING -> "RUNNING"
        com.google.android.gms.location.DetectedActivity.ON_BICYCLE -> "ON_BICYCLE"
        com.google.android.gms.location.DetectedActivity.IN_VEHICLE -> "IN_VEHICLE"
        com.google.android.gms.location.DetectedActivity.STILL -> "STILL"
        else -> "UNKNOWN($type)"
    }
}
