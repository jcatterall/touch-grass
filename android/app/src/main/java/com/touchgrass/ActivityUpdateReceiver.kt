package com.touchgrass

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactApplication
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.DetectedActivity

class ActivityUpdateReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val testActivityType = intent.getStringExtra(EXTRA_TEST_ACTIVITY_TYPE)
        if (testActivityType != null) {
            handleTestActivity(context, testActivityType)
        } else {
            handleRealActivity(context, intent)
        }
    }

    private fun handleTestActivity(context: Context, activityType: String) {
        Log.i(TAG, "Handling test activity: $activityType")
        val mappedActivity = mapActivityType(parseTestActivityType(activityType)) ?: return
        processActivity(context, mappedActivity, 100)
    }

    private fun handleRealActivity(context: Context, intent: Intent) {
        if (!ActivityRecognitionResult.hasResult(intent)) {
            Log.d(TAG, "Received real intent with no activity recognition result.")
            return
        }

        val result = ActivityRecognitionResult.extractResult(intent) ?: return
        logAllActivities(result)

        val mostProbableActivity = findMostProbableTrackedActivity(result)

        if (mostProbableActivity == null || mostProbableActivity.confidence < MIN_CONFIDENCE) {
            val best = mostProbableActivity?.let { "${getActivityName(it.type)} at ${it.confidence}%" } ?: "none"
            Log.d(TAG, "No confident activity detected. Best candidate: $best")
            return
        }

        val activityName = mapActivityType(mostProbableActivity.type) ?: return
        processActivity(context, activityName, mostProbableActivity.confidence)
    }

    private fun processActivity(context: Context, activityName: String, confidence: Int) {
        Log.i(TAG, "Confident activity detected: $activityName ($confidence%)")
        if (tryEmitToJs(context, activityName, confidence)) {
            Log.d(TAG, "Successfully emitted event to JS.")
        } else {
            Log.d(TAG, "React instance not active. Attempting to launch headless task.")
            maybeStartHeadlessTask(context, activityName)
        }
    }

    private fun findMostProbableTrackedActivity(result: ActivityRecognitionResult): DetectedActivity? {
        return result.probableActivities
            .filter { SUPPORTED_ACTIVITIES.contains(it.type) }
            .maxByOrNull { it.confidence }
    }

    private fun tryEmitToJs(context: Context, activity: String, confidence: Int): Boolean {
        try {
            val application = context.applicationContext as? ReactApplication ?: return false
            val reactHost = application.reactHost ?: return false
            val reactContext = reactHost.currentReactContext ?: return false

            if (!reactContext.hasActiveReactInstance()) {
                return false
            }

            reactContext.getNativeModule(ActivityRecognitionModule::class.java)?.emitActivityToJs(activity, confidence)
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to emit activity event to JS", e)
            return false
        }
    }

    private fun maybeStartHeadlessTask(context: Context, activityName: String) {
        if (activityName == "STILL") {
            Log.d(TAG, "Skipping headless task for STILL activity.")
            return
        }

        Log.d(TAG, "Launching headless task for $activityName")
        val serviceIntent = Intent(context, ActivityHeadlessTaskService::class.java).apply {
            val extras = Bundle().apply {
                putString("activity", activityName)
                putString("transition", "ENTER")
            }
            putExtras(extras)
        }

        try {
            context.startService(serviceIntent)
        } catch (e: IllegalStateException) {
            Log.e(TAG, "Failed to start headless task service. App may be restricted.", e)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start headless task service", e)
        }
    }

    private fun mapActivityType(type: Int): String? = when (type) {
        DetectedActivity.WALKING, DetectedActivity.ON_FOOT -> "WALKING"
        DetectedActivity.RUNNING -> "RUNNING"
        DetectedActivity.ON_BICYCLE -> "CYCLING"
        DetectedActivity.STILL -> "STILL"
        else -> null
    }
    
    private fun parseTestActivityType(type: String): Int = when (type) {
        "WALKING" -> DetectedActivity.WALKING
        "RUNNING" -> DetectedActivity.RUNNING
        "CYCLING" -> DetectedActivity.ON_BICYCLE
        "STILL" -> DetectedActivity.STILL
        "IN_VEHICLE" -> DetectedActivity.IN_VEHICLE
        else -> DetectedActivity.UNKNOWN
    }

    private fun logAllActivities(result: ActivityRecognitionResult) {
        if (!BuildConfig.DEBUG) return
        val activities = result.probableActivities.joinToString {
            "${getActivityName(it.type)}: ${it.confidence}%"
        }
        Log.d(TAG, "Detected activities: [$activities]")
    }

    private fun getActivityName(type: Int): String = when (type) {
        DetectedActivity.IN_VEHICLE -> "IN_VEHICLE"
        DetectedActivity.ON_BICYCLE -> "ON_BICYCLE"
        DetectedActivity.ON_FOOT -> "ON_FOOT"
        DetectedActivity.RUNNING -> "RUNNING"
        DetectedActivity.STILL -> "STILL"
        DetectedActivity.TILTING -> "TILTING"
        DetectedActivity.WALKING -> "WALKING"
        DetectedActivity.UNKNOWN -> "UNKNOWN"
        else -> "UNIDENTIFIABLE"
    }

    companion object {
        private const val TAG = "ActivityUpdateReceiver"
        const val ACTION_ACTIVITY_UPDATE = "com.touchgrass.ACTIVITY_UPDATE"
        const val EXTRA_TEST_ACTIVITY_TYPE = "com.touchgrass.TEST_ACTIVITY_TYPE"
        private const val MIN_CONFIDENCE = 50

        private val SUPPORTED_ACTIVITIES = setOf(
            DetectedActivity.WALKING,
            DetectedActivity.RUNNING,
            DetectedActivity.ON_BICYCLE,
            DetectedActivity.ON_FOOT,
            DetectedActivity.STILL
        )
    }
}
