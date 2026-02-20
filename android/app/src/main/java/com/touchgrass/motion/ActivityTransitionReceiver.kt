package com.touchgrass.motion

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.ActivityTransitionResult

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
        if (!ActivityTransitionResult.hasResult(intent)) {
            Log.w(TAG, "Received intent without ActivityTransitionResult")
            return
        }

        val result = ActivityTransitionResult.extractResult(intent) ?: return

        for (event in result.transitionEvents) {
            val isEntering = event.transitionType == com.google.android.gms.location.ActivityTransition.ACTIVITY_TRANSITION_ENTER
            val typeName = activityTypeName(event.activityType)

            Log.d(TAG, "Transition: $typeName ${if (isEntering) "ENTER" else "EXIT"}")

            MotionEngine.onActivityTransitionDetected(
                type = event.activityType,
                isEntering = isEntering
            )
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
