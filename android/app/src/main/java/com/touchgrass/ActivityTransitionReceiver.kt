package com.touchgrass

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

/**
 * Receives activity transition events from Google Play Services even when the app is killed.
 * Boots up the HeadlessJsTaskService to evaluate plans and start tracking if needed.
 */
class ActivityTransitionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_TRANSITION = "com.touchgrass.ACTIVITY_TRANSITION"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (!ActivityTransitionResult.hasResult(intent)) return

        val result = ActivityTransitionResult.extractResult(intent) ?: return

        for (event in result.transitionEvents) {
            val activity = when (event.activityType) {
                DetectedActivity.WALKING -> "WALKING"
                DetectedActivity.RUNNING -> "RUNNING"
                DetectedActivity.STILL -> "STILL"
                else -> continue
            }
            val transition = when (event.transitionType) {
                ActivityTransition.ACTIVITY_TRANSITION_ENTER -> "ENTER"
                ActivityTransition.ACTIVITY_TRANSITION_EXIT -> "EXIT"
                else -> continue
            }

            // Launch the headless JS task
            val serviceIntent = Intent(context, ActivityHeadlessTaskService::class.java).apply {
                val extras = Bundle().apply {
                    putString("activity", activity)
                    putString("transition", transition)
                }
                putExtras(extras)
            }

            try {
                context.startService(serviceIntent)
            } catch (e: Exception) {
                // On Android 12+, starting a background service may fail if not exempt.
                // The foreground service (TrackingService) handles this case.
            }
        }
    }
}
