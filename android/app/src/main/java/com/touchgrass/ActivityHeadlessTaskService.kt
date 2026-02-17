package com.touchgrass

import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * A service that runs a JavaScript task in the background.
 *
 * This is invoked by [ActivityUpdateReceiver] when a significant motion activity
 * is detected and the main React Native application is not in the foreground.
 * The service is responsible for starting the app in the background and passing
 * the activity data to a predefined JavaScript task.
 */
class ActivityHeadlessTaskService : HeadlessJsTaskService() {

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras ?: return null
        Log.d(TAG, "getTaskConfig called with activity: ${extras.getString("activity")}")

        // This task name must match the name registered in JS with AppRegistry.registerHeadlessTask
        return HeadlessJsTaskConfig(
            "TouchGrassActivityTask", // Correct task name
            Arguments.fromBundle(extras), // Data to pass to the JS task
            5000, // Timeout for the task in milliseconds
            true // Optional: Allow the task to run in the foreground
        )
    }

    companion object {
        private const val TAG = "ActivityHeadlessTask"
    }
}
