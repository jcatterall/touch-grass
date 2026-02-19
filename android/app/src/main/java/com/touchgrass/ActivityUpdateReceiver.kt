package com.touchgrass

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.facebook.react.ReactApplication
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.DetectedActivity

/**
 * Receives activity recognition broadcasts from Google Play Services and routes them to
 * TrackingService via targeted intents.
 *
 * Architecture (reference-library-inspired):
 *   TrackingService is always running (in IDLE state) while background tracking is enabled.
 *   This receiver never calls startService() or startForegroundService() to launch a new
 *   service — it only signals the already-running service via startService() with an action
 *   intent, which is always permitted by Android regardless of app state or API level.
 *
 * This eliminates the Android 8+ IllegalStateException that occurs when trying to start
 * a background service from a BroadcastReceiver when the app is not in the foreground.
 */
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

    private fun findMostProbableTrackedActivity(result: ActivityRecognitionResult): DetectedActivity? {
        return result.probableActivities
            .filter { SUPPORTED_ACTIVITIES.contains(it.type) }
            .maxByOrNull { it.confidence }
    }

    private fun processActivity(context: Context, activityName: String, confidence: Int) {
        Log.i(TAG, "Confident activity detected: $activityName ($confidence%)")

        // Try to emit to a live JS instance first (app is in foreground)
        if (tryEmitToJs(context, activityName, confidence)) {
            Log.d(TAG, "Successfully emitted event to JS.")
        }

        // Always route to TrackingService if it's running — this is the primary path
        // for background tracking. The service is always running (IDLE or TRACKING) when
        // background tracking is enabled, so we can always use startService() here.
        if (isTrackingServiceRunning(context)) {
            routeToTrackingService(context, activityName)
        } else {
            Log.d(TAG, "TrackingService not running — background tracking disabled, ignoring $activityName")
        }
    }

    /**
     * Routes the detected activity to the already-running TrackingService.
     * Uses startService() with an action intent, which is always permitted when the
     * target service is already running (regardless of Android API level or app state).
     */
    private fun routeToTrackingService(context: Context, activityName: String) {
        val isAutoTracking = MMKVStore.isAutoTracking()  // true = TRACKING state, false = IDLE

        val action = when (activityName) {
            "WALKING", "RUNNING", "CYCLING" -> {
                if (isAutoTracking) {
                    // Service is already TRACKING — cancel any stationary buffer, keep GPS alive
                    Log.d(TAG, "$activityName detected while TRACKING — cancelling stationary buffer")
                    TrackingService.ACTION_MOTION_DETECTED
                } else {
                    // Service is IDLE — transition to TRACKING
                    Log.d(TAG, "$activityName detected while IDLE — starting tracking session")
                    TrackingService.ACTION_START_AUTO_TRACKING
                }
            }
            "STILL" -> {
                if (isAutoTracking) {
                    Log.d(TAG, "STILL detected while TRACKING — arming stationary buffer")
                    TrackingService.ACTION_STILL_DETECTED
                } else {
                    Log.d(TAG, "STILL detected while IDLE — no-op")
                    return
                }
            }
            "IN_VEHICLE" -> {
                // Vehicle movement: never start a new session. Speed filter in processLocation
                // handles distance pausing if the service is already TRACKING.
                Log.d(TAG, "IN_VEHICLE detected — speed filter handles this in TrackingService")
                return
            }
            else -> {
                Log.d(TAG, "Unknown activity $activityName — ignoring")
                return
            }
        }

        sendActionToTrackingService(context, action)
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

    /**
     * Returns true if TrackingService is currently running as a foreground service.
     */
    private fun isTrackingServiceRunning(context: Context): Boolean {
        val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        @Suppress("DEPRECATION") // getRunningServices is deprecated but reliable for our own service
        return manager.getRunningServices(Int.MAX_VALUE).any {
            it.service.className == TrackingService::class.java.name
        }
    }

    /**
     * Sends a targeted action intent to the already-running TrackingService.
     * This is always permitted — startService() to an already-running foreground service
     * works regardless of Android API level or app background state.
     */
    private fun sendActionToTrackingService(context: Context, action: String) {
        val intent = Intent(context, TrackingService::class.java).apply { this.action = action }
        try {
            context.startService(intent)
            Log.d(TAG, "Sent $action to TrackingService")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send $action to TrackingService", e)
        }
    }

    private fun mapActivityType(type: Int): String? = when (type) {
        DetectedActivity.WALKING, DetectedActivity.ON_FOOT -> "WALKING"
        DetectedActivity.RUNNING -> "RUNNING"
        DetectedActivity.ON_BICYCLE -> "CYCLING"
        DetectedActivity.STILL -> "STILL"
        DetectedActivity.IN_VEHICLE -> "IN_VEHICLE"
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
            DetectedActivity.STILL,
            DetectedActivity.IN_VEHICLE
        )
    }
}
